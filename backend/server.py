from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import HTMLResponse, Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
import uuid
import jwt
import random
import stripe
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from datetime import datetime, timezone, timedelta, date
from emergentintegrations.llm.chat import LlmChat, UserMessage
from email_service import send_order_receipt
from storage_service import put_object, get_object, init_storage, APP_NAME


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Konphlux API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("konphlux")

# ----------------------------- Auth / LLM config -----------------------------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CHAT_MODEL = ("openai", "gpt-5.4")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
CURRENCY = "usd"

password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES)}
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        user_id = payload["sub"]
    except (InvalidTokenError, KeyError, TypeError):
        raise _unauthorized()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise _unauthorized()
    return user


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user["display_name"],
        "handle": user["handle"],
    }


# ----------------------------- Models -----------------------------
class PostCreate(BaseModel):
    body: str


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=60)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SaveBody(BaseModel):
    kind: str  # "post" | "listing" | "district"
    item_id: str


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class CommunityCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: str = Field(min_length=1, max_length=280)
    icon: str = "forum"


class ThreadCreate(BaseModel):
    community_id: str
    title: str = Field(min_length=2, max_length=140)
    body: str = Field(min_length=1, max_length=4000)


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CartAdd(BaseModel):
    item_id: str
    qty: int = Field(default=1, ge=1, le=99)


class CartSet(BaseModel):
    qty: int = Field(ge=0, le=99)


class CheckoutBody(BaseModel):
    return_base: str


class QuestionCreate(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    body: str = Field(default="", max_length=4000)
    category: str = Field(default="General", max_length=40)


class AnswerCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class BestAnswerBody(BaseModel):
    answer_id: str


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    category: str = Field(min_length=1, max_length=40)
    image: str = Field(min_length=1, max_length=600)
    kind: str = "fixed"  # "fixed" | "auction"
    price_cents: int | None = Field(default=None, ge=100, le=100_000_000)
    starting_price_cents: int | None = Field(default=None, ge=100, le=100_000_000)
    duration_hours: int | None = Field(default=None, ge=1, le=168)
    booth_id: str | None = None  # None => individual item; else part of a booth


class BoothCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=600)
    image: str = Field(default="", max_length=600)


class BidBody(BaseModel):
    amount_cents: int = Field(ge=100, le=100_000_000)


class DatingProfileBody(BaseModel):
    gender: str = Field(min_length=1, max_length=20)  # man | woman | nonbinary
    seeking: list[str] = Field(default_factory=lambda: ["man", "woman"])
    bio: str = Field(default="", max_length=600)
    tagline: str = Field(default="", max_length=120)
    photo: str = Field(default="", max_length=600)
    age: int | None = Field(default=None, ge=18, le=120)


class SwipeBody(BaseModel):
    target_id: str
    action: str  # like | pass


class AnvilWorkCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    kind: str = "story"  # story | script
    category: str = Field(default="General", max_length=40)
    body: str = Field(min_length=1, max_length=20000)
    open_cowriting: bool = False


class ContributionBody(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


class AssistBody(BaseModel):
    mode: str = "continue"  # continue | idea | improve
    title: str = Field(default="", max_length=160)
    kind: str = "story"
    text: str = Field(default="", max_length=8000)


class AdventureBody(BaseModel):
    history: list[dict] = Field(default_factory=list)
    action: str = Field(min_length=1, max_length=2000)


class GenoBody(BaseModel):
    tool: str = "story"  # story | script | prompt
    topic: str = Field(min_length=1, max_length=800)
    tone: str = Field(default="", max_length=40)
    genre: str = Field(default="", max_length=40)
    length: str = Field(default="short", max_length=20)  # short | medium


class PromptCreate(BaseModel):
    text: str = Field(min_length=8, max_length=400)


class BBProgressBody(BaseModel):
    lesson_index: int = Field(ge=0, le=200)
    completed: bool = True


class BBQuizSubmit(BaseModel):
    answers: list[int] = Field(default_factory=list)


class BBLexiconBody(BaseModel):
    word: str = Field(min_length=1, max_length=60)
    mode: str = "dictionary"  # dictionary | thesaurus


class BBRepairBody(BaseModel):
    problem: str = Field(min_length=3, max_length=1200)


# ----------------------------- Seed data -----------------------------
DISTRICTS = [
    {"slug": "home", "name": "Home", "icon": "home-city",
     "tagline": "The great social commons of Konphlux.",
     "description": "The main square: your feed of friends, communities, businesses, creators and followed pages.",
     "chatmonger": {"name": "Atlas", "role": "Konphlux Concierge", "greeting": "Welcome home. Shall I show you what your circle has been building today?"},
     "features": ["News Feed", "Posts & Comments", "Reactions & Sharing", "Photo Albums", "Stories", "Groups", "Events", "Pages", "Marketplace shortcuts", "Trending topics", "Friend suggestions", "Messaging shortcuts", "Profile pages"]},
    {"slug": "sparking-dawn", "name": "Sparking Dawn", "icon": "heart-flash",
     "tagline": "Where sparks are struck and kindled.",
     "description": "Dating and connection, powered by your Konphlux ID. Serious courtship or casual company — you set the dial.",
     "chatmonger": {"name": "Lofn", "role": "Matchmaker", "greeting": "Tell me what stirs you, and I shall find a kindred spark."},
     "features": ["I'm looking for men", "I'm looking for women"]},
    {"slug": "profession-plaza", "name": "Profession Plaza", "icon": "briefcase-variant",
     "tagline": "Trade your craft, hire your crew.",
     "description": "Jobs, freelancing, hiring and professional reputation in one plaza.",
     "chatmonger": {"name": "Joaquin", "role": "Guild Broker", "greeting": "Looking for work, or for workers? Either way, I know a guild."},
     "features": ["Find jobs", "Post jobs", "Find Freelance Gigs", "Job Categories", "Apply & track applications", "Freelancer marketplace", "Resumés", "Interview scheduling"]},
    {"slug": "retrospections", "name": "Retrospections", "icon": "star-circle",
     "tagline": "Honest word on every establishment.",
     "description": "Reviews, ratings and photographs of the places around you.",
     "chatmonger": {"name": "Shirley", "role": "Roving Critic", "greeting": "Been somewhere worth remarking upon? Let's set it down properly."},
     "features": ["Reviews", "Submit Review", "Review Categories", "Put a Business Up for Sale", "Browse nearby", "Save favourite places", "Opening Soon", "Recently Opened", "Businesses For Sale", "Health Inspection Updates"]},
    {"slug": "vault", "name": "Vault", "icon": "safe-square",
     "tagline": "Every good idea, filed and lit.",
     "description": "Collect and organise recipes, projects, tricks, hacks and inspiration into boards.",
     "chatmonger": {"name": "Eugene", "role": "Archivist", "greeting": "Hand it here — I'll shelve it where you'll actually find it again."},
     "features": ["Recipes", "DIY projects", "Magic tricks", "Life hacks", "Crafts", "Decor Ideas", "Travel Ideas", "AI Artwork", "Fashion", "Reading List", "Quotes", "Collections & boards", "Tutorials"]},
    {"slug": "library", "name": "Library", "icon": "bookshelf",
     "tagline": "Everything you have bought, kept for good.",
     "description": "Your permanent shelf of digital purchases — eBooks and audio books bought in the Bazaar, downloadable to any device as often as you like.",
     "chatmonger": {"name": "Marlowe", "role": "Librarian", "greeting": "Your shelf is dusted and in order. Shall we pick up where you left off?"},
     "features": ["Your Library", "eBooks", "Audio Books", "Buy eBooks", "Buy Audio Books"]},
    {"slug": "pictureshow-theatre", "name": "PictureShow", "icon": "movie-open",
     "tagline": "Moving pictures, all hours.",
     "description": "Upload, watch and curate video. Channels, playlists, recommendations — and the AI moving-picture workshop. Streamora is its live-broadcast branch.",
     "chatmonger": {"name": "Felix", "role": "Projectionist", "greeting": "The reels are threaded. What shall we screen?"},
     "features": ["Videos", "Upload videos", "Categories", "Streamora", "Subscriptions", "Playlists", "Channels", "Trending", "Create AI Video", "Create AI Animation"]},
    {"slug": "streamora", "name": "Streamora", "icon": "video-wireless",
     "tagline": "Live from the boiler room.",
     "description": "The live branch of PictureShow. Go live, watch live and follow your streamers.",
     "chatmonger": {"name": "Felix", "role": "Projectionist", "greeting": "Cameras hot, reels live. Ready when you are."},
     "features": ["Go live", "Live Now", "Upcoming Live Streams", "Recent Live Streams", "Follow streamers", "Clips & highlights"]},
    {"slug": "answerfier", "name": "Answerfier", "icon": "help-circle",
     "tagline": "Ask anything. Someone here knows.",
     "description": "Questions, answers, votes and a badge for the best reply.",
     "chatmonger": {"name": "Oskar", "role": "Question Warden", "greeting": "No question too small, no answer unexamined."},
     "features": ["New Questions", "Popular Questions", "Trending Questions", "Unanswered Questions", "Categories"]},
    {"slug": "telegraph", "name": "Telegraph", "icon": "newspaper-variant",
     "tagline": "Short thoughts and long essays.",
     "description": "Post a passing thought or publish a full article for Konphlux to read.",
     "chatmonger": {"name": "Valeri", "role": "Wire Operator", "greeting": "Compose your message — I'll see it down the wire."},
     "features": ["All Articles", "Post Something", "Popular", "Trending", "New", "Following", "Reading lists"]},
    {"slug": "roundtable", "name": "Roundtable", "icon": "forum",
     "tagline": "Every discussion in Konphlux ends up here.",
     "description": "Communities, threads, votes and awards. Discussions started anywhere on the site are routed to the Roundtable.",
     "chatmonger": {"name": "Odyn", "role": "Table Marshal", "greeting": "Pull up a chair. The floor is yours."},
     "features": ["Create Community", "Browse Communities", "Recently Visited", "Joined Communities", "Discussion threads", "Discussions I Started", "Site-wide discussion routing"]},
    {"slug": "chatterbox", "name": "Chatterbox", "icon": "chat-processing",
     "tagline": "Every conversation, one inbox.",
     "description": "Private messages, group chats and calls. Conversations begun anywhere on the site continue here.",
     "chatmonger": {"name": "Alicia", "role": "Switchboard", "greeting": "I'll connect you. Voice, video or written word?"},
     "features": ["Private messaging", "Group chats", "Voice calls", "Video calls", "Site-wide chat routing"]},
    {"slug": "entrepreneur-lobby", "name": "Entrepreneur Lobby", "icon": "office-building",
     "tagline": "Workspaces for working companies.",
     "description": "Team messaging, projects, tasks and voice channels for businesses.",
     "chatmonger": {"name": "Sebastian", "role": "Floor Foreman", "greeting": "Let's get the crew organised and the work moving."},
     "features": ["Business workspaces", "Add Workspace", "Add Teammates", "My Team", "My Clients", "Team messaging", "Projects", "Tasks", "Announcements", "Voice channels"]},
    {"slug": "bazaar", "name": "Bazaar", "icon": "storefront",
     "tagline": "Buy, sell, bid, barter.",
     "description": "Local listings, auctions, shipping and a proper checkout.",
     "chatmonger": {"name": "Garrison", "role": "Market Crier", "greeting": "Fine wares today. Buying or selling?"},
     "features": ["Buy", "Sell", "Booths", "Setup Booth", "You Might Be Interested In", "Your Posts", "Your Saves", "Seller ratings", "eBooks", "Audio Books", "Wish lists", "Shopping cart", "Checkout"]},
    {"slug": "frankenstein-lab", "name": "Frankenstein Lab", "icon": "flask-round-bottom",
     "tagline": "Bring your ideas to life.",
     "description": "An AI creation studio for images, music, sound and mischief.",
     "chatmonger": {"name": "Klaus", "role": "Lab Assistant", "greeting": "The apparatus is charged. What shall we animate?"},
     "features": ["GenoPic", "GenoLogo", "GenoMeme", "GenoGIF", "GenoTune", "GenoFX"]},
    {"slug": "author-anvil", "name": "Author Anvil", "icon": "book-edit",
     "tagline": "Hammer out your story.",
     "description": "Write, co-write and publish books, scripts and stories with AI assistance — plus AIventure.",
     "chatmonger": {"name": "Anubis", "role": "Story Smith", "greeting": "First line is the hardest. Shall I strike it for you?"},
     "features": ["Stories", "Scripts", "Prompts", "Write & Submit Stories", "Write & Submit Scripts", "Story Categories", "GenoScribe", "Co-writing", "AIventure"]},
    {"slug": "treasury", "name": "Treasury", "icon": "bank",
     "tagline": "The Konphlux's counting house.",
     "description": "Balance, payments, transfers, donations and every receipt in one ledger.",
     "chatmonger": {"name": "Sapphire Sam", "role": "Teller", "greeting": "Ledgers balanced and books open. What can I settle for you?"},
     "features": ["Konphlux Balance", "Payments", "Transfers", "Donations in Dreambacker", "Spends in Bazaar", "Deals in Waypoint", "Membership Subscription"]},
    {"slug": "dreambacker", "name": "Dreambacker", "icon": "hand-heart",
     "tagline": "Fund the improbable.",
     "description": "Launch projects, offer rewards and collect recurring support.",
     "chatmonger": {"name": "Hope", "role": "Patron Liaison", "greeting": "Big dream? Let's find it some backers."},
     "features": ["Start a Fundraiser", "All Fundraisers", "New Fundraisers", "Trending Fundraisers", "Popular Fundraisers", "Near Deadline Fundraisers", "Fundraisers I Created", "Recurring support", "Backer updates"]},
    {"slug": "brainboost", "name": "BrainBoost", "icon": "school",
     "tagline": "Learn a new trade before supper.",
     "description": "Lessons, quizzes, progress tracking and an AI tutor at your elbow.",
     "chatmonger": {"name": "Brianna", "role": "Tutor", "greeting": "Ten minutes a day and you'll surprise yourself."},
     "features": ["Courses", "Fun Facts", "Dictionary", "Thesaurus", "Quizzes", "Video lessons", "Saved progress", "AI tutoring", "Repair Guy"]},
    {"slug": "waypoint", "name": "Waypoint", "icon": "map-marker-radius",
     "tagline": "Somewhere to stay, somewhere to settle.",
     "description": "Book stays anywhere in Konphlux — and browse vacation houses, condos and cabins that are for sale.",
     "chatmonger": {"name": "Ace", "role": "Wayfinder", "greeting": "A weekend away or a place of your own? I'll fetch the keys."},
     "features": ["Search stays", "Book a stay", "Host your place", "Vacation houses", "Condos & apartments", "Cabins & cottages", "Places for sale", "Saved stays & wish lists", "Guest & host reviews", "Trip planner", "Map search", "Your bookings"]},
    {"slug": "evention-center", "name": "Evention Center", "icon": "calendar-star",
     "tagline": "Every date, list and appointment under one roof.",
     "description": "Your Konphlux calendar: interviews, meetings, flights, reminders, appointments, events and birthdays — plus agendas and every list you keep.",
     "chatmonger": {"name": "Clarity", "role": "Timekeeper", "greeting": "Let's see what the week has in store — and what we can move."},
     "features": ["Calendar view", "Upcoming Interviews", "Meetings", "Upcoming Flights & Trips", "Reminders", "Appointments", "Events", "Birthdays & Special Days", "Agendas", "Lists", "Create a List"]},
    {"slug": "bluepaint", "name": "Bluepaint", "icon": "floor-plan",
     "tagline": "Draw the dream before you pour the footing.",
     "description": "Design floor plans and homes room by room, then let Iris weigh the light, the flow, the materials and the likely cost of building it.",
     "chatmonger": {"name": "Iris", "role": "Grand Visionary", "greeting": "Show me the shape of it. Then we'll discover what it will take to build."},
     "features": ["Floor Plan Studio", "Room Planner", "Materials Estimator", "Construction Cost Estimator", "Design Reviews with Iris", "Saved Blueprints"]},
]

FEED_POSTS = [
    {"id": "1", "author": "Wilhelmina Grast", "kind": "Friend", "time": "12 minutes ago",
     "body": "Finally got the pressure gauge on my workshop door to read the weather instead. Two weeks of swearing, entirely worth it.",
     "likes": 214, "comments": 38, "liked": False},
    {"id": "2", "author": "The Copperline Collective", "kind": "Community", "time": "1 hour ago",
     "body": "Open bench night this Thursday in the Entrepreneur Lobby. Bring a half-finished project and a bad idea. We'll supply the tea and the unsolicited advice.",
     "likes": 981, "comments": 142, "liked": False},
    {"id": "3", "author": "Ashgrove Tea & Tools", "kind": "Business", "time": "3 hours ago",
     "body": "New shipment of brass calipers just landed in the Bazaar. Retrospections reviewers get first pick until Friday.",
     "likes": 442, "comments": 27, "liked": False},
    {"id": "4", "author": "Iolanthe Vex", "kind": "Creator", "time": "5 hours ago",
     "body": "Episode nine of the Clockwork Serial is live in PictureShow — and the script draft is open for notes over in Author Anvil.",
     "likes": 1587, "comments": 309, "liked": False},
    {"id": "5", "author": "Guild of Aetherwrights", "kind": "Page", "time": "8 hours ago",
     "body": "Reminder: the annual Gear & Signal exhibition opens next month at the Evention Center. Booth applications close soon.",
     "likes": 623, "comments": 71, "liked": False},
    {"id": "6", "author": "Percival Oakes", "kind": "Friend", "time": "yesterday",
     "body": "Retrofitted my reading lamp with an aether coil. It hums a low B-flat when it's happy. I've named it Reginald.",
     "likes": 1120, "comments": 204, "liked": False},
]

STORIES = ["Your story", "Percival", "Nadia", "Tomas", "Junie", "Ilse", "Klaus"]
TRENDING = [
    "Brass-forward interiors", "Aether lamp retrofits", "Roundtable: best district?",
    "Streamora late-night forges", "Dreambacker: the Tidal Orrery", "GenoTune remixes",
]
SUGGESTIONS = ["Percival Oakes", "Nadia Bellweather", "Tomas Krieg", "Junie Ashcombe"]

IMG_WATCH = "https://images.unsplash.com/photo-1605953680110-ed5084aaa8ea?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
IMG_GEARS = "https://images.unsplash.com/photo-1777891699620-98471a1042e2?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
IMG_ARCH = "https://images.unsplash.com/photo-1563273026-41f9f93e3dc4?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
IMG_PARCH = "https://images.unsplash.com/photo-1705837863332-7162639852d8?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"

BAZAAR = [
    {"id": "b1", "title": "Brass Marine Chronometer", "price_cents": 42000, "seller": "Ashgrove Tea & Tools", "rating": 4.9, "reviews": 128, "category": "Instruments", "image": IMG_WATCH,
     "description": "A precision marine chronometer housed in polished brass, restored and running true to within two seconds a day. Comes with the original gimbal mount."},
    {"id": "b2", "title": "Aether Lamp Retrofit Kit", "price_cents": 8900, "seller": "Copperline Collective", "rating": 4.7, "reviews": 342, "category": "Aetherworks", "image": IMG_GEARS,
     "description": "Everything you need to convert an ordinary reading lamp into a glowing aether fixture. Coil, diffuser, and a rather charming low hum included."},
    {"id": "b3", "title": "Copperline Calipers, Set of Three", "price_cents": 12500, "seller": "Ashgrove Tea & Tools", "rating": 4.8, "reviews": 96, "category": "Tools", "image": IMG_WATCH,
     "description": "Machinist-grade calipers in copper and steel. The set covers inside, outside and depth measurement — the artificer's essential trio."},
    {"id": "b4", "title": "Victorian Writing Desk", "price_cents": 189000, "seller": "Marlowe & Sons", "rating": 5.0, "reviews": 41, "category": "Furniture", "image": IMG_ARCH,
     "description": "A generous mahogany writing desk with a leather top, seven drawers and a concealed compartment that we absolutely will not tell you the location of."},
    {"id": "b5", "title": "Hand-Bound Parchment Journal", "price_cents": 3400, "seller": "The Vault Bindery", "rating": 4.9, "reviews": 511, "category": "Paper Goods", "image": IMG_PARCH,
     "description": "Two hundred pages of thick, cream parchment stitched into a supple leather cover. Ages beautifully, spills forgivingly."},
    {"id": "b6", "title": "Clockwork Weather Gauge", "price_cents": 15600, "seller": "Grast Workshop", "rating": 4.6, "reviews": 73, "category": "Instruments", "image": IMG_GEARS,
     "description": "Reads barometric pressure, humidity and a fourth quantity the maker declines to identify. Whimsical, accurate, and faintly ominous."},
    {"id": "b7", "title": "Wayfarer's Bronze Compass", "price_cents": 6700, "seller": "Waypoint Outfitters", "rating": 4.8, "reviews": 289, "category": "Tools", "image": IMG_WATCH,
     "description": "A pocket compass cast in warm bronze with a hinged lid and a needle that has, so far, never once lied to us."},
    {"id": "b8", "title": "Steam Pressure Reader", "price_cents": 9800, "seller": "Boiler Room Supply", "rating": 4.5, "reviews": 154, "category": "Aetherworks", "image": IMG_GEARS,
     "description": "A face-mounted pressure reader for home boilers and small forges. Glows a gentle amber in safe range, an alarming red otherwise."},
]

IMG_BOOK = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
IMG_AUDIO = "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"

# eBooks + Audio Books — the "Books" media of the Bazaar.
BOOK_LISTINGS = [
    {"id": "e1", "title": "The Aetherwright's Handbook (eBook)", "price_cents": 1200, "seller": "The Vault Bindery", "rating": 4.9, "reviews": 380, "category": "eBooks", "image": IMG_BOOK,
     "description": "A downloadable field manual for coil-work, glow diffusion and the polite tuning of humming lamps. Yours to keep, on any device."},
    {"id": "e2", "title": "Clockwork & Consequence (eBook)", "price_cents": 990, "seller": "Iolanthe Vex", "rating": 4.7, "reviews": 214, "category": "eBooks", "image": IMG_PARCH,
     "description": "A serialized mystery set in the brass alleys of Konphlux. Nine chapters, one very suspicious pocket-watch."},
    {"id": "e3", "title": "Brass-Forward Interiors (eBook)", "price_cents": 1500, "seller": "Ashgrove Press", "rating": 4.6, "reviews": 96, "category": "eBooks", "image": IMG_ARCH,
     "description": "A photographic guide to warm metals, oiled walnut and gaslight. Includes downloadable mood boards."},
    {"id": "a-b1", "title": "Tales from the Boiler Room (Audio Book)", "price_cents": 1800, "seller": "Streamora Audio", "rating": 4.8, "reviews": 512, "category": "Audio Books", "image": IMG_AUDIO,
     "description": "Six hours of narrated short stories, read by the Clockwork Serial cast. Streams or downloads for offline listening."},
    {"id": "a-b2", "title": "The Wayfinder's Log (Audio Book)", "price_cents": 1600, "seller": "Waypoint Audio", "rating": 4.5, "reviews": 143, "category": "Audio Books", "image": IMG_AUDIO,
     "description": "A gentle travelogue across every district, narrated with a cartographer's calm. Perfect for a long airship crossing."},
]


def _portrait(pid: str) -> str:
    return f"https://images.unsplash.com/photo-{pid}?crop=faces&fit=crop&w=640&h=800&q=80"


# Sparking Dawn — seeded dating profiles ("sparks"). `likes_back` ones match instantly on a like.
DATING_PROFILES = [
    {"user_id": "spark-1", "display_name": "Isolde Vayne", "gender": "woman", "age": 29, "seed": True, "active": True, "likes_back": True,
     "tagline": "Airship navigator, terrible at chess", "bio": "I chart routes over the cloud-line and collect brass compasses. Looking for someone who'll argue about maps over coffee.", "photo": _portrait("1494790108377-be9c29b29330")},
    {"user_id": "spark-2", "display_name": "Cassius Merrow", "gender": "man", "age": 33, "seed": True, "active": True, "likes_back": True,
     "tagline": "Clockmaker with two left feet", "bio": "I build timepieces that mostly keep time. Fond of long walks and short deadlines.", "photo": _portrait("1500648767791-00dcc994a43e")},
    {"user_id": "spark-3", "display_name": "Marguerite Ashe", "gender": "woman", "age": 27, "seed": True, "active": True, "likes_back": False,
     "tagline": "Botanist of impossible orchids", "bio": "I grow things that shouldn't survive the smog. Tea drinker, letter writer, occasional arsonist of bad ideas.", "photo": _portrait("1438761681033-6461ffad8d80")},
    {"user_id": "spark-4", "display_name": "Dorian Kesh", "gender": "man", "age": 31, "seed": True, "active": True, "likes_back": True,
     "tagline": "Aetheric engineer, hopeless romantic", "bio": "I wire the lamps that keep the district glowing. Seeking a co-conspirator for midnight rooftop repairs.", "photo": _portrait("1507003211169-0a1dd7228f2d")},
    {"user_id": "spark-5", "display_name": "Selene Ardent", "gender": "woman", "age": 30, "seed": True, "active": True, "likes_back": True,
     "tagline": "Opera singer, part-time pickpocket", "bio": "I sing on the brass stage and lift only hearts (mostly). Looking for someone unafraid of a dramatic exit.", "photo": _portrait("1534528741775-53994a69daeb")},
    {"user_id": "spark-6", "display_name": "Ambrose Fell", "gender": "man", "age": 35, "seed": True, "active": True, "likes_back": False,
     "tagline": "Cartographer of forgotten alleys", "bio": "I map the parts of Konphlux nobody remembers. Quiet, curious, dangerously good at directions.", "photo": _portrait("1502685104226-ee32379fefbe")},
    {"user_id": "spark-7", "display_name": "Beatrix Nolan", "gender": "woman", "age": 26, "seed": True, "active": True, "likes_back": True,
     "tagline": "Inventor of small useless wonders", "bio": "My workshop is chaos and my ideas are worse. Bring snacks and a sense of humour.", "photo": _portrait("1524504388940-b1c1722653e1")},
    {"user_id": "spark-8", "display_name": "Lucian Vale", "gender": "man", "age": 28, "seed": True, "active": True, "likes_back": True,
     "tagline": "Airship pilot, reluctant poet", "bio": "I fly the dawn patrol and write verses I never show anyone. Until now, apparently.", "photo": _portrait("1519085360753-af0119f7cbe7")},
    {"user_id": "spark-9", "display_name": "Odette Grimm", "gender": "woman", "age": 32, "seed": True, "active": True, "likes_back": False,
     "tagline": "Bookbinder & incurable night-owl", "bio": "I stitch stories back together for a living. Looking for a plot twist of my own.", "photo": _portrait("1544005313-94ddf0286df2")},
    {"user_id": "spark-10", "display_name": "Rafael Dunn", "gender": "man", "age": 34, "seed": True, "active": True, "likes_back": True,
     "tagline": "Blacksmith with a soft heart", "bio": "I forge iron all day and go soft at sunsets. Seeking someone to share the quiet after the hammering stops.", "photo": _portrait("1506794778202-cad84cf45f1d")},
]


# Author Anvil — writing & publishing district.
ANVIL_CATEGORIES = ["General", "Fantasy", "Mystery", "Romance", "Sci-Fi", "Horror", "Adventure", "Drama", "Comedy", "Poetry"]

ANVIL_PROMPTS = [
    "A lamplighter discovers one street lamp that refuses to be lit.",
    "Two rival clockmakers are commissioned to build the same impossible watch.",
    "An airship arrives at a port that isn't on any map.",
    "The city's automatons begin leaving tiny handwritten notes.",
    "A letter arrives, postmarked from a district that burned down years ago.",
    "An inventor's greatest creation asks to be switched off.",
    "The last telegraph operator receives a message from the future.",
    "A stowaway on the dawn patrol turns out to be the captain's younger self.",
    "Someone is stealing sounds from the city — first the bells, then the birds.",
    "A cartographer falls in love with a place that keeps moving.",
    "The Bazaar's oldest merchant offers to sell you a single, perfect memory.",
    "Steam rises from a manhole in the exact shape of a person you once knew.",
]

ANVIL_WORKS = [
    {"id": "w1", "title": "The Kettle That Kept Time", "kind": "story", "category": "Fantasy",
     "author": "Wilhelmina Grast", "author_id": "seed", "applause": 128, "open_cowriting": False,
     "created_at": "2026-06-08T09:00:00+00:00",
     "body": "The kettle had been in the family for three generations, and for three generations it had told the time. Not with hands or numbers, but with the pitch of its whistle — a low hum at dawn, a bright shriek at noon, a tired sigh at dusk. On the morning it fell silent, Wilhelmina knew that something in the city had stopped as well.\n\nShe carried it to the Forge Floor, past the copper stalls and the hiss of the great boilers, and set it on the workbench of the only smith who might understand. \"It has forgotten the hour,\" she said. The smith only smiled, and reached for the smallest of his hammers."},
    {"id": "w2", "title": "Pressure — A Two-Hander", "kind": "script", "category": "Drama",
     "author": "Marlowe Quill", "author_id": "seed", "applause": 74, "open_cowriting": True,
     "created_at": "2026-06-11T09:00:00+00:00",
     "body": "INT. BOILER ROOM — NIGHT\n\nThe gauges glow amber. TOMAS, grease to the elbows, does not look up.\n\nTOMAS\nYou came back.\n\nISOLDE (O.S.)\nThe city's holding its breath. I could hardly stay away.\n\nTOMAS\n(a beat)\nThen help me hold it a little longer.\n\n[The scene is open for co-writing — add the next exchange.]"},
    {"id": "w3", "title": "Notes Left by Automatons", "kind": "story", "category": "Mystery",
     "author": "Percival Oakes", "author_id": "seed", "applause": 203, "open_cowriting": True,
     "created_at": "2026-06-13T09:00:00+00:00",
     "body": "The first note was folded into a perfect square and left on the tram seat: REMEMBER TO LOOK UP. The second was tucked under a teacup at the Parlour: THE THIRD LAMP IS LYING. By the fourth, the whole district had begun to read them aloud in the mornings, the way one reads a horoscope — half in jest, half in dread.\n\nNobody had ever seen an automaton write."},
]

PROFILE = {
    "display_name": "Wilhelmina Grast",
    "handle": "@artificer",
    "title": "Master Artificer",
    "bio": "Tinkerer of gauges, keeper of one very happy aether lamp named Reginald. Building small improbable things in the Copperline district.",
    "district": "Home",
    "stats": {"posts": 342, "followers": 12800, "following": 486},
    "balance_cents": 128450,
    "menu": [
        {"group": "You", "items": [
            {"label": "Konphlux ID", "icon": "card-account-details", "to": "id"},
            {"label": "Dashboard", "icon": "view-dashboard", "to": "dashboard"},
            {"label": "Resumé", "icon": "file-account", "to": "resume"},
            {"label": "My Orders", "icon": "receipt", "to": "warehouse"},
            {"label": "Bookmarks", "icon": "bookmark-multiple", "to": "bookmarks"},
            {"label": "Achievements", "icon": "trophy", "to": "achievements"},
        ]},
        {"group": "Signals", "items": [
            {"label": "Notifications", "icon": "bell-ring", "to": "notifications"},
            {"label": "Messages", "icon": "message-text", "to": "messages"},
        ]},
        {"group": "Controls", "items": [
            {"label": "Settings", "icon": "cog", "to": "settings"},
            {"label": "Privacy", "icon": "shield-lock", "to": "privacy"},
            {"label": "Account Security", "icon": "lock-check", "to": "security"},
            {"label": "Appearance", "icon": "palette", "to": "appearance"},
        ]},
        {"group": "Assistance", "items": [
            {"label": "Help Center", "icon": "lifebuoy", "to": "help"},
            {"label": "Support", "icon": "face-agent", "to": "support"},
        ]},
    ],
}


RT_COMMUNITIES = [
    {"id": "c1", "name": "The Forge Floor", "icon": "anvil", "members": 4820,
     "description": "Makers and tinkerers sharing works-in-progress, half-finished contraptions and hard-won fixes.",
     "created_by": "seed", "created_at": "2026-01-02T09:00:00+00:00"},
    {"id": "c2", "name": "Aether & Ether", "icon": "lightning-bolt", "members": 3110,
     "description": "Coils, glowing experiments and the polite argument over whether aether hums in B-flat.",
     "created_by": "seed", "created_at": "2026-01-03T09:00:00+00:00"},
    {"id": "c3", "name": "Parlour Debates", "icon": "forum", "members": 6740,
     "description": "Spirited discourse on anything under gaslight. Bring an opinion and a thick skin.",
     "created_by": "seed", "created_at": "2026-01-04T09:00:00+00:00"},
    {"id": "c4", "name": "Market Watchers", "icon": "chart-line", "members": 2290,
     "description": "Deals, duds and dispatches from the Bazaar. What's worth the brass this week?",
     "created_by": "seed", "created_at": "2026-01-05T09:00:00+00:00"},
]

RT_THREADS = [
    {"id": "t1", "community_id": "c1", "title": "My workshop door now reads the weather",
     "body": "Two weeks of swearing later, the pressure gauge on my door reads barometric pressure. Ask me anything before I retrofit the letterbox.",
     "author": "Wilhelmina Grast", "user_id": "seed", "upvotes": 214,
     "created_at": "2026-06-10T09:00:00+00:00"},
    {"id": "t2", "community_id": "c2", "title": "Why does my aether coil hum a low B-flat?",
     "body": "New retrofit on my reading lamp. It hums, contentedly, at what I swear is a low B-flat. Is this normal or have I built a very small pipe organ?",
     "author": "Percival Oakes", "user_id": "seed", "upvotes": 148,
     "created_at": "2026-06-11T09:00:00+00:00"},
    {"id": "t3", "community_id": "c3", "title": "Hot take: brass-forward interiors have peaked",
     "body": "There, I said it. We've reached maximum brass. The pendulum swings back to blackened iron and oiled walnut. Discuss.",
     "author": "Iolanthe Vex", "user_id": "seed", "upvotes": 331,
     "created_at": "2026-06-12T09:00:00+00:00"},
    {"id": "t4", "community_id": "c4", "title": "Are the Copperline calipers worth 125 brass?",
     "body": "Tempted by the set of three in the Bazaar. Anyone own them? Do they hold calibration or wander after a month?",
     "author": "Tomas Krieg", "user_id": "seed", "upvotes": 72,
     "created_at": "2026-06-13T09:00:00+00:00"},
]

RT_REPLIES = [
    {"id": "r1", "thread_id": "t1", "body": "Astonishing. Now do the kettle.", "author": "Percival Oakes", "user_id": "seed", "created_at": "2026-06-10T10:00:00+00:00"},
    {"id": "r2", "thread_id": "t1", "body": "Parts list or it didn't happen.", "author": "Tomas Krieg", "user_id": "seed", "created_at": "2026-06-10T10:30:00+00:00"},
    {"id": "r3", "thread_id": "t3", "body": "Bold words in a brass district. I'll allow it.", "author": "Odyn (Table Marshal)", "user_id": "seed", "created_at": "2026-06-12T11:00:00+00:00"},
]


# ----------------------------- Answerfier (Q&A) -----------------------------
AF_CATEGORIES = [
    "General", "Technology", "Life & Advice", "Craft & Making",
    "Food & Drink", "Arts", "Science", "Philosophy", "Question of the Day",
]

# Question of the Day is deterministic per calendar date and never repeats
# within the length of the pool (>1000), satisfying the "no repeat for 1,000 days" rule.
_QOTD_TEMPLATES = [
    "What are your honest thoughts on {x}?",
    "How has {x} changed your life?",
    "What's something most people get wrong about {x}?",
    "What's your favourite thing about {x}?",
    "If you could change one thing about {x}, what would it be?",
    "What's a surprising fact you know about {x}?",
    "What first drew you to {x}?",
    "What advice would you give a beginner about {x}?",
    "Is {x} overrated or underrated, and why?",
    "Where do you think {x} is heading in the next ten years?",
    "What's the best lesson {x} has taught you?",
    "How do you make time for {x} in a busy week?",
]

_QOTD_TOPICS = [
    "music", "travel", "cooking", "friendship", "technology", "reading", "art",
    "science", "history", "nature", "exercise", "sleep", "coffee", "tea",
    "gardening", "photography", "writing", "painting", "dancing", "gaming",
    "film", "theatre", "fashion", "design", "architecture", "poetry",
    "philosophy", "psychology", "economics", "politics", "education",
    "parenting", "leadership", "teamwork", "creativity", "productivity",
    "mindfulness", "meditation", "yoga", "running", "cycling", "swimming",
    "hiking", "camping", "fishing", "baking", "wine", "chocolate",
    "street food", "learning languages", "mathematics", "astronomy",
    "space exploration", "robotics", "artificial intelligence",
    "virtual reality", "social media", "journaling", "budgeting", "investing",
    "entrepreneurship", "volunteering", "community", "spirituality",
    "mythology", "folklore", "storytelling", "comedy", "jazz",
    "classical music", "hip hop", "folk music", "opera", "ballet",
    "sculpture", "pottery", "woodworking", "metalworking", "blacksmithing",
    "calligraphy", "origami", "knitting", "sewing", "embroidery", "quilting",
    "chess", "board games", "puzzles", "magic tricks", "card games",
    "birdwatching", "stargazing", "meteorology", "geology", "oceanography",
    "marine life", "wildlife", "conservation", "sustainability", "recycling",
    "minimalism", "interior design", "urban planning", "public transport",
    "classic cars", "motorcycles", "aviation", "sailing", "trains",
    "handwriting", "collecting", "antiques", "vintage clocks", "clockwork",
    "tinkering", "home repair", "coffee brewing", "tea ceremonies",
    "board sports", "rock climbing", "kayaking", "surfing", "skiing",
]

# Fixed-seed shuffle so every device/day agrees on the same question order.
_QOTD_POOL = [t.format(x=topic) for t in _QOTD_TEMPLATES for topic in _QOTD_TOPICS]
random.Random(20260101).shuffle(_QOTD_POOL)
_QOTD_EPOCH = date(2026, 1, 1)


def _qotd_text_for(day: date) -> str:
    idx = (day - _QOTD_EPOCH).days % len(_QOTD_POOL)
    return _QOTD_POOL[idx]


AF_QUESTIONS = [
    {"id": "q1", "title": "What's the most reliable way to keep brass from tarnishing?",
     "body": "My workshop fittings dull within weeks. Lacquer, oil, or something cleverer?",
     "category": "Craft & Making", "author": "Wilhelmina Grast", "user_id": "seed",
     "best_answer_id": "a2", "created_at": "2026-06-09T09:00:00+00:00"},
    {"id": "q2", "title": "Best beginner project to learn soldering?",
     "body": "I've got an iron and more enthusiasm than sense. Where should I start?",
     "category": "Craft & Making", "author": "Tomas Krieg", "user_id": "seed",
     "best_answer_id": None, "created_at": "2026-06-11T09:00:00+00:00"},
    {"id": "q3", "title": "Why does my aether lamp hum at a low B-flat?",
     "body": "Contentedly, mind you. Is this a fault or a feature?",
     "category": "Science", "author": "Percival Oakes", "user_id": "seed",
     "best_answer_id": None, "created_at": "2026-06-13T09:00:00+00:00"},
    {"id": "q4", "title": "How do you stay productive on grey, low-pressure days?",
     "body": "The barometer drops and so does my will to work. Tips welcome.",
     "category": "Life & Advice", "author": "Nadia Bellweather", "user_id": "seed",
     "best_answer_id": None, "created_at": "2026-06-14T09:00:00+00:00"},
]

AF_ANSWERS = [
    {"id": "a1", "question_id": "q1", "body": "A thin coat of microcrystalline wax. Buffs up nicely and lasts months.",
     "author": "Eugene Halloway", "user_id": "seed", "upvotes": 12, "created_at": "2026-06-09T10:00:00+00:00"},
    {"id": "a2", "question_id": "q1", "body": "Renaissance wax is the conservator's secret. Invisible, reversible, and it won't yellow.",
     "author": "Marlowe Quill", "user_id": "seed", "upvotes": 34, "created_at": "2026-06-09T11:00:00+00:00"},
    {"id": "a3", "question_id": "q2", "body": "Wire a simple LED torch. Cheap, forgiving, and you'll learn clean joints fast.",
     "author": "Klaus Ferro", "user_id": "seed", "upvotes": 8, "created_at": "2026-06-11T12:00:00+00:00"},
]


# ----------------------------- BrainBoost (learning district) -----------------------------
BB_CATEGORIES = ["Trades & Crafts", "Languages", "Science", "Technology", "Arts", "Wellness", "Religious Studies"]

BB_COURSES = [
    {"id": "bc1", "title": "Foundations of Blacksmithing", "category": "Trades & Crafts",
     "level": "Beginner", "icon": "anvil",
     "summary": "Fire, iron and patience — strike your first clean weld.",
     "lessons": [
        {"title": "Reading the Forge Fire", "body": "A good fire is the smith's first tool. Learn to read colour: dull red means too cool, bright orange to yellow is the working heat for mild steel. Keep the fuel banked and the air steady. Too much air burns the metal; too little starves the heat. Work in a shaded corner so you can judge colour honestly."},
        {"title": "Drawing Out & Tapering", "body": "Drawing out lengthens and thins the stock. Strike with the hammer angled slightly and rotate the work a quarter turn between blows to keep it square. For a taper, reduce your hammer angle as the point forms. Finish on the flat of the anvil to true the faces."},
        {"title": "The Scarf Weld", "body": "Forge-welding joins two pieces with heat and pressure. Shape matching scarfs, bring both to a sparkling welding heat, flux to keep scale out, then set the weld with firm, quick blows before the heat fades. Confidence beats force — hesitation lets the joint cool and fail."},
     ]},
    {"id": "bc2", "title": "Practical Watchmaking", "category": "Trades & Crafts",
     "level": "Intermediate", "icon": "watch",
     "summary": "Gears, springs and the tiny art of keeping time.",
     "lessons": [
        {"title": "Anatomy of a Movement", "body": "Every mechanical watch is a chain: mainspring stores energy, the gear train delivers it, the escapement doles it out in even beats, and the balance wheel counts them. Understand the flow of power and every repair becomes logical."},
        {"title": "Cleaning & Oiling", "body": "Old oil turns to varnish and stops a watch faster than any broken part. Disassemble, clean each part, and re-oil only the pivots and escapement with the correct grade — a pinhead too much drags the whole train."},
     ]},
    {"id": "bc3", "title": "Conversational French", "category": "Languages",
     "level": "Beginner", "icon": "translate",
     "summary": "Order coffee, make friends, and sound the part.",
     "lessons": [
        {"title": "Greetings & Politeness", "body": "Bonjour (hello, daytime), bonsoir (evening), s'il vous plaît (please), merci (thank you), de rien (you're welcome). The French treat 'bonjour' as a small courtesy that opens every interaction — skip it and you'll seem brusque."},
        {"title": "The Present Tense", "body": "Regular -er verbs follow one pattern: je parle, tu parles, il/elle parle, nous parlons, vous parlez, ils/elles parlent. Master this and hundreds of verbs open up at once."},
        {"title": "Ordering in a Café", "body": "'Je voudrais un café, s'il vous plaît' — I would like a coffee, please. 'Voudrais' (the conditional) is softer and more polite than 'je veux' (I want). Small softeners matter enormously in French."},
     ]},
    {"id": "bc4", "title": "Everyday Astronomy", "category": "Science",
     "level": "Beginner", "icon": "telescope",
     "summary": "Find your way around the night sky without a telescope.",
     "lessons": [
        {"title": "Star-hopping from the Plough", "body": "The Big Dipper (the Plough) is your signpost. Follow the two 'pointer' stars to Polaris, the North Star, which barely moves all night. Once you find north, the rest of the sky becomes a map you can read."},
        {"title": "Why the Moon Changes Shape", "body": "The Moon makes no light of its own; it reflects sunlight. As it orbits Earth, we see different fractions of its lit half — new, waxing, full, waning — over roughly 29.5 days."},
     ]},
    {"id": "bc5", "title": "Introduction to Electronics", "category": "Technology",
     "level": "Beginner", "icon": "chip",
     "summary": "Resistors, circuits and your first blinking light.",
     "lessons": [
        {"title": "Voltage, Current & Resistance", "body": "Ohm's Law ties them together: V = I × R. Voltage is the push, current is the flow, resistance is the friction. Change any two and you can predict the third — the single most useful equation in electronics."},
        {"title": "Reading a Breadboard", "body": "A breadboard's rows are connected in short strips; the long rails down the sides carry power and ground. Plan your layout before you plug in and debugging becomes far easier."},
     ]},
    {"id": "bc6", "title": "Watercolour Basics", "category": "Arts",
     "level": "Beginner", "icon": "palette",
     "summary": "Light, water and the courage to leave white paper alone.",
     "lessons": [
        {"title": "Controlling Water", "body": "Watercolour is really water-control. More water means paler, softer washes; less water gives richer, sharper marks. Practice a graded wash from dark to light before painting anything real."},
        {"title": "Wet-on-Wet vs Wet-on-Dry", "body": "Drop colour into a wet area and it blooms softly (wet-on-wet); paint onto dry paper for crisp edges (wet-on-dry). Combining both in one painting gives depth and life."},
     ]},
    {"id": "bc7", "title": "Mindful Breathing", "category": "Wellness",
     "level": "Beginner", "icon": "meditation",
     "summary": "Calm the nervous system in three unhurried minutes.",
     "lessons": [
        {"title": "The Physiological Sigh", "body": "Two short inhales through the nose followed by a long, slow exhale through the mouth is the fastest known way to calm the body. It reinflates collapsed air sacs and offloads carbon dioxide, easing stress in seconds."},
        {"title": "Box Breathing", "body": "Inhale for four counts, hold for four, exhale for four, hold for four. Used by athletes and pilots, it steadies the heart rate and sharpens focus before any demanding task."},
     ]},
    {"id": "bc8", "title": "World Religions: An Overview", "category": "Religious Studies",
     "level": "Beginner", "icon": "hands-pray",
     "summary": "A respectful tour of the great faith traditions.",
     "lessons": [
        {"title": "The Abrahamic Faiths", "body": "Judaism, Christianity and Islam share a common ancestor in Abraham and a belief in one God. They differ in scripture and practice — the Torah, the Bible, and the Qur'an — yet each centres on covenant, ethics and community."},
        {"title": "Dharmic Traditions", "body": "Hinduism, Buddhism, Jainism and Sikhism arose in the Indian subcontinent. Shared themes include karma (action and consequence), dharma (duty or right living), and the aim of liberation from cycles of rebirth."},
        {"title": "Reading Sacred Texts Respectfully", "body": "Sacred texts are read differently within each tradition — literally, allegorically, or mystically. Studying religion well means understanding what believers themselves mean, not judging one tradition by another's rules."},
     ]},
    {"id": "bc9", "title": "Comparative Ethics & Belief", "category": "Religious Studies",
     "level": "Intermediate", "icon": "scale-balance",
     "summary": "How different traditions answer life's hardest questions.",
     "lessons": [
        {"title": "The Golden Rule Across Faiths", "body": "Nearly every tradition teaches a version of 'treat others as you wish to be treated' — from the Torah and the Gospels to the Analects of Confucius and the Buddhist Udana. This shared ethic is one of humanity's most striking agreements."},
        {"title": "Ritual, Festival & Meaning", "body": "Festivals such as Passover, Easter, Eid, Diwali and Vesak mark sacred time and bind communities together. Understanding a festival's story reveals the values a tradition holds most dear."},
     ]},
    {"id": "bc10", "title": "Conversational Spanish", "category": "Languages",
     "level": "Beginner", "icon": "translate",
     "summary": "The world's second-most-spoken mother tongue, one phrase at a time.",
     "lessons": [
        {"title": "Sounds & Stress", "body": "Spanish vowels are pure and consistent: a, e, i, o, u never change. Stress usually falls on the second-to-last syllable unless an accent mark tells you otherwise. Get the vowels clean and you'll be understood."},
        {"title": "Ser vs Estar", "body": "Both mean 'to be'. Use 'ser' for permanent traits (soy alto — I am tall) and 'estar' for states and locations (estoy cansado — I am tired). Mixing them is the classic beginner slip."},
     ]},
]

BB_QUIZZES = [
    {"id": "bq1", "title": "General Knowledge Warm-up", "category": "Science", "icon": "lightbulb-on",
     "questions": [
        {"q": "What is the largest planet in our solar system?", "options": ["Saturn", "Jupiter", "Neptune", "Earth"], "answer": 1},
        {"q": "Water is made of hydrogen and which other element?", "options": ["Helium", "Nitrogen", "Oxygen", "Carbon"], "answer": 2},
        {"q": "How many bones are in the adult human body?", "options": ["186", "206", "226", "246"], "answer": 1},
        {"q": "What gas do plants absorb from the air?", "options": ["Oxygen", "Hydrogen", "Carbon dioxide", "Nitrogen"], "answer": 2},
     ]},
    {"id": "bq2", "title": "World Geography", "category": "Science", "icon": "earth",
     "questions": [
        {"q": "What is the longest river in the world?", "options": ["Amazon", "Nile", "Yangtze", "Mississippi"], "answer": 1},
        {"q": "Which country has the most natural lakes?", "options": ["Russia", "USA", "Canada", "Finland"], "answer": 2},
        {"q": "Mount Everest sits on the border of Nepal and which country?", "options": ["India", "China", "Bhutan", "Pakistan"], "answer": 1},
        {"q": "What is the smallest country in the world?", "options": ["Monaco", "Nauru", "Vatican City", "San Marino"], "answer": 2},
     ]},
    {"id": "bq3", "title": "Trades & Making", "category": "Trades & Crafts", "icon": "hammer-wrench",
     "questions": [
        {"q": "What does flux do during forge-welding?", "options": ["Adds colour", "Keeps scale out of the joint", "Cools the metal", "Hardens the steel"], "answer": 1},
        {"q": "In Ohm's Law, V equals I times what?", "options": ["Power", "Resistance", "Charge", "Frequency"], "answer": 1},
        {"q": "What stores the energy in a mechanical watch?", "options": ["Balance wheel", "Escapement", "Mainspring", "Dial"], "answer": 2},
     ]},
    {"id": "bq4", "title": "Languages & Words", "category": "Languages", "icon": "translate",
     "questions": [
        {"q": "In French, what does 'merci' mean?", "options": ["Please", "Hello", "Thank you", "Goodbye"], "answer": 2},
        {"q": "Spanish 'ser' and 'estar' both translate to which English verb?", "options": ["To have", "To be", "To go", "To do"], "answer": 1},
        {"q": "A word opposite in meaning to another is a…", "options": ["Synonym", "Homonym", "Antonym", "Acronym"], "answer": 2},
     ]},
    {"id": "bq5", "title": "World Religions", "category": "Religious Studies", "icon": "hands-pray",
     "questions": [
        {"q": "Judaism, Christianity and Islam are collectively called the…", "options": ["Dharmic faiths", "Abrahamic faiths", "Eastern faiths", "Folk faiths"], "answer": 1},
        {"q": "Diwali is a festival of light celebrated chiefly in which tradition?", "options": ["Islam", "Hinduism", "Judaism", "Shinto"], "answer": 1},
        {"q": "The concept of 'karma' means action and its…", "options": ["Reward only", "Consequence", "Forgiveness", "Denial"], "answer": 1},
     ]},
]

BB_VIDEOS = [
    {"id": "bv1", "title": "How a Blacksmith Forges a Blade", "topic": "Trades & Crafts", "duration": "12 min"},
    {"id": "bv2", "title": "The Beginner's Guide to Watercolour", "topic": "Arts", "duration": "18 min"},
    {"id": "bv3", "title": "Understanding Ohm's Law", "topic": "Technology", "duration": "9 min"},
    {"id": "bv4", "title": "French Pronunciation for Beginners", "topic": "Languages", "duration": "15 min"},
    {"id": "bv5", "title": "A Tour of the Night Sky", "topic": "Science", "duration": "22 min"},
    {"id": "bv6", "title": "The Physiological Sigh Explained", "topic": "Wellness", "duration": "6 min"},
    {"id": "bv7", "title": "An Introduction to World Religions", "topic": "Religious Studies", "duration": "20 min"},
    {"id": "bv8", "title": "How Mechanical Watches Work", "topic": "Trades & Crafts", "duration": "14 min"},
]

# Fact of the Day — a curated pool cycled deterministically by calendar date so
# every device agrees and the fact changes each day.
BB_FACTS = [
    "Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that is still edible.",
    "Octopuses have three hearts and blue, copper-based blood.",
    "A day on Venus is longer than its year: it rotates once every 243 Earth days but orbits the Sun in 225.",
    "Bananas are berries, but strawberries are not.",
    "The Eiffel Tower can grow more than 15 cm taller in summer as the iron expands in the heat.",
    "Wombats produce cube-shaped droppings.",
    "There are more possible games of chess than there are atoms in the observable universe.",
    "A group of flamingos is called a 'flamboyance'.",
    "The shortest war in history lasted about 38 minutes, between Britain and Zanzibar in 1896.",
    "Sharks existed before trees did — sharks are around 400 million years old, trees about 350 million.",
    "The human brain uses roughly 20% of the body's total energy despite being about 2% of its weight.",
    "Sea otters hold hands while sleeping so they don't drift apart.",
    "The Great Wall of China is not a single wall but many walls built over centuries.",
    "Lightning strikes the Earth about 8 million times a day.",
    "A single strand of spider silk is thinner than a human hair but stronger by weight than steel.",
    "The dot over a lowercase 'i' or 'j' is called a tittle.",
    "Cows have best friends and can become stressed when separated from them.",
    "Venus is the only planet in our solar system that spins clockwise.",
    "The inventor of the Frisbee was turned into a Frisbee — his ashes were made into memorial discs.",
    "A bolt of lightning is about five times hotter than the surface of the Sun.",
    "Hot water can freeze faster than cold water under certain conditions — the Mpemba effect.",
    "The heart of a shrimp is located in its head.",
    "Bees can recognise human faces.",
    "The world's oldest known living tree is a bristlecone pine over 4,800 years old.",
    "An ostrich's eye is bigger than its brain.",
    "Scotland's national animal is the unicorn.",
    "The fingerprints of koalas are so similar to humans' they have confused crime scenes.",
    "A jiffy is an actual unit of time: 1/100th of a second.",
    "There is enough gold in the Earth's core to coat the entire planet in a layer half a metre deep.",
    "Butterflies taste with their feet.",
    "The Sahara Desert was green and full of lakes as recently as 6,000 years ago.",
    "Sound cannot travel through the vacuum of space.",
    "Polar bears have black skin under their translucent fur.",
    "The longest recorded flight of a chicken is 13 seconds.",
    "The word 'set' has the most definitions of any word in the English language.",
    "Antarctica is the largest desert on Earth.",
    "A snail can sleep for up to three years.",
    "The Moon is slowly drifting away from Earth at about 3.8 cm per year.",
    "The unicorn was described in ancient texts long before it became a fantasy creature.",
    "Humans share about 60% of their DNA with bananas.",
    "The first oranges were not orange — they were green.",
    "A cloud can weigh more than a million pounds.",
    "The Statue of Liberty was originally a shade of copper before oxidising to green.",
    "Tigers have striped skin, not just striped fur.",
    "The human nose can distinguish over one trillion different scents.",
    "Saturn's rings are made mostly of ice and are only about 10 metres thick in places.",
    "The blue whale's heart is so large a human could swim through its arteries.",
    "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
    "There are more stars in the universe than grains of sand on all of Earth's beaches.",
    "A hummingbird's heart can beat over 1,200 times per minute.",
    "Pineapples take about two to three years to grow a single fruit.",
    "The Pacific Ocean is wider than the Moon's diameter would fit across many times over.",
    "The average cumulus cloud holds enough water for a small pond.",
    "Elephants are the only mammals that can't jump.",
    "The tongue is the fastest-healing part of the human body.",
    "A crocodile cannot stick out its tongue.",
    "The smell of freshly cut grass is actually a plant distress signal.",
    "Some turtles can breathe through their rear ends.",
    "The dot pattern on dice always adds up to seven on opposite faces.",
    "Peanuts are not nuts — they are legumes, related to beans and lentils.",
    "The Earth is not a perfect sphere; it bulges slightly at the equator.",
    "Wombat teeth never stop growing throughout their lives.",
    "A day on Mars is only about 40 minutes longer than a day on Earth.",
    "Owls cannot move their eyeballs, so they turn their whole heads instead.",
    "Bubble wrap was originally invented as textured wallpaper.",
    "The human body contains enough carbon to fill about 9,000 pencils.",
    "The wood frog can survive being frozen solid and thaw back to life.",
    "The average person walks the equivalent of about five times around the world in a lifetime.",
    "There is a species of jellyfish considered biologically immortal.",
    "The loudest sound ever recorded was the 1883 eruption of Krakatoa, heard 3,000 miles away.",
    "A teaspoon of neutron star material would weigh about six billion tons on Earth.",
    "Rats laugh when they are tickled.",
    "Coconuts kill more people each year than sharks do.",
    "The letters in the word 'listen' can be rearranged to spell 'silent'.",
    "Giraffes have the same number of neck bones as humans: seven.",
    "The Hawaiian alphabet has only 13 letters.",
    "A group of owls is called a parliament.",
    "The average lightning bolt is only about as wide as a thumb.",
    "Slugs have around 27,000 microscopic teeth.",
    "The Amazon rainforest produces about 20% of the world's oxygen.",
    "There are more trees on Earth than stars in the Milky Way.",
    "Mosquitoes are attracted to the colour black more than other colours.",
    "The shortest complete sentence in English is 'I am.'",
    "A shrimp's heartbeat lives in its head, and its nervous system runs the length of its body.",
    "Some cats are allergic to humans.",
    "The Eiffel Tower was meant to be a temporary structure for the 1889 World's Fair.",
    "Venus is the hottest planet in the solar system, even hotter than Mercury.",
    "The average person spends about six months of their life waiting for red lights to turn green.",
    "A group of pandas is called an embarrassment.",
    "The tiny pocket in jeans was originally designed to hold a pocket watch.",
    "Sloths can hold their breath longer than dolphins can.",
    "The world's largest snowflake on record was reportedly 38 cm wide.",
    "A bolt of lightning contains enough energy to toast about 100,000 slices of bread.",
    "Norway once knighted a penguin.",
    "The heart of a blue whale can weigh as much as a small car.",
    "Your stomach gets a new lining every few days to avoid digesting itself.",
    "The word 'muscle' comes from the Latin for 'little mouse'.",
    "Cashews grow attached to the bottom of a cashew apple.",
    "A snail can regenerate parts of its body, including its eyes.",
    "The dot of an exclamation mark was once called a 'bang' by printers.",
    "Some frogs can be frozen and then thawed and continue living.",
    "The average human heart beats about 100,000 times a day.",
    "Ketchup was once sold in the 1830s as medicine.",
    "The longest place name in the world has 85 letters, a hill in New Zealand.",
    "A day on the dwarf planet Pluto lasts about 153 hours.",
    "Bananas are naturally slightly radioactive due to their potassium content.",
    "The first computer mouse was made of wood.",
    "Sharks can detect a single drop of blood in an Olympic-sized swimming pool.",
    "The plastic tips on shoelaces are called aglets.",
    "The human eye can distinguish about 10 million colours.",
    "Starfish have no brain and no blood.",
    "The Great Barrier Reef is the largest living structure on Earth, visible from space.",
    "A group of crows is called a murder.",
    "The average cloud floats because its water droplets are incredibly tiny and spread out.",
    "Honeybees communicate the location of flowers by dancing.",
    "The coldest temperature ever recorded on Earth was about -89°C in Antarctica.",
    "Your ears and nose never stop growing throughout your life.",
    "The world's smallest mammal is the bumblebee bat, weighing about two grams.",
    "There are more possible ways to shuffle a deck of cards than there are atoms on Earth.",
    "The average person blinks about 20 times a minute — over 10 million times a year.",
]

# Fixed-seed shuffle so the daily fact order is stable across devices and restarts.
_BB_FACTS_POOL = list(BB_FACTS)
random.Random(20260202).shuffle(_BB_FACTS_POOL)
_BB_FACT_EPOCH = date(2026, 1, 1)


def _bb_fact_for(day: date) -> str:
    idx = (day - _BB_FACT_EPOCH).days % len(_BB_FACTS_POOL)
    return _BB_FACTS_POOL[idx]




async def seed():
    if await db.districts.count_documents({}) == 0:
        await db.districts.insert_many([dict(d) for d in DISTRICTS])
        logger.info("Seeded districts")
    # Keep each district's features (and other rendered fields) in sync with the
    # DISTRICTS constant so feature-list changes in code are reflected in the DB.
    for d in DISTRICTS:
        await db.districts.update_one(
            {"slug": d["slug"]},
            {"$set": {"features": d.get("features", []),
                      "name": d.get("name"), "icon": d.get("icon"),
                      "tagline": d.get("tagline"), "description": d.get("description"),
                      "chatmonger": d.get("chatmonger")}},
        )
    if await db.feed.count_documents({}) == 0:
        await db.feed.insert_many([dict(p) for p in FEED_POSTS])
        logger.info("Seeded feed")
    if await db.bazaar.count_documents({}) == 0:
        await db.bazaar.insert_many([dict(b) for b in BAZAAR])
        logger.info("Seeded bazaar")
    # Book media (eBooks + Audio Books) — insert any that are missing (idempotent).
    for b in BOOK_LISTINGS:
        if not await db.bazaar.find_one({"id": b["id"]}):
            await db.bazaar.insert_one(dict(b))
    # Sparking Dawn seeded profiles (idempotent).
    for p in DATING_PROFILES:
        if not await db.dating_profiles.find_one({"user_id": p["user_id"]}):
            await db.dating_profiles.insert_one(dict(p))
    # Author Anvil seeded works (idempotent).
    for w in ANVIL_WORKS:
        if not await db.anvil_works.find_one({"id": w["id"]}):
            await db.anvil_works.insert_one(dict(w))
    if await db.rt_communities.count_documents({}) == 0:
        await db.rt_communities.insert_many([dict(c) for c in RT_COMMUNITIES])
        await db.rt_threads.insert_many([dict(t) for t in RT_THREADS])
        await db.rt_replies.insert_many([dict(r) for r in RT_REPLIES])
        logger.info("Seeded roundtable")
    if await db.af_questions.count_documents({}) == 0:
        await db.af_questions.insert_many([dict(q) for q in AF_QUESTIONS])
        await db.af_answers.insert_many([dict(a) for a in AF_ANSWERS])
        logger.info("Seeded answerfier")
    # BrainBoost courses & quizzes (idempotent).
    for c in BB_COURSES:
        if not await db.bb_courses.find_one({"id": c["id"]}):
            await db.bb_courses.insert_one(dict(c))
    for q in BB_QUIZZES:
        if not await db.bb_quizzes.find_one({"id": q["id"]}):
            await db.bb_quizzes.insert_one(dict(q))
    await db.af_questions.create_index("qotd_date", unique=True, sparse=True)
    await db.users.create_index("email", unique=True)


async def _user_like_ids(user_id: str) -> set:
    rows = await db.likes.find({"user_id": user_id}, {"_id": 0, "post_id": 1}).to_list(1000)
    return {r["post_id"] for r in rows}


async def _user_saves(user_id: str, kind: str | None = None) -> list:
    q = {"user_id": user_id}
    if kind:
        q["kind"] = kind
    return await db.saves.find(q, {"_id": 0}).to_list(2000)


def enrich_post(post: dict, liked_ids: set, saved_ids: set) -> dict:
    post = {k: v for k, v in post.items() if k != "_id"}
    post["liked"] = post["id"] in liked_ids
    post["saved"] = post["id"] in saved_ids
    return post


# ----------------------------- Routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Konphlux API — one ID, every district."}


# ---------- Auth ----------
@api_router.post("/auth/register", status_code=201)
async def register(body: RegisterBody):
    email = str(body.email).lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="That email is already enrolled.")
    handle = "@" + email.split("@")[0].replace(".", "").replace("+", "")[:20]
    user = {
        "id": uuid.uuid4().hex,
        "email": email,
        "password_hash": password_hash.hash(body.password),
        "display_name": body.display_name.strip(),
        "handle": handle,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(dict(user))
    token = create_access_token(user["id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    email = str(body.email).lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        password_hash.verify(body.password, password_hash.hash("dummy-password"))
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not password_hash.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(require_user)):
    return public_user(user)


# ---------- Districts ----------
@api_router.get("/districts")
async def get_districts():
    docs = await db.districts.find({}, {"_id": 0}).to_list(100)
    docs.sort(key=lambda d: d["name"])
    return docs


@api_router.get("/districts/{slug}")
async def get_district(slug: str, user: dict = Depends(require_user)):
    doc = await db.districts.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="District not found")
    others = await db.districts.find({"slug": {"$nin": [slug, "home"]}}, {"_id": 0}).to_list(100)
    others.sort(key=lambda d: d["name"])
    doc["nearby"] = others[:6]
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "district")}
    doc["saved"] = slug in saved_ids
    return doc


# ---------- Feed ----------
@api_router.get("/feed")
async def get_feed(user: dict = Depends(require_user)):
    docs = await db.feed.find({}).to_list(500)
    docs.sort(key=lambda p: p.get("created_at", "") or "", reverse=True)
    docs.sort(key=lambda p: 0 if p.get("created_at") else 1)  # user posts (with created_at) first-ish
    docs.sort(key=lambda p: (p.get("created_at") or "0"), reverse=True)
    liked_ids = await _user_like_ids(user["id"])
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "post")}
    posts = [enrich_post(p, liked_ids, saved_ids) for p in docs]
    return {"stories": STORIES, "trending": TRENDING, "suggestions": SUGGESTIONS, "posts": posts}


@api_router.post("/feed")
async def create_post(payload: PostCreate, user: dict = Depends(require_user)):
    post = {
        "id": uuid.uuid4().hex,
        "author": user["display_name"],
        "user_id": user["id"],
        "kind": "You",
        "time": "just now",
        "body": payload.body,
        "likes": 0,
        "comments": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feed.insert_one(dict(post))
    return enrich_post(post, set(), set())


@api_router.post("/feed/{post_id}/like")
async def toggle_like(post_id: str, user: dict = Depends(require_user)):
    doc = await db.feed.find_one({"id": post_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.likes.find_one({"user_id": user["id"], "post_id": post_id})
    if existing:
        await db.likes.delete_one({"user_id": user["id"], "post_id": post_id})
        liked = False
        delta = -1
    else:
        await db.likes.insert_one({"user_id": user["id"], "post_id": post_id})
        liked = True
        delta = 1
    likes = max(0, doc.get("likes", 0) + delta)
    await db.feed.update_one({"id": post_id}, {"$set": {"likes": likes}})
    return {"id": post_id, "liked": liked, "likes": likes}


# ---------- Sparking Dawn (dating) ----------
def _match_key(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


def _dating_card(doc: dict) -> dict:
    return {
        "id": doc["user_id"],
        "display_name": doc.get("display_name", "Someone"),
        "gender": doc.get("gender"),
        "age": doc.get("age"),
        "tagline": doc.get("tagline", ""),
        "bio": doc.get("bio", ""),
        "photo": doc.get("photo", ""),
    }


async def _dating_card_for(target_id: str) -> dict:
    prof = await db.dating_profiles.find_one({"user_id": target_id})
    if prof:
        return _dating_card(prof)
    u = await db.users.find_one({"id": target_id})
    if u:
        return {"id": target_id, "display_name": u.get("display_name", "Someone"), "gender": None,
                "age": None, "tagline": "", "bio": u.get("bio", ""), "photo": u.get("avatar", "")}
    return {"id": target_id, "display_name": "Someone", "gender": None, "age": None, "tagline": "", "bio": "", "photo": ""}


@api_router.get("/dating/me")
async def dating_me(user: dict = Depends(require_user)):
    prof = await db.dating_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
    return prof


@api_router.post("/dating/profile")
async def dating_save_profile(body: DatingProfileBody, user: dict = Depends(require_user)):
    if body.gender not in ("man", "woman", "nonbinary"):
        raise HTTPException(status_code=400, detail="Please pick how you identify.")
    seeking = [s for s in body.seeking if s in ("man", "woman", "nonbinary")] or ["man", "woman"]
    doc = {
        "user_id": user["id"],
        "display_name": user["display_name"],
        "gender": body.gender,
        "seeking": seeking,
        "bio": body.bio.strip(),
        "tagline": body.tagline.strip(),
        "photo": body.photo.strip() or user.get("avatar", ""),
        "age": body.age,
        "seed": False,
        "active": True,
    }
    await db.dating_profiles.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    doc.pop("_id", None)
    return doc


@api_router.get("/dating/discover")
async def dating_discover(user: dict = Depends(require_user), seeking: str = "all"):
    swiped = {s["target_id"] for s in await db.dating_swipes.find({"user_id": user["id"]}, {"_id": 0, "target_id": 1}).to_list(5000)}
    my_matches = await db.dating_matches.find({"users": user["id"]}, {"_id": 0}).to_list(2000)
    matched_ids = set()
    for m in my_matches:
        matched_ids.update(u for u in m["users"] if u != user["id"])
    exclude = swiped | matched_ids | {user["id"]}
    query: dict = {"active": True, "user_id": {"$nin": list(exclude)}}
    if seeking in ("man", "woman", "nonbinary"):
        query["gender"] = seeking
    docs = await db.dating_profiles.find(query, {"_id": 0}).to_list(200)
    random.shuffle(docs)
    return [_dating_card(d) for d in docs[:30]]


@api_router.post("/dating/swipe")
async def dating_swipe(body: SwipeBody, user: dict = Depends(require_user)):
    if body.action not in ("like", "pass"):
        raise HTTPException(status_code=400, detail="Unknown action.")
    if body.target_id == user["id"]:
        raise HTTPException(status_code=400, detail="You can't swipe on yourself.")
    await db.dating_swipes.update_one(
        {"user_id": user["id"], "target_id": body.target_id},
        {"$set": {"action": body.action, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    if body.action != "like":
        return {"match": False}

    target = await db.dating_profiles.find_one({"user_id": body.target_id})
    liked_back = False
    if target and target.get("seed"):
        liked_back = bool(target.get("likes_back"))
    else:
        rev = await db.dating_swipes.find_one({"user_id": body.target_id, "target_id": user["id"], "action": "like"})
        liked_back = bool(rev)

    if not liked_back:
        return {"match": False}

    key = _match_key(user["id"], body.target_id)
    if not await db.dating_matches.find_one({"key": key}):
        await db.dating_matches.insert_one({
            "id": uuid.uuid4().hex,
            "key": key,
            "users": [user["id"], body.target_id],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"match": True, "profile": await _dating_card_for(body.target_id)}


@api_router.get("/dating/matches")
async def dating_matches(user: dict = Depends(require_user)):
    docs = await db.dating_matches.find({"users": user["id"]}).to_list(2000)
    docs.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    out = []
    for m in docs:
        other = next((u for u in m["users"] if u != user["id"]), None)
        if other:
            card = await _dating_card_for(other)
            card["matched_at"] = m.get("created_at")
            out.append(card)
    return out



# ---------- Bazaar (browse + sell + auctions) ----------
BID_INCREMENT_CENTS = 100  # minimum raise between bids


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _maybe_end_auction(doc: dict) -> dict:
    """Lazily settle an auction whose end time has passed."""
    if doc.get("is_auction") and doc.get("status") == "active":
        ends = doc.get("ends_at")
        if ends and _now() >= datetime.fromisoformat(ends):
            final = doc.get("current_bid_cents") or doc.get("starting_price_cents") or doc.get("price_cents") or 0
            winner = doc.get("highest_bidder_id")
            await db.bazaar.update_one(
                {"id": doc["id"]},
                {"$set": {"status": "ended", "winner_id": winner, "price_cents": final}},
            )
            doc = {**doc, "status": "ended", "winner_id": winner, "price_cents": final}
    return doc


def _public_listing(doc: dict, user_id: str, saved_ids: set) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    is_auction = bool(d.get("is_auction"))
    d["kind"] = "auction" if is_auction else "fixed"
    d["is_auction"] = is_auction
    d["saved"] = d["id"] in saved_ids
    d["is_seller"] = d.get("seller_id") == user_id
    d.setdefault("rating", 0)
    d.setdefault("reviews", 0)
    d["booth_id"] = d.get("booth_id")
    d["booth_name"] = d.get("booth_name")
    d["listing_type"] = "booth" if d.get("booth_id") else "individual"
    if is_auction:
        current_bid = d.get("current_bid_cents")
        start = d.get("starting_price_cents") or 0
        current = current_bid or start
        ended = d.get("status") == "ended"
        d["price_cents"] = current
        d["starting_price_cents"] = start
        d["current_bid_cents"] = current_bid
        d["bid_count"] = d.get("bid_count", 0)
        d["highest_bidder_name"] = d.get("highest_bidder_name")
        d["ended"] = ended
        ends = d.get("ends_at")
        d["seconds_left"] = (
            max(0, int((datetime.fromisoformat(ends) - _now()).total_seconds())) if ends and not ended else 0
        )
        d["is_winner"] = ended and d.get("winner_id") == user_id
        d["min_next_bid_cents"] = current + BID_INCREMENT_CENTS if current_bid else start
        d["can_bid"] = (not ended) and (not d["is_seller"])
        d["can_buy"] = ended and d["is_winner"]
    else:
        d["ended"] = False
        d["can_bid"] = False
        d["can_buy"] = not d["is_seller"]
    return d


@api_router.get("/bazaar")
async def get_bazaar(user: dict = Depends(require_user)):
    raw = await db.bazaar.find({}).to_list(500)
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    listings = [_public_listing(await _maybe_end_auction(d), user["id"], saved_ids) for d in raw]
    listings.sort(key=lambda l: l.get("created_at") or "", reverse=True)
    cats = sorted({l["category"] for l in listings})
    return {"categories": cats, "listings": listings}


@api_router.get("/bazaar/mine")
async def get_my_listings(user: dict = Depends(require_user)):
    raw = await db.bazaar.find({"seller_id": user["id"]}).to_list(500)
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    listings = [_public_listing(await _maybe_end_auction(d), user["id"], saved_ids) for d in raw]
    listings.sort(key=lambda l: l.get("created_at") or "", reverse=True)
    return listings


@api_router.post("/bazaar/upload", status_code=201)
async def upload_listing_image(user: dict = Depends(require_user), file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 8MB).")
    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please choose an image file.")
    ext = {"image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(content_type, "jpg")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4().hex}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except Exception as e:  # noqa: BLE001
        logger.exception("Image upload failed")
        raise HTTPException(status_code=502, detail="Couldn't store the image. Try again.") from e
    return {"path": path}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="File not found") from e
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=31536000"})


@api_router.post("/bazaar", status_code=201)
async def create_listing(body: ListingCreate, user: dict = Depends(require_user)):
    if body.kind not in ("fixed", "auction"):
        raise HTTPException(status_code=400, detail="Unknown listing type.")
    now = _now()
    listing = {
        "id": uuid.uuid4().hex,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "category": body.category.strip(),
        "image": body.image.strip(),
        "seller": user["display_name"],
        "seller_id": user["id"],
        "rating": 0,
        "reviews": 0,
        "created_at": now.isoformat(),
    }
    if body.kind == "auction":
        if not body.starting_price_cents or not body.duration_hours:
            raise HTTPException(status_code=400, detail="Auctions need a starting price and a duration.")
        listing.update({
            "is_auction": True,
            "status": "active",
            "starting_price_cents": body.starting_price_cents,
            "current_bid_cents": None,
            "highest_bidder_id": None,
            "highest_bidder_name": None,
            "bid_count": 0,
            "price_cents": body.starting_price_cents,
            "ends_at": (now + timedelta(hours=body.duration_hours)).isoformat(),
            "winner_id": None,
        })
    else:
        if not body.price_cents:
            raise HTTPException(status_code=400, detail="A fixed-price listing needs a price.")
        listing.update({"is_auction": False, "price_cents": body.price_cents})
    # Optionally attach to one of the seller's booths (else it's an individual item).
    if body.booth_id:
        booth = await db.booths.find_one({"id": body.booth_id})
        if not booth or booth.get("owner_id") != user["id"]:
            raise HTTPException(status_code=400, detail="That booth isn't yours.")
        listing["booth_id"] = booth["id"]
        listing["booth_name"] = booth["name"]
    await db.bazaar.insert_one(dict(listing))
    return _public_listing(listing, user["id"], set())


# ---------- Booths (seller storefronts) ----------
async def _booth_public(doc: dict) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["listing_count"] = await db.bazaar.count_documents({"booth_id": d["id"]})
    return d


@api_router.post("/booths", status_code=201)
async def create_booth(body: BoothCreate, user: dict = Depends(require_user)):
    booth = {
        "id": uuid.uuid4().hex,
        "name": body.name.strip(),
        "description": body.description.strip(),
        "image": body.image.strip(),
        "owner_id": user["id"],
        "owner_name": user["display_name"],
        "created_at": _now().isoformat(),
    }
    await db.booths.insert_one(dict(booth))
    return await _booth_public(booth)


@api_router.get("/booths")
async def list_booths(user: dict = Depends(require_user)):
    docs = await db.booths.find({}).to_list(500)
    booths = [await _booth_public(d) for d in docs]
    booths.sort(key=lambda b: b.get("listing_count", 0), reverse=True)
    return booths


@api_router.get("/booths/mine")
async def my_booths(user: dict = Depends(require_user)):
    docs = await db.booths.find({"owner_id": user["id"]}).to_list(500)
    booths = [await _booth_public(d) for d in docs]
    booths.sort(key=lambda b: b.get("created_at", ""), reverse=True)
    return booths


@api_router.get("/booths/{booth_id}")
async def booth_detail(booth_id: str, user: dict = Depends(require_user)):
    booth = await db.booths.find_one({"id": booth_id})
    if not booth:
        raise HTTPException(status_code=404, detail="Booth not found")
    result = await _booth_public(booth)
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    raw = await db.bazaar.find({"booth_id": booth_id}).to_list(500)
    listings = [_public_listing(await _maybe_end_auction(d), user["id"], saved_ids) for d in raw]
    listings.sort(key=lambda l: l.get("created_at") or "", reverse=True)
    result["listings"] = listings
    result["is_owner"] = booth.get("owner_id") == user["id"]
    return result


@api_router.get("/bazaar/{item_id}")
async def get_bazaar_item(item_id: str, user: dict = Depends(require_user)):
    doc = await db.bazaar.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    doc = await _maybe_end_auction(doc)
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    return _public_listing(doc, user["id"], saved_ids)


@api_router.delete("/bazaar/{item_id}")
async def delete_listing(item_id: str, user: dict = Depends(require_user)):
    doc = await db.bazaar.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    if doc.get("seller_id") != user["id"]:
        raise HTTPException(status_code=403, detail="You can only remove your own listings.")
    await db.bazaar.delete_one({"id": item_id})
    await db.saves.delete_many({"kind": "listing", "item_id": item_id})
    # pull it from every cart
    async for cart in db.carts.find({"items.item_id": item_id}):
        items = [i for i in cart.get("items", []) if i["item_id"] != item_id]
        await db.carts.update_one({"_id": cart["_id"]}, {"$set": {"items": items}})
    return {"deleted": True, "id": item_id}


@api_router.get("/bazaar/{item_id}/bids")
async def list_bids(item_id: str, user: dict = Depends(require_user)):
    bids = await db.bazaar_bids.find({"listing_id": item_id}, {"_id": 0}).to_list(500)
    bids.sort(key=lambda b: b.get("created_at", ""), reverse=True)
    return bids


@api_router.post("/bazaar/{item_id}/bid")
async def place_bid(item_id: str, body: BidBody, user: dict = Depends(require_user)):
    doc = await db.bazaar.find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    doc = await _maybe_end_auction(doc)
    if not doc.get("is_auction"):
        raise HTTPException(status_code=400, detail="This listing isn't an auction.")
    if doc.get("status") == "ended":
        raise HTTPException(status_code=409, detail="This auction has ended.")
    if doc.get("seller_id") == user["id"]:
        raise HTTPException(status_code=400, detail="You can't bid on your own listing.")
    current = doc.get("current_bid_cents")
    if current is None:
        min_bid = doc.get("starting_price_cents") or 0
        if body.amount_cents < min_bid:
            raise HTTPException(status_code=400, detail="Bid must meet the starting price.")
    else:
        min_bid = current + BID_INCREMENT_CENTS
        if body.amount_cents < min_bid:
            raise HTTPException(status_code=400, detail="Bid must be higher than the current bid.")
    prev_bidder = doc.get("highest_bidder_id")
    await db.bazaar.update_one(
        {"id": item_id},
        {"$set": {
            "current_bid_cents": body.amount_cents,
            "highest_bidder_id": user["id"],
            "highest_bidder_name": user["display_name"],
            "price_cents": body.amount_cents,
        }, "$inc": {"bid_count": 1}},
    )
    await db.bazaar_bids.insert_one({
        "id": uuid.uuid4().hex,
        "listing_id": item_id,
        "user_id": user["id"],
        "bidder_name": user["display_name"],
        "amount_cents": body.amount_cents,
        "created_at": _now().isoformat(),
    })
    # Notify the previous highest bidder that they've been outbid.
    if prev_bidder and prev_bidder != user["id"]:
        await _notify(
            prev_bidder,
            "outbid",
            listing_id=item_id,
            title="You've been outbid",
            body=f'{user["display_name"]} outbid you on "{doc.get("title", "an item")}" — now {_dollars(body.amount_cents)}.',
        )
    fresh = await db.bazaar.find_one({"id": item_id})
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    return _public_listing(fresh, user["id"], saved_ids)


# ---------- Notifications (in-app alerts) ----------
def _dollars(cents: int) -> str:
    return "$" + f"{cents / 100:,.2f}"


async def _notify(user_id: str, ntype: str, listing_id: str | None, title: str, body: str) -> None:
    await db.notifications.insert_one({
        "id": uuid.uuid4().hex,
        "user_id": user_id,
        "type": ntype,
        "listing_id": listing_id,
        "title": title,
        "body": body,
        "read": False,
        "created_at": _now().isoformat(),
    })


@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(require_user)):
    docs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    return docs


@api_router.get("/notifications/unread_count")
async def unread_count(user: dict = Depends(require_user)):
    count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": count}


@api_router.post("/notifications/read")
async def mark_all_read(user: dict = Depends(require_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Saves ----------
@api_router.post("/saves")
async def toggle_save(body: SaveBody, user: dict = Depends(require_user)):
    if body.kind not in ("post", "listing", "district"):
        raise HTTPException(status_code=400, detail="Unknown save kind")
    q = {"user_id": user["id"], "kind": body.kind, "item_id": body.item_id}
    existing = await db.saves.find_one(q)
    if existing:
        await db.saves.delete_one(q)
        return {"saved": False, **{k: v for k, v in q.items() if k != "user_id"}}
    await db.saves.insert_one({**q, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"saved": True, **{k: v for k, v in q.items() if k != "user_id"}}


@api_router.get("/saves")
async def list_saves(user: dict = Depends(require_user)):
    saves = await _user_saves(user["id"])
    post_ids = [s["item_id"] for s in saves if s["kind"] == "post"]
    listing_ids = [s["item_id"] for s in saves if s["kind"] == "listing"]
    district_slugs = [s["item_id"] for s in saves if s["kind"] == "district"]

    posts = await db.feed.find({"id": {"$in": post_ids}}).to_list(500)
    liked_ids = await _user_like_ids(user["id"])
    posts = [enrich_post(p, liked_ids, set(post_ids)) for p in posts]

    listings = await db.bazaar.find({"id": {"$in": listing_ids}}, {"_id": 0}).to_list(500)
    for d in listings:
        d["saved"] = True
    districts = await db.districts.find({"slug": {"$in": district_slugs}}, {"_id": 0}).to_list(100)

    return {"posts": posts, "listings": listings, "districts": districts}


# ---------- Author Anvil (writing & publishing) ----------
async def _anvil_public(doc: dict, user_id: str, applauded_ids: set) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    d.setdefault("applause", 0)
    d.setdefault("open_cowriting", False)
    d["applauded"] = d["id"] in applauded_ids
    d["is_author"] = d.get("author_id") == user_id
    d["contribution_count"] = await db.anvil_contributions.count_documents({"work_id": d["id"]})
    excerpt = (d.get("body") or "").strip().replace("\n", " ")
    d["excerpt"] = excerpt[:160] + ("…" if len(excerpt) > 160 else "")
    return d


async def _anvil_llm(system: str, prompt: str, session: str) -> str:
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session, system_message=system).with_model(*CHAT_MODEL)
    return await chat.send_message(UserMessage(text=prompt))


@api_router.get("/anvil/prompts")
async def anvil_prompts(user: dict = Depends(require_user)):
    docs = await db.anvil_prompts.find({}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    user_prompts = [d["text"] for d in docs]
    return {"prompts": user_prompts + ANVIL_PROMPTS, "categories": ANVIL_CATEGORIES}


@api_router.post("/anvil/prompts", status_code=201)
async def anvil_add_prompt(body: PromptCreate, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex,
        "text": body.text.strip(),
        "author": user["display_name"],
        "author_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.anvil_prompts.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.post("/anvil/genoscribe")
async def anvil_genoscribe(body: GenoBody, user: dict = Depends(require_user)):
    if body.tool not in ("story", "script", "prompt"):
        raise HTTPException(status_code=400, detail="Unknown GenoScribe tool.")
    tone = f" Tone: {body.tone}." if body.tone else ""
    genre = f" Genre: {body.genre}." if body.genre else ""
    words = "about 180 words" if body.length == "short" else "about 450 words"
    base = (
        "You are GenoScribe, the AI writing studio of Author Anvil inside Konphlux, a whimsical steampunk world. "
        "Write vivid, atmospheric, original content. Return ONLY the requested writing — no preamble or commentary."
    )
    if body.tool == "prompt":
        system = base
        prompt = (
            f"Write ONE original, evocative writing prompt (one or two sentences) for a steampunk story "
            f"inspired by: {body.topic}.{genre}{tone} Return only the prompt sentence, no quotes, no label."
        )
        try:
            text = await _anvil_llm(system, prompt, session=f"geno-prompt:{user['id']}")
        except Exception as e:  # noqa: BLE001
            logger.exception("GenoScribe prompt error")
            raise HTTPException(status_code=502, detail="GenoScribe's aether pen ran dry. Try again.") from e
        return {"tool": "prompt", "title": "", "text": text.strip().strip('"')}

    kind = "screenplay scene" if body.tool == "script" else "short story"
    system = base
    prompt = (
        f"Write a complete {kind} ({words}) in a whimsical steampunk style about: {body.topic}.{genre}{tone} "
        f"On the FIRST line output 'TITLE: <a short evocative title>' and then the {kind} on the following lines."
    )
    try:
        raw = await _anvil_llm(system, prompt, session=f"geno-{body.tool}:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("GenoScribe error")
        raise HTTPException(status_code=502, detail="GenoScribe's aether pen ran dry. Try again.") from e
    title = ""
    text = raw.strip()
    lines = text.split("\n", 1)
    if lines and lines[0].strip().upper().startswith("TITLE:"):
        title = lines[0].split(":", 1)[1].strip()
        text = lines[1].strip() if len(lines) > 1 else ""
    return {"tool": body.tool, "title": title, "text": text}


@api_router.get("/anvil/cowriting")
async def anvil_cowriting(user: dict = Depends(require_user)):
    docs = await db.anvil_works.find({"open_cowriting": True}).to_list(300)
    applauded = {a["work_id"] for a in await db.anvil_applause.find({"user_id": user["id"]}, {"_id": 0, "work_id": 1}).to_list(5000)}
    works = [await _anvil_public(d, user["id"], applauded) for d in docs]
    works.sort(key=lambda w: w.get("created_at", ""), reverse=True)
    return works


@api_router.get("/anvil")
async def anvil_list(user: dict = Depends(require_user), kind: str | None = None, category: str | None = None):
    query: dict = {}
    if kind in ("story", "script"):
        query["kind"] = kind
    if category and category != "All":
        query["category"] = category
    docs = await db.anvil_works.find(query).to_list(500)
    applauded = {a["work_id"] for a in await db.anvil_applause.find({"user_id": user["id"]}, {"_id": 0, "work_id": 1}).to_list(5000)}
    works = [await _anvil_public(d, user["id"], applauded) for d in docs]
    works.sort(key=lambda w: w.get("created_at", ""), reverse=True)
    cats = sorted({w["category"] for w in works if w.get("category")})
    return {"works": works, "categories": cats}


@api_router.post("/anvil", status_code=201)
async def anvil_create(body: AnvilWorkCreate, user: dict = Depends(require_user)):
    if body.kind not in ("story", "script"):
        raise HTTPException(status_code=400, detail="A work is either a story or a script.")
    category = body.category if body.category in ANVIL_CATEGORIES else "General"
    work = {
        "id": uuid.uuid4().hex,
        "title": body.title.strip(),
        "kind": body.kind,
        "category": category,
        "body": body.body.strip(),
        "author": user["display_name"],
        "author_id": user["id"],
        "applause": 0,
        "open_cowriting": body.open_cowriting,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.anvil_works.insert_one(dict(work))
    return await _anvil_public(work, user["id"], set())


@api_router.get("/anvil/{work_id}")
async def anvil_detail(work_id: str, user: dict = Depends(require_user)):
    doc = await db.anvil_works.find_one({"id": work_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Work not found")
    applauded = {a["work_id"] for a in await db.anvil_applause.find({"user_id": user["id"]}, {"_id": 0, "work_id": 1}).to_list(5000)}
    work = await _anvil_public(doc, user["id"], applauded)
    contribs = await db.anvil_contributions.find({"work_id": work_id}, {"_id": 0}).to_list(1000)
    contribs.sort(key=lambda c: c.get("created_at", ""))
    work["contributions"] = contribs
    return work


@api_router.post("/anvil/{work_id}/applause")
async def anvil_applause(work_id: str, user: dict = Depends(require_user)):
    doc = await db.anvil_works.find_one({"id": work_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Work not found")
    q = {"user_id": user["id"], "work_id": work_id}
    existing = await db.anvil_applause.find_one(q)
    if existing:
        await db.anvil_applause.delete_one(q)
        applauded, delta = False, -1
    else:
        await db.anvil_applause.insert_one(dict(q))
        applauded, delta = True, 1
    applause = max(0, doc.get("applause", 0) + delta)
    await db.anvil_works.update_one({"id": work_id}, {"$set": {"applause": applause}})
    return {"id": work_id, "applauded": applauded, "applause": applause}


@api_router.post("/anvil/{work_id}/contribute", status_code=201)
async def anvil_contribute(work_id: str, body: ContributionBody, user: dict = Depends(require_user)):
    doc = await db.anvil_works.find_one({"id": work_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Work not found")
    if not doc.get("open_cowriting"):
        raise HTTPException(status_code=403, detail="This work isn't open for co-writing.")
    contribution = {
        "id": uuid.uuid4().hex,
        "work_id": work_id,
        "body": body.body.strip(),
        "author": user["display_name"],
        "author_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.anvil_contributions.insert_one(dict(contribution))
    contribution.pop("_id", None)
    return contribution


@api_router.post("/anvil/assist")
async def anvil_assist(body: AssistBody, user: dict = Depends(require_user)):
    kind = "screenplay" if body.kind == "script" else "story"
    system = (
        "You are GenoScribe, the resident writing-smith of Author Anvil inside Konphlux, a whimsical "
        "steampunk world. You help authors write vivid, atmospheric prose. Match the author's voice. "
        "Return only the requested writing — no preamble, no commentary, no markdown headers."
    )
    if body.mode == "idea":
        prompt = (
            f"Give me three short, original {kind} ideas set in a steampunk world"
            + (f' related to the title "{body.title}".' if body.title else ".")
            + " Return them as a simple numbered list, one sentence each."
        )
    elif body.mode == "improve":
        prompt = f"Rewrite the following {kind} excerpt to be more vivid and evocative, keeping the same meaning and length:\n\n{body.text}"
    else:  # continue
        seed = body.text or (f"Title: {body.title}" if body.title else "")
        prompt = f"Continue this {kind} with the next 1-2 paragraphs, picking up naturally:\n\n{seed}"
    try:
        text = await _anvil_llm(system, prompt, session=f"anvil-assist:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("GenoScribe error")
        raise HTTPException(status_code=502, detail="GenoScribe's aether pen ran dry. Try again.") from e
    return {"text": text}


@api_router.post("/anvil/adventure")
async def anvil_adventure(body: AdventureBody, user: dict = Depends(require_user)):
    system = (
        "You are the narrator of AIventure, an interactive steampunk text adventure inside Konphlux. "
        "Narrate in second person, vividly but briefly (2-4 sentences). After each passage, always end with "
        "'What do you do?' Keep the story coherent with what came before and react to the player's action."
    )
    transcript = ""
    for m in body.history[-12:]:
        role = "You" if m.get("role") == "user" else "Narrator"
        transcript += f"{role}: {m.get('content', '')}\n"
    prompt = (
        (f"Story so far:\n{transcript}\n" if transcript.strip() else "")
        + f"The player does: {body.action}\nNarrate what happens next."
    )
    try:
        text = await _anvil_llm(system, prompt, session=f"anvil-adventure:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("AIventure error")
        raise HTTPException(status_code=502, detail="The adventure's aether flickered. Try again.") from e
    return {"text": text}



# ---------- Chatmonger (AI) ----------
@api_router.get("/chatmonger/{slug}")
async def chat_history(slug: str, user: dict = Depends(require_user)):
    district = await db.districts.find_one({"slug": slug}, {"_id": 0})
    if not district:
        raise HTTPException(status_code=404, detail="District not found")
    msgs = await db.chat_messages.find(
        {"user_id": user["id"], "slug": slug}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"chatmonger": district["chatmonger"], "district": district["name"], "messages": msgs}


@api_router.post("/chatmonger/{slug}")
async def chat_send(slug: str, body: ChatBody, user: dict = Depends(require_user)):
    district = await db.districts.find_one({"slug": slug}, {"_id": 0})
    if not district:
        raise HTTPException(status_code=404, detail="District not found")
    cm = district["chatmonger"]
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one(
        {"user_id": user["id"], "slug": slug, "role": "user", "text": body.message, "created_at": now}
    )

    system = (
        f"You are {cm['name']}, the '{cm['role']}' and resident Chatmonger of the '{district['name']}' district "
        f"inside Konphlux — a whimsical, ornate steampunk 'everything platform'. "
        f"District purpose: {district['description']} "
        f"Features here: {', '.join(district['features'])}. "
        f"Speak with warm, witty Victorian-steampunk flair, but stay genuinely helpful and concise (2-4 short sentences). "
        f"Only help with matters relevant to this district and Konphlux. Address the user as {user['display_name']}."
    )
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{user['id']}:{slug}",
            system_message=system,
        ).with_model(*CHAT_MODEL)
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:  # noqa: BLE001
        logger.exception("Chatmonger error")
        raise HTTPException(status_code=502, detail="The Chatmonger's aether coil sputtered. Try again.") from e

    reply_at = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one(
        {"user_id": user["id"], "slug": slug, "role": "assistant", "text": reply, "created_at": reply_at}
    )
    return {"role": "assistant", "text": reply, "created_at": reply_at}


# ---------- Profile ----------
@api_router.get("/profile")
async def get_profile(user: dict = Depends(require_user)):
    posts_count = await db.feed.count_documents({"user_id": user["id"]})
    saves_count = await db.saves.count_documents({"user_id": user["id"]})
    profile = dict(PROFILE)
    profile["display_name"] = user["display_name"]
    profile["handle"] = user["handle"]
    profile["email"] = user["email"]
    profile["stats"] = {
        "posts": posts_count,
        "followers": PROFILE["stats"]["followers"],
        "saved": saves_count,
    }
    return profile


# ---------- Roundtable ----------
async def _thread_meta(thread: dict, user_id: str, community_name: str | None = None) -> dict:
    t = {k: v for k, v in thread.items() if k != "_id"}
    t["reply_count"] = await db.rt_replies.count_documents({"thread_id": t["id"]})
    t["voted"] = bool(await db.rt_votes.find_one({"user_id": user_id, "thread_id": t["id"]}))
    if community_name is None:
        c = await db.rt_communities.find_one({"id": t["community_id"]}, {"_id": 0, "name": 1})
        community_name = c["name"] if c else "Roundtable"
    t["community_name"] = community_name
    return t


@api_router.get("/roundtable/communities")
async def rt_list_communities(user: dict = Depends(require_user), filter: str | None = None):
    member_ids = {m["community_id"] for m in await db.rt_members.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)}
    query = {"id": {"$in": list(member_ids)}} if filter == "joined" else {}
    docs = await db.rt_communities.find(query, {"_id": 0}).to_list(500)
    for d in docs:
        d["member"] = d["id"] in member_ids
        d["thread_count"] = await db.rt_threads.count_documents({"community_id": d["id"]})
    docs.sort(key=lambda c: c.get("members", 0), reverse=True)
    return docs


@api_router.post("/roundtable/communities", status_code=201)
async def rt_create_community(body: CommunityCreate, user: dict = Depends(require_user)):
    community = {
        "id": uuid.uuid4().hex,
        "name": body.name.strip(),
        "description": body.description.strip(),
        "icon": body.icon or "forum",
        "members": 1,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rt_communities.insert_one(dict(community))
    await db.rt_members.insert_one({"user_id": user["id"], "community_id": community["id"]})
    community.pop("_id", None)
    community["member"] = True
    community["thread_count"] = 0
    return community


@api_router.get("/roundtable/communities/{community_id}")
async def rt_community_detail(community_id: str, user: dict = Depends(require_user)):
    c = await db.rt_communities.find_one({"id": community_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    c["member"] = bool(await db.rt_members.find_one({"user_id": user["id"], "community_id": community_id}))
    threads = await db.rt_threads.find({"community_id": community_id}).to_list(500)
    threads = [await _thread_meta(t, user["id"], c["name"]) for t in threads]
    threads.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    c["threads"] = threads
    c["thread_count"] = len(threads)
    return c


@api_router.post("/roundtable/communities/{community_id}/join")
async def rt_toggle_join(community_id: str, user: dict = Depends(require_user)):
    c = await db.rt_communities.find_one({"id": community_id})
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    q = {"user_id": user["id"], "community_id": community_id}
    existing = await db.rt_members.find_one(q)
    if existing:
        await db.rt_members.delete_one(q)
        member = False
        delta = -1
    else:
        await db.rt_members.insert_one(dict(q))
        member = True
        delta = 1
    members = max(0, c.get("members", 0) + delta)
    await db.rt_communities.update_one({"id": community_id}, {"$set": {"members": members}})
    return {"id": community_id, "member": member, "members": members}


@api_router.get("/roundtable/threads")
async def rt_list_threads(user: dict = Depends(require_user), mine: bool = False):
    query = {"user_id": user["id"]} if mine else {}
    threads = await db.rt_threads.find(query).to_list(1000)
    threads = [await _thread_meta(t, user["id"]) for t in threads]
    threads.sort(key=lambda t: t.get("created_at", ""), reverse=True)
    return threads


@api_router.post("/roundtable/threads", status_code=201)
async def rt_create_thread(body: ThreadCreate, user: dict = Depends(require_user)):
    c = await db.rt_communities.find_one({"id": body.community_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    thread = {
        "id": uuid.uuid4().hex,
        "community_id": body.community_id,
        "title": body.title.strip(),
        "body": body.body.strip(),
        "author": user["display_name"],
        "user_id": user["id"],
        "upvotes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rt_threads.insert_one(dict(thread))
    thread.pop("_id", None)
    return await _thread_meta(thread, user["id"], c["name"])


@api_router.get("/roundtable/threads/{thread_id}")
async def rt_thread_detail(thread_id: str, user: dict = Depends(require_user)):
    t = await db.rt_threads.find_one({"id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread = await _thread_meta(t, user["id"])
    replies = await db.rt_replies.find({"thread_id": thread_id}, {"_id": 0}).to_list(2000)
    replies.sort(key=lambda r: r.get("created_at", ""))
    thread["replies"] = replies
    return thread


@api_router.post("/roundtable/threads/{thread_id}/vote")
async def rt_toggle_vote(thread_id: str, user: dict = Depends(require_user)):
    t = await db.rt_threads.find_one({"id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Thread not found")
    q = {"user_id": user["id"], "thread_id": thread_id}
    existing = await db.rt_votes.find_one(q)
    if existing:
        await db.rt_votes.delete_one(q)
        voted = False
        delta = -1
    else:
        await db.rt_votes.insert_one(dict(q))
        voted = True
        delta = 1
    upvotes = max(0, t.get("upvotes", 0) + delta)
    await db.rt_threads.update_one({"id": thread_id}, {"$set": {"upvotes": upvotes}})
    return {"id": thread_id, "voted": voted, "upvotes": upvotes}


@api_router.post("/roundtable/threads/{thread_id}/replies", status_code=201)
async def rt_add_reply(thread_id: str, body: ReplyCreate, user: dict = Depends(require_user)):
    t = await db.rt_threads.find_one({"id": thread_id})
    if not t:
        raise HTTPException(status_code=404, detail="Thread not found")
    reply = {
        "id": uuid.uuid4().hex,
        "thread_id": thread_id,
        "body": body.body.strip(),
        "author": user["display_name"],
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rt_replies.insert_one(dict(reply))
    reply.pop("_id", None)
    return reply


# ---------- Answerfier (Q&A) ----------
async def _question_meta(q: dict, user_id: str) -> dict:
    d = {k: v for k, v in q.items() if k != "_id"}
    answers = await db.af_answers.find({"question_id": d["id"]}, {"_id": 0, "upvotes": 1}).to_list(2000)
    d["answer_count"] = len(answers)
    d["total_upvotes"] = sum(a.get("upvotes", 0) for a in answers)
    d["is_author"] = d.get("user_id") == user_id
    d["is_qotd"] = bool(d.get("is_qotd"))
    return d


async def _ensure_qotd() -> dict:
    today = datetime.now(timezone.utc).date()
    key = today.isoformat()
    existing = await db.af_questions.find_one({"qotd_date": key})
    if existing:
        return existing
    q = {
        "id": uuid.uuid4().hex,
        "title": _qotd_text_for(today),
        "body": "Konphlux's Question of the Day — everyone's invited to answer.",
        "category": "Question of the Day",
        "author": "Oskar",
        "user_id": None,
        "best_answer_id": None,
        "is_qotd": True,
        "qotd_date": key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.af_questions.insert_one(dict(q))
    except Exception:  # noqa: BLE001 — race: another request created it first
        existing = await db.af_questions.find_one({"qotd_date": key})
        if existing:
            return existing
    return q


@api_router.get("/answerfier")
async def af_board(user: dict = Depends(require_user)):
    qotd_doc = await _ensure_qotd()
    qotd = await _question_meta(qotd_doc, user["id"])
    docs = await db.af_questions.find({"is_qotd": {"$ne": True}}).to_list(2000)
    questions = [await _question_meta(q, user["id"]) for q in docs]
    questions.sort(key=lambda q: q.get("created_at", ""), reverse=True)
    used = {q["category"] for q in questions if q.get("category")}
    categories = [c for c in AF_CATEGORIES if c != "Question of the Day"]
    for c in sorted(used):
        if c not in categories:
            categories.append(c)
    return {"qotd": qotd, "questions": questions, "categories": categories}


@api_router.get("/answerfier/qotd")
async def af_qotd(user: dict = Depends(require_user)):
    return await _question_meta(await _ensure_qotd(), user["id"])


@api_router.post("/answerfier/questions", status_code=201)
async def af_create_question(body: QuestionCreate, user: dict = Depends(require_user)):
    category = body.category if body.category in AF_CATEGORIES and body.category != "Question of the Day" else "General"
    q = {
        "id": uuid.uuid4().hex,
        "title": body.title.strip(),
        "body": body.body.strip(),
        "category": category,
        "author": user["display_name"],
        "user_id": user["id"],
        "best_answer_id": None,
        "is_qotd": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.af_questions.insert_one(dict(q))
    return await _question_meta(q, user["id"])


@api_router.get("/answerfier/questions/{question_id}")
async def af_question_detail(question_id: str, user: dict = Depends(require_user)):
    q = await db.af_questions.find_one({"id": question_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    question = await _question_meta(q, user["id"])
    best_id = question.get("best_answer_id")
    voted_ids = {v["answer_id"] for v in await db.af_answer_votes.find({"user_id": user["id"]}, {"_id": 0, "answer_id": 1}).to_list(5000)}
    raw = await db.af_answers.find({"question_id": question_id}, {"_id": 0}).to_list(5000)
    answers = []
    for a in raw:
        a["voted"] = a["id"] in voted_ids
        a["is_best"] = a["id"] == best_id
        answers.append(a)
    answers.sort(key=lambda a: (not a["is_best"], -a.get("upvotes", 0), a.get("created_at", "")))
    question["answers"] = answers
    return question


@api_router.post("/answerfier/questions/{question_id}/answers", status_code=201)
async def af_add_answer(question_id: str, body: AnswerCreate, user: dict = Depends(require_user)):
    q = await db.af_questions.find_one({"id": question_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    answer = {
        "id": uuid.uuid4().hex,
        "question_id": question_id,
        "body": body.body.strip(),
        "author": user["display_name"],
        "user_id": user["id"],
        "upvotes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.af_answers.insert_one(dict(answer))
    answer.pop("_id", None)
    answer["voted"] = False
    answer["is_best"] = False
    return answer


@api_router.post("/answerfier/questions/{question_id}/best")
async def af_set_best(question_id: str, body: BestAnswerBody, user: dict = Depends(require_user)):
    q = await db.af_questions.find_one({"id": question_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if q.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the asker can mark the best answer.")
    answer = await db.af_answers.find_one({"id": body.answer_id, "question_id": question_id})
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    new_best = None if q.get("best_answer_id") == body.answer_id else body.answer_id
    await db.af_questions.update_one({"id": question_id}, {"$set": {"best_answer_id": new_best}})
    return {"id": question_id, "best_answer_id": new_best}


@api_router.post("/answerfier/answers/{answer_id}/vote")
async def af_vote_answer(answer_id: str, user: dict = Depends(require_user)):
    a = await db.af_answers.find_one({"id": answer_id})
    if not a:
        raise HTTPException(status_code=404, detail="Answer not found")
    qv = {"user_id": user["id"], "answer_id": answer_id}
    existing = await db.af_answer_votes.find_one(qv)
    if existing:
        await db.af_answer_votes.delete_one(qv)
        voted = False
        delta = -1
    else:
        await db.af_answer_votes.insert_one(dict(qv))
        voted = True
        delta = 1
    upvotes = max(0, a.get("upvotes", 0) + delta)
    await db.af_answers.update_one({"id": answer_id}, {"$set": {"upvotes": upvotes}})
    return {"id": answer_id, "voted": voted, "upvotes": upvotes}


# ---------- Cart & Checkout (Stripe) ----------
async def _build_cart(user_id: str) -> dict:
    doc = await db.carts.find_one({"user_id": user_id})
    items = doc.get("items", []) if doc else []
    enriched = []
    subtotal = 0
    for it in items:
        listing = await db.bazaar.find_one({"id": it["item_id"]}, {"_id": 0})
        if not listing:
            continue
        qty = it["qty"]
        line = listing["price_cents"] * qty
        subtotal += line
        enriched.append({
            "item_id": listing["id"], "title": listing["title"], "image": listing["image"],
            "price_cents": listing["price_cents"], "qty": qty, "line_cents": line,
            "seller": listing["seller"],
        })
    return {"items": enriched, "subtotal_cents": subtotal, "count": sum(e["qty"] for e in enriched)}


async def _set_qty(user_id: str, item_id: str, qty: int):
    doc = await db.carts.find_one({"user_id": user_id})
    items = doc.get("items", []) if doc else []
    items = [i for i in items if i["item_id"] != item_id]
    if qty > 0:
        items.append({"item_id": item_id, "qty": qty})
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": items}}, upsert=True)


@api_router.get("/cart")
async def get_cart(user: dict = Depends(require_user)):
    return await _build_cart(user["id"])


@api_router.post("/cart")
async def add_to_cart(body: CartAdd, user: dict = Depends(require_user)):
    listing = await db.bazaar.find_one({"id": body.item_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing = await _maybe_end_auction(listing)
    if listing.get("is_auction"):
        if listing.get("status") != "ended":
            raise HTTPException(status_code=400, detail="This auction is still running — place a bid instead.")
        if listing.get("winner_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Only the winning bidder can buy this lot.")
    elif listing.get("seller_id") == user["id"]:
        raise HTTPException(status_code=400, detail="You can't buy your own listing.")
    doc = await db.carts.find_one({"user_id": user["id"]})
    items = doc.get("items", []) if doc else []
    existing = next((i for i in items if i["item_id"] == body.item_id), None)
    new_qty = min(99, (existing["qty"] if existing else 0) + body.qty)
    await _set_qty(user["id"], body.item_id, new_qty)
    return await _build_cart(user["id"])


@api_router.patch("/cart/{item_id}")
async def set_cart_qty(item_id: str, body: CartSet, user: dict = Depends(require_user)):
    await _set_qty(user["id"], item_id, body.qty)
    return await _build_cart(user["id"])


@api_router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: str, user: dict = Depends(require_user)):
    await _set_qty(user["id"], item_id, 0)
    return await _build_cart(user["id"])


@api_router.post("/checkout")
async def create_checkout(body: CheckoutBody, user: dict = Depends(require_user)):
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Payments are not configured.")
    cart = await _build_cart(user["id"])
    if not cart["items"]:
        raise HTTPException(status_code=400, detail="Your cart is empty.")

    base = body.return_base.rstrip("/")
    if not base.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid return URL")

    line_items = [{
        "price_data": {
            "currency": CURRENCY,
            "product_data": {"name": it["title"]},
            "unit_amount": it["price_cents"],
        },
        "quantity": it["qty"],
    } for it in cart["items"]]

    order_id = uuid.uuid4().hex
    success_url = f"{base}/api/checkout/return?result=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base}/api/checkout/return?result=cancel"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=line_items,
            success_url=success_url,
            cancel_url=cancel_url,
            managed_payments={"enabled": False},
            metadata={"order_id": order_id, "user_id": user["id"]},
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Stripe session error")
        raise HTTPException(status_code=502, detail="Could not start checkout.") from e

    await db.orders.insert_one({
        "id": order_id,
        "user_id": user["id"],
        "session_id": session.id,
        "status": "pending",
        "payment_status": "unpaid",
        "currency": CURRENCY,
        "amount_cents": cart["subtotal_cents"],
        "lines": [{"item_id": it["item_id"], "title": it["title"], "qty": it["qty"], "unit_amount": it["price_cents"], "image": it["image"]} for it in cart["items"]],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"session_id": session.id, "checkout_url": session.url}


async def _fulfill_paid_order(session_id: str, buyer: dict | None = None):
    """Mark order paid (idempotent), clear the buyer's cart, and email a receipt once."""
    order = await db.orders.find_one({"session_id": session_id})
    if not order:
        return
    already_paid = order.get("payment_status") == "paid"
    await db.orders.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": "paid", "status": "paid",
                  "paid_at": order.get("paid_at") or datetime.now(timezone.utc).isoformat()}},
    )
    await db.carts.update_one({"user_id": order["user_id"]}, {"$set": {"items": []}})
    if not order.get("email_sent"):
        user = buyer or await db.users.find_one({"id": order["user_id"]})
        if user and user.get("email"):
            fresh = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
            try:
                await send_order_receipt(to=user["email"], name=user.get("display_name", "there"), order=fresh)
                await db.orders.update_one({"session_id": session_id}, {"$set": {"email_sent": True}})
            except Exception:  # noqa: BLE001
                logger.exception("Receipt email failed")


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, user: dict = Depends(require_user)):
    order = await db.orders.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_status"] != "paid" and stripe.api_key:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session.payment_status == "paid":
                await _fulfill_paid_order(session_id, buyer=user)
                order["payment_status"] = "paid"
                order["status"] = "paid"
        except Exception:  # noqa: BLE001
            logger.exception("Stripe status error")
    return {"paid": order["payment_status"] == "paid", "order": order}


@api_router.get("/checkout/return", response_class=HTMLResponse)
async def checkout_return(result: str = "cancel", session_id: str = ""):
    ok = result == "success"
    title = "Payment complete" if ok else "Checkout cancelled"
    msg = ("Your order is confirmed. You may close this window and return to Konphlux."
           if ok else "No charge was made. Close this window to return to Konphlux.")
    color = "#B06C3A"
    return f"""<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;font-family:Georgia,serif;background:#F6F1E7;color:#3B3229;display:flex;align-items:center;justify-content:center;height:100vh;">
<div style="text-align:center;padding:32px;max-width:420px;">
<div style="font-size:56px;">{'⚙️' if ok else '✕'}</div>
<h1 style="color:{color};font-size:26px;margin:12px 0;">{title}</h1>
<p style="font-size:16px;line-height:1.5;color:#8A7A63;">{msg}</p>
</div></body></html>"""


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not STRIPE_WEBHOOK_SECRET:
        return {"received": True, "note": "webhook secret not configured"}
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid webhook") from e
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        if session.get("payment_status") == "paid":
            await _fulfill_paid_order(session["id"])
    return {"received": True}


@api_router.get("/orders")
async def list_orders(user: dict = Depends(require_user)):
    docs = await db.orders.find({"user_id": user["id"], "payment_status": "paid"}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda o: o.get("paid_at") or o.get("created_at", ""), reverse=True)
    return docs


# ---------- BrainBoost (learning district) ----------
def _bb_course_card(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "title": doc["title"],
        "category": doc["category"],
        "level": doc.get("level", "Beginner"),
        "icon": doc.get("icon", "school"),
        "summary": doc.get("summary", ""),
        "lesson_count": len(doc.get("lessons", [])),
    }


async def _bb_completed(user_id: str, course_id: str) -> list[int]:
    row = await db.bb_progress.find_one({"user_id": user_id, "course_id": course_id})
    return sorted(row.get("completed", [])) if row else []


@api_router.get("/brainboost")
async def brainboost_hub(user: dict = Depends(require_user)):
    courses = await db.bb_courses.find({}, {"_id": 0}).to_list(200)
    quizzes = await db.bb_quizzes.find({}, {"_id": 0}).to_list(200)
    prog = await db.bb_progress.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    lessons_done = sum(len(p.get("completed", [])) for p in prog)
    return {
        "fact_of_day": _bb_fact_for(date.today()),
        "categories": BB_CATEGORIES,
        "featured": [_bb_course_card(c) for c in courses[:4]],
        "course_count": len(courses),
        "quiz_count": len(quizzes),
        "video_count": len(BB_VIDEOS),
        "lessons_completed": lessons_done,
    }


@api_router.get("/brainboost/courses")
async def brainboost_courses(user: dict = Depends(require_user), category: str | None = None):
    query: dict = {}
    if category and category != "All":
        query["category"] = category
    docs = await db.bb_courses.find(query, {"_id": 0}).to_list(300)
    return {"courses": [_bb_course_card(c) for c in docs], "categories": BB_CATEGORIES}


@api_router.get("/brainboost/courses/{course_id}")
async def brainboost_course_detail(course_id: str, user: dict = Depends(require_user)):
    doc = await db.bb_courses.find_one({"id": course_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Course not found")
    doc["completed"] = await _bb_completed(user["id"], course_id)
    return doc


@api_router.post("/brainboost/courses/{course_id}/progress")
async def brainboost_progress(course_id: str, body: BBProgressBody, user: dict = Depends(require_user)):
    course = await db.bb_courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    op = "$addToSet" if body.completed else "$pull"
    await db.bb_progress.update_one(
        {"user_id": user["id"], "course_id": course_id},
        {op: {"completed": body.lesson_index}},
        upsert=True,
    )
    completed = await _bb_completed(user["id"], course_id)
    return {"course_id": course_id, "completed": completed, "total": len(course.get("lessons", []))}


@api_router.get("/brainboost/quizzes")
async def brainboost_quizzes(user: dict = Depends(require_user)):
    docs = await db.bb_quizzes.find({}, {"_id": 0}).to_list(200)
    return [
        {"id": d["id"], "title": d["title"], "category": d.get("category", "General"),
         "icon": d.get("icon", "help-circle"), "question_count": len(d.get("questions", []))}
        for d in docs
    ]


@api_router.get("/brainboost/quizzes/{quiz_id}")
async def brainboost_quiz_detail(quiz_id: str, user: dict = Depends(require_user)):
    doc = await db.bb_quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    # Strip correct answers before sending to the client.
    questions = [{"q": q["q"], "options": q["options"]} for q in doc.get("questions", [])]
    return {"id": doc["id"], "title": doc["title"], "category": doc.get("category", "General"),
            "icon": doc.get("icon", "help-circle"), "questions": questions}


@api_router.post("/brainboost/quizzes/{quiz_id}/submit")
async def brainboost_quiz_submit(quiz_id: str, body: BBQuizSubmit, user: dict = Depends(require_user)):
    doc = await db.bb_quizzes.find_one({"id": quiz_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = doc.get("questions", [])
    correct = [q["answer"] for q in questions]
    score = sum(1 for i, a in enumerate(body.answers) if i < len(correct) and a == correct[i])
    return {"score": score, "total": len(questions), "correct": correct}


@api_router.get("/brainboost/facts")
async def brainboost_facts(user: dict = Depends(require_user)):
    today = date.today()
    upcoming = [_bb_fact_for(today - timedelta(days=i)) for i in range(1, 13)]
    return {"fact_of_day": _bb_fact_for(today), "date": today.isoformat(), "more": upcoming}


@api_router.get("/brainboost/videos")
async def brainboost_videos(user: dict = Depends(require_user)):
    out = []
    for v in BB_VIDEOS:
        query = v["title"].replace(" ", "+")
        out.append({**v, "url": f"https://www.youtube.com/results?search_query={query}"})
    return out


@api_router.post("/brainboost/lexicon")
async def brainboost_lexicon(body: BBLexiconBody, user: dict = Depends(require_user)):
    word = body.word.strip()
    if body.mode == "thesaurus":
        system = "You are a concise thesaurus. Given a word, return synonyms and antonyms only."
        prompt = (
            f"For the word '{word}', return plain text in exactly this format:\n"
            f"SYNONYMS: comma-separated list of 6-10 synonyms\n"
            f"ANTONYMS: comma-separated list of up to 6 antonyms (or 'none')\n"
            f"No other commentary."
        )
    else:
        system = "You are a clear, friendly dictionary. Define words plainly and accurately."
        prompt = (
            f"Define the word '{word}'. Return plain text in exactly this format:\n"
            f"PART OF SPEECH: (e.g. noun, verb)\n"
            f"DEFINITION: one or two clear sentences\n"
            f"EXAMPLE: one natural example sentence using the word\n"
            f"No other commentary."
        )
    try:
        text = await _anvil_llm(system, prompt, session=f"bb-lex:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("BrainBoost lexicon error")
        raise HTTPException(status_code=502, detail="The library's aether lamp flickered. Try again.") from e
    return {"word": word, "mode": body.mode, "text": text.strip()}


@api_router.post("/brainboost/repair")
async def brainboost_repair(body: BBRepairBody, user: dict = Depends(require_user)):
    system = (
        "You are Repair Guy, a friendly, practical repair expert in the steampunk world of Konphlux. "
        "Give safe, clear, step-by-step repair guidance for household items, gadgets, bicycles, plumbing and the like. "
        "Always mention any safety precaution first if relevant (power off, unplug, gloves). "
        "Be concise and use numbered steps."
    )
    prompt = f"Help me fix this problem, step by step:\n{body.problem.strip()}"
    try:
        text = await _anvil_llm(system, prompt, session=f"bb-repair:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("BrainBoost repair error")
        raise HTTPException(status_code=502, detail="Repair Guy is elbow-deep in a boiler. Try again.") from e
    return {"steps": text.strip()}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed()
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialised")
    except Exception:  # noqa: BLE001
        logger.exception("Object storage init failed (uploads may not work yet)")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
import uuid
import jwt
import stripe
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage


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
     "features": ["Courses", "Religious Studies", "Fun Facts", "Dictionary", "Thesaurus", "Quizzes", "Video lessons", "Saved progress", "AI tutoring", "Repair Guy"]},
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


async def seed():
    if await db.districts.count_documents({}) == 0:
        await db.districts.insert_many([dict(d) for d in DISTRICTS])
        logger.info("Seeded districts")
    if await db.feed.count_documents({}) == 0:
        await db.feed.insert_many([dict(p) for p in FEED_POSTS])
        logger.info("Seeded feed")
    if await db.bazaar.count_documents({}) == 0:
        await db.bazaar.insert_many([dict(b) for b in BAZAAR])
        logger.info("Seeded bazaar")
    if await db.rt_communities.count_documents({}) == 0:
        await db.rt_communities.insert_many([dict(c) for c in RT_COMMUNITIES])
        await db.rt_threads.insert_many([dict(t) for t in RT_THREADS])
        await db.rt_replies.insert_many([dict(r) for r in RT_REPLIES])
        logger.info("Seeded roundtable")
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


# ---------- Bazaar ----------
@api_router.get("/bazaar")
async def get_bazaar(user: dict = Depends(require_user)):
    docs = await db.bazaar.find({}, {"_id": 0}).to_list(200)
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    for d in docs:
        d["saved"] = d["id"] in saved_ids
    cats = sorted({d["category"] for d in docs})
    return {"categories": cats, "listings": docs}


@api_router.get("/bazaar/{item_id}")
async def get_bazaar_item(item_id: str, user: dict = Depends(require_user)):
    doc = await db.bazaar.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    saved_ids = {s["item_id"] for s in await _user_saves(user["id"], "listing")}
    doc["saved"] = item_id in saved_ids
    return doc


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
async def rt_list_communities(user: dict = Depends(require_user)):
    docs = await db.rt_communities.find({}, {"_id": 0}).to_list(500)
    member_ids = {m["community_id"] for m in await db.rt_members.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)}
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
async def rt_list_threads(user: dict = Depends(require_user)):
    threads = await db.rt_threads.find({}).to_list(1000)
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


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, user: dict = Depends(require_user)):
    order = await db.orders.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_status"] != "paid" and stripe.api_key:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session.payment_status == "paid":
                await db.orders.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
                )
                await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
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
            await db.orders.update_one(
                {"session_id": session["id"]},
                {"$set": {"payment_status": "paid", "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
            )
            uid = (session.get("metadata") or {}).get("user_id")
            if uid:
                await db.carts.update_one({"user_id": uid}, {"$set": {"items": []}})
    return {"received": True}


@api_router.get("/orders")
async def list_orders(user: dict = Depends(require_user)):
    docs = await db.orders.find({"user_id": user["id"], "payment_status": "paid"}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda o: o.get("paid_at") or o.get("created_at", ""), reverse=True)
    return docs


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

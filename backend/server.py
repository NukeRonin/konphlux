from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import HTMLResponse, Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
import uuid
import base64
import jwt
import random
import stripe
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from datetime import datetime, timezone, timedelta, date
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import fal_client
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
FAL_KEY = os.environ.get("FAL_KEY", "")
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


class RewardTierIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=400)
    amount_cents: int = Field(ge=100)


class DBProjectCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=4000)
    goal_cents: int = Field(ge=100)
    funding_model: str = Field(pattern="^(all_or_nothing|keep_what_you_raise)$")
    deadline: str | None = None
    cover_url: str | None = Field(default=None, max_length=600)
    reward_tiers: list[RewardTierIn] = Field(default_factory=list, max_length=8)
    category: str = "other"


class DBProjectEdit(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, min_length=10, max_length=4000)
    goal_cents: int | None = Field(default=None, ge=100)
    cover_url: str | None = Field(default=None, max_length=600)
    category: str | None = None


class DBBackBody(BaseModel):
    amount_cents: int = Field(ge=100)
    return_base: str
    tier_id: str | None = None
    recurring: bool = False


class DBCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    parent_id: str | None = None


class DBUpdateCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    body: str = Field(min_length=5, max_length=4000)


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


class FrankAudioBody(BaseModel):
    kind: str = Field(default="music", pattern="^(music|sfx)$")
    prompt: str = Field(min_length=1, max_length=600)
    mood: str = Field(default="", max_length=60)
    genre: str = Field(default="", max_length=60)
    duration: str = Field(default="", max_length=40)


class FrankVisualBody(BaseModel):
    kind: str = Field(default="pic", pattern="^(pic|logo|gif|meme)$")
    prompt: str = Field(min_length=1, max_length=600)


class FrankVaultBody(BaseModel):
    kind: str = Field(max_length=20)
    prompt: str = Field(default="", max_length=600)
    image_path: str = Field(default="", max_length=600)
    concept: str = Field(default="", max_length=8000)
    title: str = Field(default="", max_length=120)


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


# ---- PictureShow ----
class PSVideoCreate(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    video_url: str = Field(min_length=4, max_length=600)
    category: str = "Shorts"
    description: str = Field(default="", max_length=1000)
    thumbnail: str = Field(default="", max_length=600)


class PSPlaylistCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)


class PSPlaylistAdd(BaseModel):
    video_id: str


class PSGoLiveBody(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    category: str = "Live Recordings"
    when: str = "now"  # "now" -> live, else ISO datetime -> upcoming


class PSAIConceptBody(BaseModel):
    prompt: str = Field(min_length=3, max_length=600)
    kind: str = "video"  # video | animation
    style: str = Field(default="", max_length=80)


class PSCharacterBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=600)
    reference_path: str = Field(default="", max_length=600)


class PSSuiteBody(BaseModel):
    prompt: str = Field(min_length=3, max_length=800)
    kind: str = Field(default="video", pattern="^(video|animation)$")
    style: str = Field(default="", max_length=40)
    length: str = Field(default="", max_length=20)
    speed: str = Field(default="", max_length=20)
    transitions: list[str] = Field(default_factory=list, max_length=20)
    atmospherics: list[str] = Field(default_factory=list, max_length=20)
    titles: list[str] = Field(default_factory=list, max_length=20)
    finishing: list[str] = Field(default_factory=list, max_length=10)
    audio_effects: list[str] = Field(default_factory=list, max_length=10)
    character_ids: list[str] = Field(default_factory=list, max_length=20)
    has_soundtrack: bool = False
    has_voiceover: bool = False


class PSProjectBody(BaseModel):
    title: str = Field(default="", max_length=120)
    prompt: str = Field(min_length=1, max_length=800)
    kind: str = Field(default="video", pattern="^(video|animation)$")
    style: str = Field(default="", max_length=40)
    length: str = Field(default="", max_length=20)
    speed: str = Field(default="", max_length=20)
    transitions: list[str] = Field(default_factory=list, max_length=20)
    atmospherics: list[str] = Field(default_factory=list, max_length=20)
    titles: list[str] = Field(default_factory=list, max_length=20)
    finishing: list[str] = Field(default_factory=list, max_length=10)
    audio_effects: list[str] = Field(default_factory=list, max_length=10)
    character_ids: list[str] = Field(default_factory=list, max_length=20)
    soundtrack_path: str = Field(default="", max_length=600)
    voiceover_path: str = Field(default="", max_length=600)
    storyboard: str = Field(default="", max_length=12000)
    poster_path: str = Field(default="", max_length=600)


class PSPresetBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    style: str = Field(default="", max_length=40)
    length: str = Field(default="", max_length=20)
    speed: str = Field(default="", max_length=20)
    transitions: list[str] = Field(default_factory=list, max_length=20)
    atmospherics: list[str] = Field(default_factory=list, max_length=20)
    titles: list[str] = Field(default_factory=list, max_length=20)
    finishing: list[str] = Field(default_factory=list, max_length=10)
    audio_effects: list[str] = Field(default_factory=list, max_length=10)


class JobBody(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    company: str = Field(default="", max_length=100)
    location: str = Field(default="", max_length=100)
    job_type: str = Field(default="Full-time", max_length=30)
    category: str = Field(default="Other", max_length=40)
    salary_min: int = Field(default=0, ge=0, le=100_000_000)
    salary_max: int = Field(default=0, ge=0, le=100_000_000)
    remote: bool = False
    description: str = Field(min_length=1, max_length=6000)


class JobApplyBody(BaseModel):
    cover_note: str = Field(default="", max_length=3000)
    resume_link: str = Field(default="", max_length=600)
    resume_path: str = Field(default="", max_length=600)


class AppStatusBody(BaseModel):
    status: str = Field(pattern="^(submitted|reviewed|accepted|rejected)$")


class JobAlertBody(BaseModel):
    categories: list[str] = Field(default_factory=list, max_length=20)
    keywords: list[str] = Field(default_factory=list, max_length=20)


class ExperienceItem(BaseModel):
    role: str = Field(default="", max_length=100)
    org: str = Field(default="", max_length=100)
    detail: str = Field(default="", max_length=400)


class FreelancerBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    headline: str = Field(default="", max_length=120)
    bio: str = Field(default="", max_length=2000)
    category: str = Field(default="Other", max_length=40)
    skills: list[str] = Field(default_factory=list, max_length=30)
    hourly_rate: int = Field(default=0, ge=0, le=100000)
    location: str = Field(default="", max_length=100)
    avatar_url: str = Field(default="", max_length=600)
    links: list[str] = Field(default_factory=list, max_length=10)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=15)
    available: bool = True


class OfferBody(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=40)
    to_user_id: str = Field(min_length=1, max_length=60)
    title: str = Field(min_length=1, max_length=120)
    rate_text: str = Field(default="", max_length=60)
    note: str = Field(default="", max_length=1000)


class RespondBody(BaseModel):
    accept: bool


class InterviewBody(BaseModel):
    to_user_id: str = Field(min_length=1, max_length=60)
    conversation_id: str = Field(default="", max_length=40)
    job_id: str = Field(default="", max_length=40)
    title: str = Field(min_length=1, max_length=120)
    scheduled_at: str = Field(min_length=4, max_length=40)
    location: str = Field(default="", max_length=200)


class InterviewRespondBody(BaseModel):
    status: str = Field(pattern="^(confirmed|declined)$")


class ReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)
    job_title: str = Field(default="", max_length=120)


class CalendarEventBody(BaseModel):
    type: str = Field(pattern="^(meeting|flight|appointment|event|birthday)$")
    title: str = Field(min_length=1, max_length=120)
    when: str = Field(min_length=4, max_length=40)
    location: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=1000)


class RescheduleBody(BaseModel):
    scheduled_at: str = Field(min_length=4, max_length=40)


class EventionListBody(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ListItemBody(BaseModel):
    text: str = Field(min_length=1, max_length=300)


RETRO_CATEGORIES = ["Restaurants", "Cafés", "Retail", "Services", "Entertainment", "Health"]


class RetroBusinessBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    address: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=600)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class RetroReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=1500)


class RetroListingBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    asking_price: str = Field(min_length=1, max_length=40)
    location: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=1500)
    reason: str = Field(default="", max_length=300)
    revenue: str = Field(default="", max_length=60)
    contact: str = Field(min_length=1, max_length=120)


class TransferBody(BaseModel):
    recipient: str = Field(min_length=1, max_length=120)  # email or @handle
    amount_cents: int = Field(gt=0, le=100_000_000)
    note: str = Field(default="", max_length=200)


class TopupBody(BaseModel):
    amount_cents: int = Field(gt=0, le=100_000_000)


class PaymentBody(BaseModel):
    amount_cents: int = Field(gt=0, le=100_000_000)
    title: str = Field(min_length=1, max_length=120)
    category: str = Field(default="General", max_length=40)



# ---- Chatterbox ----
class CBStartDM(BaseModel):
    user_id: str


class CBCreateGroup(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    member_ids: list[str] = Field(default_factory=list)


class CBSendMessage(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


# ---- Bluepaint Space Designer ----
class BPWall(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class BPItem(BaseModel):
    id: str
    kind: str
    x: float
    y: float
    rotation: float = 0
    scale: float = 1


class BPDesignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class BPDesignUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    walls: list[BPWall] = Field(default_factory=list)
    items: list[BPItem] = Field(default_factory=list)


class BPReviewBody(BaseModel):
    plan_width: float = Field(default=8, gt=0, le=100)


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
     "features": ["Reviews", "Submit Review", "Review Categories", "Put a Business Up for Sale", "Browse nearby", "Save Favorite Places", "Opening Soon", "Recently Opened", "Businesses For Sale", "Health Inspection Updates"]},
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
     "features": ["Private messaging", "Group chats", "Voice calls", "Video calls"]},
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
     "features": ["Space Designer", "Materials Estimator", "Construction Cost Estimator", "Design Reviews with Iris", "Saved Blueprints"]},
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

# Building materials — surfaced by the Bluepaint Materials Estimator "Purchase in Bazaar" flow.
MATERIAL_LISTINGS = [
    {"id": "m-paint", "title": "Aether-Grade Wall Paint (2.5L)", "price_cents": 3200, "seller": "Copperline Collective", "rating": 4.7, "reviews": 210, "category": "Building Materials", "image": IMG_GEARS,
     "description": "Smooth, low-odour interior paint with a faint pearlescent sheen. Covers roughly 10 m² per litre, two coats recommended."},
    {"id": "m-primer", "title": "Sealing Primer & Undercoat (2.5L)", "price_cents": 2400, "seller": "Copperline Collective", "rating": 4.5, "reviews": 98, "category": "Building Materials", "image": IMG_GEARS,
     "description": "A dependable primer that grips plaster and timber alike, readying any wall for a clean coat of paint."},
    {"id": "m-wood", "title": "Seasoned Oak Timber Boards (2.4m)", "price_cents": 5400, "seller": "Grast Workshop", "rating": 4.8, "reviews": 176, "category": "Building Materials", "image": IMG_ARCH,
     "description": "Kiln-dried oak boards, 2.4 metres each — ideal for framing, studs and skirting. Sold per board."},
    {"id": "m-floor", "title": "Reclaimed Parquet Flooring (per m²)", "price_cents": 4100, "seller": "Marlowe & Sons", "rating": 4.9, "reviews": 143, "category": "Building Materials", "image": IMG_ARCH,
     "description": "Warm reclaimed parquet flooring, sold by the square metre. Adds instant character to any room."},
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

# Retrospections — seeded businesses (default map centre: midtown-style coords).
RETRO_CENTER = {"lat": 40.7580, "lng": -73.9855}
_RIMG = "https://images.unsplash.com/photo-"
RETRO_BUSINESSES = [
    {"id": "rb-1", "name": "The Brass Kettle", "category": "Restaurants", "address": "12 Cog Lane", "lat": 40.7595, "lng": -73.9840,
     "description": "Steampunk-styled bistro serving slow-braised fare and copper-pot stews.", "image": f"{_RIMG}1517248135467-4c7edcad34c4?w=800&q=80", "base_rating": 4.6, "base_reviews": 128},
    {"id": "rb-2", "name": "Gearwork Coffee House", "category": "Cafés", "address": "3 Piston Alley", "lat": 40.7568, "lng": -73.9870,
     "description": "Single-origin pour-overs and pastries beneath humming gaslamps.", "image": f"{_RIMG}1501339847302-ac426a4a7cbb?w=800&q=80", "base_rating": 4.8, "base_reviews": 214},
    {"id": "rb-3", "name": "Copperline Outfitters", "category": "Retail", "address": "88 Rivet Street", "lat": 40.7602, "lng": -73.9862,
     "description": "Fine coats, goggles and brass-buckled boots for every wayfarer.", "image": f"{_RIMG}1441984904996-e0b6ba687e04?w=800&q=80", "base_rating": 4.3, "base_reviews": 76},
    {"id": "rb-4", "name": "Ashgrove Repairs", "category": "Services", "address": "5 Ratchet Court", "lat": 40.7551, "lng": -73.9848,
     "description": "Trusted clockwork and appliance repair with same-day turnaround.", "image": f"{_RIMG}1581092160562-40aa08e78837?w=800&q=80", "base_rating": 4.5, "base_reviews": 54},
    {"id": "rb-5", "name": "The Lamplight Theatre", "category": "Entertainment", "address": "20 Marquee Way", "lat": 40.7588, "lng": -73.9820,
     "description": "Nightly variety shows, magic-lantern screenings and live brass bands.", "image": f"{_RIMG}1503095396549-807759245b35?w=800&q=80", "base_rating": 4.7, "base_reviews": 163},
    {"id": "rb-6", "name": "Vex Apothecary & Wellness", "category": "Health", "address": "9 Tincture Row", "lat": 40.7573, "lng": -73.9895,
     "description": "Herbal remedies, tonics and a calm consulting room.", "image": f"{_RIMG}1584308666744-24d5c474f2ae?w=800&q=80", "base_rating": 4.4, "base_reviews": 41},
    {"id": "rb-7", "name": "Marlowe's Chop House", "category": "Restaurants", "address": "44 Ember Street", "lat": 40.7612, "lng": -73.9878,
     "description": "Char-grilled steaks and root vegetables over an open flame.", "image": f"{_RIMG}1424847651672-bf20a4b0982b?w=800&q=80", "base_rating": 4.2, "base_reviews": 89},
    {"id": "rb-8", "name": "Tinker's Toy Emporium", "category": "Retail", "address": "17 Spindle Lane", "lat": 40.7559, "lng": -73.9832,
     "description": "Wind-up automata, marble runs and clockwork curiosities for all ages.", "image": f"{_RIMG}1558060370-d644479cb6f7?w=800&q=80", "base_rating": 4.9, "base_reviews": 202},
    {"id": "rb-9", "name": "Waypoint Barber & Bath", "category": "Services", "address": "6 Steamway", "lat": 40.7541, "lng": -73.9861,
     "description": "Hot-towel shaves, steam baths and an honest cup of coffee.", "image": f"{_RIMG}1521590832167-7bcbfaa6381f?w=800&q=80", "base_rating": 4.6, "base_reviews": 118},
    {"id": "rb-10", "name": "The Aether Lounge", "category": "Cafés", "address": "31 Vapor Court", "lat": 40.7620, "lng": -73.9845,
     "description": "Late-night teas, cordials and quiet corners for reading.", "image": f"{_RIMG}1495474472287-4d71bcdd2085?w=800&q=80", "base_rating": 4.5, "base_reviews": 97},
]

# Upcoming businesses (Opening Soon) — listed in the Business Status hub before they open.
RETRO_UPCOMING = [
    {"id": "rb-11", "name": "The Gilded Fork", "category": "Restaurants", "address": "7 Lantern Row", "lat": 40.7606, "lng": -73.9835,
     "description": "An ambitious new supper club of brass and candlelight.", "image": f"{_RIMG}1414235077428-338989a2e8c0?w=800&q=80", "base_rating": 0.0, "base_reviews": 0,
     "status": "opening_soon", "status_days": 10, "status_note": "Grand opening next week."},
    {"id": "rb-12", "name": "Vellum & Vine Bookshop", "category": "Retail", "address": "22 Quill Court", "lat": 40.7549, "lng": -73.9887,
     "description": "Rare books, maps and a quiet wine nook.", "image": f"{_RIMG}1521587760476-6c12a4b040da?w=800&q=80", "base_rating": 0.0, "base_reviews": 0,
     "status": "opening_soon", "status_days": 21, "status_note": "Coming later this month."},
]

# status_days: +future for opening/reopening, -past for recently opened.
RETRO_STATUS = {
    "rb-1": {"status": "temporary_closure", "status_days": 6, "status_note": "Closed for a kitchen refurbishment."},
    "rb-9": {"status": "temporary_closure", "status_days": 3, "status_note": "Brief staff holiday — back soon."},
    "rb-3": {"status": "recently_opened", "status_days": -5, "status_note": "Now open on Rivet Street."},
    "rb-8": {"status": "recently_opened", "status_days": -12, "status_note": "New flagship store."},
}

# Health inspection updates (days_ago in the past).
RETRO_INSPECTIONS = {
    "rb-2": {"grade": "A", "score": 96, "days_ago": 3, "note": "Excellent hygiene throughout."},
    "rb-5": {"grade": "A", "score": 92, "days_ago": 2, "note": "Clean, well-maintained venue."},
    "rb-6": {"grade": "A", "score": 98, "days_ago": 1, "note": "Spotless — exemplary practices."},
    "rb-7": {"grade": "B", "score": 84, "days_ago": 6, "note": "Good; minor cold-storage notes."},
}

# Commercial Marketplace — seeded businesses for sale.
RETRO_LISTINGS = [
    {"id": "rl-1", "name": "The Copper Spoon Diner", "category": "Restaurants", "asking_price": "£185,000", "location": "14 Foundry Street",
     "description": "A beloved 40-seat diner with a loyal regular trade, fully fitted kitchen and outdoor seating. Turn-key operation.",
     "reason": "Owner retiring after 22 years.", "revenue": "£320k / yr", "contact": "spoon.sale@konphlux.mail",
     "image": f"{_RIMG}1552566626-52f8b828add9?w=800&q=80"},
    {"id": "rl-2", "name": "Gearhaven Cycles", "category": "Retail", "asking_price": "£92,000", "location": "3 Sprocket Lane",
     "description": "Established bicycle & repair shop with workshop, tooling and stock included. Strong online presence.",
     "reason": "Relocating abroad.", "revenue": "£140k / yr", "contact": "07•• ••• 4412",
     "image": f"{_RIMG}1485965120184-e220f721d03e?w=800&q=80"},
    {"id": "rl-3", "name": "Aether & Oak Salon", "category": "Services", "asking_price": "£64,500", "location": "9 Marble Row",
     "description": "Six-chair salon in a prime footfall location. Lease assignable, staff willing to stay on.",
     "reason": "Pursuing a new venture.", "revenue": "£110k / yr", "contact": "aetheroak@konphlux.mail",
     "image": f"{_RIMG}1521590832167-7bcbfaa6381f?w=800&q=80"},
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


# ----------------------------- PictureShow (video district) -----------------------------
PS_CATEGORIES = ["Serials", "Documentaries", "Music", "Tutorials", "Comedy", "Shorts", "Live Recordings"]

_V = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/"

PS_CHANNELS = [
    {"id": "ch1", "name": "Clockwork Serials", "avatar": "https://picsum.photos/seed/pschan1/200",
     "subscribers": 48210, "description": "Weekly steampunk adventure serials."},
    {"id": "ch2", "name": "The Aether Almanac", "avatar": "https://picsum.photos/seed/pschan2/200",
     "subscribers": 31980, "description": "Documentaries on the wonders of the age."},
    {"id": "ch3", "name": "GenoTune Records", "avatar": "https://picsum.photos/seed/pschan3/200",
     "subscribers": 76540, "description": "Brass-band remixes and phonograph sessions."},
    {"id": "ch4", "name": "Grast Workshop", "avatar": "https://picsum.photos/seed/pschan4/200",
     "subscribers": 22110, "description": "Hands-on tinkering and repair tutorials."},
    {"id": "ch5", "name": "Boiler Room Comedy", "avatar": "https://picsum.photos/seed/pschan5/200",
     "subscribers": 40320, "description": "Late-night laughs from the furnace floor."},
]

PS_VIDEOS = [
    {"id": "v1", "title": "The Clockwork Serial — Episode Nine", "channel_id": "ch1", "category": "Serials",
     "thumbnail": "https://picsum.photos/seed/psv1/800/450", "video_url": f"{_V}BigBuckBunny.mp4",
     "duration": "10:34", "views": 128400, "likes": 8420, "description": "Our heroes descend into the Tidal Orrery as the aether storm gathers."},
    {"id": "v2", "title": "How Aether Lamps Really Work", "channel_id": "ch2", "category": "Documentaries",
     "thumbnail": "https://picsum.photos/seed/psv2/800/450", "video_url": f"{_V}ElephantsDream.mp4",
     "duration": "12:02", "views": 89230, "likes": 6110, "description": "A deep dive into the glowing heart of every Konphlux home."},
    {"id": "v3", "title": "Brass Band Remix: Tidal Orrery", "channel_id": "ch3", "category": "Music",
     "thumbnail": "https://picsum.photos/seed/psv3/800/450", "video_url": f"{_V}ForBiggerBlazes.mp4",
     "duration": "3:48", "views": 210500, "likes": 19800, "description": "GenoTune reworks the serial's haunting theme."},
    {"id": "v4", "title": "Repair Clinic: Fixing a Steam Gauge", "channel_id": "ch4", "category": "Tutorials",
     "thumbnail": "https://picsum.photos/seed/psv4/800/450", "video_url": f"{_V}ForBiggerEscapes.mp4",
     "duration": "8:15", "views": 45600, "likes": 3300, "description": "Step-by-step: bring a dead pressure reader back to life."},
    {"id": "v5", "title": "The Furnace Floor — Stand-Up Night", "channel_id": "ch5", "category": "Comedy",
     "thumbnail": "https://picsum.photos/seed/psv5/800/450", "video_url": f"{_V}ForBiggerFun.mp4",
     "duration": "6:59", "views": 67800, "likes": 5900, "description": "The best bits from last week's boiler-room comedy hour."},
    {"id": "v6", "title": "A Wayfarer's Journey — Short", "channel_id": "ch1", "category": "Shorts",
     "thumbnail": "https://picsum.photos/seed/psv6/800/450", "video_url": f"{_V}ForBiggerJoyrides.mp4",
     "duration": "1:22", "views": 302100, "likes": 24500, "description": "Sixty seconds of airship wanderlust."},
    {"id": "v7", "title": "The Great Meltdown, Explained", "channel_id": "ch2", "category": "Documentaries",
     "thumbnail": "https://picsum.photos/seed/psv7/800/450", "video_url": f"{_V}ForBiggerMeltdowns.mp4",
     "duration": "14:40", "views": 51200, "likes": 4020, "description": "What really happened in the Copperline foundry fire."},
    {"id": "v8", "title": "Sintel of the Skies (Fan Serial)", "channel_id": "ch1", "category": "Serials",
     "thumbnail": "https://picsum.photos/seed/psv8/800/450", "video_url": f"{_V}Sintel.mp4",
     "duration": "9:07", "views": 98700, "likes": 7700, "description": "A lone traveller and her mechanical companion."},
    {"id": "v9", "title": "Phonograph Sessions: Vol. 3", "channel_id": "ch3", "category": "Music",
     "thumbnail": "https://picsum.photos/seed/psv9/800/450", "video_url": f"{_V}TearsOfSteel.mp4",
     "duration": "4:31", "views": 143000, "likes": 12200, "description": "Warm wax recordings from the GenoTune vault."},
    {"id": "v10", "title": "Tinkering 101: Your First Gear Train", "channel_id": "ch4", "category": "Tutorials",
     "thumbnail": "https://picsum.photos/seed/psv10/800/450", "video_url": f"{_V}WeAreGoingOnBullrun.mp4",
     "duration": "7:44", "views": 38900, "likes": 2900, "description": "Assemble a working gear train on your workbench."},
    {"id": "v11", "title": "Two Minutes of Pure Nonsense", "channel_id": "ch5", "category": "Shorts",
     "thumbnail": "https://picsum.photos/seed/psv11/800/450", "video_url": f"{_V}VolkswagenGTIReview.mp4",
     "duration": "2:05", "views": 175400, "likes": 15100, "description": "The furnace crew loses the plot entirely."},
    {"id": "v12", "title": "Building the Tidal Orrery — Behind the Scenes", "channel_id": "ch1", "category": "Documentaries",
     "thumbnail": "https://picsum.photos/seed/psv12/800/450", "video_url": f"{_V}WhatCarCanYouGetForAGrand.mp4",
     "duration": "11:18", "views": 62300, "likes": 5400, "description": "How the serial's grandest set was engineered."},
]

PS_PLAYLISTS = [
    {"id": "pl1", "title": "Clockwork Serial — Full Season", "video_ids": ["v1", "v8"], "seed": True},
    {"id": "pl2", "title": "Best of GenoTune", "video_ids": ["v3", "v9"], "seed": True},
    {"id": "pl3", "title": "Repair & Tinker", "video_ids": ["v4", "v10"], "seed": True},
]

PS_STREAMS = [
    {"id": "ls1", "title": "Late-Night Forge — Live Build", "channel_id": "ch4", "category": "Live Recordings",
     "thumbnail": "https://picsum.photos/seed/psl1/800/450", "video_url": f"{_V}ForBiggerBlazes.mp4",
     "status": "live", "viewers": 1240, "scheduled_at": ""},
    {"id": "ls2", "title": "GenoTune Live Set from the Boiler Room", "channel_id": "ch3", "category": "Music",
     "thumbnail": "https://picsum.photos/seed/psl2/800/450", "video_url": f"{_V}ForBiggerFun.mp4",
     "status": "live", "viewers": 3410, "scheduled_at": ""},
    {"id": "ls3", "title": "Serial Table Read — Episode Ten", "channel_id": "ch1", "category": "Live Recordings",
     "thumbnail": "https://picsum.photos/seed/psl3/800/450", "video_url": "",
     "status": "upcoming", "viewers": 0, "scheduled_at": "2026-06-20T20:00:00+00:00"},
    {"id": "ls4", "title": "Ask the Aether Almanac — AMA", "channel_id": "ch2", "category": "Documentaries",
     "thumbnail": "https://picsum.photos/seed/psl4/800/450", "video_url": "",
     "status": "upcoming", "viewers": 0, "scheduled_at": "2026-06-22T18:30:00+00:00"},
    {"id": "ls5", "title": "Comedy Hour — Last Week's Live", "channel_id": "ch5", "category": "Comedy",
     "thumbnail": "https://picsum.photos/seed/psl5/800/450", "video_url": f"{_V}ForBiggerJoyrides.mp4",
     "status": "recent", "viewers": 8900, "scheduled_at": ""},
    {"id": "ls6", "title": "Repair Marathon — Full Replay", "channel_id": "ch4", "category": "Tutorials",
     "thumbnail": "https://picsum.photos/seed/psl6/800/450", "video_url": f"{_V}ForBiggerEscapes.mp4",
     "status": "recent", "viewers": 5600, "scheduled_at": ""},
]

PS_CLIPS = [
    {"id": "cl1", "title": "That Explosion Though 💥", "channel_id": "ch4", "category": "Shorts",
     "thumbnail": "https://picsum.photos/seed/psc1/800/450", "video_url": f"{_V}ForBiggerMeltdowns.mp4",
     "duration": "0:32", "views": 44100, "likes": 6800, "description": "Clip from the Late-Night Forge live build."},
    {"id": "cl2", "title": "The Drop — GenoTune Live", "channel_id": "ch3", "category": "Music",
     "thumbnail": "https://picsum.photos/seed/psc2/800/450", "video_url": f"{_V}Sintel.mp4",
     "duration": "0:48", "views": 92300, "likes": 11200, "description": "Highlight from the boiler-room set."},
    {"id": "cl3", "title": "Perfect Comic Timing", "channel_id": "ch5", "category": "Comedy",
     "thumbnail": "https://picsum.photos/seed/psc3/800/450", "video_url": f"{_V}VolkswagenGTIReview.mp4",
     "duration": "0:21", "views": 130500, "likes": 18900, "description": "Best moment from comedy hour."},
]


# ----------------------------- Chatterbox (messaging district) -----------------------------
# Seeded conversational personas so private messaging is usable from a fresh account.
# When you DM one of these, they send a canned steampunk-flavoured reply.
CB_CONTACTS = [
    {"id": "cb-alicia", "display_name": "Alicia (Switchboard)", "handle": "@switchboard",
     "avatar": "https://picsum.photos/seed/cbalicia/200", "tagline": "Konphlux concierge — here to help",
     "replies": ["Connected! How can I route you today?", "Happy to help — anything you need across Konphlux, just ask.",
                 "I've noted that. Anything else I can line up for you?"]},
    {"id": "cb-eugene", "display_name": "Eugene Halloway", "handle": "@eugene",
     "avatar": "https://picsum.photos/seed/cbeugene/200", "tagline": "Tinkerer at the Roundtable",
     "replies": ["Ha! Good one. So about that gear train…", "Let's meet at the workshop later?", "Agreed. Bring your calipers."]},
    {"id": "cb-marlowe", "display_name": "Marlowe Quill", "handle": "@marlowe",
     "avatar": "https://picsum.photos/seed/cbmarlowe/200", "tagline": "Scribe & conservator",
     "replies": ["A fine thought — I'll pen it down.", "Renaissance wax, as always, my friend.", "Meet me at the Vault Bindery?"]},
    {"id": "cb-isolde", "display_name": "Isolde Vayne", "handle": "@isolde",
     "avatar": "https://picsum.photos/seed/cbisolde/200", "tagline": "Aetherworks engineer",
     "replies": ["The lamp retrofit is holding beautifully.", "Ooh, tell me more!", "Sounds like a plan. ⚙️"]},
    {"id": "cb-dorian", "display_name": "Dorian Kesh", "handle": "@dorian",
     "avatar": "https://picsum.photos/seed/cbdorian/200", "tagline": "Airship navigator",
     "replies": ["Charting a course now.", "Winds are fair today — perfect for a flight.", "Catch you on the observation deck."]},
    {"id": "cb-beatrix", "display_name": "Beatrix Nolan", "handle": "@beatrix",
     "avatar": "https://picsum.photos/seed/cbbeatrix/200", "tagline": "Bazaar booth-keeper",
     "replies": ["New stock just came in — you'll love it.", "I'll set one aside for you.", "See you at the Bazaar!"]},
]
CB_CONTACT_MAP = {c["id"]: c for c in CB_CONTACTS}






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
    # Building materials (idempotent).
    for b in MATERIAL_LISTINGS:
        if not await db.bazaar.find_one({"id": b["id"]}):
            await db.bazaar.insert_one(dict(b))
    # Retrospections seeded businesses (idempotent; keep fields synced).
    for b in RETRO_BUSINESSES:
        await db.retro_businesses.update_one({"id": b["id"]}, {"$set": dict(b)}, upsert=True)
    for b in RETRO_UPCOMING:
        await db.retro_businesses.update_one({"id": b["id"]}, {"$set": dict(b)}, upsert=True)
    for bid, st in RETRO_STATUS.items():
        await db.retro_businesses.update_one({"id": bid}, {"$set": dict(st)})
    for bid, insp in RETRO_INSPECTIONS.items():
        await db.retro_businesses.update_one({"id": bid}, {"$set": {"inspection": dict(insp)}})
    for lst in RETRO_LISTINGS:
        await db.retro_listings.update_one({"id": lst["id"]}, {"$set": {**lst, "seller_id": "", "seller_name": "Konphlux Brokerage", "status": "active", "seeded": True}}, upsert=True)
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
    # PictureShow (idempotent).
    for ch in PS_CHANNELS:
        if not await db.ps_channels.find_one({"id": ch["id"]}):
            await db.ps_channels.insert_one(dict(ch))
    for v in PS_VIDEOS:
        if not await db.ps_videos.find_one({"id": v["id"]}):
            await db.ps_videos.insert_one({**v, "user_id": "seed", "created_at": "2026-06-01T09:00:00+00:00"})
    for cl in PS_CLIPS:
        if not await db.ps_clips.find_one({"id": cl["id"]}):
            await db.ps_clips.insert_one(dict(cl))
    for s in PS_STREAMS:
        if not await db.ps_streams.find_one({"id": s["id"]}):
            await db.ps_streams.insert_one({**s, "user_id": "seed"})
    for pl in PS_PLAYLISTS:
        if not await db.ps_playlists.find_one({"id": pl["id"]}):
            await db.ps_playlists.insert_one({**pl, "user_id": "seed", "created_at": "2026-06-01T09:00:00+00:00"})
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
    docs = await db.districts.find({"slug": {"$ne": "streamora"}}, {"_id": 0}).to_list(100)
    docs.sort(key=lambda d: d["name"])
    return docs


@api_router.get("/districts/{slug}")
async def get_district(slug: str, user: dict = Depends(require_user)):
    doc = await db.districts.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="District not found")
    others = await db.districts.find({"slug": {"$nin": [slug, "home", "streamora"]}}, {"_id": 0}).to_list(100)
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
            meta = session.get("metadata") or {}
            if meta.get("type") == "contribution":
                await _fulfill_contribution(session["id"])
            else:
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


# ---------- PictureShow (video district + Streamora live branch) ----------
async def _ps_channels_map() -> dict:
    docs = await db.ps_channels.find({}, {"_id": 0}).to_list(200)
    return {c["id"]: c for c in docs}


def _ps_video_card(v: dict, channels: dict) -> dict:
    ch = channels.get(v.get("channel_id"), {})
    return {
        "id": v["id"],
        "title": v["title"],
        "thumbnail": v.get("thumbnail", ""),
        "duration": v.get("duration", ""),
        "views": v.get("views", 0),
        "likes": v.get("likes", 0),
        "category": v.get("category", "Shorts"),
        "channel_id": v.get("channel_id", ""),
        "channel_name": ch.get("name", "Unknown Channel"),
        "channel_avatar": ch.get("avatar", ""),
    }


@api_router.get("/pictureshow")
async def pictureshow_hub(user: dict = Depends(require_user)):
    channels = await _ps_channels_map()
    videos = await db.ps_videos.find({}, {"_id": 0}).to_list(500)
    videos.sort(key=lambda v: v.get("created_at", ""), reverse=True)
    trending = sorted(videos, key=lambda v: v.get("views", 0), reverse=True)[:6]
    subs = await db.ps_subs.count_documents({"user_id": user["id"]})
    live_count = await db.ps_streams.count_documents({"status": "live"})
    return {
        "featured": [_ps_video_card(v, channels) for v in videos[:6]],
        "trending": [_ps_video_card(v, channels) for v in trending],
        "categories": PS_CATEGORIES,
        "channels": [
            {"id": c["id"], "name": c["name"], "avatar": c["avatar"], "subscribers": c["subscribers"]}
            for c in list(channels.values())[:6]
        ],
        "video_count": len(videos),
        "subscriptions": subs,
        "live_count": live_count,
    }


@api_router.get("/pictureshow/videos")
async def pictureshow_videos(user: dict = Depends(require_user), category: str | None = None, sort: str = "recent"):
    query: dict = {}
    if category and category != "All":
        query["category"] = category
    channels = await _ps_channels_map()
    videos = await db.ps_videos.find(query, {"_id": 0}).to_list(500)
    if sort == "trending":
        videos.sort(key=lambda v: v.get("views", 0), reverse=True)
    else:
        videos.sort(key=lambda v: v.get("created_at", ""), reverse=True)
    return {"videos": [_ps_video_card(v, channels) for v in videos], "categories": PS_CATEGORIES}


@api_router.get("/pictureshow/trending")
async def pictureshow_trending(user: dict = Depends(require_user)):
    channels = await _ps_channels_map()
    videos = await db.ps_videos.find({}, {"_id": 0}).to_list(500)
    videos.sort(key=lambda v: v.get("views", 0), reverse=True)
    return {"videos": [_ps_video_card(v, channels) for v in videos[:20]]}


@api_router.get("/pictureshow/videos/{video_id}")
async def pictureshow_video_detail(video_id: str, user: dict = Depends(require_user)):
    v = await db.ps_videos.find_one({"id": video_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    channels = await _ps_channels_map()
    ch = channels.get(v.get("channel_id"), {})
    liked = bool(await db.ps_likes.find_one({"user_id": user["id"], "video_id": video_id}))
    subscribed = bool(await db.ps_subs.find_one({"user_id": user["id"], "channel_id": v.get("channel_id")}))
    related = await db.ps_videos.find({"category": v.get("category"), "id": {"$ne": video_id}}, {"_id": 0}).to_list(20)
    playlists = await db.ps_playlists.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return {
        **v,
        "channel_name": ch.get("name", "Unknown Channel"),
        "channel_avatar": ch.get("avatar", ""),
        "channel_subscribers": ch.get("subscribers", 0),
        "liked": liked,
        "subscribed": subscribed,
        "related": [_ps_video_card(r, channels) for r in related[:6]],
        "my_playlists": [{"id": p["id"], "title": p["title"]} for p in playlists],
    }


@api_router.post("/pictureshow/videos/{video_id}/like")
async def pictureshow_like(video_id: str, user: dict = Depends(require_user)):
    v = await db.ps_videos.find_one({"id": video_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    existing = await db.ps_likes.find_one({"user_id": user["id"], "video_id": video_id})
    if existing:
        await db.ps_likes.delete_one({"user_id": user["id"], "video_id": video_id})
        await db.ps_videos.update_one({"id": video_id}, {"$inc": {"likes": -1}})
        liked = False
    else:
        await db.ps_likes.insert_one({"user_id": user["id"], "video_id": video_id})
        await db.ps_videos.update_one({"id": video_id}, {"$inc": {"likes": 1}})
        liked = True
    fresh = await db.ps_videos.find_one({"id": video_id}, {"_id": 0, "likes": 1})
    return {"liked": liked, "likes": fresh.get("likes", 0)}


@api_router.post("/pictureshow/videos", status_code=201)
async def pictureshow_create_video(body: PSVideoCreate, user: dict = Depends(require_user)):
    # Ensure the user has a personal channel.
    ch_id = f"u-{user['id']}"
    if not await db.ps_channels.find_one({"id": ch_id}):
        await db.ps_channels.insert_one({
            "id": ch_id, "name": user["display_name"], "avatar": "https://picsum.photos/seed/" + ch_id + "/200",
            "subscribers": 0, "description": f"{user['display_name']}'s channel",
        })
    vid = uuid.uuid4().hex[:10]
    doc = {
        "id": vid, "title": body.title.strip(), "channel_id": ch_id,
        "category": body.category if body.category in PS_CATEGORIES else "Shorts",
        "thumbnail": body.thumbnail.strip() or f"https://picsum.photos/seed/{vid}/800/450",
        "video_url": body.video_url.strip(), "duration": "", "views": 0, "likes": 0,
        "description": body.description.strip(), "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ps_videos.insert_one(dict(doc))
    channels = await _ps_channels_map()
    return _ps_video_card(doc, channels)


@api_router.get("/pictureshow/channels")
async def pictureshow_channels(user: dict = Depends(require_user)):
    channels = await db.ps_channels.find({}, {"_id": 0}).to_list(200)
    subs = {s["channel_id"] for s in await db.ps_subs.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)}
    out = []
    for c in channels:
        count = await db.ps_videos.count_documents({"channel_id": c["id"]})
        out.append({**c, "video_count": count, "subscribed": c["id"] in subs})
    out.sort(key=lambda c: c.get("subscribers", 0), reverse=True)
    return out


@api_router.get("/pictureshow/channels/{channel_id}")
async def pictureshow_channel_detail(channel_id: str, user: dict = Depends(require_user)):
    c = await db.ps_channels.find_one({"id": channel_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Channel not found")
    channels = await _ps_channels_map()
    videos = await db.ps_videos.find({"channel_id": channel_id}, {"_id": 0}).to_list(200)
    videos.sort(key=lambda v: v.get("views", 0), reverse=True)
    subscribed = bool(await db.ps_subs.find_one({"user_id": user["id"], "channel_id": channel_id}))
    return {**c, "subscribed": subscribed, "videos": [_ps_video_card(v, channels) for v in videos]}


@api_router.post("/pictureshow/channels/{channel_id}/subscribe")
async def pictureshow_subscribe(channel_id: str, user: dict = Depends(require_user)):
    c = await db.ps_channels.find_one({"id": channel_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Channel not found")
    existing = await db.ps_subs.find_one({"user_id": user["id"], "channel_id": channel_id})
    if existing:
        await db.ps_subs.delete_one({"user_id": user["id"], "channel_id": channel_id})
        await db.ps_channels.update_one({"id": channel_id}, {"$inc": {"subscribers": -1}})
        subscribed = False
    else:
        await db.ps_subs.insert_one({"user_id": user["id"], "channel_id": channel_id})
        await db.ps_channels.update_one({"id": channel_id}, {"$inc": {"subscribers": 1}})
        subscribed = True
    return {"subscribed": subscribed}


@api_router.get("/pictureshow/subscriptions")
async def pictureshow_subscriptions(user: dict = Depends(require_user)):
    sub_ids = [s["channel_id"] for s in await db.ps_subs.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)]
    channels = await _ps_channels_map()
    subbed = [channels[cid] for cid in sub_ids if cid in channels]
    videos = await db.ps_videos.find({"channel_id": {"$in": sub_ids}}, {"_id": 0}).to_list(500)
    videos.sort(key=lambda v: v.get("created_at", ""), reverse=True)
    return {
        "channels": [{"id": c["id"], "name": c["name"], "avatar": c["avatar"], "subscribers": c["subscribers"]} for c in subbed],
        "videos": [_ps_video_card(v, channels) for v in videos],
    }


@api_router.get("/pictureshow/playlists")
async def pictureshow_playlists(user: dict = Depends(require_user)):
    docs = await db.ps_playlists.find({"$or": [{"user_id": user["id"]}, {"seed": True}]}, {"_id": 0}).to_list(200)
    channels = await _ps_channels_map()
    out = []
    for p in docs:
        vids = await db.ps_videos.find({"id": {"$in": p.get("video_ids", [])}}, {"_id": 0}).to_list(200)
        thumb = vids[0]["thumbnail"] if vids else ""
        out.append({"id": p["id"], "title": p["title"], "count": len(p.get("video_ids", [])),
                    "thumbnail": thumb, "mine": p.get("user_id") == user["id"]})
    return out


@api_router.get("/pictureshow/playlists/{playlist_id}")
async def pictureshow_playlist_detail(playlist_id: str, user: dict = Depends(require_user)):
    p = await db.ps_playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    channels = await _ps_channels_map()
    vids = await db.ps_videos.find({"id": {"$in": p.get("video_ids", [])}}, {"_id": 0}).to_list(200)
    order = {vid: i for i, vid in enumerate(p.get("video_ids", []))}
    vids.sort(key=lambda v: order.get(v["id"], 999))
    return {"id": p["id"], "title": p["title"], "videos": [_ps_video_card(v, channels) for v in vids]}


@api_router.post("/pictureshow/playlists", status_code=201)
async def pictureshow_create_playlist(body: PSPlaylistCreate, user: dict = Depends(require_user)):
    pid = uuid.uuid4().hex[:10]
    await db.ps_playlists.insert_one({
        "id": pid, "title": body.title.strip(), "video_ids": [], "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"id": pid, "title": body.title.strip(), "count": 0}


@api_router.post("/pictureshow/playlists/{playlist_id}/add")
async def pictureshow_playlist_add(playlist_id: str, body: PSPlaylistAdd, user: dict = Depends(require_user)):
    p = await db.ps_playlists.find_one({"id": playlist_id, "user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Playlist not found")
    await db.ps_playlists.update_one({"id": playlist_id}, {"$addToSet": {"video_ids": body.video_id}})
    fresh = await db.ps_playlists.find_one({"id": playlist_id}, {"_id": 0})
    return {"id": playlist_id, "count": len(fresh.get("video_ids", []))}


# ----- Streamora (live branch) -----
def _ps_stream_card(s: dict, channels: dict) -> dict:
    ch = channels.get(s.get("channel_id"), {})
    return {
        "id": s["id"], "title": s["title"], "thumbnail": s.get("thumbnail", ""),
        "video_url": s.get("video_url", ""), "status": s.get("status", "recent"),
        "viewers": s.get("viewers", 0), "category": s.get("category", "Live Recordings"),
        "scheduled_at": s.get("scheduled_at", ""),
        "channel_id": s.get("channel_id", ""),
        "channel_name": ch.get("name", "Unknown"), "channel_avatar": ch.get("avatar", ""),
    }


@api_router.get("/pictureshow/streamora")
async def streamora_hub(user: dict = Depends(require_user)):
    channels = await _ps_channels_map()
    streams = await db.ps_streams.find({}, {"_id": 0}).to_list(500)
    follows = {f["channel_id"] for f in await db.ps_follows.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)}
    live = [_ps_stream_card(s, channels) for s in streams if s.get("status") == "live"]
    live.sort(key=lambda s: s["viewers"], reverse=True)
    upcoming = [_ps_stream_card(s, channels) for s in streams if s.get("status") == "upcoming"]
    upcoming.sort(key=lambda s: s.get("scheduled_at", ""))
    recent = [_ps_stream_card(s, channels) for s in streams if s.get("status") == "recent"]
    recent.sort(key=lambda s: s["viewers"], reverse=True)
    clips = await db.ps_clips.find({}, {"_id": 0}).to_list(100)
    followed = [
        {"id": c["id"], "name": c["name"], "avatar": c["avatar"]}
        for cid, c in channels.items() if cid in follows
    ]
    return {
        "live": live, "upcoming": upcoming, "recent": recent,
        "clips": [{**_ps_video_card(c, channels), "video_url": c.get("video_url", "")} for c in clips],
        "followed": followed,
    }


@api_router.post("/pictureshow/streamora/golive", status_code=201)
async def streamora_golive(body: PSGoLiveBody, user: dict = Depends(require_user)):
    ch_id = f"u-{user['id']}"
    if not await db.ps_channels.find_one({"id": ch_id}):
        await db.ps_channels.insert_one({
            "id": ch_id, "name": user["display_name"], "avatar": "https://picsum.photos/seed/" + ch_id + "/200",
            "subscribers": 0, "description": f"{user['display_name']}'s channel",
        })
    sid = uuid.uuid4().hex[:10]
    is_now = body.when == "now"
    doc = {
        "id": sid, "title": body.title.strip(), "channel_id": ch_id,
        "category": body.category if body.category in PS_CATEGORIES else "Live Recordings",
        "thumbnail": f"https://picsum.photos/seed/{sid}/800/450",
        "video_url": f"{_V}BigBuckBunny.mp4" if is_now else "",
        "status": "live" if is_now else "upcoming",
        "viewers": 1 if is_now else 0,
        "scheduled_at": "" if is_now else body.when,
        "user_id": user["id"],
    }
    await db.ps_streams.insert_one(dict(doc))
    channels = await _ps_channels_map()
    return _ps_stream_card(doc, channels)


@api_router.post("/pictureshow/streamora/{channel_id}/follow")
async def streamora_follow(channel_id: str, user: dict = Depends(require_user)):
    c = await db.ps_channels.find_one({"id": channel_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Channel not found")
    existing = await db.ps_follows.find_one({"user_id": user["id"], "channel_id": channel_id})
    if existing:
        await db.ps_follows.delete_one({"user_id": user["id"], "channel_id": channel_id})
        following = False
    else:
        await db.ps_follows.insert_one({"user_id": user["id"], "channel_id": channel_id})
        following = True
    return {"following": following}


# ----- AI Video Concept Studio (Nano Banana poster + written storyboard) -----
async def _ps_generate_image(prompt: str, user_id: str, ref_images: list[bytes] | None = None) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ps-img:{user_id}:{uuid.uuid4().hex[:8]}",
        system_message="You are a cinematic concept-art illustration engine. Produce a single striking poster image. When reference photos of characters are provided, keep those characters visually consistent with the references (face, hair, outfit).",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    file_contents = [ImageContent(base64.b64encode(b).decode("utf-8")) for b in (ref_images or [])]
    msg = UserMessage(text=prompt, file_contents=file_contents) if file_contents else UserMessage(text=prompt)
    _, images = await chat.send_message_multimodal_response(msg)
    if not images:
        raise RuntimeError("No image returned")
    img = images[0]
    mime = img.get("mime_type", "image/png")
    ext = "png" if "png" in mime else "jpg"
    data = base64.b64decode(img["data"])
    path = f"{APP_NAME}/ai/{user_id}/{uuid.uuid4().hex}.{ext}"
    await run_in_threadpool(put_object, path, data, mime)
    return path


@api_router.post("/pictureshow/ai/concept")
async def pictureshow_ai_concept(body: PSAIConceptBody, user: dict = Depends(require_user)):
    kind = "animation" if body.kind == "animation" else "video"
    style = body.style.strip() or ("hand-drawn steampunk animation" if kind == "animation" else "cinematic steampunk short film")
    # 1) Written storyboard / script via text LLM.
    system = (
        f"You are a {'animation' if kind == 'animation' else 'film'} director in the steampunk world of Konphlux. "
        f"Given a concept, produce a concise creative brief in plain text with exactly these sections:\n"
        f"TITLE: a short evocative title\n"
        f"LOGLINE: one sentence\n"
        f"STORYBOARD: 4-6 numbered beats/shots, one line each\n"
        f"NARRATION: 2-3 sentences of voice-over or script\n"
        f"No other commentary."
    )
    prompt = f"Concept: {body.prompt.strip()}\nStyle: {style}\nKind: {kind}"
    try:
        storyboard = await _anvil_llm(system, prompt, session=f"ps-ai:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("PictureShow AI storyboard error")
        raise HTTPException(status_code=502, detail="The projection engine sputtered. Try again.") from e
    # 2) Poster keyframe via Nano Banana.
    poster_path = ""
    try:
        img_prompt = f"A {style} poster keyframe. Scene: {body.prompt.strip()}. Ornate brass, aether glow, dramatic lighting, no text."
        poster_path = await _ps_generate_image(img_prompt, user["id"])
    except Exception:  # noqa: BLE001
        logger.exception("PictureShow AI poster error")
        poster_path = ""
    return {"kind": kind, "storyboard": storyboard.strip(), "poster_path": poster_path}


# ----- PictureShow: AI Video Suite (Concept Studio + characters + projects) -----
PS_STYLE_NOTES = {
    "Cinematic": "big-budget cinematic film look: shallow depth of field, dramatic lighting, epic framing",
    "Documentary": "authentic documentary style: handheld realism, natural light, observational framing, interview beats",
    "Music Video": "rhythmic music-video style: bold colour, quick cuts synced to a beat, performance energy",
    "Noir": "classic film noir: high-contrast black-and-white, hard shadows, venetian-blind light, moody mystery",
    "Splash Noir": "film noir in black-and-white with a single splash of vivid colour on one key element (Sin City style)",
    "Sepia": "warm sepia-toned vintage look, aged and nostalgic, soft golden-brown palette",
    "Cool Toon": "live-action mixed with hand-drawn animation (Who Framed Roger Rabbit / Cool World), real footage sharing frames with cartoon characters",
}


def _ps_join(items: list[str]) -> str:
    return ", ".join([i for i in items if i]) if items else ""


async def _ps_characters_for(user_id: str, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    docs = await db.ps_characters.find({"user_id": user_id, "id": {"$in": ids}}, {"_id": 0}).to_list(50)
    return docs


def _storage_path_from_url(url: str) -> str:
    """Extract the object-storage path from a stored file URL."""
    if not url:
        return ""
    marker = "/api/files/"
    return url.split(marker, 1)[1] if marker in url else url


async def _ps_reference_bytes(chars: list[dict], limit: int = 3) -> list[bytes]:
    out: list[bytes] = []
    for c in chars:
        path = _storage_path_from_url(c.get("reference_path", ""))
        if not path:
            continue
        try:
            content, _ = await run_in_threadpool(get_object, path)
            out.append(content)
        except Exception:  # noqa: BLE001
            logger.warning("Couldn't fetch character reference %s", path)
        if len(out) >= limit:
            break
    return out


@api_router.post("/pictureshow/upload-audio", status_code=201)
async def pictureshow_upload_audio(user: dict = Depends(require_user), file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio too large (max 25MB).")
    content_type = file.content_type or "audio/mpeg"
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Please choose an audio file.")
    ext = {"audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/aac": "aac", "audio/ogg": "ogg", "audio/webm": "webm"}.get(content_type, "m4a")
    path = f"{APP_NAME}/ps-audio/{user['id']}/{uuid.uuid4().hex}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except Exception as e:  # noqa: BLE001
        logger.exception("PS audio upload failed")
        raise HTTPException(status_code=502, detail="Couldn't store the audio. Try again.") from e
    return {"path": path}


@api_router.post("/pictureshow/characters", status_code=201)
async def pictureshow_create_character(body: PSCharacterBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12],
        "user_id": user["id"],
        "name": body.name.strip(),
        "description": body.description.strip(),
        "reference_path": body.reference_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ps_characters.insert_one(dict(doc))
    return doc


@api_router.get("/pictureshow/characters")
async def pictureshow_list_characters(user: dict = Depends(require_user)):
    docs = await db.ps_characters.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.delete("/pictureshow/characters/{char_id}")
async def pictureshow_delete_character(char_id: str, user: dict = Depends(require_user)):
    res = await db.ps_characters.delete_one({"id": char_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"deleted": True}


@api_router.post("/pictureshow/ai/suite")
async def pictureshow_ai_suite(body: PSSuiteBody, user: dict = Depends(require_user)):
    kind = "animation" if body.kind == "animation" else "video"
    style = body.style.strip()
    style_note = PS_STYLE_NOTES.get(style, style) or ("hand-drawn animation" if kind == "animation" else "cinematic short film")
    chars = await _ps_characters_for(user["id"], body.character_ids)
    char_lines = "\n".join([f"- {c['name']}: {c.get('description') or 'a recurring character'}" for c in chars])

    directives: list[str] = []
    if body.length:
        directives.append(f"Target runtime: {body.length} — pace the beats to fit this length.")
    if body.transitions:
        directives.append(f"Use these transitions between shots where fitting: {_ps_join(body.transitions)}.")
    if body.atmospherics:
        directives.append(f"Apply atmospheric looks: {_ps_join(body.atmospherics)}.")
    if body.titles:
        directives.append(f"Include title/text animations: {_ps_join(body.titles)}.")
    if body.finishing:
        directives.append(f"Finishing polish: {_ps_join(body.finishing)}.")
    if body.audio_effects:
        directives.append(f"Voice/audio effects to apply: {_ps_join(body.audio_effects)}.")
    if body.speed:
        directives.append(f"Playback speed treatment: {body.speed}.")
    if body.has_soundtrack:
        directives.append("A custom uploaded soundtrack accompanies the piece — reference music cues in the beats.")
    if body.has_voiceover:
        directives.append("A recorded voice-over narration is provided — write narration to match it.")
    if char_lines:
        directives.append(f"Feature these characters consistently:\n{char_lines}")

    system = (
        f"You are the AI Video Suite director in the steampunk world of Konphlux, producing a shot-ready brief for a "
        f"{'stylised animation' if kind == 'animation' else 'live-action film'} in a {style_note} style. "
        f"Return a concise creative brief in plain text with exactly these section headers, each on its own line:\n"
        f"TITLE: a short evocative title\n"
        f"LOGLINE: one sentence\n"
        f"STYLE & LOOK: 1-2 sentences describing the visual treatment (honour the requested style, atmosphere and titles)\n"
        f"STORYBOARD: numbered shot list (scale beats to the target runtime), one line each with shot type, action and the transition into the next shot\n"
        f"SCRIPT / NARRATION: the spoken lines or voice-over, matching any requested audio treatment\n"
        f"SOUND & MUSIC: music and sound direction\n"
        f"No other commentary."
    )
    prompt = f"Concept: {body.prompt.strip()}\nStyle: {style or style_note}\nKind: {kind}"
    if directives:
        prompt += "\n\nDirection:\n" + "\n".join(f"- {d}" for d in directives)

    try:
        storyboard = await _anvil_llm(system, prompt, session=f"ps-suite:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("PictureShow AI suite storyboard error")
        raise HTTPException(status_code=502, detail="The projection engine sputtered. Try again.") from e

    poster_path = ""
    try:
        char_visual = f" Featuring {_ps_join([c['name'] for c in chars])}." if chars else ""
        atmos = f" {_ps_join(body.atmospherics)}." if body.atmospherics else ""
        ref_bytes = await _ps_reference_bytes(chars)
        consistency = " Match the provided reference photos so the characters look identical to them." if ref_bytes else ""
        img_prompt = (
            f"A {style_note} poster keyframe. Scene: {body.prompt.strip()}.{char_visual}{atmos}{consistency} "
            f"Ornate brass, aether glow, dramatic lighting, no text."
        )
        poster_path = await _ps_generate_image(img_prompt, user["id"], ref_images=ref_bytes)
    except Exception:  # noqa: BLE001
        logger.exception("PictureShow AI suite poster error")
        poster_path = ""
    return {"kind": kind, "storyboard": storyboard.strip(), "poster_path": poster_path}


def _ps_project_public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.post("/pictureshow/projects", status_code=201)
async def pictureshow_save_project(body: PSProjectBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12],
        "user_id": user["id"],
        "title": body.title.strip() or (body.prompt.strip()[:60] or "Untitled project"),
        "prompt": body.prompt.strip(),
        "kind": body.kind,
        "style": body.style,
        "length": body.length,
        "speed": body.speed,
        "transitions": body.transitions,
        "atmospherics": body.atmospherics,
        "titles": body.titles,
        "finishing": body.finishing,
        "audio_effects": body.audio_effects,
        "character_ids": body.character_ids,
        "soundtrack_path": body.soundtrack_path,
        "voiceover_path": body.voiceover_path,
        "storyboard": body.storyboard.strip(),
        "poster_path": body.poster_path,
        "render_status": "",
        "video_url": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ps_projects.insert_one(dict(doc))
    return _ps_project_public(doc)


@api_router.get("/pictureshow/projects")
async def pictureshow_list_projects(user: dict = Depends(require_user)):
    docs = await db.ps_projects.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.get("/pictureshow/projects/{project_id}")
async def pictureshow_get_project(project_id: str, user: dict = Depends(require_user)):
    doc = await db.ps_projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


@api_router.delete("/pictureshow/projects/{project_id}")
async def pictureshow_delete_project(project_id: str, user: dict = Depends(require_user)):
    res = await db.ps_projects.delete_one({"id": project_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}


# ----- PictureShow: Suite Presets (style + effects bundles) -----
@api_router.post("/pictureshow/presets", status_code=201)
async def pictureshow_save_preset(body: PSPresetBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12],
        "user_id": user["id"],
        "name": body.name.strip(),
        "style": body.style,
        "length": body.length,
        "speed": body.speed,
        "transitions": body.transitions,
        "atmospherics": body.atmospherics,
        "titles": body.titles,
        "finishing": body.finishing,
        "audio_effects": body.audio_effects,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ps_presets.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.get("/pictureshow/presets")
async def pictureshow_list_presets(user: dict = Depends(require_user)):
    docs = await db.ps_presets.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.delete("/pictureshow/presets/{preset_id}")
async def pictureshow_delete_preset(preset_id: str, user: dict = Depends(require_user)):
    res = await db.ps_presets.delete_one({"id": preset_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"deleted": True}


# ----- PictureShow: Real video rendering via fal.ai -----
PS_T2V_MODEL = "fal-ai/kling-video/v3/standard/text-to-video"
PS_I2V_MODEL = "fal-ai/kling-video/v3/standard/image-to-video"


def _ps_video_prompt(doc: dict) -> str:
    style = doc.get("style", "")
    style_note = PS_STYLE_NOTES.get(style, style)
    parts = [doc.get("prompt", "").strip()]
    if style_note:
        parts.append(style_note)
    atmos = _ps_join(doc.get("atmospherics", []))
    if atmos:
        parts.append(atmos)
    if doc.get("kind") == "animation":
        parts.append("stylised animation")
    return ". ".join([p for p in parts if p])[:1000]


@api_router.post("/pictureshow/projects/{project_id}/render")
async def pictureshow_render(project_id: str, user: dict = Depends(require_user)):
    if not FAL_KEY:
        raise HTTPException(status_code=503, detail="Video rendering isn't configured yet. Add your fal.ai API key to enable it.")
    doc = await db.ps_projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    prompt = _ps_video_prompt(doc)
    try:
        if doc.get("poster_path"):
            content, ctype = await run_in_threadpool(get_object, doc["poster_path"])
            image_url = await fal_client.upload_async(content, ctype or "image/png")
            model = PS_I2V_MODEL
            args = {"prompt": prompt, "start_image_url": image_url, "duration": "5", "aspect_ratio": "16:9"}
        else:
            model = PS_T2V_MODEL
            args = {"prompt": prompt, "duration": "5", "aspect_ratio": "16:9"}
        handler = await fal_client.submit_async(model, arguments=args)
        request_id = handler.request_id
    except Exception as e:  # noqa: BLE001
        logger.exception("PictureShow render submit failed")
        raise HTTPException(status_code=502, detail="Couldn't start the render. Try again.") from e
    await db.ps_projects.update_one(
        {"id": project_id, "user_id": user["id"]},
        {"$set": {"render_status": "rendering", "render_model": model, "render_request_id": request_id, "video_url": ""}},
    )
    return {"status": "rendering"}


def _extract_video_url(result) -> str:
    if not isinstance(result, dict):
        return ""
    v = result.get("video")
    if isinstance(v, dict):
        return v.get("url", "")
    if isinstance(v, list) and v and isinstance(v[0], dict):
        return v[0].get("url", "")
    if isinstance(v, str):
        return v
    return ""


@api_router.get("/pictureshow/projects/{project_id}/render-status")
async def pictureshow_render_status(project_id: str, user: dict = Depends(require_user)):
    doc = await db.ps_projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    status = doc.get("render_status", "")
    if status != "rendering":
        return {"status": status or "idle", "video_url": doc.get("video_url", "")}
    model = doc.get("render_model")
    rid = doc.get("render_request_id")
    if not FAL_KEY or not model or not rid:
        return {"status": "rendering", "video_url": ""}
    try:
        st = await fal_client.status_async(model, rid, with_logs=False)
        if isinstance(st, fal_client.Completed):
            result = await fal_client.result_async(model, rid)
            video_url = _extract_video_url(result)
            new_status = "ready" if video_url else "failed"
            await db.ps_projects.update_one(
                {"id": project_id, "user_id": user["id"]},
                {"$set": {"render_status": new_status, "video_url": video_url}},
            )
            return {"status": new_status, "video_url": video_url}
        return {"status": "rendering", "video_url": ""}
    except Exception:  # noqa: BLE001
        logger.exception("PictureShow render status failed")
        await db.ps_projects.update_one(
            {"id": project_id, "user_id": user["id"]},
            {"$set": {"render_status": "failed"}},
        )
        return {"status": "failed", "video_url": ""}




# ----- Profession Plaza: Job Board -----
JOB_CATEGORIES = [
    "Engineering", "Design", "Product", "Marketing", "Sales", "Operations",
    "Finance", "Customer Support", "Writing", "Data", "Healthcare", "Education", "Other",
]
JOB_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary"]
GIG_TYPES = ["Contract", "Freelance", "Internship", "Temporary"]


def _job_public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


async def _notify_job_alerts(job: dict) -> None:
    """Notify users whose alert prefs match this new job (by category or keyword)."""
    try:
        haystack = f"{job.get('title', '')} {job.get('description', '')} {job.get('company', '')}".lower()
        subs = await db.job_alert_prefs.find({}, {"_id": 0}).to_list(2000)
        for s in subs:
            if s.get("user_id") == job.get("poster_id"):
                continue
            cat_match = job.get("category", "") in (s.get("categories") or [])
            kw_match = any(k.lower().strip() in haystack for k in (s.get("keywords") or []) if k.strip())
            if cat_match or kw_match:
                await _notify(s["user_id"], "job_alert", job["id"], "New job for you", f"\"{job['title']}\" matches your job alerts.")
    except Exception:  # noqa: BLE001
        logger.exception("job alert notify failed")


@api_router.get("/profession/meta")
async def profession_meta(user: dict = Depends(require_user)):
    return {"categories": JOB_CATEGORIES, "job_types": JOB_TYPES}


@api_router.post("/profession/jobs", status_code=201)
async def profession_create_job(body: JobBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12],
        "poster_id": user["id"],
        "poster_name": user.get("display_name", "Someone"),
        "title": body.title.strip(),
        "company": body.company.strip(),
        "location": body.location.strip(),
        "job_type": body.job_type,
        "category": body.category,
        "salary_min": body.salary_min,
        "salary_max": body.salary_max,
        "remote": body.remote,
        "description": body.description.strip(),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.jobs.insert_one(dict(doc))
    await _notify_job_alerts(doc)
    return _job_public(doc)


@api_router.get("/profession/jobs")
async def profession_list_jobs(user: dict = Depends(require_user), q: str = "", category: str = "", gigs: bool = False):
    query: dict = {"status": "open"}
    if gigs:
        query["job_type"] = {"$in": GIG_TYPES}
    if category and category != "All":
        query["category"] = category
    if q.strip():
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"title": rx}, {"company": rx}, {"description": rx}, {"location": rx}]
    docs = await db.jobs.find(query, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    ids = [d["id"] for d in docs]
    applied = set()
    saved = set()
    if ids:
        apps = await db.job_applications.find({"applicant_id": user["id"], "job_id": {"$in": ids}}, {"_id": 0, "job_id": 1}).to_list(1000)
        applied = {a["job_id"] for a in apps}
        sv = await db.job_saves.find({"user_id": user["id"], "job_id": {"$in": ids}}, {"_id": 0, "job_id": 1}).to_list(1000)
        saved = {s["job_id"] for s in sv}
    for d in docs:
        d["has_applied"] = d["id"] in applied
        d["is_owner"] = d["poster_id"] == user["id"]
        d["saved"] = d["id"] in saved
    return docs


@api_router.get("/profession/jobs/mine")
async def profession_my_jobs(user: dict = Depends(require_user)):
    docs = await db.jobs.find({"poster_id": user["id"]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    for d in docs:
        d["applicant_count"] = await db.job_applications.count_documents({"job_id": d["id"]})
    return docs


@api_router.get("/profession/applications/mine")
async def profession_my_applications(user: dict = Depends(require_user)):
    apps = await db.job_applications.find({"applicant_id": user["id"]}, {"_id": 0}).to_list(500)
    apps.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    job_ids = [a["job_id"] for a in apps]
    jobs = await db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0}).to_list(500)
    by_id = {j["id"]: j for j in jobs}
    out = []
    for a in apps:
        j = by_id.get(a["job_id"])
        out.append({
            **a,
            "job_title": j["title"] if j else "Removed listing",
            "company": j.get("company", "") if j else "",
            "job_open": bool(j and j.get("status") == "open"),
        })
    return out


@api_router.get("/profession/jobs/{job_id}")
async def profession_get_job(job_id: str, user: dict = Depends(require_user)):
    doc = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    app = await db.job_applications.find_one({"job_id": job_id, "applicant_id": user["id"]}, {"_id": 0})
    doc["is_owner"] = doc["poster_id"] == user["id"]
    doc["has_applied"] = bool(app)
    doc["my_application_status"] = app["status"] if app else ""
    doc["saved"] = bool(await db.job_saves.find_one({"user_id": user["id"], "job_id": job_id}))
    return doc


@api_router.put("/profession/jobs/{job_id}")
async def profession_update_job(job_id: str, body: JobBody, user: dict = Depends(require_user)):
    doc = await db.jobs.find_one({"id": job_id, "poster_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "title": body.title.strip(), "company": body.company.strip(), "location": body.location.strip(),
            "job_type": body.job_type, "category": body.category, "salary_min": body.salary_min,
            "salary_max": body.salary_max, "remote": body.remote, "description": body.description.strip(),
        }},
    )
    updated = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return _job_public(updated)


@api_router.post("/profession/jobs/{job_id}/close")
async def profession_close_job(job_id: str, user: dict = Depends(require_user)):
    doc = await db.jobs.find_one({"id": job_id, "poster_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    new_status = "closed" if doc.get("status") == "open" else "open"
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": new_status}})
    return {"status": new_status}


@api_router.delete("/profession/jobs/{job_id}")
async def profession_delete_job(job_id: str, user: dict = Depends(require_user)):
    res = await db.jobs.delete_one({"id": job_id, "poster_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.job_applications.delete_many({"job_id": job_id})
    return {"deleted": True}


@api_router.post("/profession/jobs/{job_id}/apply", status_code=201)
async def profession_apply(job_id: str, body: JobApplyBody, user: dict = Depends(require_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["poster_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You can't apply to your own listing.")
    if job.get("status") != "open":
        raise HTTPException(status_code=400, detail="This listing is closed.")
    existing = await db.job_applications.find_one({"job_id": job_id, "applicant_id": user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="You've already applied to this job.")
    doc = {
        "id": uuid.uuid4().hex[:12],
        "job_id": job_id,
        "applicant_id": user["id"],
        "applicant_name": user.get("display_name", "Someone"),
        "applicant_handle": user.get("handle", ""),
        "cover_note": body.cover_note.strip(),
        "resume_link": body.resume_link.strip(),
        "resume_path": body.resume_path,
        "status": "submitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.job_applications.insert_one(dict(doc))
    # Notify the poster in-app.
    try:
        await _notify(job["poster_id"], "job_application", job_id, "New application", f"{doc['applicant_name']} applied to your job \"{job['title']}\".")
    except Exception:  # noqa: BLE001
        pass
    return _job_public(doc)


@api_router.get("/profession/jobs/{job_id}/applicants")
async def profession_applicants(job_id: str, user: dict = Depends(require_user)):
    job = await db.jobs.find_one({"id": job_id, "poster_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    apps = await db.job_applications.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    apps.sort(key=lambda a: a.get("created_at", ""), reverse=True)
    return {"job": job, "applicants": apps}


@api_router.put("/profession/applications/{app_id}/status")
async def profession_set_status(app_id: str, body: AppStatusBody, user: dict = Depends(require_user)):
    app = await db.job_applications.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    job = await db.jobs.find_one({"id": app["job_id"], "poster_id": user["id"]})
    if not job:
        raise HTTPException(status_code=403, detail="Not your listing")
    await db.job_applications.update_one({"id": app_id}, {"$set": {"status": body.status}})
    try:
        await _notify(app["applicant_id"], "job_status", app["job_id"], "Application update", f"Your application for \"{job['title']}\" is now {body.status}.")
    except Exception:  # noqa: BLE001
        pass
    return {"status": body.status}


# ----- Profession Plaza: Save jobs -----
@api_router.post("/profession/jobs/{job_id}/save")
async def profession_toggle_save(job_id: str, user: dict = Depends(require_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "id": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = await db.job_saves.find_one({"user_id": user["id"], "job_id": job_id})
    if existing:
        await db.job_saves.delete_one({"user_id": user["id"], "job_id": job_id})
        return {"saved": False}
    await db.job_saves.insert_one({"user_id": user["id"], "job_id": job_id, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"saved": True}


@api_router.get("/profession/saved")
async def profession_saved_jobs(user: dict = Depends(require_user)):
    saves = await db.job_saves.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    saves.sort(key=lambda s: s.get("created_at", ""), reverse=True)
    ids = [s["job_id"] for s in saves]
    jobs = await db.jobs.find({"id": {"$in": ids}, "status": "open"}, {"_id": 0}).to_list(500)
    by_id = {j["id"]: j for j in jobs}
    applied = {a["job_id"] for a in await db.job_applications.find({"applicant_id": user["id"], "job_id": {"$in": ids}}, {"_id": 0, "job_id": 1}).to_list(1000)}
    out = []
    for s in saves:
        j = by_id.get(s["job_id"])
        if not j:
            continue
        j["saved"] = True
        j["has_applied"] = j["id"] in applied
        j["is_owner"] = j["poster_id"] == user["id"]
        out.append(j)
    return out


# ----- Profession Plaza: Job alerts -----
@api_router.get("/profession/alerts/prefs")
async def profession_get_alert_prefs(user: dict = Depends(require_user)):
    doc = await db.job_alert_prefs.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"categories": doc.get("categories", []) if doc else [], "keywords": doc.get("keywords", []) if doc else []}


@api_router.put("/profession/alerts/prefs")
async def profession_set_alert_prefs(body: JobAlertBody, user: dict = Depends(require_user)):
    cats = [c for c in body.categories if c in JOB_CATEGORIES]
    kws = [k.strip() for k in body.keywords if k.strip()][:20]
    await db.job_alert_prefs.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "categories": cats, "keywords": kws}},
        upsert=True,
    )
    return {"categories": cats, "keywords": kws}


# ----- Profession Plaza: Gigs (freelance-type jobs) -----
@api_router.get("/profession/gigs")
async def profession_gigs(user: dict = Depends(require_user), q: str = "", category: str = ""):
    return await profession_list_jobs(user=user, q=q, category=category, gigs=True)


# ----- Profession Plaza: Resume file upload -----
@api_router.post("/profession/upload-resume", status_code=201)
async def profession_upload_resume(user: dict = Depends(require_user), file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume too large (max 10MB).")
    content_type = file.content_type or "application/pdf"
    allowed = {
        "application/pdf": "pdf",
        "application/msword": "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/plain": "txt",
    }
    if content_type not in allowed:
        raise HTTPException(status_code=400, detail="Please choose a PDF, Word doc, or text file.")
    path = f"{APP_NAME}/resumes/{user['id']}/{uuid.uuid4().hex}.{allowed[content_type]}"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except Exception as e:  # noqa: BLE001
        logger.exception("Resume upload failed")
        raise HTTPException(status_code=502, detail="Couldn't store the resume. Try again.") from e
    return {"path": path}


# ----- Profession Plaza: Freelancer marketplace -----
def _freelancer_public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


async def _freelancer_rating(user_id: str) -> tuple[float, int]:
    revs = await db.freelancer_reviews.find({"freelancer_user_id": user_id}, {"_id": 0, "rating": 1}).to_list(1000)
    if not revs:
        return 0.0, 0
    return round(sum(r["rating"] for r in revs) / len(revs), 1), len(revs)


@api_router.get("/profession/freelancers")
async def profession_list_freelancers(user: dict = Depends(require_user), q: str = "", category: str = "", sort: str = "featured"):
    query: dict = {}
    if category and category != "All":
        query["category"] = category
    if q.strip():
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"name": rx}, {"headline": rx}, {"bio": rx}, {"skills": rx}]
    docs = await db.freelancers.find(query, {"_id": 0}).to_list(500)
    for d in docs:
        d["avg_rating"], d["review_count"] = await _freelancer_rating(d["user_id"])
    if sort == "rating":
        docs.sort(key=lambda d: (d.get("avg_rating", 0), d.get("review_count", 0)), reverse=True)
    elif sort == "available":
        docs.sort(key=lambda d: (d.get("available", False), d.get("updated_at", "")), reverse=True)
    elif sort == "recent":
        docs.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    else:  # featured
        docs.sort(key=lambda d: (d.get("available", False), d.get("avg_rating", 0), d.get("updated_at", "")), reverse=True)
    for i, d in enumerate(docs):
        d["featured"] = bool(d.get("available") and (d.get("avg_rating", 0) >= 4 or i < 3))
    return docs


@api_router.get("/profession/freelancer/me")
async def profession_my_freelancer(user: dict = Depends(require_user)):
    doc = await db.freelancers.find_one({"user_id": user["id"]}, {"_id": 0})
    return doc or {}


@api_router.put("/profession/freelancer/me")
async def profession_save_freelancer(body: FreelancerBody, user: dict = Depends(require_user)):
    existing = await db.freelancers.find_one({"user_id": user["id"]}, {"_id": 0})
    doc = {
        "id": existing["id"] if existing else uuid.uuid4().hex[:12],
        "user_id": user["id"],
        "handle": user.get("handle", ""),
        "name": body.name.strip(),
        "headline": body.headline.strip(),
        "bio": body.bio.strip(),
        "category": body.category,
        "skills": [s.strip() for s in body.skills if s.strip()][:30],
        "hourly_rate": body.hourly_rate,
        "location": body.location.strip(),
        "avatar_url": body.avatar_url,
        "links": [l.strip() for l in body.links if l.strip()][:10],
        "experience": [e.model_dump() for e in body.experience],
        "available": body.available,
        "created_at": existing.get("created_at") if existing else datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.freelancers.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return _freelancer_public(doc)


@api_router.get("/profession/freelancers/{freelancer_id}")
async def profession_get_freelancer(freelancer_id: str, user: dict = Depends(require_user)):
    doc = await db.freelancers.find_one({"id": freelancer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    doc["is_me"] = doc.get("user_id") == user["id"]
    doc["avg_rating"], doc["review_count"] = await _freelancer_rating(doc["user_id"])
    reviews = await db.freelancer_reviews.find({"freelancer_user_id": doc["user_id"]}, {"_id": 0}).to_list(200)
    reviews.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    doc["reviews"] = reviews
    doc["can_review"] = not doc["is_me"]
    return doc


@api_router.post("/profession/freelancers/{freelancer_id}/review", status_code=201)
async def profession_review_freelancer(freelancer_id: str, body: ReviewBody, user: dict = Depends(require_user)):
    fl = await db.freelancers.find_one({"id": freelancer_id}, {"_id": 0})
    if not fl:
        raise HTTPException(status_code=404, detail="Profile not found")
    if fl["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You can't review your own profile.")
    doc = {
        "id": uuid.uuid4().hex[:12], "freelancer_id": freelancer_id, "freelancer_user_id": fl["user_id"],
        "reviewer_id": user["id"], "reviewer_name": user.get("display_name", "Someone"),
        "rating": body.rating, "comment": body.comment.strip(), "job_title": body.job_title.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.freelancer_reviews.update_one({"freelancer_id": freelancer_id, "reviewer_id": user["id"]}, {"$set": doc}, upsert=True)
    try:
        await _notify(fl["user_id"], "freelancer_review", freelancer_id, "New review", f"{doc['reviewer_name']} rated you {body.rating}★.")
    except Exception:  # noqa: BLE001
        pass
    return {k: v for k, v in doc.items() if k != "_id"}


# ----- Profession Plaza: Hire from chat (offers) -----
async def _cb_post_card(conv_id: str, sender: dict, text: str, kind: str, meta: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    msg = {"id": uuid.uuid4().hex[:12], "conversation_id": conv_id, "sender_id": sender["id"],
           "sender_name": sender.get("display_name", "Someone"), "text": text, "kind": kind, "meta": meta, "created_at": now}
    await db.cb_messages.insert_one(dict(msg))
    await db.cb_conversations.update_one({"id": conv_id}, {"$set": {"last_message": text[:120], "last_at": now}})


@api_router.post("/profession/offers", status_code=201)
async def profession_send_offer(body: OfferBody, user: dict = Depends(require_user)):
    conv = await db.cb_conversations.find_one({"id": body.conversation_id, "participants": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    offer = {
        "id": uuid.uuid4().hex[:12], "conversation_id": body.conversation_id,
        "from_user_id": user["id"], "from_name": user.get("display_name", "Someone"),
        "to_user_id": body.to_user_id, "title": body.title.strip(), "rate_text": body.rate_text.strip(),
        "note": body.note.strip(), "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.job_offers.insert_one(dict(offer))
    await _cb_post_card(body.conversation_id, user, f"Sent an offer: {offer['title']}", "offer",
                        {"offer_id": offer["id"], "title": offer["title"], "rate_text": offer["rate_text"], "note": offer["note"], "status": "pending", "to_user_id": body.to_user_id})
    try:
        await _notify(body.to_user_id, "job_offer", body.conversation_id, "New offer", f"{offer['from_name']} sent you an offer: {offer['title']}.")
    except Exception:  # noqa: BLE001
        pass
    return {k: v for k, v in offer.items() if k != "_id"}


@api_router.post("/profession/offers/{offer_id}/respond")
async def profession_respond_offer(offer_id: str, body: RespondBody, user: dict = Depends(require_user)):
    offer = await db.job_offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer or offer["to_user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Offer not found")
    new_status = "accepted" if body.accept else "declined"
    await db.job_offers.update_one({"id": offer_id}, {"$set": {"status": new_status}})
    await db.cb_messages.update_one({"conversation_id": offer["conversation_id"], "meta.offer_id": offer_id}, {"$set": {"meta.status": new_status}})
    contract_id = ""
    if body.accept:
        existing = await db.job_contracts.find_one({"offer_id": offer_id}, {"_id": 0, "id": 1})
        contract_id = existing["id"] if existing else uuid.uuid4().hex[:12]
        if not existing:
            contract = {
                "id": contract_id, "offer_id": offer_id, "conversation_id": offer["conversation_id"],
                "client_id": offer["from_user_id"], "client_name": offer["from_name"],
                "freelancer_id": offer["to_user_id"], "freelancer_name": user.get("display_name", "Someone"),
                "title": offer["title"], "rate_text": offer.get("rate_text", ""), "note": offer.get("note", ""),
                "status": "active", "accepted_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.job_contracts.insert_one(dict(contract))
        await db.cb_messages.update_one({"conversation_id": offer["conversation_id"], "meta.offer_id": offer_id}, {"$set": {"meta.contract_id": contract_id}})
    await _cb_post_card(offer["conversation_id"], user, f"{'Accepted' if body.accept else 'Declined'} the offer: {offer['title']}", "system", {})
    try:
        await _notify(offer["from_user_id"], "job_offer", offer["conversation_id"], "Offer " + new_status, f"{user.get('display_name','Someone')} {new_status} your offer: {offer['title']}.")
    except Exception:  # noqa: BLE001
        pass
    return {"status": new_status, "contract_id": contract_id}


@api_router.get("/profession/contracts")
async def profession_my_contracts(user: dict = Depends(require_user)):
    docs = await db.job_contracts.find({"$or": [{"client_id": user["id"]}, {"freelancer_id": user["id"]}]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("accepted_at", ""), reverse=True)
    for d in docs:
        d["role"] = "client" if d["client_id"] == user["id"] else "freelancer"
    return docs


@api_router.get("/profession/contracts/{contract_id}")
async def profession_get_contract(contract_id: str, user: dict = Depends(require_user)):
    doc = await db.job_contracts.find_one({"id": contract_id}, {"_id": 0})
    if not doc or user["id"] not in (doc["client_id"], doc["freelancer_id"]):
        raise HTTPException(status_code=404, detail="Agreement not found")
    doc["role"] = "client" if doc["client_id"] == user["id"] else "freelancer"
    return doc


@api_router.post("/profession/interviews/{interview_id}/reschedule")
async def profession_reschedule_interview(interview_id: str, body: RescheduleBody, user: dict = Depends(require_user)):
    iv = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not iv or user["id"] not in (iv["applicant_id"], iv["poster_id"]):
        raise HTTPException(status_code=404, detail="Interview not found")
    await db.interviews.update_one({"id": interview_id}, {"$set": {"scheduled_at": body.scheduled_at, "status": "proposed"}})
    if iv.get("conversation_id"):
        await db.cb_messages.update_one({"conversation_id": iv["conversation_id"], "meta.interview_id": interview_id}, {"$set": {"meta.status": "proposed", "meta.scheduled_at": body.scheduled_at}})
        await _cb_post_card(iv["conversation_id"], user, f"Proposed a new time for: {iv['title']}", "interview",
                            {"interview_id": interview_id, "title": iv["title"], "scheduled_at": body.scheduled_at, "location": iv.get("location", ""), "status": "proposed", "to_user_id": iv["applicant_id"]})
    other_id = iv["poster_id"] if user["id"] == iv["applicant_id"] else iv["applicant_id"]
    try:
        await _notify(other_id, "interview", iv.get("job_id") or iv.get("conversation_id"), "Interview rescheduled", f"{user.get('display_name','Someone')} proposed a new time for: {iv['title']}.")
    except Exception:  # noqa: BLE001
        pass
    return {"status": "proposed", "scheduled_at": body.scheduled_at}


# ----- Profession Plaza + Evention Center: Interview scheduling -----
def _interview_public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.post("/profession/interviews", status_code=201)
async def profession_schedule_interview(body: InterviewBody, user: dict = Depends(require_user)):
    other = await db.users.find_one({"id": body.to_user_id})
    if not other:
        raise HTTPException(status_code=404, detail="Person not found")
    doc = {
        "id": uuid.uuid4().hex[:12], "job_id": body.job_id, "conversation_id": body.conversation_id,
        "poster_id": user["id"], "poster_name": user.get("display_name", "Someone"),
        "applicant_id": body.to_user_id, "applicant_name": other.get("display_name", "Someone"),
        "title": body.title.strip(), "scheduled_at": body.scheduled_at, "location": body.location.strip(),
        "status": "proposed", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.interviews.insert_one(dict(doc))
    if body.conversation_id:
        conv = await db.cb_conversations.find_one({"id": body.conversation_id, "participants": user["id"]}, {"_id": 0})
        if conv:
            await _cb_post_card(body.conversation_id, user, f"Proposed an interview: {doc['title']}", "interview",
                                {"interview_id": doc["id"], "title": doc["title"], "scheduled_at": doc["scheduled_at"], "location": doc["location"], "status": "proposed", "to_user_id": body.to_user_id})
    try:
        await _notify(body.to_user_id, "interview", body.job_id or body.conversation_id, "Interview proposed", f"{doc['poster_name']} proposed an interview: {doc['title']}.")
    except Exception:  # noqa: BLE001
        pass
    return _interview_public(doc)


@api_router.post("/profession/interviews/{interview_id}/respond")
async def profession_respond_interview(interview_id: str, body: InterviewRespondBody, user: dict = Depends(require_user)):
    iv = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not iv or user["id"] not in (iv["applicant_id"], iv["poster_id"]):
        raise HTTPException(status_code=404, detail="Interview not found")
    await db.interviews.update_one({"id": interview_id}, {"$set": {"status": body.status}})
    if iv.get("conversation_id"):
        await db.cb_messages.update_one({"conversation_id": iv["conversation_id"], "meta.interview_id": interview_id}, {"$set": {"meta.status": body.status}})
        await _cb_post_card(iv["conversation_id"], user, f"{'Confirmed' if body.status == 'confirmed' else 'Declined'} the interview: {iv['title']}", "system", {})
    other_id = iv["poster_id"] if user["id"] == iv["applicant_id"] else iv["applicant_id"]
    try:
        await _notify(other_id, "interview", iv.get("job_id") or iv.get("conversation_id"), "Interview " + body.status, f"{user.get('display_name','Someone')} {body.status} the interview: {iv['title']}.")
    except Exception:  # noqa: BLE001
        pass
    return {"status": body.status}


@api_router.get("/evention/interviews")
async def evention_interviews(user: dict = Depends(require_user)):
    docs = await db.interviews.find({"$or": [{"poster_id": user["id"]}, {"applicant_id": user["id"]}], "status": {"$ne": "declined"}}, {"_id": 0}).to_list(500)
    now_iso = datetime.now(timezone.utc).isoformat()
    upcoming = [d for d in docs if d.get("scheduled_at", "") >= now_iso]
    past = [d for d in docs if d.get("scheduled_at", "") < now_iso]
    upcoming.sort(key=lambda d: d.get("scheduled_at", ""))
    past.sort(key=lambda d: d.get("scheduled_at", ""), reverse=True)
    for d in upcoming + past:
        d["role"] = "poster" if d["poster_id"] == user["id"] else "applicant"
    return {"upcoming": upcoming, "past": past}


async def _fire_interview_reminders(user_id: str) -> None:
    """Lazily nudge both parties ~24h before a confirmed interview (once)."""
    now = datetime.now(timezone.utc)
    soon = (now + timedelta(hours=24)).isoformat()
    ivs = await db.interviews.find({"$or": [{"poster_id": user_id}, {"applicant_id": user_id}], "status": "confirmed", "reminded": {"$ne": True}}, {"_id": 0}).to_list(200)
    for iv in ivs:
        sa = iv.get("scheduled_at", "")
        if now.isoformat() <= sa <= soon:
            await db.interviews.update_one({"id": iv["id"]}, {"$set": {"reminded": True}})
            for uid in (iv["poster_id"], iv["applicant_id"]):
                try:
                    await _notify(uid, "interview", iv.get("conversation_id"), "Interview soon", f"Reminder: \"{iv['title']}\" is coming up.")
                except Exception:  # noqa: BLE001
                    pass


CAL_TYPE_COLORS = {"interview": "#3182CE", "meeting": "#805AD5", "flight": "#DD6B20", "appointment": "#319795", "event": "#D53F8C", "birthday": "#38A169"}


@api_router.post("/evention/events", status_code=201)
async def evention_create_event(body: CalendarEventBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12], "user_id": user["id"], "type": body.type,
        "title": body.title.strip(), "when": body.when, "location": body.location.strip(),
        "note": body.note.strip(), "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.calendar_events.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.delete("/evention/events/{event_id}")
async def evention_delete_event(event_id: str, user: dict = Depends(require_user)):
    res = await db.calendar_events.delete_one({"id": event_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"deleted": True}


@api_router.get("/evention/calendar")
async def evention_calendar(user: dict = Depends(require_user)):
    await _fire_interview_reminders(user["id"])
    items: list[dict] = []
    ivs = await db.interviews.find({"$or": [{"poster_id": user["id"]}, {"applicant_id": user["id"]}], "status": {"$ne": "declined"}}, {"_id": 0}).to_list(500)
    for iv in ivs:
        other = iv["applicant_name"] if iv["poster_id"] == user["id"] else iv["poster_name"]
        items.append({"id": iv["id"], "type": "interview", "title": iv["title"], "when": iv.get("scheduled_at", ""),
                      "location": iv.get("location", ""), "note": f"With {other}", "status": iv.get("status", ""),
                      "color": CAL_TYPE_COLORS["interview"], "deletable": False})
    evs = await db.calendar_events.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    for e in evs:
        items.append({"id": e["id"], "type": e["type"], "title": e["title"], "when": e.get("when", ""),
                      "location": e.get("location", ""), "note": e.get("note", ""), "status": "",
                      "color": CAL_TYPE_COLORS.get(e["type"], "#718096"), "deletable": True})
    items.sort(key=lambda x: x.get("when", ""))
    now_iso = datetime.now(timezone.utc).isoformat()
    return {"upcoming": [i for i in items if i["when"] >= now_iso], "past": [i for i in items if i["when"] < now_iso][::-1]}


# ----- Evention Center: Smart Reminders (Clarity nudges when something starts soon) -----
_CAL_TYPE_LABEL = {"interview": "interview", "meeting": "meeting", "flight": "trip",
                   "appointment": "appointment", "event": "event", "birthday": "special day"}


def _clarity_reminder_message(type_key: str, title: str, minutes: int, location: str) -> str:
    label = _CAL_TYPE_LABEL.get(type_key, "event")
    if minutes <= 0:
        when_phrase = "is starting right now"
    elif minutes == 1:
        when_phrase = "starts in about a minute"
    else:
        when_phrase = f"starts in about {minutes} minutes"
    where = f" at {location}" if location else ""
    return f"Heads up — your {label} \u201c{title}\u201d {when_phrase}{where}. Best get ready!"


@api_router.get("/evention/reminders/due")
async def evention_reminders_due(user: dict = Depends(require_user)):
    """Return calendar items starting within the next 30 minutes that the user
    hasn't been nudged about yet. Each returned item is marked so it fires once."""
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(minutes=30)
    grace = now - timedelta(minutes=2)  # still remind if it just started
    out: list[dict] = []

    def _parse(iso: str):
        try:
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:  # noqa: BLE001
            return None

    # Confirmed interviews
    ivs = await db.interviews.find(
        {"$or": [{"poster_id": user["id"]}, {"applicant_id": user["id"]}],
         "status": "confirmed", "soon_reminded": {"$ne": True}}, {"_id": 0}).to_list(200)
    for iv in ivs:
        dt = _parse(iv.get("scheduled_at", ""))
        if not dt or not (grace <= dt <= horizon):
            continue
        await db.interviews.update_one({"id": iv["id"]}, {"$set": {"soon_reminded": True}})
        mins = max(0, int((dt - now).total_seconds() // 60))
        out.append({"id": iv["id"], "type": "interview", "title": iv["title"], "when": iv.get("scheduled_at", ""),
                    "location": iv.get("location", ""), "minutes": mins, "color": CAL_TYPE_COLORS["interview"],
                    "message": _clarity_reminder_message("interview", iv["title"], mins, iv.get("location", ""))})

    # User-created events
    evs = await db.calendar_events.find(
        {"user_id": user["id"], "reminder_sent": {"$ne": True}}, {"_id": 0}).to_list(1000)
    for e in evs:
        dt = _parse(e.get("when", ""))
        if not dt or not (grace <= dt <= horizon):
            continue
        await db.calendar_events.update_one({"id": e["id"], "user_id": user["id"]}, {"$set": {"reminder_sent": True}})
        mins = max(0, int((dt - now).total_seconds() // 60))
        loc = e.get("location", "")
        out.append({"id": e["id"], "type": e["type"], "title": e["title"], "when": e.get("when", ""),
                    "location": loc, "minutes": mins, "color": CAL_TYPE_COLORS.get(e["type"], "#718096"),
                    "message": _clarity_reminder_message(e["type"], e["title"], mins, loc)})

    out.sort(key=lambda x: x.get("when", ""))
    return {"reminders": out}


# ----- Evention Center: Lists (custom checklists, not date-bound) -----
@api_router.post("/evention/lists", status_code=201)
async def evention_create_list(body: EventionListBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12], "user_id": user["id"], "title": body.title.strip(),
        "items": [], "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.evention_lists.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.get("/evention/lists")
async def evention_lists(user: dict = Depends(require_user)):
    docs = await db.evention_lists.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.delete("/evention/lists/{list_id}")
async def evention_delete_list(list_id: str, user: dict = Depends(require_user)):
    res = await db.evention_lists.delete_one({"id": list_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="List not found")
    return {"deleted": True}


@api_router.post("/evention/lists/{list_id}/items", status_code=201)
async def evention_add_list_item(list_id: str, body: ListItemBody, user: dict = Depends(require_user)):
    item = {"id": uuid.uuid4().hex[:8], "text": body.text.strip(), "done": False}
    res = await db.evention_lists.update_one({"id": list_id, "user_id": user["id"]}, {"$push": {"items": item}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="List not found")
    return item


@api_router.post("/evention/lists/{list_id}/items/{item_id}/toggle")
async def evention_toggle_list_item(list_id: str, item_id: str, user: dict = Depends(require_user)):
    doc = await db.evention_lists.find_one({"id": list_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="List not found")
    items = doc.get("items", [])
    found = False
    for it in items:
        if it["id"] == item_id:
            it["done"] = not it.get("done", False)
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.evention_lists.update_one({"id": list_id, "user_id": user["id"]}, {"$set": {"items": items}})
    return {"done": next(it["done"] for it in items if it["id"] == item_id)}


@api_router.delete("/evention/lists/{list_id}/items/{item_id}")
async def evention_delete_list_item(list_id: str, item_id: str, user: dict = Depends(require_user)):
    res = await db.evention_lists.update_one({"id": list_id, "user_id": user["id"]}, {"$pull": {"items": {"id": item_id}}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="List not found")
    return {"deleted": True}


# ----- Retrospections: business Review System (reviews, categories, nearby map) -----
def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _retro_public(b: dict) -> dict:
    """Attach live rating/review counts (seeded base + user reviews)."""
    base_rating = float(b.get("base_rating", 0) or 0)
    base_reviews = int(b.get("base_reviews", 0) or 0)
    agg = await db.retro_reviews.aggregate([
        {"$match": {"business_id": b["id"]}},
        {"$group": {"_id": None, "sum": {"$sum": "$rating"}, "n": {"$sum": 1}}},
    ]).to_list(1)
    user_sum = agg[0]["sum"] if agg else 0
    user_n = agg[0]["n"] if agg else 0
    total_n = base_reviews + user_n
    avg = ((base_rating * base_reviews) + user_sum) / total_n if total_n else 0.0
    return {
        "id": b["id"], "name": b["name"], "category": b["category"], "address": b.get("address", ""),
        "description": b.get("description", ""), "image": b.get("image", ""),
        "lat": b.get("lat"), "lng": b.get("lng"),
        "avg_rating": round(avg, 1), "review_count": total_n,
        "owner_id": b.get("owner_id", ""),
        "status": b.get("status", "open"),
    }


@api_router.get("/retrospections/meta")
async def retro_meta(user: dict = Depends(require_user)):
    return {"categories": RETRO_CATEGORIES, "center": RETRO_CENTER}


@api_router.get("/retrospections/businesses")
async def retro_businesses(category: str = "", q: str = "",
                           lat: float | None = None, lng: float | None = None,
                           user: dict = Depends(require_user)):
    query: dict = {"status": {"$ne": "opening_soon"}}
    if category and category != "All":
        query["category"] = category
    if q.strip():
        query["name"] = {"$regex": q.strip(), "$options": "i"}
    docs = await db.retro_businesses.find(query, {"_id": 0}).to_list(500)
    out = [await _retro_public(b) for b in docs]
    fav_ids = await _retro_fav_ids(user["id"])
    for o in out:
        o["is_favorite"] = o["id"] in fav_ids
    if lat is not None and lng is not None:
        for o in out:
            if o.get("lat") is not None and o.get("lng") is not None:
                o["distance_km"] = round(_haversine_km(lat, lng, o["lat"], o["lng"]), 2)
            else:
                o["distance_km"] = None
        out.sort(key=lambda x: (x.get("distance_km") is None, x.get("distance_km") or 0))
    else:
        out.sort(key=lambda x: (-x["avg_rating"], -x["review_count"]))
    return out


@api_router.post("/retrospections/businesses", status_code=201)
async def retro_create_business(body: RetroBusinessBody, user: dict = Depends(require_user)):
    if body.category not in RETRO_CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown category")
    doc = {
        "id": uuid.uuid4().hex[:12], "name": body.name.strip(), "category": body.category,
        "address": body.address.strip(), "description": body.description.strip(),
        "lat": body.lat, "lng": body.lng, "image": "",
        "base_rating": 0.0, "base_reviews": 0, "owner_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.retro_businesses.insert_one(dict(doc))
    return await _retro_public(doc)


@api_router.get("/retrospections/businesses/{business_id}")
async def retro_business_detail(business_id: str, user: dict = Depends(require_user)):
    b = await db.retro_businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    pub = await _retro_public(b)
    reviews = await db.retro_reviews.find({"business_id": business_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    pub["reviews"] = reviews
    pub["can_review"] = not any(r["user_id"] == user["id"] for r in reviews)
    pub["is_favorite"] = await db.retro_favorites.find_one({"user_id": user["id"], "business_id": business_id}) is not None
    return pub


@api_router.post("/retrospections/businesses/{business_id}/reviews", status_code=201)
async def retro_add_review(business_id: str, body: RetroReviewBody, user: dict = Depends(require_user)):
    b = await db.retro_businesses.find_one({"id": business_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")
    if await db.retro_reviews.find_one({"business_id": business_id, "user_id": user["id"]}):
        raise HTTPException(status_code=409, detail="You've already reviewed this place")
    doc = {
        "id": uuid.uuid4().hex[:12], "business_id": business_id, "user_id": user["id"],
        "author_name": user.get("display_name", "Someone"), "rating": body.rating,
        "text": body.text.strip(), "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.retro_reviews.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.get("/retrospections/nearby")
async def retro_nearby(lat: float, lng: float, user: dict = Depends(require_user)):
    docs = await db.retro_businesses.find({"status": {"$ne": "opening_soon"}}, {"_id": 0}).to_list(500)
    out = []
    for b in docs:
        o = await _retro_public(b)
        if o.get("lat") is None or o.get("lng") is None:
            continue
        o["distance_km"] = round(_haversine_km(lat, lng, o["lat"], o["lng"]), 2)
        out.append(o)
    out.sort(key=lambda x: x["distance_km"])
    return {"center": {"lat": lat, "lng": lng}, "businesses": out}


@api_router.get("/retrospections/status")
async def retro_status(user: dict = Depends(require_user)):
    """Real-time business status hub: opening soon, recently opened,
    health inspection updates and temporary closures."""
    now = datetime.now(timezone.utc)
    docs = await db.retro_businesses.find({}, {"_id": 0}).to_list(1000)

    def _base(b: dict) -> dict:
        return {"id": b["id"], "name": b["name"], "category": b["category"],
                "address": b.get("address", ""), "image": b.get("image", "")}

    opening_soon, recently_opened, closures, inspections = [], [], [], []
    for b in docs:
        st = b.get("status", "open")
        days = int(b.get("status_days", 0) or 0)
        note = b.get("status_note", "")
        if st == "opening_soon":
            item = _base(b); item["date"] = (now + timedelta(days=days)).isoformat(); item["days"] = days; item["note"] = note
            opening_soon.append(item)
        elif st == "recently_opened":
            item = _base(b); item["date"] = (now + timedelta(days=days)).isoformat(); item["days"] = days; item["note"] = note
            recently_opened.append(item)
        elif st == "temporary_closure":
            item = _base(b); item["date"] = (now + timedelta(days=days)).isoformat() if days else None; item["days"] = days; item["note"] = note
            closures.append(item)
        insp = b.get("inspection")
        if insp:
            item = _base(b)
            item.update({"grade": insp.get("grade", ""), "score": insp.get("score", 0),
                         "date": (now - timedelta(days=int(insp.get("days_ago", 0) or 0))).isoformat(),
                         "note": insp.get("note", "")})
            inspections.append(item)

    opening_soon.sort(key=lambda x: x["days"])
    recently_opened.sort(key=lambda x: x["days"], reverse=True)  # most recent first (days negative)
    closures.sort(key=lambda x: (x["days"] is None, x["days"] or 0))
    inspections.sort(key=lambda x: x["date"], reverse=True)
    return {"opening_soon": opening_soon, "recently_opened": recently_opened,
            "closures": closures, "inspections": inspections}


# ----- Retrospections: Save Favorite Places (personal bookmarks) -----
async def _retro_fav_ids(user_id: str) -> set:
    favs = await db.retro_favorites.find({"user_id": user_id}, {"_id": 0, "business_id": 1}).to_list(1000)
    return {f["business_id"] for f in favs}


@api_router.post("/retrospections/favorites/{business_id}", status_code=201)
async def retro_add_favorite(business_id: str, user: dict = Depends(require_user)):
    if not await db.retro_businesses.find_one({"id": business_id}):
        raise HTTPException(status_code=404, detail="Business not found")
    await db.retro_favorites.update_one(
        {"user_id": user["id"], "business_id": business_id},
        {"$setOnInsert": {"user_id": user["id"], "business_id": business_id, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    return {"is_favorite": True}


@api_router.delete("/retrospections/favorites/{business_id}")
async def retro_remove_favorite(business_id: str, user: dict = Depends(require_user)):
    await db.retro_favorites.delete_one({"user_id": user["id"], "business_id": business_id})
    return {"is_favorite": False}


@api_router.get("/retrospections/favorites")
async def retro_favorites(user: dict = Depends(require_user)):
    favs = await db.retro_favorites.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    out = []
    for f in favs:
        b = await db.retro_businesses.find_one({"id": f["business_id"]}, {"_id": 0})
        if b:
            pub = await _retro_public(b)
            pub["is_favorite"] = True
            out.append(pub)
    return out


# ----- Retrospections: Commercial Marketplace (businesses for sale) -----
def _listing_public(lst: dict, user_id: str) -> dict:
    return {
        "id": lst["id"], "name": lst["name"], "category": lst["category"],
        "asking_price": lst.get("asking_price", ""), "location": lst.get("location", ""),
        "description": lst.get("description", ""), "reason": lst.get("reason", ""),
        "revenue": lst.get("revenue", ""), "contact": lst.get("contact", ""),
        "image": lst.get("image", ""), "seller_name": lst.get("seller_name", ""),
        "created_at": lst.get("created_at", ""), "is_owner": lst.get("seller_id", "") == user_id,
    }


@api_router.get("/retrospections/listings")
async def retro_listings(category: str = "", q: str = "", user: dict = Depends(require_user)):
    query: dict = {"status": "active"}
    if category and category != "All":
        query["category"] = category
    if q.strip():
        query["name"] = {"$regex": q.strip(), "$options": "i"}
    docs = await db.retro_listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    # seeded listings have no created_at; keep them after user listings but visible
    return [_listing_public(d, user["id"]) for d in docs]


@api_router.get("/retrospections/my-listings")
async def retro_my_listings(user: dict = Depends(require_user)):
    docs = await db.retro_listings.find({"seller_id": user["id"], "status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_listing_public(d, user["id"]) for d in docs]


@api_router.post("/retrospections/listings", status_code=201)
async def retro_create_listing(body: RetroListingBody, user: dict = Depends(require_user)):
    if body.category not in RETRO_CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown category")
    doc = {
        "id": uuid.uuid4().hex[:12], "seller_id": user["id"], "seller_name": user.get("display_name", "A seller"),
        "name": body.name.strip(), "category": body.category, "asking_price": body.asking_price.strip(),
        "location": body.location.strip(), "description": body.description.strip(), "reason": body.reason.strip(),
        "revenue": body.revenue.strip(), "contact": body.contact.strip(), "image": "", "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.retro_listings.insert_one(dict(doc))
    return _listing_public(doc, user["id"])


@api_router.get("/retrospections/listings/{listing_id}")
async def retro_listing_detail(listing_id: str, user: dict = Depends(require_user)):
    lst = await db.retro_listings.find_one({"id": listing_id, "status": "active"}, {"_id": 0})
    if not lst:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _listing_public(lst, user["id"])


@api_router.delete("/retrospections/listings/{listing_id}")
async def retro_delete_listing(listing_id: str, user: dict = Depends(require_user)):
    res = await db.retro_listings.delete_one({"id": listing_id, "seller_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found or not yours")
    return {"deleted": True}


# ----- Treasury: Konphlux Balance (the core wallet & ledger) -----
def _money(cents: int) -> str:
    return f"£{cents / 100:,.2f}"


async def _ensure_wallet(user: dict) -> dict:
    """Return the user's wallet, creating it with a starter balance and a little
    seeded history the first time they open the Treasury."""
    w = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if w:
        return w
    now = datetime.now(timezone.utc)
    opening = 100_000
    # (days_ago, type, direction, amount_cents, title, counterparty, category)
    seed = [
        (30, "payment", "credit", 10_000, "Added funds", "Bank card", "Top-up"),
        (24, "payment", "debit", 3_400, "Bazaar order — Brass Sextant", "Bazaar", "Shopping"),
        (18, "transfer", "credit", 5_000, "Received from Cogsworth", "@cogsworth", "Transfer"),
        (12, "payment", "debit", 999, "Membership Subscription", "Konphlux", "Subscription"),
        (7, "payment", "debit", 2_500, "Donation — Aether Lamp Restoration", "Dreambacker", "Donation"),
        (3, "transfer", "debit", 1_500, "Sent to Isolde Vayne", "@isolde", "Transfer"),
    ]
    bal = opening
    docs = []
    for days_ago, ttype, direction, amt, title, counterparty, category in seed:
        bal = bal + amt if direction == "credit" else bal - amt
        docs.append({
            "id": uuid.uuid4().hex[:12], "user_id": user["id"], "type": ttype, "direction": direction,
            "amount_cents": amt, "title": title, "counterparty": counterparty, "category": category,
            "note": "", "balance_after_cents": bal,
            "created_at": (now - timedelta(days=days_ago)).isoformat(),
        })
    if docs:
        await db.transactions.insert_many([dict(d) for d in docs])
    wallet = {"user_id": user["id"], "balance_cents": bal, "created_at": now.isoformat()}
    await db.wallets.insert_one(dict(wallet))
    return {"user_id": user["id"], "balance_cents": bal, "created_at": wallet["created_at"]}


async def _record_txn(user_id: str, ttype: str, direction: str, amount_cents: int,
                      title: str, counterparty: str, category: str, note: str = "") -> dict:
    """Apply a ledger entry to a wallet atomically-ish and return the transaction."""
    w = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    bal = (w["balance_cents"] if w else 0)
    bal = bal + amount_cents if direction == "credit" else bal - amount_cents
    doc = {
        "id": uuid.uuid4().hex[:12], "user_id": user_id, "type": ttype, "direction": direction,
        "amount_cents": amount_cents, "title": title, "counterparty": counterparty, "category": category,
        "note": note, "balance_after_cents": bal, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(dict(doc))
    await db.wallets.update_one({"user_id": user_id}, {"$set": {"balance_cents": bal}}, upsert=True)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.get("/treasury/balance")
async def treasury_balance(user: dict = Depends(require_user)):
    w = await _ensure_wallet(user)
    txns = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)
    total_in = sum(t["amount_cents"] for t in txns if t["direction"] == "credit")
    total_out = sum(t["amount_cents"] for t in txns if t["direction"] == "debit")
    return {
        "balance_cents": w["balance_cents"],
        "total_in_cents": total_in,
        "total_out_cents": total_out,
        "payments_count": sum(1 for t in txns if t["type"] == "payment"),
        "transfers_count": sum(1 for t in txns if t["type"] == "transfer"),
    }


@api_router.get("/treasury/transactions")
async def treasury_transactions(type: str = "all", user: dict = Depends(require_user)):
    await _ensure_wallet(user)
    query: dict = {"user_id": user["id"]}
    if type in ("payment", "transfer"):
        query["type"] = type
    docs = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return docs


@api_router.post("/treasury/topup", status_code=201)
async def treasury_topup(body: TopupBody, user: dict = Depends(require_user)):
    await _ensure_wallet(user)
    txn = await _record_txn(user["id"], "payment", "credit", body.amount_cents, "Added funds", "Bank card", "Top-up")
    w = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"transaction": txn, "balance_cents": w["balance_cents"]}


@api_router.post("/treasury/pay", status_code=201)
async def treasury_pay(body: PaymentBody, user: dict = Depends(require_user)):
    w = await _ensure_wallet(user)
    if w["balance_cents"] < body.amount_cents:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    txn = await _record_txn(user["id"], "payment", "debit", body.amount_cents, body.title.strip(), "Konphlux", body.category.strip() or "General")
    w2 = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"transaction": txn, "balance_cents": w2["balance_cents"]}


@api_router.post("/treasury/transfer", status_code=201)
async def treasury_transfer(body: TransferBody, user: dict = Depends(require_user)):
    w = await _ensure_wallet(user)
    if w["balance_cents"] < body.amount_cents:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    key = body.recipient.strip()
    handle = key if key.startswith("@") else f"@{key}"
    recipient = await db.users.find_one({"$or": [{"email": key.lower()}, {"handle": handle}, {"handle": key}]})
    if not recipient:
        raise HTTPException(status_code=404, detail="No Konphlux member found for that email or handle")
    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You can't transfer to yourself")
    # debit sender, credit recipient
    txn = await _record_txn(user["id"], "transfer", "debit", body.amount_cents,
                            f"Sent to {recipient['display_name']}", recipient.get("handle", ""), "Transfer", body.note.strip())
    await _ensure_wallet(recipient)
    await _record_txn(recipient["id"], "transfer", "credit", body.amount_cents,
                      f"Received from {user['display_name']}", user.get("handle", ""), "Transfer", body.note.strip())
    w2 = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"transaction": txn, "balance_cents": w2["balance_cents"]}









# ----- Frankenstein Lab: Audio Creation Studio (GenoTune music + GenoFX sfx) -----
@api_router.post("/frankenstein/audio")
async def frankenstein_audio(body: FrankAudioBody, user: dict = Depends(require_user)):
    is_music = body.kind == "music"
    if is_music:
        system = (
            "You are GenoTune, the AI music-smith of Frankenstein Lab in the steampunk world of Konphlux. "
            "Given a brief, produce a detailed MUSIC CONCEPT in plain text with exactly these section headers, each on its own line:\n"
            "TITLE: an evocative track title\n"
            "GENRE & MOOD: the style and emotional feel\n"
            "INSTRUMENTATION: the key instruments and textures\n"
            "STRUCTURE: 4-6 sections (e.g. Intro, Verse, Chorus, Bridge, Outro), one line each with a short description\n"
            "TEMPO & KEY: approximate BPM and musical key\n"
            "PRODUCTION NOTES: mixing/atmosphere guidance\n"
            "Keep it vivid but concise. No other commentary."
        )
        prompt = f"Brief: {body.prompt.strip()}"
        if body.genre:
            prompt += f"\nGenre: {body.genre}"
        if body.mood:
            prompt += f"\nMood: {body.mood}"
        if body.duration:
            prompt += f"\nApprox length: {body.duration}"
        img_prompt = (
            f"Abstract album cover / sound visualization for a piece of music: {body.prompt.strip()}. "
            f"{body.genre} {body.mood}. Flowing waveforms, glowing brass tuning forks, aether light, steampunk, no text."
        )
    else:
        system = (
            "You are GenoFX, the AI sound-effects engineer of Frankenstein Lab in the steampunk world of Konphlux. "
            "Given a brief, produce a detailed SFX DESCRIPTION in plain text with exactly these section headers, each on its own line:\n"
            "NAME: a short name for the effect\n"
            "CATEGORY: the type of sound (e.g. mechanical, ambient, UI, creature, impact)\n"
            "DESCRIPTION: what the listener hears, vividly\n"
            "LAYERS: 3-5 sound layers that build the effect, one line each\n"
            "DURATION & DYNAMICS: length and how loudness/pitch evolve\n"
            "SUGGESTED USE: where this effect fits\n"
            "Keep it precise and practical. No other commentary."
        )
        prompt = f"Brief: {body.prompt.strip()}"
        if body.mood:
            prompt += f"\nCharacter: {body.mood}"
        if body.duration:
            prompt += f"\nApprox length: {body.duration}"
        img_prompt = (
            f"Abstract visual representation of a sound effect: {body.prompt.strip()}. "
            f"Waveform and spectrogram motifs, sparks, brass gears, aether glow, steampunk, no text."
        )
    try:
        concept = await _anvil_llm(system, prompt, session=f"frank-audio:{body.kind}:{user['id']}")
    except Exception as e:  # noqa: BLE001
        logger.exception("Frankenstein audio concept error")
        raise HTTPException(status_code=502, detail="The lab's aether coils overloaded. Try again.") from e
    image_path = ""
    try:
        image_path = await _ps_generate_image(img_prompt, user["id"])
    except Exception:  # noqa: BLE001
        logger.exception("Frankenstein audio image error")
        image_path = ""
    return {"kind": body.kind, "concept": concept.strip(), "image_path": image_path}


VISUAL_PROMPTS = {
    "pic": "{p}. A high-quality, richly detailed, well-composed illustration.",
    "logo": "A clean, iconic, modern logo design for: {p}. Simple vector style, centered, high contrast, solid background, no watermark.",
    "gif": "A single vivid keyframe for a short animation about: {p}. Dynamic, expressive pose, bold colors.",
    "meme": "A funny, bold, high-contrast meme image about: {p}. Expressive and shareable, leave clear space at top and bottom for a caption.",
}


@api_router.post("/frankenstein/visual")
async def frankenstein_visual(body: FrankVisualBody, user: dict = Depends(require_user)):
    img_prompt = VISUAL_PROMPTS[body.kind].format(p=body.prompt.strip())
    try:
        image_path = await _ps_generate_image(img_prompt, user["id"])
    except Exception as e:  # noqa: BLE001
        logger.exception("Frankenstein visual error")
        raise HTTPException(status_code=502, detail="The image forge sputtered. Try again.") from e
    return {"kind": body.kind, "image_path": image_path}


@api_router.post("/frankenstein/vault", status_code=201)
async def frankenstein_vault_save(body: FrankVaultBody, user: dict = Depends(require_user)):
    doc = {
        "id": uuid.uuid4().hex[:12],
        "user_id": user["id"],
        "kind": body.kind,
        "prompt": body.prompt.strip(),
        "image_path": body.image_path,
        "concept": body.concept.strip(),
        "title": body.title.strip() or (body.prompt.strip()[:60] or body.kind.upper()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.frank_vault.insert_one(dict(doc))
    return doc


@api_router.get("/frankenstein/vault")
async def frankenstein_vault_list(kind: str = "", user: dict = Depends(require_user)):
    query: dict = {"user_id": user["id"]}
    if kind:
        query["kind"] = kind
    docs = await db.frank_vault.find(query, {"_id": 0}).to_list(1000)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


@api_router.delete("/frankenstein/vault/{item_id}")
async def frankenstein_vault_delete(item_id: str, user: dict = Depends(require_user)):
    res = await db.frank_vault.delete_one({"id": item_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"deleted": True}


# ---------- Chatterbox (messaging: private DMs + group chats) ----------
def _cb_avatar_for(uid: str) -> str:
    return f"https://picsum.photos/seed/cbuser{uid[:8]}/200"


async def _cb_user(uid: str) -> dict:
    if uid in CB_CONTACT_MAP:
        c = CB_CONTACT_MAP[uid]
        return {"id": c["id"], "display_name": c["display_name"], "handle": c["handle"], "avatar": c["avatar"], "bot": True}
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        return {"id": uid, "display_name": "Unknown", "handle": "@unknown", "avatar": _cb_avatar_for(uid), "bot": False}
    return {"id": u["id"], "display_name": u["display_name"], "handle": u.get("handle", ""), "avatar": _cb_avatar_for(u["id"]), "bot": False}


async def _cb_conv_summary(conv: dict, me: str) -> dict:
    others = [p for p in conv["participants"] if p != me]
    parts = [await _cb_user(p) for p in others]
    read_at = (conv.get("reads") or {}).get(me, "")
    unread = await db.cb_messages.count_documents({
        "conversation_id": conv["id"], "sender_id": {"$ne": me},
        "created_at": {"$gt": read_at or "1970"},
    })
    if conv["type"] == "group":
        title = conv.get("title", "Group chat")
        avatar = parts[0]["avatar"] if parts else _cb_avatar_for(conv["id"])
    else:
        title = parts[0]["display_name"] if parts else "Conversation"
        avatar = parts[0]["avatar"] if parts else _cb_avatar_for(conv["id"])
    return {
        "id": conv["id"], "type": conv["type"], "title": title, "avatar": avatar,
        "participants": parts, "member_count": len(conv["participants"]),
        "last_message": conv.get("last_message", ""), "last_at": conv.get("last_at", ""),
        "unread": unread,
    }


@api_router.get("/chatterbox/users")
async def chatterbox_users(user: dict = Depends(require_user), q: str = ""):
    ql = q.strip().lower()
    out = []
    for c in CB_CONTACTS:
        if not ql or ql in c["display_name"].lower() or ql in c["handle"].lower():
            out.append({"id": c["id"], "display_name": c["display_name"], "handle": c["handle"], "avatar": c["avatar"], "bot": True})
    users = await db.users.find({"id": {"$ne": user["id"]}}, {"_id": 0}).to_list(500)
    for u in users:
        if not ql or ql in u["display_name"].lower() or ql in u.get("handle", "").lower():
            out.append({"id": u["id"], "display_name": u["display_name"], "handle": u.get("handle", ""), "avatar": _cb_avatar_for(u["id"]), "bot": False})
    return out


@api_router.get("/chatterbox/conversations")
async def chatterbox_conversations(user: dict = Depends(require_user)):
    convs = await db.cb_conversations.find({"participants": user["id"]}, {"_id": 0}).to_list(500)
    convs.sort(key=lambda c: c.get("last_at", ""), reverse=True)
    summaries = [await _cb_conv_summary(c, user["id"]) for c in convs]
    total_unread = sum(s["unread"] for s in summaries)
    return {"conversations": summaries, "total_unread": total_unread}


@api_router.post("/chatterbox/conversations/dm", status_code=201)
async def chatterbox_start_dm(body: CBStartDM, user: dict = Depends(require_user)):
    other = body.user_id
    if other == user["id"]:
        raise HTTPException(status_code=400, detail="You can't message yourself.")
    if other not in CB_CONTACT_MAP and not await db.users.find_one({"id": other}):
        raise HTTPException(status_code=404, detail="Person not found.")
    existing = await db.cb_conversations.find_one(
        {"type": "dm", "participants": {"$all": [user["id"], other], "$size": 2}}, {"_id": 0}
    )
    if existing:
        return await _cb_conv_summary(existing, user["id"])
    now = datetime.now(timezone.utc).isoformat()
    conv = {"id": uuid.uuid4().hex[:12], "type": "dm", "participants": [user["id"], other],
            "title": "", "reads": {}, "last_message": "", "last_at": now, "created_at": now}
    await db.cb_conversations.insert_one(dict(conv))
    return await _cb_conv_summary(conv, user["id"])


@api_router.post("/chatterbox/conversations/group", status_code=201)
async def chatterbox_create_group(body: CBCreateGroup, user: dict = Depends(require_user)):
    members = [m for m in dict.fromkeys(body.member_ids) if m != user["id"]]
    valid = []
    for m in members:
        if m in CB_CONTACT_MAP or await db.users.find_one({"id": m}):
            valid.append(m)
    if len(valid) < 1:
        raise HTTPException(status_code=400, detail="Add at least one other member.")
    now = datetime.now(timezone.utc).isoformat()
    conv = {"id": uuid.uuid4().hex[:12], "type": "group", "participants": [user["id"], *valid],
            "title": body.title.strip(), "reads": {}, "last_message": "", "last_at": now, "created_at": now}
    await db.cb_conversations.insert_one(dict(conv))
    return await _cb_conv_summary(conv, user["id"])


@api_router.get("/chatterbox/conversations/{conv_id}")
async def chatterbox_conversation_detail(conv_id: str, user: dict = Depends(require_user)):
    conv = await db.cb_conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Mark read.
    await db.cb_conversations.update_one(
        {"id": conv_id}, {"$set": {f"reads.{user['id']}": datetime.now(timezone.utc).isoformat()}}
    )
    msgs = await db.cb_messages.find({"conversation_id": conv_id}, {"_id": 0}).to_list(1000)
    msgs.sort(key=lambda m: m.get("created_at", ""))
    summary = await _cb_conv_summary(conv, user["id"])
    others = [p for p in conv.get("participants", []) if p != user["id"]]
    other_id = others[0] if (conv.get("type") != "group" and others) else ""
    return {**summary, "messages": msgs, "me": user["id"], "other_id": other_id}


@api_router.get("/chatterbox/conversations/{conv_id}/messages")
async def chatterbox_poll(conv_id: str, user: dict = Depends(require_user), after: str = ""):
    conv = await db.cb_conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    query: dict = {"conversation_id": conv_id}
    if after:
        query["created_at"] = {"$gt": after}
    msgs = await db.cb_messages.find(query, {"_id": 0}).to_list(1000)
    msgs.sort(key=lambda m: m.get("created_at", ""))
    return {"messages": msgs}


@api_router.post("/chatterbox/conversations/{conv_id}/messages", status_code=201)
async def chatterbox_send(conv_id: str, body: CBSendMessage, user: dict = Depends(require_user)):
    conv = await db.cb_conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    now = datetime.now(timezone.utc).isoformat()
    msg = {"id": uuid.uuid4().hex[:12], "conversation_id": conv_id, "sender_id": user["id"],
           "sender_name": user["display_name"], "text": body.text.strip(), "created_at": now}
    await db.cb_messages.insert_one(dict(msg))
    await db.cb_conversations.update_one(
        {"id": conv_id}, {"$set": {"last_message": body.text.strip()[:120], "last_at": now, f"reads.{user['id']}": now}}
    )
    # Canned auto-reply from any seeded persona participant.
    bots = [p for p in conv["participants"] if p in CB_CONTACT_MAP]
    if bots:
        bot_id = bots[0]
        persona = CB_CONTACT_MAP[bot_id]
        reply_text = random.choice(persona["replies"])
        reply_at = (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()
        reply = {"id": uuid.uuid4().hex[:12], "conversation_id": conv_id, "sender_id": bot_id,
                 "sender_name": persona["display_name"], "text": reply_text, "created_at": reply_at}
        await db.cb_messages.insert_one(dict(reply))
        await db.cb_conversations.update_one(
            {"id": conv_id}, {"$set": {"last_message": reply_text[:120], "last_at": reply_at}}
        )
    return {"message": msg}


# ---------- Bluepaint Space Designer (2D floor plans + room planning) ----------
@api_router.get("/bluepaint/designs")
async def bp_list_designs(user: dict = Depends(require_user)):
    docs = await db.bp_designs.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    return [
        {"id": d["id"], "name": d["name"], "wall_count": len(d.get("walls", [])),
         "item_count": len(d.get("items", [])), "updated_at": d.get("updated_at", ""),
         "walls": d.get("walls", []), "items": d.get("items", [])}
        for d in docs
    ]


@api_router.post("/bluepaint/designs", status_code=201)
async def bp_create_design(body: BPDesignCreate, user: dict = Depends(require_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": uuid.uuid4().hex[:12], "user_id": user["id"], "name": body.name.strip(),
           "walls": [], "items": [], "created_at": now, "updated_at": now}
    await db.bp_designs.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/bluepaint/designs/{design_id}")
async def bp_get_design(design_id: str, user: dict = Depends(require_user)):
    d = await db.bp_designs.find_one({"id": design_id, "user_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Design not found")
    return d


@api_router.put("/bluepaint/designs/{design_id}")
async def bp_update_design(design_id: str, body: BPDesignUpdate, user: dict = Depends(require_user)):
    d = await db.bp_designs.find_one({"id": design_id, "user_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Design not found")
    update: dict = {
        "walls": [w.model_dump() for w in body.walls],
        "items": [i.model_dump() for i in body.items],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.name is not None and body.name.strip():
        update["name"] = body.name.strip()
    await db.bp_designs.update_one({"id": design_id}, {"$set": update})
    return {**d, **update}


@api_router.delete("/bluepaint/designs/{design_id}")
async def bp_delete_design(design_id: str, user: dict = Depends(require_user)):
    res = await db.bp_designs.delete_one({"id": design_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Design not found")
    return {"deleted": True}


def _bp_plan_summary(walls: list[dict], items: list[dict], plan_width: float) -> dict:
    total_len = 0.0
    minx = miny = 1.0
    maxx = maxy = 0.0
    has = False
    for w in walls:
        total_len += math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"]) * plan_width
        minx = min(minx, w["x1"], w["x2"]); miny = min(miny, w["y1"], w["y2"])
        maxx = max(maxx, w["x1"], w["x2"]); maxy = max(maxy, w["y1"], w["y2"])
        has = True
    width_m = max(0.0, (maxx - minx)) * plan_width if has else 0.0
    depth_m = max(0.0, (maxy - miny)) * plan_width if has else 0.0
    kinds: dict[str, int] = {}
    for it in items:
        kinds[it["kind"]] = kinds.get(it["kind"], 0) + 1
    return {
        "wall_count": len(walls),
        "total_wall_len": round(total_len, 1),
        "bbox_w": round(width_m, 1),
        "bbox_d": round(depth_m, 1),
        "floor_area": round(width_m * depth_m, 1),
        "doors": kinds.get("door", 0),
        "windows": kinds.get("window", 0),
        "furniture": {k: v for k, v in kinds.items() if k not in ("door", "window")},
    }


@api_router.post("/bluepaint/designs/{design_id}/review")
async def bp_review_design(design_id: str, body: BPReviewBody, user: dict = Depends(require_user)):
    d = await db.bp_designs.find_one({"id": design_id, "user_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Design not found")
    walls = d.get("walls", [])
    if not walls:
        raise HTTPException(status_code=400, detail="Draw a floor plan first — Iris needs walls to review.")
    s = _bp_plan_summary(walls, d.get("items", []), body.plan_width)
    furniture_desc = ", ".join(f"{v}× {k}" for k, v in s["furniture"].items()) or "none placed"
    system = (
        "You are Iris, the Grand Visionary architect of the steampunk district Bluepaint. "
        "You give professional, constructive design reviews of residential floor plans. "
        "Your tone is warm, encouraging and expert — like a seasoned architect mentoring a client. "
        "Focus on practical critique: traffic flow and circulation, natural light and window placement, "
        "room proportions and sizes, door placement, furniture layout, and any safety concerns. "
        "Be specific and reference the numbers you are given. Never invent measurements you were not told."
    )
    prompt = (
        f"Please review this floor plan named '{d['name']}'.\n"
        f"- Overall footprint: {s['bbox_w']} m wide × {s['bbox_d']} m deep\n"
        f"- Enclosed floor area: {s['floor_area']} m²\n"
        f"- Wall segments: {s['wall_count']} (about {s['total_wall_len']} m of wall in total)\n"
        f"- Doors placed: {s['doors']}\n"
        f"- Windows placed: {s['windows']}\n"
        f"- Furniture & fixtures placed: {furniture_desc}\n\n"
        "Write your review in plain text using these exact section headers, each on its own line:\n"
        "OVERALL: one or two encouraging sentences on the plan's strengths.\n"
        "TRAFFIC FLOW: comment on circulation and door placement.\n"
        "NATURAL LIGHT: comment on windows (clearly flag if there are none or too few).\n"
        "ROOM SIZES: say whether the space/area seems too small, cramped or well proportioned.\n"
        "SUGGESTIONS: 2-4 short improvements, each on its own line starting with '- '.\n"
        "Keep the whole review concise and genuinely helpful."
    )
    try:
        text = await _anvil_llm(system, prompt, session=f"bp-review:{user['id']}:{design_id}")
    except Exception as e:  # noqa: BLE001
        logger.exception("Bluepaint review error")
        raise HTTPException(status_code=502, detail="Iris set down her drafting pen for a moment. Try again.") from e
    return {"summary": s, "review": text.strip()}


# ---------- Dreambacker (crowdfunding) ----------
DB_CATEGORIES = ["art", "tech", "community", "games", "music", "film", "publishing", "food", "fashion", "other"]


def _db_project_public(doc: dict, user_id: str) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    d.setdefault("raised_cents", 0)
    d.setdefault("backer_count", 0)
    d.setdefault("cover_url", None)
    d.setdefault("reward_tiers", [])
    d.setdefault("category", "other")
    d["progress"] = min(1.0, d["raised_cents"] / d["goal_cents"]) if d.get("goal_cents") else 0.0
    d["funded"] = d["raised_cents"] >= d.get("goal_cents", 0) and d.get("goal_cents", 0) > 0
    d["is_creator"] = d.get("creator_id") == user_id
    return d


@api_router.post("/dreambacker/projects", status_code=201)
async def db_create_project(body: DBProjectCreate, user: dict = Depends(require_user)):
    now = datetime.now(timezone.utc).isoformat()
    tiers = [{
        "id": uuid.uuid4().hex[:8],
        "title": t.title.strip(),
        "description": t.description.strip(),
        "amount_cents": t.amount_cents,
        "backer_count": 0,
    } for t in body.reward_tiers]
    tiers.sort(key=lambda t: t["amount_cents"])
    category = body.category if body.category in DB_CATEGORIES else "other"
    doc = {
        "id": uuid.uuid4().hex[:12],
        "creator_id": user["id"],
        "creator_name": user.get("display_name", "A dreamer"),
        "title": body.title.strip(),
        "description": body.description.strip(),
        "goal_cents": body.goal_cents,
        "funding_model": body.funding_model,
        "deadline": (body.deadline or None),
        "cover_url": (body.cover_url or None),
        "reward_tiers": tiers,
        "category": category,
        "raised_cents": 0,
        "backer_count": 0,
        "created_at": now,
    }
    await db.db_projects.insert_one(dict(doc))
    return _db_project_public(doc, user["id"])


@api_router.put("/dreambacker/projects/{project_id}")
async def db_edit_project(project_id: str, body: DBProjectEdit, user: dict = Depends(require_user)):
    proj = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    if proj.get("creator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can edit this fundraiser.")
    update: dict = {}
    if body.title is not None:
        update["title"] = body.title.strip()
    if body.description is not None:
        update["description"] = body.description.strip()
    if body.goal_cents is not None:
        update["goal_cents"] = body.goal_cents
    if body.cover_url is not None:
        update["cover_url"] = body.cover_url or None
    if body.category is not None:
        update["category"] = body.category if body.category in DB_CATEGORIES else "other"
    if update:
        await db.db_projects.update_one({"id": project_id}, {"$set": update})
    fresh = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    return _db_project_public(fresh, user["id"])


@api_router.delete("/dreambacker/projects/{project_id}")
async def db_delete_project(project_id: str, user: dict = Depends(require_user)):
    proj = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    if proj.get("creator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can delete this fundraiser.")
    await db.db_projects.delete_one({"id": project_id})
    await db.db_updates.delete_many({"project_id": project_id})
    return {"deleted": True}


async def _db_recent_growth() -> dict:
    """Sum of paid contributions per project over the last 7 days (for Trending)."""
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    growth: dict = {}
    cursor = db.db_contributions.find({"status": "paid", "paid_at": {"$gte": since}}, {"_id": 0, "project_id": 1, "amount_cents": 1})
    async for c in cursor:
        growth[c["project_id"]] = growth.get(c["project_id"], 0) + c.get("amount_cents", 0)
    return growth


@api_router.get("/dreambacker/projects")
async def db_list_projects(filter: str = "all", category: str = "", user: dict = Depends(require_user)):
    now = datetime.now(timezone.utc)
    query: dict = {}
    if filter == "mine":
        query = {"creator_id": user["id"]}
    elif filter == "deadline":
        # Ending within the next 48 hours (and not already past).
        query = {"deadline": {"$gt": now.isoformat(), "$lte": (now + timedelta(hours=48)).isoformat()}}
    if category and category in DB_CATEGORIES:
        query["category"] = category
    docs = await db.db_projects.find(query, {"_id": 0}).to_list(500)
    if filter == "new":
        docs.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    elif filter == "popular":
        docs.sort(key=lambda p: (p.get("backer_count", 0), p.get("raised_cents", 0)), reverse=True)
    elif filter == "trending":
        growth = await _db_recent_growth()
        docs.sort(key=lambda p: (growth.get(p["id"], 0), p.get("created_at", "")), reverse=True)
    elif filter == "deadline":
        docs.sort(key=lambda p: p.get("deadline") or "")
    else:
        docs.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return [_db_project_public(d, user["id"]) for d in docs]


@api_router.get("/dreambacker/alerts")
async def db_alerts(user: dict = Depends(require_user)):
    """Projects the user has backed that posted an update since the user last viewed them."""
    contribs = await db.db_contributions.find(
        {"user_id": user["id"], "status": "paid"}, {"_id": 0, "project_id": 1, "paid_at": 1}
    ).to_list(2000)
    if not contribs:
        return {"count": 0, "project_ids": []}
    backed: dict = {}
    for c in contribs:
        pid = c["project_id"]; pa = c.get("paid_at") or ""
        if pid not in backed or pa < backed[pid]:
            backed[pid] = pa
    reads = await db.db_update_reads.find({"user_id": user["id"], "project_id": {"$in": list(backed)}}, {"_id": 0}).to_list(2000)
    read_map = {r["project_id"]: r["last_seen_at"] for r in reads}
    out = []
    for pid, baseline in backed.items():
        seen = read_map.get(pid) or baseline
        newer = await db.db_updates.find_one({"project_id": pid, "created_at": {"$gt": seen}}, {"_id": 0, "id": 1})
        if newer:
            out.append(pid)
    return {"count": len(out), "project_ids": out}


@api_router.post("/dreambacker/projects/{project_id}/seen")
async def db_mark_seen(project_id: str, user: dict = Depends(require_user)):
    await db.db_update_reads.update_one(
        {"user_id": user["id"], "project_id": project_id},
        {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/dreambacker/projects/{project_id}")
async def db_get_project(project_id: str, user: dict = Depends(require_user)):
    doc = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    pub = _db_project_public(doc, user["id"])
    # One-time confetti moment for the creator the first time it's funded.
    pub["celebrate"] = False
    if pub["is_creator"] and pub["funded"] and not doc.get("funded_celebrated"):
        await db.db_projects.update_one({"id": project_id}, {"$set": {"funded_celebrated": True}})
        pub["celebrate"] = True
    return pub


@api_router.post("/dreambacker/projects/{project_id}/back")
async def db_back_project(project_id: str, body: DBBackBody, user: dict = Depends(require_user)):
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Payments are not configured.")
    proj = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    base = body.return_base.rstrip("/")
    if not base.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid return URL")
    tier_title = None
    if body.tier_id:
        tier = next((t for t in proj.get("reward_tiers", []) if t["id"] == body.tier_id), None)
        if not tier:
            raise HTTPException(status_code=400, detail="That reward tier no longer exists.")
        if body.amount_cents < tier["amount_cents"]:
            raise HTTPException(status_code=400, detail="Contribution is below this reward's minimum.")
        tier_title = tier["title"]
    contribution_id = uuid.uuid4().hex
    success_url = f"{base}/api/checkout/return?result=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base}/api/checkout/return?result=cancel"
    product_name = f"Backing: {proj['title']}" + (f" — {tier_title}" if tier_title else "")
    price_data: dict = {
        "currency": CURRENCY,
        "product_data": {"name": product_name},
        "unit_amount": body.amount_cents,
    }
    if body.recurring:
        price_data["recurring"] = {"interval": "month"}
    session_args: dict = {
        "mode": "subscription" if body.recurring else "payment",
        "line_items": [{"price_data": price_data, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "managed_payments": {"enabled": False},
        "metadata": {"type": "contribution", "contribution_id": contribution_id, "project_id": project_id, "user_id": user["id"]},
    }
    try:
        session = stripe.checkout.Session.create(**session_args)
    except Exception as e:  # noqa: BLE001
        logger.exception("Stripe contribution session error")
        raise HTTPException(status_code=502, detail="Could not start the contribution.") from e
    await db.db_contributions.insert_one({
        "id": contribution_id,
        "user_id": user["id"],
        "backer_name": user.get("display_name", "A backer"),
        "project_id": project_id,
        "session_id": session.id,
        "amount_cents": body.amount_cents,
        "tier_id": body.tier_id,
        "tier_title": tier_title,
        "recurring": body.recurring,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"session_id": session.id, "checkout_url": session.url}


async def _fulfill_contribution(session_id: str):
    """Mark a contribution paid (idempotent) and credit the project's raised total."""
    c = await db.db_contributions.find_one({"session_id": session_id})
    if not c or c.get("status") == "paid":
        return
    set_fields = {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}
    # For monthly plans, capture the Stripe subscription id so the backer can cancel later.
    if c.get("recurring") and not c.get("subscription_id") and stripe.api_key:
        try:
            sess = stripe.checkout.Session.retrieve(session_id)
            if getattr(sess, "subscription", None):
                set_fields["subscription_id"] = sess.subscription
        except Exception:  # noqa: BLE001
            logger.exception("Stripe subscription capture error")
    await db.db_contributions.update_one({"session_id": session_id}, {"$set": set_fields})
    await db.db_projects.update_one(
        {"id": c["project_id"]},
        {"$inc": {"raised_cents": c["amount_cents"], "backer_count": 1}},
    )
    if c.get("tier_id"):
        await db.db_projects.update_one(
            {"id": c["project_id"], "reward_tiers.id": c["tier_id"]},
            {"$inc": {"reward_tiers.$.backer_count": 1}},
        )
    # If this contribution pushed the project to its goal, notify the creator once.
    proj = await db.db_projects.find_one({"id": c["project_id"]}, {"_id": 0})
    if proj and proj.get("goal_cents") and proj.get("raised_cents", 0) >= proj["goal_cents"] and not proj.get("funded_notified"):
        await db.db_projects.update_one({"id": proj["id"]}, {"$set": {"funded_notified": True}})
        await _notify(proj["creator_id"], "dreambacker_funded", None, "🎉 Your fundraiser is funded!", f"'{proj['title']}' reached its goal.")


@api_router.get("/dreambacker/contributions/status/{session_id}")
async def db_contribution_status(session_id: str, user: dict = Depends(require_user)):
    c = await db.db_contributions.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Contribution not found")
    if c["status"] != "paid" and stripe.api_key:
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            if session.payment_status == "paid":
                await _fulfill_contribution(session_id)
                c["status"] = "paid"
        except Exception:  # noqa: BLE001
            logger.exception("Stripe contribution status error")
    return {"paid": c["status"] == "paid", "contribution": c}


@api_router.get("/dreambacker/projects/{project_id}/backers")
async def db_project_backers(project_id: str, user: dict = Depends(require_user)):
    docs = await db.db_contributions.find(
        {"project_id": project_id, "status": "paid"},
        {"_id": 0, "backer_name": 1, "amount_cents": 1, "tier_title": 1, "paid_at": 1},
    ).to_list(500)
    docs.sort(key=lambda c: c.get("paid_at") or "", reverse=True)
    return {"count": len(docs), "backers": docs[:50]}


@api_router.get("/dreambacker/projects/{project_id}/updates")
async def db_list_updates(project_id: str, user: dict = Depends(require_user)):
    docs = await db.db_updates.find({"project_id": project_id}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda u: u.get("created_at", ""), reverse=True)
    return docs


@api_router.post("/dreambacker/projects/{project_id}/updates", status_code=201)
async def db_create_update(project_id: str, body: DBUpdateCreate, user: dict = Depends(require_user)):
    proj = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    if proj.get("creator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can post updates.")
    doc = {
        "id": uuid.uuid4().hex[:12],
        "project_id": project_id,
        "title": body.title.strip(),
        "body": body.body.strip(),
        "author_name": user.get("display_name", "The creator"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.db_updates.insert_one(dict(doc))
    # Notify every backer (in-app) that the creator posted an update.
    backer_ids = await db.db_contributions.distinct("user_id", {"project_id": project_id, "status": "paid"})
    for uid in backer_ids:
        if uid != user["id"]:
            await _notify(uid, "dreambacker_update", None, f"New update: {proj['title']}", body.title.strip())
    return doc


@api_router.get("/dreambacker/projects/{project_id}/comments")
async def db_list_comments(project_id: str, user: dict = Depends(require_user)):
    docs = await db.db_comments.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    docs.sort(key=lambda c: c.get("created_at", ""))
    return docs


@api_router.post("/dreambacker/projects/{project_id}/comments", status_code=201)
async def db_create_comment(project_id: str, body: DBCommentCreate, user: dict = Depends(require_user)):
    proj = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    is_creator = proj.get("creator_id") == user["id"]
    doc = {
        "id": uuid.uuid4().hex[:12],
        "project_id": project_id,
        "user_id": user["id"],
        "author_name": user.get("display_name", "A backer"),
        "is_creator": is_creator,
        "body": body.body.strip(),
        "parent_id": body.parent_id or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.db_comments.insert_one(dict(doc))
    # If the creator replies to a comment, notify that comment's author.
    if is_creator and body.parent_id:
        parent = await db.db_comments.find_one({"id": body.parent_id}, {"_id": 0})
        if parent and parent.get("user_id") and parent["user_id"] != user["id"]:
            await _notify(parent["user_id"], "dreambacker_reply", None, f"{proj['title']}: creator replied", body.body.strip()[:120])
    # If a backer/visitor comments, notify the creator.
    if not is_creator:
        await _notify(proj["creator_id"], "dreambacker_comment", None, f"New comment on {proj['title']}", f"{doc['author_name']}: {body.body.strip()[:100]}")
    return doc


@api_router.get("/dreambacker/projects/{project_id}/recurring")
async def db_recurring_supporters(project_id: str, user: dict = Depends(require_user)):
    proj = await db.db_projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    if proj.get("creator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can see recurring supporters.")
    docs = await db.db_contributions.find(
        {"project_id": project_id, "status": "paid", "recurring": True},
        {"_id": 0, "user_id": 1, "backer_name": 1, "amount_cents": 1, "paid_at": 1},
    ).to_list(1000)
    by_user: dict = {}
    for c in docs:
        uid = c["user_id"]
        if uid not in by_user or (c.get("paid_at") or "") < by_user[uid]["since"]:
            by_user[uid] = {"backer_name": c["backer_name"], "amount_cents": c["amount_cents"], "since": c.get("paid_at") or ""}
    out = list(by_user.values())
    out.sort(key=lambda s: s["since"], reverse=True)
    monthly_total = sum(s["amount_cents"] for s in out)
    return {"count": len(out), "monthly_total_cents": monthly_total, "supporters": out}


@api_router.get("/dreambacker/my-backings")
async def db_my_backings(user: dict = Depends(require_user)):
    contribs = await db.db_contributions.find(
        {"user_id": user["id"], "status": "paid"}, {"_id": 0, "project_id": 1, "amount_cents": 1, "recurring": 1}
    ).to_list(2000)
    agg: dict = {}
    for c in contribs:
        pid = c["project_id"]
        a = agg.setdefault(pid, {"total": 0, "recurring": False})
        a["total"] += c.get("amount_cents", 0)
        if c.get("recurring"):
            a["recurring"] = True
    if not agg:
        return []
    # Which projects have an active (cancellable) monthly subscription for this user.
    active_recurring = await db.db_contributions.find(
        {"user_id": user["id"], "status": "paid", "recurring": True}, {"_id": 0, "project_id": 1}
    ).to_list(2000)
    cancellable = {c["project_id"] for c in active_recurring}
    projects = await db.db_projects.find({"id": {"$in": list(agg)}}, {"_id": 0}).to_list(500)
    out = []
    for p in projects:
        pub = _db_project_public(p, user["id"])
        pub["your_total_cents"] = agg[p["id"]]["total"]
        pub["your_recurring"] = agg[p["id"]]["recurring"]
        pub["can_cancel_recurring"] = p["id"] in cancellable
        out.append(pub)
    out.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return out


@api_router.post("/dreambacker/backings/{project_id}/cancel-recurring")
async def db_cancel_recurring(project_id: str, user: dict = Depends(require_user)):
    contribs = await db.db_contributions.find(
        {"user_id": user["id"], "project_id": project_id, "status": "paid", "recurring": True}, {"_id": 0}
    ).to_list(100)
    if not contribs:
        raise HTTPException(status_code=404, detail="No active monthly support found.")
    cancelled = 0
    for c in contribs:
        sub_id = c.get("subscription_id")
        if sub_id and stripe.api_key:
            try:
                stripe.Subscription.cancel(sub_id)
            except Exception:  # noqa: BLE001
                logger.exception("Stripe subscription cancel error")
        await db.db_contributions.update_one(
            {"id": c["id"]},
            {"$set": {"recurring": False, "cancelled_at": datetime.now(timezone.utc).isoformat()}},
        )
        cancelled += 1
    return {"cancelled": cancelled}


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

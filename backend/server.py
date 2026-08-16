from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Konphlux API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("konphlux")


# ----------------------------- Models -----------------------------
class PostCreate(BaseModel):
    body: str
    author: str = "Wilhelmina Grast"
    kind: str = "Friend"


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
            {"label": "My Warehouse", "icon": "warehouse", "to": "warehouse"},
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


# ----------------------------- Routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Konphlux API — one ID, every district."}


@api_router.get("/districts")
async def get_districts():
    docs = await db.districts.find({}, {"_id": 0}).to_list(100)
    docs.sort(key=lambda d: d["name"])
    return docs


@api_router.get("/districts/{slug}")
async def get_district(slug: str):
    doc = await db.districts.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="District not found")
    others = await db.districts.find({"slug": {"$nin": [slug, "home"]}}, {"_id": 0}).to_list(100)
    others.sort(key=lambda d: d["name"])
    doc["nearby"] = others[:6]
    return doc


@api_router.get("/feed")
async def get_feed():
    docs = await db.feed.find({}, {"_id": 0}).to_list(200)
    docs.sort(key=lambda p: int(p["id"]) if p.get("id", "").isdigit() else 0, reverse=True)
    return {"stories": STORIES, "trending": TRENDING, "suggestions": SUGGESTIONS, "posts": docs}


@api_router.post("/feed")
async def create_post(payload: PostCreate):
    post = {
        "id": uuid.uuid4().hex,
        "author": payload.author,
        "kind": payload.kind,
        "time": "just now",
        "body": payload.body,
        "likes": 0,
        "comments": 0,
        "liked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feed.insert_one(dict(post))
    post.pop("_id", None)
    return post


@api_router.post("/feed/{post_id}/like")
async def toggle_like(post_id: str):
    doc = await db.feed.find_one({"id": post_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    liked = not doc.get("liked", False)
    likes = doc.get("likes", 0) + (1 if liked else -1)
    await db.feed.update_one({"id": post_id}, {"$set": {"liked": liked, "likes": likes}})
    return {"id": post_id, "liked": liked, "likes": likes}


@api_router.get("/bazaar")
async def get_bazaar():
    docs = await db.bazaar.find({}, {"_id": 0}).to_list(200)
    cats = sorted({d["category"] for d in docs})
    return {"categories": cats, "listings": docs}


@api_router.get("/bazaar/{item_id}")
async def get_bazaar_item(item_id: str):
    doc = await db.bazaar.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    return doc


@api_router.get("/profile")
async def get_profile():
    return PROFILE


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

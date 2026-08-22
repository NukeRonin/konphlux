# Konphlux — Mobile App PRD

## Original Problem Statement
"Build a mobile app version of my imported website (Konphlux)." Konphlux is an all-in-one social + utility ecosystem (social networking, marketplace, content creation, professional services) organized into 22 themed "districts", with a polished steampunk parchment aesthetic. Website was a private Vite + TanStack Router + Supabase app (backend not deployed).

## Architecture
- **Frontend**: Expo (SDK 54) + expo-router. Auth gate → `(auth)` (login/register) vs `(tabs)` (Feed / Districts / Bazaar / HQ). Detail routes: `district/[slug]`, `product/[id]`, `chatmonger/[slug]`, `saved`, modal `compose`.
  - Steampunk theme system (light "parchment" default + dark "lamplight"), Cinzel + Karla fonts (expo-font), reusable components (Panel, BrassText, ForgeButton, AvatarInitials, Gear, ChatmongerCard, AppHeader, States).
  - AuthContext stores JWT in `storage.secure*`; API client attaches Bearer token.
- **Backend** (`server.py`): FastAPI + MongoDB (motor). Seeds 22 districts, 6 feed posts, 8 bazaar listings. JWT auth (PyJWT + argon2/pwdlib). AI Chatmonger via emergentintegrations (Emergent LLM key, openai `gpt-5.4`). All data routes require Bearer token; under `/api`.

## Implemented
### 2026-06 (MVP)
- ✅ Feed (stories/composer/trending/posts), Districts grid (22) + district detail (features + chatmonger + nearby), Bazaar (category chips + product detail), HQ profile with dark-mode toggle. Light+dark steampunk theme. 12/12 backend + full frontend tests.
- ✅ Bug fix: district cards not responding (Gear `pointerEvents` prop → `style.pointerEvents` for New Architecture).

### 2026-06 (Auth + interactivity drop)
- ✅ JWT email/password auth: register/login/me; auth gate; sign-out.
- ✅ Real AI Chatmonger chat per district (persisted history, per-user sessions).
- ✅ Per-user data: likes, created posts, and saves (saved Bazaar listings + saved posts + favourite districts).
- ✅ Saved screen (3 tabs) reachable from HQ → Bookmarks; save toggles on feed posts, products, and districts.
- ✅ Verified: 28/28 backend + full frontend flow (incl. the reported Roundtable card navigation).

### 2026-06 (Roundtable — fully functional)
- ✅ Communities: browse (seeded 4 + user-created), create (name/description/emblem), join/leave (per-user members count).
- ✅ Threads: list (hub + per community), create (authored by user), upvote toggle (per-user), reply.
- ✅ Replies with keyboard-aware composer; per-user votes & memberships.
- ✅ Roundtable district button ("Enter the Roundtable") opens the functional hub (`/roundtable`).
- ✅ Verified: 16/16 new backend tests + full frontend flow; previous 28/28 intact.

### 2026-06 (Bazaar cart + Stripe checkout)
- ✅ Server-side per-user cart (add/set qty/remove) with authoritative prices from the bazaar collection.
- ✅ Stripe Checkout (test mode) hosted page: POST /api/checkout creates a Checkout Session (managed_payments disabled); app opens it via expo-web-browser; backend verifies via stripe.Session.retrieve.
- ✅ Paid orders recorded; My Orders screen (HQ → My Orders); cart badge on Bazaar; add-to-cart on product page.
- ✅ Verified: 18/18 backend tests + frontend flow (checkout opens real Stripe hosted URL). Card entry on stripe.com not driven by harness (external domain) — works in real use with test card 4242…
- Stripe secret key stored in backend/.env (STRIPE_SECRET_KEY). Webhook (STRIPE_WEBHOOK_SECRET) optional for production; payment currently verified by polling.

### 2026-06 (Go-live prep + Home district links)
- ✅ Home feed now has an "Explore districts" horizontal shortcut row (home-district-<slug>) that navigates to each district — verified.
- ✅ Stripe webhook endpoint /api/stripe/webhook (verifies signature when STRIPE_WEBHOOK_SECRET set; marks order paid + clears buyer cart). Safe no-op when secret unset.
- ✅ Go-live plan: keep TEST key in preview; set LIVE sk_live_... + STRIPE_WEBHOOK_SECRET in Deployment → Secrets after publishing. Webhook URL: https://<deployed-domain>/api/stripe/webhook (event: checkout.session.completed).
- ✅ 63/63 backend tests pass.

### 2026-06 (Order receipt emails)
- ✅ Emergent-managed email: server sends an HTML receipt to the buyer's email after payment is confirmed (both /checkout/status poll + webhook paths), idempotent via order.email_sent, fixed server-side template (guardrails enforced).
- ✅ email_service.py (EMERGENT_EMAIL_KEY + EMAIL_FROM_NAME=Konphlux in .env). 75/75 backend tests pass (12 new email tests).

### 2026-06 (BrainBoost learning district — COMPLETE, agent-tested 15/15 backend + frontend)
- ✅ Full BrainBoost hub (/brainboost) with Fact of the Day, stats, quick-action grid, featured courses. Title fits one line.
- ✅ Courses (10 seeded) with category filter; **Religious Studies moved into Courses** as a category (courses bc8/bc9). Removed from district top-level features (seed() now syncs DISTRICTS fields on every startup).
- ✅ Course detail: expandable lessons + per-user "mark complete" progress persistence (db.bb_progress) + progress bar.
- ✅ Quizzes (5 seeded): take → submit → server-scored (answer key stripped from GET) with correct/incorrect highlighting.
- ✅ Fact of the Day: deterministic daily pick from a 120-fact pool (random.Random(20260202) shuffle, cycles by date) → GET /api/brainboost/facts.
- ✅ Dictionary + Thesaurus (AI, gpt-5.4) via /api/brainboost/lexicon; Repair Guy (AI) via /api/brainboost/repair; Video lessons list; AI Tutor → Chatmonger.
- Files: frontend/app/brainboost/* (index, courses, course/[id], quizzes, quiz/[id], facts, videos, lexicon, repair), district/[slug].tsx (BRAINBOOST_ACTIONS + hub), src/api/client.ts (bb* methods), backend/server.py (BB seed + routes), backend/tests/test_brainboost.py.

### 2026-06 (PictureShow video district + Streamora branch — COMPLETE; user self-testing)
- ✅ Full PictureShow hub (/pictureshow): Theatre vs Streamora segmented layout, trending, channels, latest, quick actions. Title fits one line.
- ✅ Streamora REMOVED as a standalone home district (get_districts + nearby now exclude slug "streamora"); it is now a branch inside PictureShow at /pictureshow/streamora (Live now / Upcoming / Recent / Clips / Go live / follow).
- ✅ Videos: browse + category + trending sort; video detail with in-app player (expo-video), like, subscribe, save-to-playlist, related. Upload via link (/pictureshow/upload → auto-creates personal channel).
- ✅ Channels + channel detail + subscribe; Subscriptions feed; Playlists (seed + create + add-to-playlist) + playlist detail.
- ✅ AI Concept Studio (/pictureshow/ai): Nano Banana (gemini-3.1-flash-image-preview) poster keyframe + gpt-5.4 written storyboard for Video/Animation. Poster stored via Object Storage.
- Backend collections: ps_videos, ps_channels, ps_playlists, ps_streams, ps_clips, ps_likes, ps_subs, ps_follows. Sample videos use Google gtv-videos-bucket MP4s; thumbnails via picsum.
- Files: frontend/app/pictureshow/* (index, videos, video/[id], upload, channels, channel/[id], subscriptions, playlists, playlist/[id], ai, streamora/index, streamora/golive, streamora/watch), src/components/VideoPlayer.tsx, client.ts (ps*/streamora*), backend/server.py.
- NOTE: not run through testing_agent (user opted to self-test to save credits). Backend smoke-tested via curl (hub/videos/like/subscribe/create/golive/AI concept all OK).

### 2026-06 (Chatterbox messaging district — Private messaging + groups COMPLETE; user self-testing)
- ✅ Chatterbox hub (/chatterbox): title fits one line; all 5 feature buttons functional; recent chats + unread.
- ✅ PRIVATE MESSAGING (1:1): inbox (All/Direct/Groups filter + unread badges), new message (user search), conversation thread with send + 4s polling + read tracking. Seeded persona contacts (cb-*) send canned auto-replies so a solo account can test immediately.
- ✅ Group chats: /chatterbox/new-group (name + multi-select members) → group thread (shows sender names).
- ✅ Voice/Video calls: /chatterbox/call preview screen (connecting→timer, mute/speaker/cam toggles, end). Flagged in-UI that live audio/video needs an installed device build (WebRTC not available in Expo Go/preview).
- ✅ Site-wide chat routing → unified inbox.
- Backend collections: cb_conversations, cb_messages (reads map per conversation). Contacts are constant CB_CONTACTS (not real accounts).
- Files: frontend/app/chatterbox/* (index, inbox, new, new-group, conversation/[id], call), client.ts (cb*), backend/server.py.

### 2026-08 (Bluepaint Space Designer — replaces Floor Plan Studio + Room Planner; user self-testing)
- ✅ New Space Designer: one design holds a 2D floor plan (draw walls) AND room planning (place/drag furniture & decor). Two modes: "Floor Plan" (drag on grid to draw snapped walls, undo/clear) and "Room View" (16-piece furniture palette; tap to add, drag to move, rotate/scale/delete). Rendered with react-native-svg (installed).
- ✅ Removed "Floor Plan Studio" and "Room Planner" from Bluepaint features → replaced by single "Space Designer". Other buttons (Materials/Cost/Reviews → Iris chatmonger; Saved Blueprints → designer list) wired.
- ✅ Backend CRUD: db.bp_designs; GET/POST/PUT/DELETE /api/bluepaint/designs[/{id}]. Coords stored normalized 0..1.
- Files: frontend/app/bluepaint/index.tsx, frontend/app/bluepaint/design/[id].tsx, district/[slug].tsx (BLUEPAINT_ACTIONS), client.ts (bp*), backend/server.py.
- NOTE: user opted to self-test (skip automated tests). Backend smoke-tested via curl.

### 2026-08 (Bluepaint Materials Estimator + Bazaar search — user self-testing)
- ✅ /bluepaint/estimator: pick a saved design + set plan width (m) → auto-calculates Paint (litres+cans, 2 coats/10m²/L over wall area), Timber/Wood (linear m + 2.4m boards), Flooring (m² + boxes) from the floor plan's walls (wall length + bounding-box floor area). Wired district "Materials Estimator" button to it.
- ✅ "Purchase in Bazaar" button → /(tabs)/bazaar?q=paint wood flooring; per-material magnifier → bazaar?q=<material>.
- ✅ Bazaar now has a text search bar (q param, OR-word match on title/category/seller). Seeded "Building Materials" listings (paint, primer, oak boards, parquet flooring) so the search returns real items.
- Files: frontend/app/bluepaint/estimator.tsx, frontend/app/(tabs)/bazaar.tsx (search), district/[slug].tsx, _layout.tsx, backend/server.py (MATERIAL_LISTINGS + seed).

## Backlog (prioritized)
### P1
- Bazaar cart + checkout (add-to-cart is currently a local stub).
- Real content for more districts (Roundtable threads, Telegraph articles, Answerfier Q&A).
- Comments on feed posts (count shown, thread not built).
### P2
- Google social login option; password reset.
- Messaging (Chatterbox) + Notifications inboxes.
- Image upload for posts/listings (needs object storage).
- Streaming Chatmonger responses (currently full-reply).

## Test accounts
No seeded account — register fresh (see /app/memory/test_credentials.md). Use `@example.com`, password 6+ chars.

## Next Tasks
- Await user direction: Bazaar checkout, or make a specific district (Roundtable) fully functional, or messaging.

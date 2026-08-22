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

### 2026-08 (Bluepaint Cost Estimator, live pricing, exports, measurements — user self-testing)
- ✅ Construction Cost Estimator (/bluepaint/cost): inputs local labour rate/hr + hours (auto-suggested from floor area) + permit costs + contingency %; combines with materials subtotal (live Bazaar prices) → total project budget with breakdown. Export as PDF (expo-print + expo-sharing) or share as text (RN Share).
- ✅ Materials Estimator now shows live Bazaar prices per material + estimated materials total ("Cost Total"). "Purchase in Bazaar" → ONE-TAP adds paint(cans)/wood(boards)/flooring(m²) to cart via /api/cart, then opens /cart.
- ✅ Space Designer editor shows live measurements as you draw: wall length + floor area in BOTH metres and feet, with a plan-width (scale) stepper. Added "Share as image" (react-native-view-shot capture of the canvas → expo-sharing).
- ✅ Wired district "Construction Cost Estimator" button → /bluepaint/cost.
- New util: src/utils/bpEstimate.ts (shared compute + m/ft formatting + material ids). New pkgs: expo-print, expo-sharing, react-native-view-shot.
- Files: bluepaint/cost.tsx, bluepaint/estimator.tsx (rewrite), bluepaint/design/[id].tsx, district/[slug].tsx, _layout.tsx, src/utils/bpEstimate.ts.

### 2026-06 (Dreambacker phase 3 — edit, delete, share, categories, update alerts; user self-testing)
- ✅ Edit Fundraiser: creator-only /dreambacker/edit/[id] (title, goal, cover image, category, description) → PUT /dreambacker/projects/{id} (partial; 403 for non-creators). Edit reachable from detail header (pencil) + Mine-tab cards.
- ✅ My Fundraisers: the "Mine" tab lists all your projects; each card gets Edit + Delete buttons. Delete uses a native Alert confirmation popup → DELETE /dreambacker/projects/{id} (403 for non-creators; also removes the project's updates).
- ✅ Share Fundraiser: detail header share button uses RN Share with a title/progress/goal message.
- ✅ Category Tags: new DB_CATEGORIES (art/tech/community/games/music/film/publishing/food/fashion/other). Selected on create + edit; shown as a chip on cards and detail. Gallery has a second category-filter chip row (passes ?category= to the list API; browse by interest).
- ✅ Update Alerts: db.db_update_reads tracks last-seen per user/project. GET /dreambacker/alerts returns backed projects with an update newer than last-seen (baseline = first contribution). Gallery shows a bell + count in the header and a "New update" badge on those cards. Opening a project detail calls POST /dreambacker/projects/{id}/seen to clear it.
- Backend smoke-tested via curl: create(category), edit(title/goal/category), category filter include/exclude, alerts=0 when none backed, mark-seen 200, non-creator delete 403, creator delete 200, get-after-delete 404. Web bundle compiles clean.
- Models: DBProjectEdit; DBProjectCreate+category. Files: frontend/app/dreambacker/{index,new,[id],edit/[id]}.tsx, src/api/client.ts (category + dbEditProject/dbDeleteProject/dbAlerts/dbMarkSeen), src/utils/dreambacker.ts (DB_CATEGORIES/categoryMeta), _layout.tsx, backend/server.py.
- NOTE: user opted to self-test (skip automated tests).


### 2026-06 (Dreambacker phase 2 — reward tiers, updates, cover image, backer list, refined gallery; user self-testing)
- ✅ Gallery/filters: tabs now All / New / Popular / Trending / Near Deadline / Mine, each with a contextual prompt banner. Popular = most backers; Trending = highest paid-contribution growth over last 7 days (_db_recent_growth); Near Deadline = ending within the next 48 hours only. Cards now show cover image (expo-image) when set, plus progress bar.
- ✅ Reward tiers: creators add tiers (title/description/amount) on the create form; stored on project (id, amount, backer_count, sorted by amount). On the detail page backers tap a tier to select it (sets pledge amount); backing records tier_id/tier_title and increments that tier's backer_count on payment.
- ✅ Cover image: create form has an image picker (expo-image-picker → reuses /api/bazaar/upload via uploadImage). Shown as hero on detail + on gallery cards.
- ✅ Project updates: creator-only "Post update" modal (title+body) → POST /dreambacker/projects/{id}/updates (403 for non-creators); everyone sees the updates list on the detail page.
- ✅ Backers: GET /dreambacker/projects/{id}/backers returns paid contributions (name, amount, tier, paid_at); detail page shows a thank-you banner + recent backer list (initial avatar, name, tier, amount).
- Backend: db_projects gains cover_url + reward_tiers; new db_updates collection; _fulfill_contribution increments tier backer_count. Models: RewardTierIn, DBUpdateCreate; DBProjectCreate+cover_url/reward_tiers; DBBackBody+tier_id.
- Smoke-tested via curl: create w/ tiers+cover, get (2 tiers), near-deadline 48h include, backers empty, creator update 201, non-creator 403, trending 200. Web bundle compiles clean.
- Files: frontend/app/dreambacker/{index,new,[id]}.tsx, src/api/client.ts (DBRewardTier/DBUpdate/DBBacker + db* methods), backend/server.py.
- NOTE: user opted to self-test (skip automated tests).


### 2026-06 (Dreambacker crowdfunding — Start a Fundraiser + backing; user self-testing)
- ✅ Dreambacker is now a functional district (hub at /dreambacker). Feature buttons wired: Start a Fundraiser → /dreambacker/new; All/New/Trending/Popular/Near Deadline/Fundraisers I Created → /dreambacker?filter=… . "Recurring support" & "Backer updates" left unmapped (hidden) — not built.
- ✅ Create fundraiser (/dreambacker/new): title, funding goal ($), description, optional deadline via duration chips (none/7/14/30/60/90 days → ISO date), and funding-model selector (All-or-Nothing vs Keep-What-You-Raise) with clear blurbs. All-or-Nothing = funds only if goal met by deadline; Keep-What-You-Raise = keep every contribution.
- ✅ Fundraiser detail (/dreambacker/[id]): progress bar (raised/goal/%/backers), live 1-second countdown timer when a deadline is set (days/hrs/min/sec), funding-model card that changes its payout note based on model + whether goal is met, description, and a "Back this project" flow with preset amounts + custom amount → Stripe Checkout (reuses existing setup) with WebBrowser + status polling.
- ✅ Backend: db.db_projects + db.db_contributions. Routes: POST/GET/GET /dreambacker/projects[/{id}] with filter sorting (all/new/trending/popular/deadline/mine); POST /{id}/back creates a Stripe checkout session (metadata type=contribution) and stores a pending contribution; GET /dreambacker/contributions/status/{session_id} + _fulfill_contribution (idempotent) credit raised_cents & backer_count. stripe_webhook now routes contribution vs order by session metadata.
- Smoke-tested via curl: register → create → list/all/mine/deadline → get → 422 on bad model → /back returns 200 (Stripe test session created). Web bundle compiles clean.
- New util: src/utils/dreambacker.ts (FUNDING_MODELS, useCountdown/timeLeft, fmtDeadline). Files: frontend/app/dreambacker/{index,new,[id]}.tsx, src/api/client.ts (DBProject + db* methods), district/[slug].tsx (DREAMBACKER_ACTIONS + hub), _layout.tsx, backend/server.py.
- NOTE: user opted to self-test (skip automated tests to save credits). Funds-hold for All-or-Nothing is represented conceptually (charges are immediate via Checkout); no auto-refund logic.


### 2026-06 (Bluepaint Saved Blueprints thumbnails — user self-testing)
- ✅ Saved Blueprints list (/bluepaint) now shows a live mini floor-plan thumbnail per design (react-native-svg BlueprintThumb: fits each design's walls into a 52px box) so projects are recognisable at a glance. Falls back to floor-plan icon when a design has no walls. Naming/save/reopen/delete already existed.
- ✅ Backend bp_list_designs now returns walls + items in each summary so the list can draw thumbnails without extra fetches. BPDesignSummary type extended with walls/items.
- Files: frontend/app/bluepaint/index.tsx (BlueprintThumb + thumb render), src/api/client.ts (BPDesignSummary), backend/server.py (bp_list_designs).
- NOTE: user opted to self-test (skip automated tests). Backend reloaded clean; frontend lint clean.


### 2026-06 (Bluepaint Design Reviews with Iris — user self-testing)
- ✅ New /bluepaint/review screen: pick a saved design + plan width → "Review with Iris" sends floor-plan data to AI. Iris (gpt-5.4) returns a professional, structured critique (OVERALL / TRAFFIC FLOW / NATURAL LIGHT / ROOM SIZES / SUGGESTIONS) parsed into sections, plus a footprint/area/doors/windows/walls stat strip.
- ✅ Backend POST /api/bluepaint/designs/{id}/review: computes plan summary in Python (_bp_plan_summary: wall length, bounding-box footprint & floor area from normalized coords × plan_width, door/window/furniture counts) and prompts Iris with those numbers. 400 if no walls drawn yet.
- ✅ Rewired district "Design Reviews with Iris" button → /bluepaint/review (was generic /chatmonger/bluepaint). Route registered in _layout.tsx.
- Files: frontend/app/bluepaint/review.tsx (new), src/api/client.ts (bpReview), district/[slug].tsx, _layout.tsx, backend/server.py (BPReviewBody, _bp_plan_summary, bp_review_design, import math).
- NOTE: user opted to self-test (skip automated tests to save credits). Backend loaded clean; frontend lint clean.


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

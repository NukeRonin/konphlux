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

### 2026-06 (Frankenstein Lab — Visual Creation Studio + private Vault; user self-testing)
- ✅ New /frankenstein-lab/visual: type selector (GenoPic / GenoLogo / GenoGIF / GenoMeme) + prompt → AI image via _ps_generate_image (Gemini Nano Banana, Universal Key), kind-specific prompt engineering (VISUAL_PROMPTS). GIF/Meme show "animation/caption coming soon" notes (still image for now). Result shows image + "Save to Vault".
- ✅ Private Vault: db.frank_vault. POST /frankenstein/vault (save), GET /frankenstein/vault?kind= (list, newest first), DELETE /frankenstein/vault/{id} (owner-only). New /frankenstein-lab/vault screen: 2-col grid, kind filter chips (All/Pics/Logos/GIFs/Memes/Music/SFX), delete with confirm.
- ✅ "Save to Vault" added to BOTH studios: visual studio saves image; audio studio (GenoTune/GenoFX) also saves concept+image (covers the earlier "Save to Library"). Vault buttons (treasure-chest) in both studio headers.
- ✅ District wiring: FRANKENSTEIN_ACTIONS now maps all six Geno tools — GenoPic/Logo/GIF/Meme → /frankenstein-lab/visual?type=…, GenoTune/GenoFX → audio.
- Real animation (GIF/Meme) and real audio (Suno/ElevenLabs) still deferred.
- Credit-free checks: visual 401 no-auth, 422 bad kind; vault save/list/filter/delete all pass. Web bundle compiles. No real image generation run (saves credits).
- Files: backend/server.py (FrankVisualBody, FrankVaultBody, VISUAL_PROMPTS, frankenstein_visual + vault endpoints), frontend app/frankenstein-lab/{visual,vault,audio}.tsx, district/[slug].tsx, _layout.tsx, src/api/client.ts (FrankVaultItem + frankVisual/frankVault*).


### 2026-06 (PictureShow — AI Video Suite: full Concept Studio + characters + projects; user self-testing)
- ✅ /pictureshow/ai rebuilt as the "AI Video Suite" (Create AI Video + Create AI Animation Concept Studios). Prompt → shot-ready storyboard + script (sectioned: TITLE/LOGLINE/STYLE & LOOK/STORYBOARD/SCRIPT/SOUND & MUSIC) + Nano Banana poster keyframe, all driven by the chosen settings. "Save to Projects" persists the whole config + output.
- ✅ Config options: Style (Cinematic, Documentary, Music Video, Noir, Splash Noir, Sepia, Cool Toon), Length (10s/30s/5m/20m/60m/90m/150m), Playback speed (0.5×–2×), and collapsible multi-select sections — Transition Effects (Swap/Cube/Page Curl Left/Cross Blur/Cross Dissolve/Cross Zoom/Ripple/Mosaic/Circle Close/Wipe Down), Atmospheric Presets (X-Ray/Film Grain/Aged Film/Glitchy/Negative/Sci-Fi), Titles (18: Slide…Scrolling Credits), Finishing Effects (Ken Burns, Reduce background noise), Audio Effects (Pitch Up/Down/Robot/Alien). All fed into the AI brief.
- ✅ Soundtracks: upload audio (expo-document-picker → /api/pictureshow/upload-audio, Object Storage). Voice-overs: record (expo-audio + mic permission handling; web-gated) → uploaded + playable. Playback speed treatment noted in brief.
- ✅ Characters: /pictureshow/characters — create reusable characters (name + description + reference photo via expo-image-picker/Object Storage), list, delete. Selectable in the suite; fed into storyboard + poster.
- ✅ My Projects: /pictureshow/projects — grid of saved concepts (poster thumb, kind, style, length, effect count), tap to reopen (loads all settings), delete. Hub quick actions added (Characters, My Projects).
- Real video/animation rendering still deferred (concept + poster only for now, as discussed).
- Backend: PSCharacterBody/PSSuiteBody/PSProjectBody; endpoints /pictureshow/{upload-audio, characters[CRUD], ai/suite, projects[CRUD]}; collections ps_characters, ps_projects; PS_STYLE_NOTES style guidance. app.json: mic permission (iOS NSMicrophoneUsageDescription, Android RECORD_AUDIO, expo-audio plugin).
- Files: backend/server.py; frontend app/pictureshow/{ai,characters,projects}.tsx, index.tsx (quick actions), _layout.tsx; src/utils/psSuite.ts; src/api/client.ts (uploadAudio + PSCharacter/PSProject types + ps* methods).
- NOTE: user opted to self-test (skip automated tests to save credits). Backend loads clean (endpoints 401 without auth); frontend lint clean; suite screen renders end-to-end in preview.

### 2026-06 (PictureShow — AI Video Suite v2: real rendering + character consistency + export + presets)
- ✅ **Real video rendering (fal.ai)**: after saving a project, "Render real video" submits a fal Kling job (image-to-video when a poster exists for consistency, else text-to-video), shows a "Rendering…" state, polls /render-status every 6s, and plays the finished ~5s clip inline via VideoPlayer (expo-video). Video URL saved on the project; "▶ Clip" badge in My Projects. Backend: /pictureshow/projects/{id}/render + /render-status, fal_client submit/status/result, PS_T2V_MODEL/PS_I2V_MODEL. Requires FAL_KEY in backend/.env (placeholder added; user provides real key).
- ✅ **Character Consistency**: _ps_generate_image now accepts reference image bytes; the suite fetches selected characters' reference photos (get_object) and passes them to Nano Banana as ImageContent so poster characters match the references.
- ✅ **Project Export**: "Export / share shot list" on results + share icon per project → RN Share with formatted title/style/effects/storyboard (+ clip URL if rendered).
- ✅ **Suite Presets**: save current style+length+speed+effects bundle (modal), apply in one tap, long-press to delete. Backend: /pictureshow/presets CRUD, db.ps_presets.
- Deps: fal-client (backend, pip-frozen). Multi-language Settings deferred by user (English only for now).
- Files: backend/server.py; frontend app/pictureshow/{ai,projects}.tsx; src/api/client.ts (PSPreset type, ps preset/render methods).
- NOTE: user self-tests (skip automated tests). fal rendering only works once the user's FAL_KEY is added.

### 2026-06 (Profession Plaza — Job Board)
- ✅ Full Job Board hub at /profession with 3 tabs: **Find Jobs** (search + category filter), **Applications** (my applications with live status badges), **Jobs I Posted** (my listings + applicant counts).
- ✅ **Post/Edit a Job** (/profession/post): title, company, location, remote toggle, job type & category chips, salary range, description; edit reuses the form via ?id=.
- ✅ **Job detail** (/profession/[id]): full listing + Apply flow with optional cover note (bottom sheet); shows "Applied · <status>" once applied; owners see "Manage listing".
- ✅ **Manage** (/profession/manage/[id]): applicant list with cover notes, tap a status pill to set submitted/reviewed/accepted/rejected, Edit / Close-Reopen / Delete actions.
- ✅ In-app notifications: poster notified on new application; applicant notified on status change (reuses _notify).
- Backend: collections jobs + job_applications; endpoints /profession/{meta, jobs[CRUD+mine], jobs/{id}/apply|applicants|close, applications/mine, applications/{id}/status}; dup-apply 409, apply-to-own 400, owner-only guards. Verified end-to-end via curl (create/list/mine/apply/status all pass).
- Wiring: DISTRICT_HUBS + PROFESSION_ACTIONS in district/[slug].tsx ("Open the Job Board"); non-job features route to the plaza Chatmonger assistant. Routes registered in _layout.tsx. Shared util src/utils/jobs.ts.
- Multi-language Settings still deferred (English only). User self-tests; automated tests skipped.

### 2026-06 (Profession Plaza — Job Board v2 + Freelance Marketplace)
- ✅ **Save Jobs**: bookmark toggle on job cards + detail; new "Saved" tab. Backend job_saves collection; /profession/jobs/{id}/save + /profession/saved; `saved` flag on list/detail.
- ✅ **Job Alerts** (/profession/alerts, bell icon in header): follow categories + keywords; on any matching new job the follower gets an in-app notification (job_alert). Backend job_alert_prefs + _notify_job_alerts on job create. Verified: matching post triggered alert.
- ✅ **Resume Attach**: apply sheet now supports attaching a PDF/Word doc (expo-document-picker → /profession/upload-resume, Object Storage) or pasting a resume/portfolio link. Poster sees a "Resume" button in Manage.
- ✅ **Applicant Chat**: "Message" button on each applicant (Manage) and on freelancer profiles → opens a Chatterbox DM (cbStartDm → conversation).
- ✅ **Freelance Marketplace** (/profession/marketplace) with 3 tabs: **Find Gigs** (freelance/contract/internship/temp jobs via /profession/gigs), **Freelancers** (browse profiles, Upwork-style), **My Résumé**. Freelancer profile: name, headline, bio, category, skills, hourly rate, location, avatar (Object Storage), links, experience, availability. Backend freelancers collection + CRUD (/profession/freelancers, /freelancer/me GET/PUT, /freelancers/{id}).
- ✅ **Résumé PDF**: freelancer profiles downloadable/shareable as PDF via expo-print + expo-sharing (src/utils/resumePdf.ts).
- Wiring: district actions Find Freelance Gigs/Freelancer marketplace/Resumés → marketplace routes; new routes in _layout.tsx. Entry banner on Find Jobs tab.
- Backend verified end-to-end via curl (save, saved list, alerts→notification, gigs, freelancer save/list/get). Marketplace UI smoke-tested. Deps already present (expo-print/sharing/document-picker/image-picker). User self-tests; automated tests skipped.

### 2026-06 (Profession Plaza v3 — Hire from Chat, Interviews→Evention, Reviews, Featured, Résumé Themes)
- ✅ **Hire From Chat**: briefcase action in a DM → send a formal **offer** (title/rate/note) as an interactive card in chat; recipient taps Accept/Decline; status syncs on the card + notifies. Backend job_offers + /profession/offers[+/respond]; cb_messages now carry kind/meta; conversation detail exposes other_id.
- ✅ **Interview Scheduling**: from the same chat action, propose an **interview** (title + quick time-slot chips + location/link) → interactive card; recipient Confirms/Declines. Backend interviews collection + /profession/interviews[+/respond].
- ✅ **Evention Center sync**: new /evention/interviews screen ("Upcoming Interviews", also wired as the Evention Center hub + district actions) lists a user's upcoming/past interviews (as poster or applicant) with Confirm/Decline; reads the same interviews collection. Verified: scheduled interview appears there with confirmed status.
- ✅ **Reviews & Ratings**: businesses rate a freelancer (1–5★ + comment) on the profile; avg rating + count shown on profile & marketplace cards. Backend freelancer_reviews + /profession/freelancers/{id}/review; get returns reviews + can_review.
- ✅ **Featured Freelancers**: marketplace list sorts available + higher-rated first and tags them with a "Featured" badge (backend featured flag + sort).
- ✅ **Résumé Themes**: PDF export now offers 4 themes (Brass/Slate/Ink/Rose) via a picker before download (src/utils/resumePdf.ts).
- All backend flows verified via curl (offer/interview send+respond, evention sync, review→avg, chat cards). Evention screen smoke-tested. User self-tests; automated tests skipped.

### 2026-06 (Treasury — District Trackers pulling cross-district activity; user self-testing)
- ✅ **District Trackers** (/treasury/trackers, segmented tabs + 4 tiles on Treasury dashboard): sections Donations in Dreambacker, Spends in Bazaar, Deals in Waypoint, Deals in Retrospections (company purchases). Each section shows a total + entries; every entry links back to its origin (Dreambacker→/dreambacker/{pid} or /dreambacker, Bazaar→/(tabs)/bazaar, Waypoint→/district/waypoint, Retrospections→/retrospections/marketplace/{listing}).
- ✅ Pulls REAL data where it exists: real Dreambacker db_contributions (joined to db_projects) + real paid Bazaar orders (db.orders). Plus per-user seeded demo entries (district_ledger, idempotent) so all four sections have content in preview.
- ✅ "Deals in Retrospections records company purchases": marketplace listing detail gained "Record purchase in Treasury" → POST /retrospections/listings/{id}/deal writes a retrospections tracker entry linking back to the listing.
- Backend: GET /treasury/trackers (merges real orders/contributions + district_ledger, grouped + totals). _ensure_district_ledger seeds DISTRICT_LEDGER_SEED once. Added "Deals in Retrospections" to Treasury district features (verified served).
- Wiring: TREASURY_ACTIONS district buttons for all four trackers → /treasury/trackers?source=…; dashboard tiles; route registered.
- Curl-verified: 4 sections populated w/ correct links + totals, record-deal adds an entry, seed idempotent. Lint + bundle clean. Files: backend/server.py, frontend app/treasury/{trackers,index}.tsx, app/retrospections/marketplace/[id].tsx, src/api/client.ts, app/_layout.tsx, app/district/[slug].tsx.

### 2026-06 (Treasury — Konphlux Balance dashboard / core ledger; user self-testing)
- ✅ **Konphlux Balance dashboard** (/treasury): balance hero card (current funds + In/Out totals), Add funds + Send/Transfer actions, tabbed history All / Payments / Transfers, per-txn rows (icon by type/category, title, date, category/note, colored ±amount, running balance_after). Accepts ?tab=payments|transfers.
- ✅ Functional ledger: per-user wallet auto-created on first open with £1,000 starter + 6 seeded historical entries (top-up, Bazaar order, transfer in, subscription, donation, transfer out). Add funds (topup credit) + Transfer (debit sender / credit recipient by email or @handle, insufficient→400, self→400) both live-update balance.
- Backend collections wallets + transactions. Endpoints GET /treasury/{balance, transactions?type=}, POST /treasury/{topup, pay, transfer}. Helpers _ensure_wallet (idempotent seed), _record_txn (updates running balance). Models TransferBody/TopupBody/PaymentBody.
- Wiring: DISTRICT_HUBS treasury→/treasury; TREASURY_ACTIONS ("Konphlux Balance", "Payments"→?tab=payments, "Transfers"→?tab=transfers, Donations→/dreambacker, Spends→/(tabs)/bazaar). Route registered.
- Note: seeded/manual ledger for now; live Bazaar/Dreambacker/subscription events are NOT yet auto-posted to this ledger (future wiring).
- Curl-verified: balance/summary, filtered history, topup, transfer (both sides), insufficient-400. Lint + bundle clean. Files: backend/server.py, frontend app/treasury/index.tsx, src/api/client.ts, app/_layout.tsx, app/district/[slug].tsx.

### 2026-06 (Retrospections — Commercial Marketplace + Save Favorite Places; user self-testing)
- ✅ **Commercial Marketplace**: browse "Businesses for Sale" (/retrospections/marketplace) with For Sale / My Listings tabs; "Sell" → /retrospections/marketplace/sell form (name, category, asking price, location, revenue, description, reason, contact — name/category/price/contact required); listing detail /retrospections/marketplace/[id] with Contact seller (mailto/tel via Linking) or Remove (owner-only). 3 seeded listings by "Konphlux Brokerage".
- ✅ **Save Favorite Places** (exact button spelling): heart toggle on business detail hero + quick-save heart on hub cards; /retrospections/favorites personal list with unfavorite. is_favorite returned on businesses list + detail.
- Backend collections retro_listings + retro_favorites. Endpoints: GET/POST /retrospections/listings, GET /retrospections/my-listings, GET/DELETE /retrospections/listings/{id}; POST/DELETE /retrospections/favorites/{id}, GET /retrospections/favorites. Model RetroListingBody. District feature label renamed "Save favourite places" → "Save Favorite Places" (verified served exactly). Hub header decluttered into a quick-links row (Nearby/Status/Favorites/For Sale).
- Wiring: district buttons "Put a Business Up for Sale"→sell, "Businesses For Sale"→marketplace, "Save Favorite Places"→favorites. Routes registered.
- Curl-verified: listings browse (3), create/my-listings/delete, favorites add/list/remove, is_favorite flag. Lint + bundle clean. Files: backend/server.py, frontend app/retrospections/{marketplace/index,marketplace/sell,marketplace/[id],favorites,index,business/[id]}.tsx, src/api/client.ts, app/_layout.tsx, app/district/[slug].tsx.

### 2026-06 (Retrospections — Business Status hub; user self-testing)
- ✅ **Business Status hub** (/retrospections/status, clipboard-pulse icon in hub header): 4 tabbed sections — Opening Soon, Recently Opened, Health (inspection grades A/B/C + score + date), Temporary Closures (with reopen date). Cards show image, category, status date phrasing ("Opens in 10 days", "Opened 5 days ago", "Reopens in 6 days", "inspected 3 days ago") + note; tap → business detail. Accepts ?tab=opening|recent|health|closures.
- Backend: GET /retrospections/status computes live dates from status_days/days_ago offsets (stays "real-time" regardless of seed time). Business docs gained status/status_days/status_note + inspection{grade,score,days_ago,note}. Added 2 opening-soon businesses (rb-11/12) EXCLUDED from normal browse + nearby (status!=opening_soon filter). _retro_public now returns status. Seed applies RETRO_UPCOMING + RETRO_STATUS + RETRO_INSPECTIONS idempotently.
- Wiring: district "Opening Soon"/"Recently Opened"/"Health Inspection Updates" feature buttons → status?tab=…; hub header button opens the hub. Route registered.
- Curl-verified: 4 sections populated (2/2/2/4), browse still returns 10 (opening-soon hidden). Lint clean. Files: backend/server.py, frontend app/retrospections/{status,index}.tsx, src/api/client.ts (RetroStatus types + retroStatus), app/_layout.tsx, app/district/[slug].tsx.

### 2026-06 (Retrospections — Review System with categories + nearby map; user self-testing)
- ✅ **Review System**: browse businesses by category (Restaurants, Cafés, Retail, Services, Entertainment, Health) with search; each shows image, category pill, star rating, review count, address. Business detail (/retrospections/business/[id]): hero, live avg rating, reviews list, and inline "Rate this place" form (1–5★ + optional text; one review per user, 409 on dup).
- ✅ **Submit a Review** (/retrospections/submit): "Find a place" (search existing → detail to review) or "Add a new place" (name + category + address + description + optional "Use my location" via expo-location) → creates the business then opens its detail to leave the first review.
- ✅ **Browse Nearby map** (/retrospections/map): custom react-native-svg proximity map — user at centre, concentric distance rings with labels, color-coded category pins placed by real bearing/distance from the user's coordinates; tap a pin → callout → detail. Falls back to seeded district centre when location is unavailable (with an enable-location banner). "Nearest to you" list sorted by distance below.
- Backend: collections retro_businesses (10 seeded near a default centre with base_rating/base_reviews) + retro_reviews. Endpoints GET /retrospections/{meta, businesses (category/q/lat/lng), businesses/{id}, nearby (lat/lng)}, POST /retrospections/businesses, POST /retrospections/businesses/{id}/reviews. avg = (base + user reviews) blended. _haversine_km for distances. Models RetroBusinessBody/RetroReviewBody.
- expo-location installed; app.json location usage strings + Android COARSE/FINE permissions + expo-location plugin added. Permission flow follows contract (check→request→Open Settings fallback). Works on web/Expo Go (SVG map, no native maps module or API key needed).
- Verified: full backend CRUD via curl (list/filter/nearby/submit/dup-409/detail/create); hub + map smoke screenshots render correctly. Lint clean, bundle clean. Files: backend/server.py, frontend app/retrospections/{index,submit,map,business/[id]}.tsx, src/components/RetroStars.tsx, src/utils/retro.ts, src/api/client.ts, app/_layout.tsx, app/district/[slug].tsx, app.json.

### 2026-06 (Evention Center — Smart Reminders from Clarity; user self-testing)
- ✅ **Smart Reminders**: an app-wide in-app pop-up from Clarity (Evention's Timekeeper) that slides in from the top on ANY screen when a meeting/interview/event/appointment/trip/birthday starts within the next 30 min. Helpful, clear tone (e.g. "Heads up — your meeting \u201cX\u201d starts in about 14 minutes at HQ. Best get ready!"). Tap → opens /evention calendar; auto-dismisses after 9s or tap ✕. Color-coded by event type, shows Clarity name/role + type icon.
- Backend: GET /evention/reminders/due returns items in a now-2min..now+30min window not yet nudged, marks them once (interviews soon_reminded, events reminder_sent) so each fires a single time. _clarity_reminder_message builds the tone/wording.
- Frontend: global src/components/SmartReminders.tsx mounted in app/_layout.tsx (only when authenticated). Polls every 60s + on app foreground + 6s after mount; client-side dedupe via ref; RN Animated slide-in (style-level pointerEvents, no prop). New client type EventionReminder + api.eventionRemindersDue.
- Curl-smoked: event 15min out fires (correct message+minutes+location), event 2h out does not, second poll returns 0 (fires once). Lint clean. Files: backend/server.py, frontend src/components/SmartReminders.tsx, app/_layout.tsx, src/api/client.ts.

### 2026-06 (Evention Center — Agendas + Lists; user self-testing)
- ✅ **Agendas** (/evention/agenda, view-agenda icon in Calendar header + district "Agendas" button): pulls all calendar items (interviews + user events) into 4 tab views — Today / Tomorrow / This Week (through end of Sunday) / This Month (through month end). Client-side date filtering on eventionCalendar data (local timezone), color-coded rows, item counts. No backend change (reuses /evention/calendar).
- ✅ **Lists** (/evention/lists, list-checks icon in Calendar header + district "Lists"/"Create a List" buttons): create/delete custom checklists NOT tied to a date (packing list, to-do, etc.). Inline create bar; cards show done/total; long-press or trash to delete. Detail /evention/list/[id]: add items, tap to check/uncheck (strikethrough), delete items; optimistic updates.
- Backend: collection evention_lists {id,user_id,title,items:[{id,text,done}]}. Endpoints POST/GET/DELETE /evention/lists[/{id}], POST /evention/lists/{id}/items, POST /evention/lists/{id}/items/{item_id}/toggle, DELETE /evention/lists/{id}/items/{item_id}. Models EventionListBody, ListItemBody.
- Curl-smoked full CRUD (create/add/toggle/delete item/delete list all pass). Lint clean. Files: backend/server.py, frontend app/evention/{agenda,lists,list/[id]}.tsx + index.tsx (header nav), _layout.tsx (routes), district/[slug].tsx (wiring), src/api/client.ts (EventionList types + methods).

### 2026-06 (PictureShow — real fal.ai rendering VERIFIED LIVE + model upgrade to Kling v3)
- ✅ Upgraded fal.ai models to current Kling **v3 standard** (v1 deprecated): PS_T2V_MODEL=`fal-ai/kling-video/v3/standard/text-to-video`, PS_I2V_MODEL=`fal-ai/kling-video/v3/standard/image-to-video`. v3 image-to-video renamed the image arg to `start_image_url` (was `image_url`) — updated in `pictureshow_render`.
- ✅ **Real render VERIFIED end-to-end (paid renders actually executed)**: text-to-video (no poster) → ready with playable ~5MB MP4 (~90s); image-to-video (with poster) → ready with playable MP4 (~3min). Both returned valid `https://v3b.fal.media/...output.mp4` (HTTP 200, content-type video/mp4). Poll flow (/render-status every 6s in UI) transitions rendering→ready and plays inline via VideoPlayer.
- Files: backend/server.py (PS_T2V_MODEL/PS_I2V_MODEL, start_image_url). No frontend change needed (psRender/psRenderStatus + VideoPlayer already wired in ai.tsx/projects.tsx).

### 2026-06 (Evention Calendar + Profession Plaza v4 — reschedule, contracts, reminders, rating filters)
- ✅ **Calendar View** (/evention, the Evention Center hub): unified color-coded agenda of Interviews (blue), Meetings (purple), Flights/Trips (orange), Appointments (teal), Events (pink), Birthdays (green). Add events (type + title + location + day/time slots), delete via long-press, filter by type legend. Interviews auto-appear (read-only here). Backend calendar_events CRUD + /evention/calendar unified feed.
- ✅ **Reschedule Flow**: either party proposes a new time (interview card in chat + "Propose a new time" on the Evention interviews screen) → status returns to proposed, chat card updates, other party notified. Backend /profession/interviews/{id}/reschedule.
- ✅ **Offer → Contract**: accepting an offer auto-creates a simple agreement (job_contracts); the accepted offer card shows "View agreement" → /profession/contract/[id] (client + freelancer, rate, scope, date). Backend /profession/contracts[+/{id}].
- ✅ **Calendar Reminders**: lazy in-app nudge to both parties ~24h before a confirmed interview (fired on calendar fetch, once via reminded flag).
- ✅ **Rating Filters**: marketplace Freelancers tab sort chips — Featured / Top rated / Available / Newest (backend sort param).
- All flows verified via curl (calendar add/list/delete, reschedule, accept→contract, contracts list, rating sort). Calendar UI smoke-tested. User self-tests; automated tests skipped.


### 2026-06 (Frankenstein Lab — Audio Creation Studio: GenoTune + GenoFX; user self-testing)
- ✅ New /frankenstein-lab/audio screen with two tabs: GenoTune (music) and GenoFX (sfx). Reads ?mode=music|sfx. Prompt box + suggestion chips + option chips (music: genre/mood/length; sfx: character/length). Generate → renders a Nano Banana visual + the AI concept parsed into sections + a "playable audio coming soon" note.
- ✅ Backend POST /api/frankenstein/audio (FrankAudioBody kind=music|sfx): music → detailed MUSIC CONCEPT (title/genre&mood/instrumentation/structure/tempo&key/production) via _anvil_llm (gpt-5.4); sfx → SFX DESCRIPTION (name/category/description/layers/duration&dynamics/use). Visual via _ps_generate_image (Gemini Nano Banana). Returns {kind, concept, image_path}.
- ✅ District wiring: FRANKENSTEIN_ACTIONS maps GenoTune→audio?mode=music, GenoFX→audio?mode=sfx; DISTRICT_HUBS "frankenstein-lab" → "Open Audio Studio". Route registered. (GenoPic/GenoLogo/GenoMeme/GenoGIF remain unmapped/hidden — not part of this task.)
- Real audio generation (Suno/ElevenLabs) intentionally deferred — studio produces concept + visual only for now.
- Credit-free checks only (per user): 401 no-auth, 422 bad kind / empty prompt, frankenstein-lab present in /districts. Web bundle compiles. Did NOT run real LLM/image generation to save credits.
- Files: backend/server.py (FrankAudioBody + frankenstein_audio), frontend/app/frankenstein-lab/audio.tsx, district/[slug].tsx, _layout.tsx, src/api/client.ts (frankAudio).


### 2026-06 (Dreambacker phase 5 + Headquarters/Settings; user self-testing)
- ✅ Cancel Monthly: my-backings now returns can_cancel_recurring; new POST /dreambacker/backings/{project_id}/cancel-recurring cancels the Stripe subscription (subscription_id captured in _fulfill_contribution for recurring) and marks recurring=False. Backings screen shows a "Stop monthly support" button with a native Alert confirm.
- ✅ Comment notifications: db_create_comment now in-app-notifies the creator (type dreambacker_comment) on any non-creator comment.
- ✅ Funded celebration: db_get_project returns celebrate=true ONCE for the creator when funded (funded_celebrated flag). New ConfettiCelebration overlay (RN Animated emoji burst + "Funded!" card) shows on the detail screen. _fulfill_contribution also notifies the creator once (dreambacker_funded) when the goal is first reached.
- ✅ Headquarters (profile/HQ tab): cog → /settings; balance card → /orders; handleMenu maps all menu items (bookmarks→/saved, warehouse→/orders, notifications→/notifications, messages→/chatterbox/inbox, achievements→/achievements, dashboard→home, settings/privacy/security/appearance/help/support/id/resume→/settings).
- ✅ New /settings screen: Appearance (theme), Notifications & Privacy preference toggles (persisted via storage singleton), Account/security shortcuts (bookmarks/orders/backings + security info), Help Center + Contact support (mailto), About, Sign out.
- ✅ New /achievements screen: badge grid derived from profile stats (posts/followers/saved/balance/title), earned vs locked.
- Backend smoke-tested: comment→creator notif True; celebrate true-then-false; my-backings can_cancel true→cancel→false + your_recurring false. Web bundle compiles.
- ⏳ Device Push (real lock-screen push) NOT implemented — needs Emergent push integration + user's Firebase google-services.json + a native build (can't run in Expo Go/preview). Pending user decision.
- Files: backend/server.py; frontend app/dreambacker/{[id],backings}.tsx, (tabs)/profile.tsx, settings.tsx, achievements.tsx, _layout.tsx; src/components/ConfettiCelebration.tsx; src/api/client.ts.
- NOTE: user opted to self-test (skip automated tests).


### 2026-06 (Dreambacker phase 4 — comments, recurring support, home trending row, funded ribbon, my backings, update push; user self-testing)
- ✅ Comments & questions: db.db_comments; GET/POST /dreambacker/projects/{id}/comments. Anyone can comment; creator replies (parent_id) with a "Creator" tag; creator replies notify the original commenter (in-app). Detail page has a comment box + threaded replies.
- ✅ Recurring support (monthly): DBBackBody+recurring → Stripe Checkout mode="subscription" with monthly recurring price_data (managed_payments disabled — REQUIRED or Stripe 400s on tax code). Detail has a "Make this monthly" checkbox; button becomes "Support monthly". Creator-only GET /dreambacker/projects/{id}/recurring lists recurring supporters + monthly total (shown on detail). NOTE: only the initial subscription is tracked (no invoice.payment_succeeded webhook for renewals — MVP).
- ✅ Post Update → notification: db_create_update now in-app-notifies every paid backer via _notify (type dreambacker_update). User said "the app's notification system" → used existing in-app notifications (works in preview). Device/lock-screen push would need the Emergent push integration + a real build (not added).
- ✅ Goal Reached badge: _db_project_public adds funded=raised>=goal. "Funded!" ribbon on gallery cards, detail progress card, home trending row, and my-backings.
- ✅ My Backings: GET /dreambacker/my-backings (distinct backed projects + your_total_cents + your_recurring). New /dreambacker/backings screen; entry via hand-heart icon in gallery header.
- ✅ Trending Home Row: (tabs)/index.tsx feed header shows a horizontal "Trending fundraisers" row (api.dbProjects("trending"), top 8) with progress + Funded badge → project detail; "See all" → /dreambacker.
- Backend smoke-tested: comments+creator reply, recurring supporters (creator count/total, non-creator 403), my-backings, update→backer in-app notification + alert, recurring & one-time Stripe sessions both return checkout_url. Web bundle compiles.
- Models: DBCommentCreate, DBBackBody+recurring. Files: frontend/app/dreambacker/{index,[id],backings}.tsx, (tabs)/index.tsx, src/api/client.ts (DBComment/DBRecurringSupporter + dbComments/dbCreateComment/dbRecurring/dbMyBackings + funded), _layout.tsx, backend/server.py.
- NOTE: user opted to self-test (skip automated tests).


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

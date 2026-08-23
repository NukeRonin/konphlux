# Konphlux — Mobile App PRD

## Original Problem Statement
"Build a mobile app version of my imported website (Konphlux)." Konphlux is an all-in-one social + utility ecosystem (social networking, marketplace, content creation, professional services) organized into 22 themed "districts", with a polished steampunk parchment aesthetic. Website was a private Vite + TanStack Router + Supabase app (backend not deployed).

## Architecture
- **Frontend**: Expo (SDK 54) + expo-router. Auth gate → `(auth)` (login/register) vs `(tabs)` (Feed / Districts / Bazaar / HQ). Detail routes: `district/[slug]`, `product/[id]`, `chatmonger/[slug]`, `saved`, modal `compose`.
  - Steampunk theme system (light "parchment" default + dark "lamplight"), Cinzel + Karla fonts (expo-font), reusable components (Panel, BrassText, ForgeButton, AvatarInitials, Gear, ChatmongerCard, AppHeader, States).
  - AuthContext stores JWT in `storage.secure*`; API client attaches Bearer token.
- **Backend** (`server.py`): FastAPI + MongoDB (motor). Seeds 22 districts, 6 feed posts, 8 bazaar listings. JWT auth (PyJWT + argon2/pwdlib). AI Chatmonger via emergentintegrations (Emergent LLM key, openai `gpt-5.4`). All data routes require Bearer token; under `/api`.

## Implemented
### 2026-06 (Reopen Reminders · Cheer/Comment Notifications; user self-testing, tests/screenshots skipped)
- ✅ **Reopen Reminders**: one-tap "Remind me" bell on temporarily-closed favourites (retrospections/favorites.tsx). Backend `retro_reopen_reminders` collection; POST `/retrospections/reopen-reminder/{id}` toggle; favorites payload now returns `reminding`. `_sweep_reopenings` nudges anyone who favourited OR set a reminder when the reopen date passes, then clears one-shot reminders.
- ✅ **Cheer/Comment Notifications**: cheering or commenting on a friend's feed item now sends the creator an in-app notification (bell). New `_activity_owner()` resolves the owner from the activity id prefix (fv-/bc-/vi- → frank_vault/bb_courses/vault_items); `friends_feed_cheer` (only on cheer-on) and `friends_feed_add_comment` call `_notify` (types `friend_cheer`/`friend_comment`) when actor ≠ owner.
- Files: backend/server.py (_activity_owner + notify in cheer/comment, retro_reopen_reminder endpoint + reminding flag + sweep recipients union); frontend app/retrospections/favorites.tsx (Remind me toggle), src/api/client.ts (RetroBusiness.reminding + retroReopenReminder).
- Verified: backend smoke — reminder toggle on/off + reminding flag; owner unread count +2 after a cheer+comment with latest types [friend_comment, friend_cheer]. Lint clean, iOS entry bundle 200. Backend + Expo restarted.


### 2026-06 (Course Sorting · Feed Reactions · Reopening Countdown · Stream Highlights; user self-testing, tests/screenshots skipped)
- ✅ **Course Sorting**: `/brainboost/courses` accepts `sort=recent|rating`, attaches `rating{avg,count}` + `user_created` per card. courses.tsx got Newest/Top-rated sort chips and a ★ rating pill on each course card.
- ✅ **Feed Reactions**: friends Activity feed items are now cheerable + commentable. `ff_cheers`/`ff_comments` collections; endpoints POST `/friends/feed/{id}/cheer` (toggle), GET/POST `/friends/feed/{id}/comments`. `friends_feed` now returns `cheers/cheered/comment_count`. friends/index.tsx feed rows got a Cheer button + expandable inline comment thread with input.
- ✅ **Reopening Countdown**: `_retro_public` now returns `reopen_at` + `reopen_in_days` for temporary-closure businesses. retrospections/favorites.tsx shows an amber "Reopens in X days" / "Reopens today" badge on favourited closed places.
- ✅ **Stream Highlights**: `_archive_stale_streams` now also auto-saves a short highlight clip into `ps_clips` (from_stream=True) when a live stream is archived, so followers get a quick recap in Streamora's Clips row.
- Files: backend/server.py (brainboost_courses sort+rating, friends_feed cheer/comment counts + 3 endpoints, _retro_public reopen countdown, _archive_stale_streams clip insert); frontend app/brainboost/courses.tsx, app/friends/index.tsx, app/retrospections/favorites.tsx, src/api/client.ts (FeedComment type, FriendActivity+BBCourseCard+RetroBusiness fields, bbCourses sort, feedCheer/feedComments/feedAddComment).
- Verified: backend smoke (courses sort=rating 12 w/ratings; cheer toggle; comment add+list; reopen_in_days on favourited closure; 75-min stream archive→video+clip earlier). Lint clean, iOS entry bundle 200. Backend + Expo restarted.


### 2026-06 (Friend Feed · Course Reviews · Reopening Alerts · Watermark Toggle · Streamora Start Live + auto-archive; user self-testing, tests/screenshots skipped per user)
- ✅ **Streamora Start Live + 60-min auto-archive**: `streamora_golive` now stamps `started_at` when going live now. New `_archive_stale_streams()` sweep (called at the top of `/pictureshow/streamora` and `/pictureshow` hubs) auto-archives any live stream older than 60 min: creates a recorded video in `ps_videos` (from_stream=True, category kept, viewers→views) so it appears in the main PictureShow district, and flips the stream to `status="recent"` with `archived_video_id`. Agent-verified by inserting a 75-min-old live stream → became recent + a PictureShow video was created.
- ✅ **Friend Feed** (Friends screen → "Activity" tab): `GET /friends/feed` aggregates friends' recent CREATED (Frankenstein Lab `frank_vault`, BrainBoost user courses) + SAVED (`vault_items`) activity, newest first (60 max). Frontend friends/index.tsx got a People/Activity segmented tab; activity rows show actor + verb + title + thumbnail and deep-link to the item's route.
- ✅ **Course Reviews**: `bb_reviews` collection. `GET/POST /brainboost/courses/{id}/reviews` (1–5★ + optional text, one per user 409, can't review own course 400, notifies author on new review). Course detail returns `rating{avg,count}`. course/[id].tsx shows avg pill + a star rate form (when can_review) + reviews list.
- ✅ **Reopening Alerts** (in-app only): temporary-closure businesses get an absolute `reopen_at` stamped once in seed. `_sweep_reopenings()` (called in `/retrospections/status`) flips a closure back to open once its reopen date passes and sends an in-app `_notify` (type `retro_reopen`) to every user who favourited it (guarded by `reopen_notified` to avoid repeats). Alerts appear in the notifications bell.
- ✅ **Watermark Toggle** (Frankenstein visual studio): new toggle under the result image lets creators share art WITH or WITHOUT the Konphlux watermark. When off, share/download uses the raw generated image (no captureRef overlay); when on, captures the watermarked view. GIF (video) unaffected.
- Files: backend/server.py (BBReviewBody, _archive_stale_streams, friends_feed/_friend_ids, bb reviews + _bb_course_rating, _sweep_reopenings + reopen_at seed, golive started_at); frontend app/friends/index.tsx, app/brainboost/course/[id].tsx, app/frankenstein-lab/visual.tsx, src/api/client.ts (FriendActivity, BBReview/BBReviewsResponse types + friendsFeed/bbCourseReviews/bbAddReview).
- Verified: backend smoke (friends/feed 200, course create+review+dup409+own400+rating, golive live, retro status, 75-min stream archive→PictureShow video). Lint clean, iOS entry bundle 200. Backend + Expo restarted.


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

### 2026-06 (Vault — Lifestyle & Ideas categories + create/edit items; user self-testing)
- ✅ **7 Lifestyle & Ideas categories** added to the Vault chip row: Recipes, DIY Projects, Magic Tricks, Life Hacks, Crafts, Decor Ideas, Fashion (alongside existing Jokes/GIFs/Logos/Memes/Artwork/Quotes + All). All use the standard visual masonry grid — layout consistent with the rest of the Vault.
- ✅ **Save images + instructions + notes**: new "+ Add" button in the Vault header → /vault/add form (category chips, optional image upload to Object Storage, title, Instructions, Notes). Creates a user item (source other, ref_id idea-*). Prefills category when opened from a selected category.
- ✅ **Item detail** (/vault/item/[id]): shows image, category badge, title, Instructions and a Notes box; Edit (user items) + Delete. Tapping any non-source tile opens this detail; source tiles still deep-link to their origin. Edit reuses /vault/add?id= with PUT.
- ✅ **Memes button**: already present in the category row (confirmed still working) — no regression.
- ✅ District feature chips now deep-link to filtered views (e.g. Recipes → /vault?category=Recipes); hub reads the `category` param to preselect.
- Backend: VaultItemBody category enum expanded + `notes` field; VaultUpdateBody added; text limit raised to 4000; GET /vault/items/{id} + PUT /vault/items/{id} added; _vault_public/save persist notes; 3 lifestyle seed samples (Recipe/DIY/Decor with notes).
- Curl-verified: all new categories seed + filter; create item with instructions+notes; get; PUT edit (category change); invalid category → 422; Memes intact. Lint clean, backend + Expo restarted. Tests/screenshots skipped per user.
- Files: backend/server.py (category enum+notes, VaultUpdateBody, GET/PUT item, lifestyle seeds); frontend app/vault/index.tsx (categories, add button, category param, tile→detail), app/vault/add.tsx + app/vault/item/[id].tsx (new), app/district/[slug].tsx (filtered chip routes), app/_layout.tsx (routes), src/api/client.ts (notes, vaultGetItem/vaultUpdateItem, VaultItem type).

### 2026-06 (Vault — Visual & Creative Hub categories; user self-testing)
- ✅ **Category buttons** in the Vault: All, Jokes, GIFs, Logos, Memes, Artwork, Quotes (horizontal chip row under search). Selecting filters the grid by category.
- ✅ **Layout by type**: visual categories (GIFs/Logos/Memes/Artwork + All) render the Pinterest-style two-column masonry; text categories (Jokes/Quotes) render a clean single-column card layout. In mixed/All view, text items render as compact text tiles within the masonry.
- ✅ **Receives uploads across the app**: vault items now carry a `category` + `text` field. Frankenstein Lab saves auto-tag category by kind (GenoPic→Artwork, GenoLogo→Logos, GenoGIF→GIFs, GenoMeme→Memes). SaveToVaultButton/vaultSave accept category+text so other areas can drop items into any category (incl. text Jokes/Quotes).
- ✅ Seed refreshed: 10 sample items spanning all 6 categories (image tiles + 2 jokes + 2 quotes as text cards), so every category button shows content immediately.
- Backend: VaultItemBody gained category (enum) + text; GET /vault/items adds `category` filter and searches text too; _vault_public + save persist category/text; VAULT_SEED restructured to dicts with categories + text items.
- Curl-verified: all 6 category filters return correct items (Artwork 3, Logos/Memes/GIFs 1 each, Jokes/Quotes 2 each), text vs image tagging correct, text search ("boiler") hits meme, saving a Quote lands in Quotes (count 2→3). Lint clean, backend + Expo restarted. Tests/screenshots skipped per user.
- Files: backend/server.py (category+text on model/seed/public/save/list); frontend app/vault/index.tsx (category chips, CATEGORIES, TextCard, text-tile in VaultTile, textLayout render), app/frankenstein-lab/visual.tsx (category by kind), src/api/client.ts (category/text on vaultItems+vaultSave, VaultItem type).

### 2026-06 (Vault — visual organization hub, Pinterest-style; user self-testing)
- ✅ **Vault hub** (new district, /vault, "Open the Vault"): Pinterest-style two-column masonry grid of saved item tiles (image + source badge + title; varied tile heights). Source badges: Bazaar, Frankenstein Lab, Bluepaint, Saved. Search bar filters saved items by title/subtitle.
- ✅ **Collections (boards)**: horizontal collection cards (cover = first item image + count) at top of hub; tap → /vault/collection/[id] (masonry of that board's items + delete board). Create via header folder+ button (inline modal). Long-press any tile → actions (Add to a collection… / Remove from Vault); item tap opens its source route (or actions if none).
- ✅ **Save from across the app** via reusable SaveToVaultButton (toggles saved state, idempotent): Bazaar product detail (/product/[id]) full "Save to Vault"; Frankenstein visual creations also save into the app-wide Vault when saved (source frankenstein, real image URL); Bluepaint design detail compact bookmark (source bluepaint, floor-plan icon tile).
- ✅ Per-user seeding on first open: an "Inspiration" collection + 6 sample tiles spanning all 4 sources so the grid is immediately visual.
- Backend: collections vault_items/vault_collections. Endpoints GET /vault/items (q+collection), GET /vault/saved-check, POST /vault/items (idempotent per user+source+ref_id), DELETE /vault/items/{id}, POST /vault/items/{id}/move, GET/POST /vault/collections, DELETE /vault/collections/{id} (items kept, uncollected). Models VaultItemBody/VaultCollectionBody/VaultMoveBody. Per-user seed helper _vault_seed_if_empty.
- Curl-verified end-to-end: seeded 6 items across bazaar/frankenstein/bluepaint/other + Inspiration collection (3 items, cover set); search; save (idempotent, 1 copy); move to collection (count updates); delete collection keeps item; delete item. Lint clean. Backend + Expo restarted. Screenshot of /vault is blank only because it's auth-gated (expected); no compile errors. Tests/screenshots skipped per user.
- Files: backend/server.py (Vault models, endpoints, VAULT_SEED + _vault_seed_if_empty/_vault_public); frontend app/vault/index.tsx (+exported VaultTile) & app/vault/collection/[id].tsx (new), src/components/SaveToVaultButton.tsx (new), app/product/[id].tsx + app/frankenstein-lab/visual.tsx + app/bluepaint/design/[id].tsx (save wiring), app/district/[slug].tsx (VAULT_ACTIONS + hub), app/_layout.tsx (routes), src/api/client.ts (VaultItem/VaultCollection types + vault* methods).

### 2026-06 (Waypoint: property galleries, Places for Sale, Saved, Reviews→Retrospections, Trip Planner→Evention; user self-testing)
- ✅ **Property galleries**: from the Waypoint district, "Vacation houses" / "Condos & apartments" / "Cabins & cottages" open the stays gallery scoped to that group (route /waypoint?group=...). Groups derived from place_type (Manor/Airship/Tower→Vacation Houses; Loft/Studio→Condos & Apartments; Cabin/Cottage/Houseboat→Cabins & Cottages). Header + subtitle reflect the collection; type-filter chips hidden in scoped views.
- ✅ **Places for Sale** (/waypoint?kind=sale): separate listing_kind="sale" gallery, 3 seeded property listings (house/condo/cabin) with full asking price + "FOR SALE" badge. Detail shows Asking price box + "Enquire to buy" (contact host alert), no booking panel. Rentals gallery excludes sale listings and vice-versa.
- ✅ **Saved Stays & Wish Lists**: heart toggle on cards + a heart on stay detail; /waypoint/saved screen (heart icon in header). Backend wp_saved collection; POST /waypoint/stays/{id}/save (toggle), GET /waypoint/saved; `saved` flag on stay payloads.
- ✅ **Guest & Host Reviews → auto-upload to Retrospections**: guests who've booked can leave a star+text review on a stay (WPReviews component). Backend POST /waypoint/stays/{id}/review upserts a mirror Retrospections business (id wpstay-{id}, category Services) and inserts the review into retro_reviews — so the exact same review is browsable in Retrospections. Stay rating recomputed live (base + guest reviews). GET /waypoint/stays/{id}/reviews. Guards: must have booked (403), one review per guest (409), can't review own listing.
- ✅ **Trip Planner → Evention Upcoming Trips** (/waypoint/trip): pick from your bookings or type a destination, set start date + nights + notes; "Add to my trips" creates a calendar_event type="flight" (Evention's "Upcoming Flights & Trips") with the plan in the note. POST /waypoint/trips (also stores wp_trips). Confirmation screen links to /evention. Verified a future-dated trip appears in Evention upcoming.
- Curl-verified: 3 galleries return correct place types; sale gallery 3 listings; rentals exclude sale; save/saved/detail flag; review blocked pre-booking (403) then 201, shows in Retrospections business (reviews 1, rating 5.0) and updates stay rating; trip (future date) lands in Evention upcoming as a flight/trip. Lint clean, backend + Expo restarted. Tests/screenshots skipped per user. NOTE: server clock is ~Aug 2026 — past-dated trips correctly go to calendar "past".
- Files: backend/server.py (WPReviewBody/WPTripBody, group+listing_kind on stays, WP_SALE seed, _wp_group/_wp_saved_ids/_wp_rating/_wp_retro_business_id helpers, group+kind filters, saved endpoints, reviews endpoints w/ retro mirror, trips endpoint); frontend app/waypoint/{index (galleries+save+sale cards),[id] (save+sale+reviews),saved,trip}.tsx, src/components/WPReviews.tsx (new), app/district/[slug].tsx (gallery routes), app/_layout.tsx (saved+trip routes), src/api/client.ts (WPStayDetail/WPReview types + wpSaved/wpSaveStay/wpStayReviews/wpAddReview/wpCreateTrip + group/kind on wpStays).

### 2026-06 (Waypoint Booking Engine + Telegraph: Edit Published, Comment Likes, Follow Alerts; user self-testing)
- ✅ **Waypoint Booking Engine** (new district, /waypoint, "Open the Booking Engine"): Search Stays (text search by name/place/type + place-type filter chips), List/Map toggle. **Map Search** = react-native-svg canvas with price pins positioned by stay lat/lng (normalised bounding box), tap pin → preview callout → detail. 7 seeded stays.
- ✅ **Book a Stay** (/waypoint/[id]): hero, type/rating/host/amenities, booking panel with check-in date stepper + nights + guests steppers, live total, "Book a Stay" → confirmation screen ("Booking Confirmed", shows Treasury note). Guards: can't book own listing (400), guests ≤ max (400). My Trips (/waypoint/bookings).
- ✅ **Host Your Place** (/waypoint/host, FAB): photo upload (Object Storage), title, place type, location, $/night, guests/bedrooms steppers, description, amenities → creates listing → opens it. Owner sees "This is your listing" + Remove (soft delete status=removed).
- ✅ **Treasury auto-recording**: every booking records BOTH a wallet payment (debit, category Travel, counterparty Waypoint — shows in Payments history) AND a district_ledger waypoint entry (shows in "Deals in Waypoint" tracker with total, links to /waypoint/bookings). Verified: balance dropped by booking total, tracker + payments updated.
- Backend: WP_PLACE_TYPES, WPStayBody, WPBookingBody, WP_STAYS seed (idempotent), collections wp_stays/wp_bookings, endpoints GET /waypoint/stays (q+type), /waypoint/my-stays, /waypoint/stays/{id}, POST /waypoint/stays, DELETE /waypoint/stays/{id}, POST /waypoint/stays/{id}/book (records Treasury via _record_txn + district_ledger), GET /waypoint/bookings.
- ✅ **Telegraph Edit Published**: reader Edit (pencil) for owners → /telegraph/new?id= loads article; when editing a published article the form shows only "Update article" (no Save-draft/unpublish), PUT keeps status & doesn't restamp; reader reloads on focus → instant update.
- ✅ **Telegraph Comment Likes**: heart toggle per comment/reply (tg_comment_likes), count shown; top-level threads now sort by likes desc then recency ("best rise to top"). POST /telegraph/comments/{id}/like. Delete comment clears its likes.
- ✅ **Telegraph Follow Feed Alerts**: badge on the Following tab showing count of new published articles from followed writers since last opened. GET /telegraph/following/unseen + POST /telegraph/following/seen (tg_seen). Opening the Following tab clears the badge.
- Curl-verified end-to-end: Waypoint search/filter/book/Treasury/host/guards; comment like toggle + count + liked flag; follow unseen 0→1→seen 0→1 on new post; published edit updates title. Lint clean, backend + Expo restarted. Automated tests/screenshots skipped per user.
- Files: backend/server.py (Waypoint models/seed/endpoints, comment-like endpoint + sort, following unseen/seen, comment_public likes); frontend app/waypoint/{index,[id],host,bookings}.tsx (new), src/components/TGComments.tsx (like button), app/telegraph/{index (badge),new (edit-published)}.tsx, app/district/[slug].tsx (WAYPOINT_ACTIONS + hub), app/_layout.tsx (routes), src/api/client.ts (WPStay/WPBooking types + wp* methods, tgLikeComment/tgFollowingUnseen/tgFollowingSeen).

### 2026-06 (Telegraph — Comments, Writer Profiles, Rich Drafts; user self-testing)
- ✅ **Article Comments**: threaded responses under each published article (top-level + one level of replies). Compose/Reply/Delete-own. Backend collection tg_comments; endpoints GET/POST /telegraph/articles/{id}/comments, DELETE /telegraph/comments/{id} (owner, cascades replies). comments_count added to article payload + shown on gallery cards, reader ("Responses"), and profile rows. Component: src/components/TGComments.tsx.
- ✅ **Writer Profiles** (/telegraph/author/[id]): avatar, name/handle, stats (Articles / Followers / Likes), Follow/Following toggle (or "This is you"), and the writer's published articles list. Reachable by tapping any author (gallery card + reader author row). Backend GET /telegraph/authors/{author_id} (derives identity from articles or users; followers via tg_follows count). Seeded authors (tg-auth-1..4) have profiles too.
- ✅ **Rich Drafts**: Save an unfinished article as a draft and publish later. Post screen now has **Save draft** + **Publish**; supports edit mode via /telegraph/new?id= (loads existing article/draft). Drafts are private (hidden from all gallery tabs; 404 for non-owners). My Drafts screen (/telegraph/drafts) with edit + delete; entry points from gallery header + post screen. Reader shows a Draft badge and Edit/Publish for owners. Backend: status field on TGArticleBody (published|draft), gallery filters exclude drafts, GET /telegraph/drafts, PUT /telegraph/articles/{id} (owner edit/publish — re-stamps created_at on publish).
- Curl-verified end-to-end: draft create→private→publish visible; threaded comment + reply, count, owner delete cascades reply; author profile stats + follow increments; seeded author profile. Lint clean, backend + Expo restarted. Automated tests/screenshots skipped per user; user verifies in Preview.
- Reading Lists: user chose to skip for now (Vault district not yet built).
- Files: backend/server.py (TGArticleBody.status, TGCommentBody, drafts/PUT/author/comments endpoints, _tg_comment_counts/_tg_follow_set/_tg_author_fields helpers, comments_count in _tg_public, delete cascades comments), frontend app/telegraph/{index,[id],new,drafts}.tsx + app/telegraph/author/[id].tsx (new), src/components/TGComments.tsx (new), app/_layout.tsx (routes), src/api/client.ts (TGComment/TGAuthor types + tgUpdateArticle/tgDrafts/tgAuthor/tgComments/tgAddComment/tgDeleteComment).

### 2026-06 (Telegraph — Article Gallery with 5 tabs + Contact topic/auto-reply; user self-testing)
- ✅ **Telegraph Article Gallery** (/telegraph, "Enter the Telegraph" from the district): tabbed reading hub — **All Articles / New / Popular / Trending / Following**. Clean, text-focused cards (category pill, N-min read, relative time, title, 3-line excerpt, author avatar+name, like count). Tap → reader.
- ✅ **Article reader** (/telegraph/[id]): comfortable long-form layout (720px max width, 17px/28-line body split into paragraphs, 28px display title), category pill, author row with **Follow/Following** toggle, cover image, Share, owner-only Delete, and a Like button footer.
- ✅ **Post an article** (/telegraph/new, feather icon / "Post Something"): title, category chips (8), optional cover image (expo-image-picker → Object Storage upload), long-form body; publishes then opens the new article.
- ✅ Tabs logic: All/New = newest first; Popular = most total likes; Trending = most likes in last 7 days (then likes); Following = articles from followed authors (newest first). Likes toggle per-user (tg_likes); author follow per-user (tg_follows). 6 seeded articles across 4 distinct authors so Following/Popular/Trending have content immediately.
- Backend: collections tg_articles, tg_likes, tg_follows. Endpoints GET /telegraph/articles?filter=, GET /telegraph/articles/{id}, POST /telegraph/articles, DELETE /telegraph/articles/{id} (owner), POST /telegraph/articles/{id}/like (toggle), POST /telegraph/authors/{author_id}/follow (toggle). Model TGArticleBody. read_minutes = words/200. Seed idempotent (upsert, setOnInsert created_at from days_ago).
- ✅ **Contact form Topic picker**: Bug / Idea / Billing / Other chips (default Bug); topic prefixes the support email subject ([Konphlux Contact · <Topic>]). ContactBody gained `topic` (validated enum, 422 on invalid).
- ✅ **Contact Auto-Reply**: after a submission, a friendly confirmation email is sent to the sender ("we've received your message…") via send_contact_confirmation (best-effort — never fails the request). Fixed server-side template, guardrail-safe.
- Curl-verified: all 5 tabs correct ordering, follow→2 Following articles, like toggle, create (excerpt auto-derived), contact topic 201 / invalid topic 422. Lint clean, backend + Expo restarted. NOTE: user opted to skip automated tests/screenshots; verify in Preview (incl. inbox receipt of message + auto-reply).
- Files: backend/server.py (TGArticleBody, TG_CATEGORIES, TG_ARTICLES seed, _tg_* helpers + endpoints, contact topic+confirmation), backend/email_service.py (topic in send_contact_message + send_contact_confirmation), frontend app/telegraph/{index,[id],new}.tsx, app/contact.tsx (topic chips), app/district/[slug].tsx (TELEGRAPH_ACTIONS + hub), app/_layout.tsx (routes), src/api/client.ts (TGArticle + tg* methods + contactUs topic).

### 2026-06 (Contact Us page — Settings → Assistance; user self-testing)
- ✅ **Contact Us** (/contact, reachable via Settings → Assistance/Help "Contact support"): form with Username, Email Address, Subject, Message. Signed-in user's display_name + email auto-prefill (from AuthContext). Send validates required fields + email format client-side; disabled until valid. On success shows a "Message Sent" confirmation card (check icon + Done → back).
- ✅ Backend POST /api/contact (ContactBody: username/email/subject/message with Pydantic validation) → email_service.send_contact_message delivers an HTML message to fixed server-side inbox CONTACT_INBOX="konphluxoverlord@gmail.com" (recipient is NOT client-controlled). Reply-to set to the submitter's email. Returns {"sent": true} (201).
- Agent-tested via direct API: valid → 201 {"sent":true}, invalid email → 422, missing fields → 422. Managed email key present. Frontend lint clean. NOTE: actual inbox receipt at the Gmail address NOT yet observed — user to verify in Preview. Automated tests/screenshots skipped per user request.
- Files: backend/email_service.py (send_contact_message, CONTACT_INBOX), backend/server.py (ContactBody + /contact endpoint, import send_contact_message), frontend app/contact.tsx (new), app/settings.tsx (Contact support → router), app/_layout.tsx (contact route), src/api/client.ts (contactUs).

### 2026-06 (Entrepreneur Lobby — Team Messaging via Chatterbox; user self-testing)
- ✅ **"Message Team"** button in workspace detail header → POST /lobby/workspaces/{id}/message-team finds-or-creates the Chatterbox group chat for the workspace members (reuses existing cb_conversations engine, type "group"), then navigates to /chatterbox/conversation/{id}. Idempotent via workspace_id tag; roster re-synced to current members on each open; title = workspace name. Requires ≥2 members (400 with helpful message otherwise).
- Curl-verified: solo→400, creates group, idempotent (same conv id), group opens in Chatterbox with workspace title. Lint + bundle clean. Files: backend/server.py, frontend app/lobby/[id].tsx (header button + handler), src/api/client.ts (lobbyMessageTeam).

### 2026-06 (Entrepreneur Lobby — Clients / Projects / Tasks per workspace; user self-testing)
- ✅ Workspace detail now has 4 tabs: My Team (existing) + **Clients**, **Projects**, **Tasks**. Add/delete clients (name/company/contact), projects (name/description + optional client link), tasks (title + optional project link + optional assignee from workspace members). Tasks show project + assignee pills, toggle done (strikethrough), delete. Projects show linked client name.
- Backend collections ws_clients, ws_projects, ws_tasks. Endpoints under /lobby/workspaces/{id}/: GET/POST/DELETE clients, projects (+client_name join), tasks (+project_name join), POST tasks/{tid}/toggle. _require_ws_member guards all (member-only). Task assignee validated against members (422). Deleting a project unlinks its tasks; deleting a workspace cascades clients/projects/tasks. Models ClientBody/ProjectBody/TaskBody.
- Curl-verified: client/project/task CRUD, project↔client link, task↔project+assignee link, bad-assignee 422, toggle, project-delete unlink, cascade. Lint + bundle clean. Files: backend/server.py, frontend app/lobby/[id].tsx (tabbed rewrite), src/api/client.ts.

### 2026-06 (Entrepreneur Lobby — Business Workspaces & Teams; user self-testing)
- ✅ **Workspaces** (/lobby): create business workspaces (name + description), delete (owner only, with confirm), list of workspaces you own or belong to (shows member count + your role).
- ✅ **Workspace detail / My Team** (/lobby/[id]): owner can add teammates by email or @handle and remove them; "My Team" lists everyone with Owner/Member role tags + avatars. Owner can't be removed; duplicate add → 409; non-owner can't add/remove/delete.
- Backend: collection workspaces {id, owner_id, owner_name, name, description, members:[{user_id,name,handle,role}]}. Endpoints GET/POST /lobby/workspaces, GET/DELETE /lobby/workspaces/{id}, POST /lobby/workspaces/{id}/members, DELETE /lobby/workspaces/{id}/members/{member_id}. Owner auto-added as first member on create; _find_member resolves email/@handle. Models WorkspaceBody, MemberBody.
- Wiring: DISTRICT_HUBS entrepreneur-lobby→/lobby; ACTIONS "Business workspaces"/"Add Workspace"/"Add Teammates"/"My Team"→/lobby. Routes registered.
- Curl-verified: create, add member, dup-409, My Team list, member sees workspace (is_owner false), non-owner delete 404, remove member, owner-remove 400, delete workspace. Lint + bundle clean. Files: backend/server.py, frontend app/lobby/{index,[id]}.tsx, src/api/client.ts, app/_layout.tsx, app/district/[slug].tsx.

### 2026-06 (Treasury — Security Settings: PIN + Biometric lock gate; user self-testing)
- ✅ **Security Settings** (/treasury/security, shield icon in Treasury dashboard header): choose entry method — Neither / PIN only / Biometrics only / PIN + Biometrics. Set/change 4–6 digit PIN (with confirm). Shows a note when biometrics unavailable on the device/preview.
- ✅ **Lock gate** (src/components/TreasuryGate.tsx) wraps /treasury/index AND /treasury/trackers: on opening the district it checks the user's method and requires verification — biometric prompt (expo-local-authentication) and/or a numeric PIN keypad. "both" requires biometric then PIN. In-memory unlock TTL 90s (src/utils/treasuryLock.ts) so brief in-district navigation doesn't re-nag; re-locks after leaving/timeout and on settings change. Graceful fallbacks: web/Expo Go without biometrics shows a Continue path (biometric can't be verified there); "both" falls back to PIN when biometrics unavailable.
- Backend (per integration_expert playbook): collection treasury_security {method, pin_hash, failed_pin_attempts, pin_locked_until}. PIN hashed with existing pwdlib argon2 `password_hash` (separate field, NOT reused credential). Validation 4–6 digits + common-PIN blocklist (422). Endpoints GET/PUT /treasury/security, POST /treasury/security/verify-pin (5 failures → 5-min lock 429, generic 401 on wrong). PUT keeps existing PIN if method needs one and none re-entered.
- Models TreasurySecurityBody, PinVerifyBody. `import re` added. app.json: expo-local-authentication plugin + NSFaceIDUsageDescription + faceIDPermission.
- Curl-verified: get/set (none/pin/biometric/both), correct/wrong PIN, common-PIN 422, keep-PIN-on-method-change, set-none clears. Lint + bundle clean. NOTE: biometrics only truly testable on a real device build (not Expo Go/web). suite_tester security reset to none.
- Files: backend/server.py, frontend app/treasury/{security,index,trackers}.tsx, src/components/TreasuryGate.tsx, src/utils/{biometric,treasuryLock}.ts, src/api/client.ts, app/_layout.tsx, app.json.

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

## Roundtable — central discussion engine (2026-06)
- Roundtable is now the hub for public discussions across Konphlux. Every district detail page (except Roundtable) has a "Discuss <District> at the Roundtable" button.
- Backend: `POST /api/roundtable/discuss` (create-or-join thread by title, auto-joins user, tags category) and `GET /api/roundtable/category/{category}` (ensures a per-district community exists, returns its threads). Communities & threads now carry a `category` tag; district icon auto-mapped via `_district_icon`.
- Frontend: new screen `app/roundtable/discuss.tsx` (category banner + composer + join-existing thread list); `api.rtDiscuss` / `api.rtCategory`; ThreadRow shows a category tag pill.
- Verified (agent, direct backend smoke): category community auto-create + district icon, discuss create (201) vs join-existing (same thread id), category tag on thread, distinct Waypoint community. Screenshots/testing-agent skipped per user request.

## Roundtable enhancements + Vault Knowledge & Travel (2026-06)
- **Trending Discussions**: `GET /api/roundtable/trending` (score = upvotes + 3×replies, recency-weighted, top 8). Home feed shows a "🔥 Hot discussions this week" horizontal row (`RoundtableTrending` in `(tabs)/index.tsx`).
- **Discuss This Item**: reusable `DiscussItemButton` on Bazaar product (`/product/[id]`) and Waypoint stay (`/waypoint/[id]`) — calls `rtDiscuss` with category + `Discuss: <title>` to create/join a listing-specific thread.
- **Mention & Reply**: `ReplyCreate.mentions` (user_ids); reply endpoint resolves them, stores `mention_names`, and fires `roundtable_mention` notifications. Thread screen shows a participant mention-chip bar above composer and highlights @names in replies.
- **Vault Knowledge & Travel hub**: added categories `Travel Ideas` (deep-links Waypoint), `Reading List`, `Tutorials` (deep-links BrainBoost) to VaultItem/Update patterns + seed data. Item detail now shows contextual deep-link buttons (Explore in Waypoint / Learn in BrainBoost) and an "Add to board" action (pick existing board or create new). District Vault chips deep-link to filtered categories.
- Verified (agent smoke): trending returns 8 with reply_count; mention notification delivered to mentioned user; new Vault categories seed with correct routes; user create 201; invalid category 422. Screenshots/testing-agent skipped per user request.

## Discuss Everywhere + Shared Boards + Reply Notifs + Telegraph News/Reading List (2026-06)
- **Discuss Everywhere**: `DiscussItemButton` added to Bazaar product, Waypoint stay, Dreambacker project, Telegraph article — routes each into a Roundtable thread tagged with the district.
- **Reply Notifications**: `rt_add_reply` now also notifies the thread starter (`roundtable_reply`) unless it's them or already @mentioned.
- **Shared Boards**: `vault_shares` collection. `POST /vault/collections/{id}/share` (email/@handle, notifies recipient), `GET /vault/shared`, `GET /vault/shared/{share_id}` (read-only), `DELETE /vault/shared/{share_id}`. Vault index shows "Shared with you"; collection screen has a Share action; new read-only screen `vault/shared/[id].tsx`.
- **Telegraph Reading List**: `tg_reading` collection. Toggle `POST /telegraph/articles/{id}/reading-list`, list `GET /telegraph/reading-list`; `saved` flag added to `_tg_public`. Bookmark on article detail; new `telegraph/reading-list.tsx`; entry card on gallery.
- **Telegraph News (NewsAPI.org)**: `GET /telegraph/news?topic=` fetches top-headlines/everything via httpx, heuristic bias map (Left/Center/Right), clusters same-story by title similarity (difflib), 5-min in-memory cache, graceful `configured:false` when key absent. New `telegraph/news.tsx` (topic chips, coverage bar, compare-coverage source list opening URLs). Key: `NEWS_API_KEY` in backend/.env (placeholder added — awaiting user's key).
- Verified (agent smoke): reading toggle/list/saved; shared share 201 + bad recipient 404 + recipient sees board; starter reply notification; news graceful path. NewsAPI live path pending user key.
- NewsAPI key added (2026-06). Live path verified: real headlines fetched for top/technology/world/politics/business; heuristic clustering surfaces multi-source stories (e.g. business=3) with L/C/R coverage bars. `_news_fetch` queries both top-headlines + everything; `_news_group` uses title similarity + keyword-overlap.

## Follow/Blindspot/Save-News + Collab Boards + Sparking Privacy + Library (2026-06)
- **Follow a Story**: `news_follows` collection; `POST /telegraph/news/follow` (toggle by normalized headline). `tg_news` marks clusters `following`; `_news_update_follows` fires `news_followup` notification when a followed story gains new outlets. `topic=following` lists them. News cards have a Follow bell.
- **Blindspot Feed**: `topic=blindspot` filters clusters covered by only one political side. New topic chip.
- **Save News to Vault**: news card Save button → `vaultSave` (source other, subtitle "News", sources in notes).
- **Collaborative Boards**: `vault_move_item` + `vault_list_items?collection=` + `/vault/shared`/detail now allow & aggregate share-recipient contributions (query by collection_id across users). `/vault/shared` returns `collection_id`; item-detail board picker lists shared boards.
- **Sparking Dawn Privacy (Settings)**: `POST /dating/preferences` (visible + seeking); `visible` on profile; `dating_discover` hides non-visible + honors viewer seeking. Settings section: Make Profile Visible, Interested in Men, Interested in Women.
- **Library**: removed `library` from `/districts`. `library_items` (seeded 3 eBooks) + `GET/POST/DELETE /library/ebooks`. New `app/library/index.tsx`; entry in profile menu (after Bookmarks) + Settings → `/library`.
- Verified (agent smoke): districts excludes library; dating prefs persist; library seeds 3; news follow/following/blindspot; collaborative contribution visible to owner + recipient. Lint clean.

## eBook Reader + Buy-to-Library + Board Chat + Digest + Home/Streamora + Continue Watching (2026-06)
- **eBook Reader**: `GET /library/ebooks/{id}` returns generated `content` pages + `progress_page`; `POST .../progress`. New `app/library/read/[id].tsx` (paged FlatList, progress bar, resumes at saved page). Library tile taps → reader.
- **Buy to Library**: `_fulfill_paid_order` → `_add_ebooks_from_order` adds any eBook/Audio Book line to buyer's `library_items` (idempotent). (Code path; not runtime-tested without a Stripe purchase.)
- **Board Chat**: `board_messages`; `GET/POST /vault/collections/{id}/messages` (owner+recipients only, notifies others). New `app/vault/board-chat/[id].tsx`; chat icon on collection + shared screens.
- **Daily Digest**: `GET /telegraph/news/digest` (per-follow new-outlet diff vs snapshot, resets daily). Digest banner on News → Following tab.
- **Home functional**: header bell→/notifications, chat→/chatterbox; composer Photo/Video→/compose, Event→/evention; post comment→/compose, share→RN Share; trending items→/roundtable.
- **Streamora functional + Live Chat**: `stream_chat` collection; `GET/POST /pictureshow/streamora/{id}/chat` (ambient seed). Watch screen rewritten: live chat panel (polls 5s while live), Follow button, passes stream id/channelId/following from hub.
- **Continue Watching**: `ps_progress`; `POST /pictureshow/videos/{id}/progress` (VideoPlayer reports position every 5s + on unmount), `GET /pictureshow/continue`. Row with resume badge + progress bar at top of PictureShow hub.
- Verified (agent smoke): reader pages+progress; board chat post/read/owner; digest; stream chat seed+post; continue watching (progress 0.25). Lint clean. Buy-to-Library code-only.


## Bookmarks + Stream Reactions + Watch Party + Audiobooks + Chatterbox React/Reply + Bluepaint Labels (2026-06)
- **eBook Bookmarks**: reader can bookmark a page / add page+line notes; persisted per-user; bookmark list to jump back. `frontend/app/library/read/[id].tsx` + backend endpoints.
- **Stream Reactions**: tap-to-cheer emoji controls with floating overlay on Streamora watch screen (`frontend/app/pictureshow/streamora/watch.tsx`).
- **Watch Party**: backend party create/join/state-sync/shared-chat; host advances playback, guests receive sync. Share invite via RN `Share` (no expo-clipboard). New `frontend/app/pictureshow/party/[code].tsx`; "Watch together" entry on video detail.
- **Audiobook Player**: `expo-audio`; play/pause + saved/resumed listening position. New `frontend/app/library/audio/[id].tsx`; Library item navigation branches by eBook/audiobook format.
- **Chatterbox React/Reply**: message reactions (emoji map on message) + reply-to-message with reply snapshot/banner. `frontend/app/chatterbox/conversation/[id].tsx`.
- **Bluepaint**: added per-wall length labels on drawing canvas (export/print/share via captureRef + feet/metres + floor-area via fmtLen/fmtArea already existed). Bazaar one-tap material→cart already existed in estimator.
- Verified (agent smoke + lint clean): bookmark add/list; audiobook resume position; Chatterbox reply snapshot + emoji reaction; Watch Party create/join/guest-sees-host-position/shared chat. Screenshots + testing-agent skipped per user request; awaiting user Preview verification. Native audio/real video sync require device/build QA.

## Listening Stats + Reaction Recap + Party Presence + Bookmark Sync (2026-06)
- **Listening Stats**: `listen_events` collection; `POST /library/ebooks/{id}/listen` (delta seconds + completed flag), `GET /library/stats` (hours/minutes this month, total hours, books finished this/all-time). Audiobook player reports 5s deltas while playing + marks completed at ≥98%; eBook reader marks completed on last page. Library home shows a stats card (Listened this month / Finished this month).
- **Reaction Recap**: `stream_reactions` collection; `POST /pictureshow/streamora/{id}/react`, `GET /pictureshow/streamora/{id}/reactions` (total + top emoji). Watch screen persists cheers + shows a live recap chip; Streamora hub shows "Your live reactions" recap for streams you host (top cheers per stream).
- **Party Presence**: `party_presence` collection; `POST /pictureshow/party/{code}/presence` heartbeat (upsert, 15s active window). party_state + presence return active `participants` (host flagged). Party screen sends a 4s heartbeat and shows a live avatar stack + "N people watching" (host crowned).
- **Bookmark Sync**: `GET /library/bookmarks` aggregates all bookmarks across a user's books (joined with title/cover/format). Library home lists "Your bookmarks"; tapping opens the reader at that page (`read/[id]?p=`) or the audiobook.
- Verified (agent smoke + lint clean): stats aggregation (7m listened, 1 finished); all-bookmarks join; reaction counts + hub your_streams recap; two-user party presence (host+guest, host flagged). Screenshots + testing-agent skipped per user request; awaiting user Preview verification.

## Listening Streak + Cheer Milestones + Party Invites + Reading Goals (2026-06)
- **Listening Streak**: `library_stats` now computes a daily streak from listen_events dates (consecutive days ending today/yesterday) + `listened_today` flag. Library stats card shows a 3rd tile "Day streak" (flame) + a motivational streak banner.
- **Reading Goals**: `library_goals` collection; `POST /library/goal` (0-999 monthly target). `library_stats` returns `monthly_goal`. Library home has a goal card with progress bar (finished/goal this month) + a stepper modal to set/edit/clear the goal; celebrates when reached.
- **Cheer Milestones**: new `src/components/ConfettiBurst.tsx` (Animated, no new dep). Watch screen tracks recap.total crossing milestones [10,25,50,100,250,500,1000,2500,5000], baselines on first load (no false fire), then shows confetti + a "N cheers!" toast when crossed.
- **Party Invites**: party screen "Invite" button opens a sheet listing the user's Chatterbox conversations (`cbConversations`); tapping sends a party-code invite message via `cbSend` and marks it "Invited".
- Verified (agent smoke + lint clean): streak=1 + listened_today + goal persistence via stats; confetti/invite are UI (Preview). Screenshots + testing-agent skipped per user request; awaiting user Preview verification.

## Streak Reminder + Goal Celebration + Milestone Sound + Group Invite + Home/Sparking Dawn fixes (2026-06)
- **Streak Reminders**: Home feed shows a dismissible banner (StreakReminder) when streak_days>0 && !listened_today, tapping → /library. Library streak banner also nudges.
- **Goal Celebration**: Library home shows a "Goal Achiever" trophy badge + Share button (RN Share) when books_finished_this_month >= monthly_goal.
- **Milestone Sounds**: generated `assets/sounds/chime.wav` (A5–C#6–E6 chime). Watch screen plays chime (expo-audio) + success haptic alongside confetti when cheers cross a milestone.
- **Group Watch Invite**: party invite sheet lists Chatterbox groups with "Invite everyone in this group" subtitle; one tap posts the party code to the whole group via cbSend.
- **Home District buttons fixed**: `district/[slug].tsx` now renders EVERY feature as a navigable row (universal fallback: mapped route → DISTRICT_HUBS[slug] → /chatmonger/[slug]); added HOME_ACTIONS, STREAMORA_ACTIONS, LIBRARY_ACTIONS maps. No more inert pills / dropped features.
- **Sparking Dawn**: NEW `spark/[id].tsx` (profile detail with Message/Send Flirt/Send Sex Request; peach 🍑 for women, eggplant 🍆 for men), NEW `chat/[id].tsx` (message thread w/ seeded auto-replies + quick Flirt/Sex Request), NEW `likes.tsx` (Liked Profiles w/ matched/pending badges). Swipe card info button + matches items now open profile detail. Header gains a Liked Profiles button. Routes registered in _layout.
- Backend: GET /dating/profile/{id}, GET /dating/likes, GET+POST /dating/thread/{id} (dating_messages collection, seeded sparks auto-reply per kind). Verified via agent smoke (auto-replies, match, likes, gender). Lint clean, iOS bundle 1979 modules OK. Screenshots + testing-agent skipped per user request; awaiting user Preview verification.

## Real fal.ai generation (GenoTune/GenoFX/GenoGIF) + Sparking Dawn v2 (2026-06)
### Real AI generation (fal.ai)
- **GenoTune** (music): `CassetteAI/music-generator` (note the CAPITALIZED model id — lowercase hangs). **GenoFX** (sfx): `CassetteAI/sound-effects-generator`. Args {prompt, duration:int}; output `audio_file.url` (WAV). NEW backend: POST /frankenstein/audio/render + GET /frankenstein/audio/render-status/{job_id}. Generic fal job system in `fal_jobs` collection (_fal_start_job/_fal_poll_job).
- **GenoGIF**: real looping animation via existing kling model (PS_T2V_MODEL, aspect 1:1). NEW: POST /frankenstein/gif/render + status. Plays via VideoPlayer(loop) over the keyframe.
- **GenoVid (PictureShow)**: already real (kling text/image-to-video, projects render + poll) — left as-is.
- Frontend: NEW `src/components/AudioPreview.tsx` (expo-audio play/pause+progress). audio.tsx Generate now fetches concept + kicks real audio render, polls, plays. visual.tsx GenoGIF renders + shows looping video. Removed all "coming soon" placeholders. VideoPlayer gained `loop` prop. `media_url` added to FrankVaultBody/frankVaultSave.
- Verified via agent smoke: GenoFX + GenoTune produced real WAVs (HEAD 200). GenoGIF/GenoVid reuse the proven kling pipeline (not re-billed to test). FAL_KEY present.
### Sparking Dawn v2
- **Spark Filters**: discover accepts min_age/max_age + interests (loose match); index has a Filters sheet (age steppers + interest chips) with active-count badge.
- **Daily Picks**: GET /dating/daily-picks (deterministic per date+user, hashlib), horizontal row on index → profile detail.
- **Read Receipts**: dating_messages gain `seen`; thread GET marks other's msgs seen; seeded reply marks my msgs seen; chat shows Sent/Seen footer under last of my messages.
- **Unmatch/Block**: POST /dating/unmatch/{id}, POST /dating/block/{id} (dating_blocks excluded from discover + daily-picks); profile detail "…" menu offers Unmatch (if matched) + Block.
- Verified via agent smoke: daily-picks=5, age filter, block, unmatch. Lint clean; iOS bundle 1980 modules. Screenshots + testing-agent skipped per user request; awaiting Preview verification.

## Vault categories + media + Icebreakers/Voice Notes/Download/Regenerate (2026-06)
### Vault
- Added categories (frontend index + add, backend VaultItemBody/VaultUpdateBody regex): Video Game Cheats, Images, TV/Movie/Music/Video Game Recommendations, Sound Effects (Jokes/Logos/GIFs/Memes already existed).
- VaultItem gains `media_url` + `media_type` (audio|video). Vault item detail plays audio (AudioPreview) / video (VideoPlayer loop) and has a Download/Share button (expo-file-system + expo-sharing via `src/utils/mediaDownload.ts`).
- Frankenstein → Vault: visual Save now maps pic→Images, logo→Logos, gif→GIFs (+video media_url), meme→Memes; audio Save pushes music→"Music Recommendations", sfx→"Sound Effects" with audio media_url. All playable/downloadable from Vault.
### AI result actions
- Frankenstein audio + visual results now have "Download / Share" (downloadAndShare) and "Make another version" (regenerate) buttons.
### Sparking Dawn chat
- **Icebreakers**: canned witty steampunk openers shown as tappable chips when the thread is empty (fills input).
- **Voice Notes**: mic button records via expo-audio (useAudioRecorder), permission-gated w/ Open Settings fallback; uploads to object storage (POST /dating/voice-upload) and sends kind="voice" + media_url; voice bubbles play via AudioPreview. dating_messages gained media_url; kind "voice" supported; seeded sparks reply.
- Verified via agent smoke: vault media save + new categories + list; dating voice message + thread media. Lint clean; iOS bundle 1985 modules. Mic permission already in app.json. Screenshots + testing-agent skipped per user request.

## Retrospections status + Friends + BrainBoost upload + Roundtable cleanup + Vault fav/search + voice trim + watermark (2026-06)
- **Retrospections status**: added `closing_soon` status (backend RETRO_STATUS rb-4/rb-6, endpoint field). status.tsx tabs: renamed "Closures"→"Temporary Closures" + new "Closing Soon" tab.
- **Friends**: backend friend_requests collection + endpoints (GET /friends, /friends/search, POST request/accept/decline, DELETE). New `app/friends/index.tsx` (search users, incoming requests accept/ignore, friends list w/ remove). Entry card on Profile tab. Route registered.
- **BrainBoost upload courses**: POST /brainboost/courses (BBCourseBody, user_created). New `app/brainboost/new-course.tsx` (title/category/level/summary + dynamic lessons). "Upload" button on courses header. Route registered.
- **Roundtable**: removed "Site-wide discussion routing" from Roundtable district features (backend).
- **Vault**: search bar already existed; added Favorites — POST /vault/items/{id}/favorite toggle, favorites sort to top, star badge on tiles, "Pin to top/Unpin" in long-press menu. VaultItem.is_favorite.
- **Trim Voice Notes**: chat mic now stops→preview (AudioPreview) with Send / Re-record before uploading.
- **Share Sheet Art**: Frankenstein visual images now render a "⚙ Konphlux" watermark; Download/Share captures the watermarked view via captureRef (react-native-view-shot) + shareLocalUri; GIFs fall back to downloadAndShare.
- Verified via agent smoke: friends request/accept/list, bb course create+list, closing_soon=2. Lint clean; iOS bundle 1989 modules. Screenshots + testing-agent skipped per user request.

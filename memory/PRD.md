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

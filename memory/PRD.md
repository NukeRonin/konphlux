# Konphlux — Mobile App PRD

## Original Problem Statement
"Build a mobile app: I've imported my website code from this GitHub repo. Please use it as a reference to build the mobile app version." The user provided a ZIP of `konphlux` (a Vite + TanStack Router + Supabase web app generated on Lovable). Konphlux is an all-in-one social + utility ecosystem combining social networking, a marketplace, content creation, and professional services into one platform organized into 22 themed "districts".

## User Choices
- App type: social + e-commerce + content super-app.
- Backend: reuse concept; website backend NOT deployed → rebuilt a fresh FastAPI + MongoDB backend with seeded data.
- Integrations: none for now.
- Design: **match the website's look & feel** — "polished steampunk" parchment aesthetic (brass/copper/bronze/wood/parchment + glowing aether blue), Cinzel (display) + Karla (body) fonts.

## Architecture
- **Frontend**: Expo (SDK 54) + expo-router file-based routing. Bottom tabs: Feed / Districts / Bazaar / HQ. Detail routes: `district/[slug]`, `product/[id]`, modal `compose`.
  - Theme system (`src/theme`): light "parchment" (default) + dark "lamplight" modes, persisted via `@/src/utils/storage`.
  - Custom fonts (Cinzel + Karla) loaded via expo-font from `assets/fonts`.
  - Reusable components: Panel, BrassText (masked gradient), Eyebrow, Hairline, ForgeButton, AvatarInitials/RingAvatar, Gear (animated), ChatmongerCard, AppHeader, States (Loading/Empty/Error).
  - Keyboard handled via react-native-keyboard-controller (compose modal).
- **Backend** (`server.py`): FastAPI, MongoDB (motor). Seeds 22 districts, 6 feed posts, 8 bazaar listings on startup (if empty). All routes under `/api`, `_id` excluded.

## Core Requirements (static)
1. Faithfully match the steampunk parchment visual identity of the website.
2. Social feed with stories, composer, reactions.
3. Directory of all 22 districts + district detail (features + chatmonger).
4. Bazaar marketplace with categories + product detail.
5. Profile / HQ with Konphlux ID, treasury balance, settings, dark mode.

## Implemented (2026-06)
- ✅ FastAPI backend: `/api/districts`, `/api/districts/{slug}`, `/api/feed` (GET/POST), `/api/feed/{id}/like`, `/api/bazaar`, `/api/bazaar/{id}`, `/api/profile`.
- ✅ Feed screen: stories row, composer trigger, trending, post cards, optimistic like toggle, pull-to-refresh.
- ✅ Compose modal: create post with keyboard-aware input + sticky footer.
- ✅ Districts grid (22) with brass icon plates → district detail (brass-text hero, animated gears, features grid, glowing Chatmonger card, nearby districts).
- ✅ Bazaar: horizontal category chip filter + 2-col product grid → product detail with add-to-cart.
- ✅ HQ/Profile: Konphlux ID card (rivets), treasury balance, Lamplight dark-mode toggle, 4 settings menu groups.
- ✅ Light + dark themes; Cinzel/Karla fonts; all interactive elements have testIDs.
- ✅ Tested: 12/12 backend pytest + full Playwright frontend flow PASS.

## Backlog (prioritized)
### P1
- Real content per district (e.g. Answerfier Q&A board, Roundtable threads, Telegraph articles).
- Cart + checkout flow in Bazaar (currently add-to-cart is a stub).
- "Chatmonger" AI assistant chat (would require an LLM integration).
### P2
- Real authentication (Konphlux ID sign-in) — website used Supabase auth + Stripe.
- Messaging (Chatterbox) and Notifications inboxes.
- Sparking Dawn (dating), Waypoint (stays), Dreambacker (crowdfunding) functional flows.
- Image upload for posts/listings (needs object storage).

## Next Tasks
- Await user direction on which district(s) to make fully functional first, or auth/payments.

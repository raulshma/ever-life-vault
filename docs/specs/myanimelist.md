### MyAnimeList (MAL) Integration — Product and Technical Spec

#### Summary
Surface anime activity and discovery: latest watched episodes, seasonal/new releases, and recommendations. Use MAL API v2 with OAuth2 (PKCE) for user‑scoped data; persist normalized data in Supabase and expose ergonomic UI widgets. Fits our TypeScript server and Supabase client stack [[memory:5710713]] [[memory:5776629]].

Progress:
- [x] Env + server routes scaffold (`/api/mal/*`)
- [x] Supabase tables and RLS
- [x] Link + sync + profile/recent/seasonal endpoints
- [x] Frontend hook `useMAL`
- [ ] UI widgets (profile, recent, seasonal, recs)

---

### Goals
- **Latest watched**: show recent episode progress across series.
- **Latest launched**: showcase currently airing and newly started seasonal titles.
- **Recommendations**: personalized anime suggestions per user.
- **Profile snapshot**: username, avatar, anime stats (mean score, days watched).

### Non‑Goals (initial)
- Manga support.
- Forum/social features.

---

### User Stories
- As a user, I can link my MAL account and immediately see my profile and stats.
- As a user, I can view my most recently watched anime with episode numbers and timestamps.
- As a user, I can browse currently airing and newly launched seasonal anime.
- As a user, I receive recommendations tailored to my history and preferences.

---

### Data Sources and APIs (MAL v2)
- **Auth**: OAuth2 with PKCE. Store refresh + access tokens server‑side, encrypted. Request scopes for list read/write if needed.
- **Endpoints** (official MAL v2):
  - `GET /v2/users/@me` (fields: `anime_statistics`, `name`, `picture`).
  - `GET /v2/users/@me/animelist?status=watching|completed|on_hold|dropped|plan_to_watch&nsfw=true|false&limit=...&fields=list_status{score,updated_at,priority,comments}`.
  - `GET /v2/users/{username}/history?type=anime&limit=...` for latest watched episodes (use stored MAL username or `@me` if supported).
  - `GET /v2/anime/ranking?ranking_type=airing|upcoming|bypopularity|favorite&limit=...` (latest/airing/upcoming lenses).
  - `GET /v2/anime/season/{year}/{season}?limit=...&sort=anime_num_list_users` for seasonal/now launched. Compute current `{year,season}` from server clock.
  - `GET /v2/anime/suggestions?limit=...` (authenticated user suggestions, if available for the account).

Fallbacks:
- If suggestions/history are unavailable or rate limited, optionally use Jikan for public discovery lists. Mark data provenance.

---

### Integration Points in Codebase
- Server routes: `server/routes/mal.ts` implemented (v0: link, callback, sync, profile, recent, seasonal) and registered in `server/index.ts`.
- Env: `MAL_CLIENT_ID`, `MAL_REDIRECT_URI`, optional `MAL_TOKENS_SECRET` added in `server/config/env.ts`.
- Client hook: `src/hooks/useMAL.ts` implemented (startLink, sync, getProfile, getRecent, getSeasonal).
- Widgets: `MAL*` UI pending.
- Use `src/integrations/supabase/configStore.ts` for user‑level integration state [[memory:5776629]].

---

### Supabase Data Model

Implemented via migration: `supabase/migrations/20250813120000_create_mal_tables.sql`.

---

### Server Endpoints
- [x] **POST** `/api/mal/link/start` → begin OAuth2 (PKCE); returns auth URL.
- [x] **GET** `/api/mal/link/callback` → token exchange; upsert profile; store encrypted tokens if configured; redirect.
- [x] **POST** `/api/mal/sync` → on‑demand sync (30m cooldown): refresh profile timestamp and pull latest watch history (stores in `mal_watch_history`, catalogs titles in `mal_anime`).
- [x] **GET** `/api/mal/profile` → MAL profile snapshot from DB.
- [x] **GET** `/api/mal/recent` → latest watched episodes from DB, joined with titles.
- [x] **GET** `/api/mal/seasonal` → current seasonal lineup (upserts `mal_anime` with basic info).
- [ ] **GET** `/api/mal/recommendations` → pending (v1).

Example (recent item):

```json
{
  "mal_id": 5114,
  "title": "Fullmetal Alchemist: Brotherhood",
  "episode": 23,
  "watched_at": "2025-08-10T19:22:34Z",
  "main_picture": { "medium": "https://..." }
}
```

---

### Sync Job Design
- v0: `users/@me` at link time; `users/{username}/history?type=anime` on sync; seasonal fetch; lightweight `mal_anime` catalog.
- v1: add `users/@me/animelist` ingestion and `anime/suggestions`; compute heuristic recommendations.
- Respect rate limits; use short cooldowns and server‑side caching where possible.

---

### Recommendation Heuristic (v1)
- Base pool: `plan_to_watch` and related shows from studios/genres the user watches.
- Signals:
  - Genre affinity (cosine similarity of user genre vector vs title genres).
  - Popularity prior (popularity rank, mean score with Bayesian shrinkage).
  - Recency: airing now or in last two seasons.
  - Continuations: sequels/prequels of completed shows.
- Output `r_score ∈ [0,1]`; expose top 10–20 with reason strings.

---

### UI/UX
- Widgets: `MALProfileCard`, `MALRecentlyWatched`, `MALSeasonalNow`, `MALRecommendations`.
- Status: pending. Hook available via `useMAL()`.

---

### Security, Privacy, and Rate Limits
- Store tokens encrypted, rotate refresh on schedule, and allow unlink with data purge.
- All tables RLS‑scoped to `auth.uid()`.
- Cooldown syncs (e.g., 1 per 30 min user‑initiated; background daily).
- Cache seasonal/ranking (24h) server‑side; per‑user lists/history short‑cache (5–10 min) with revalidation.

---

### Acceptance Criteria
- [x] Link flow completes with PKCE and stores profile in DB.
- [x] Recent watched: sync captures latest events into `mal_watch_history` (tested via API shape).
- [x] Seasonal view: endpoint returns current items; basic catalog upsert.
- [ ] Recommendations endpoint returns stable ordering; UI shows reason chips.

---

### Rollout Plan
- v0 [current]: profile + recent watched (history), seasonal now.
- v1: recommendations (heuristic + MAL suggestions if available) + list ingestion.
- v2: write‑back list updates (mark next episode watched) after scope approval.

---

### Open Questions
- Should we allow write‑back (update animelist entries) in‑app? Requires additional scopes and UX.
- How to handle NSFW and region filters by default? Per‑user setting with safe default.
- Should we blend Jikan discovery data as a fallback if MAL rate limits are hit?

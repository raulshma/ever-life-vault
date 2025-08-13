### Steam Games Integration — Product and Technical Spec

#### Summary
Bring Steam data into the vault: profile stats, library, recently played, per-game stats/achievements, and a smart "games to play" backlog surface. Uses Steam OpenID for identity linking and Steam Web API for data. Server runs in TypeScript and data persists in Supabase [[memory:5710713]] [[memory:5776629]].

Progress:
- [x] Env + server routes scaffold
- [x] Supabase tables and RLS
- [x] Link + sync + profile/library/recent/suggestions endpoints
- [x] Frontend hook `useSteam`
- [ ] UI widgets (profile, recent, backlog, detail)

---

### Goals
- **Profile stats**: persona name, avatar, profile state, country, Steam level (if available).
- **Games library**: owned games with playtime stats and artwork.
- **Recently played**: last two weeks, last played timestamp.
- **Per-game stats**: achievements and user stats (where supported).
- **Games to play**: backlog recommendations from owned titles (unplayed/underplayed, recency, popularity).

### Non‑Goals (initial)
- **Wishlist**: No official API; treat as best‑effort optional later.
- **Purchases/transactions**: Out of scope.

---

### User Stories
- As a user, I can link my Steam account and see my profile and avatar in my dashboard.
- As a user, I can browse my owned games with filters and sort by playtime, name, last played.
- As a user, I can view recently played games and jump back in.
- As a user, I can open a game detail to see achievements and key stats.
- As a user, I get a "games to play" list tailored to my backlog.

---

### Data Sources and APIs
- **Identity linking**: Steam OpenID 2.0 (retrieve 64‑bit `steamid`).
  - Flow: user clicks Connect ➜ OpenID sign‑in ➜ callback returns claimed `steamid` ➜ store mapping.
  - Reference: Steam OpenID docs (see Steam dev portal).
- **Steam Web API** (server‑side with API key in `server/config/env.ts`):
  - `ISteamUser/ResolveVanityURL` (optional; vanity → `steamid`).
  - `ISteamUser/GetPlayerSummaries` (profile summary).
  - `IPlayerService/GetOwnedGames` (library + playtime; include_appinfo).
  - `IPlayerService/GetRecentlyPlayedGames` (recent playtime).
  - `ISteamUserStats/GetPlayerAchievements` (per‑game achievements).
  - `ISteamUserStats/GetUserStatsForGame` (per‑game stats, when available).
  - `IPlayerService/GetBadges` (optional: level/xp).
- **Steam Storefront (public) for app metadata**:
  - `store.steampowered.com/api/appdetails?appids=<id>` (titles, genres, header images, metascore when available).
  - Cache results aggressively (rarely change).

Notes:
- Private profiles will limit some endpoints; handle gracefully and show guidance to user.
- Wishlist is not available via official Web API; avoid scraping for now.

---

### Integration Points in Codebase
- [x] Server routes: add `server/routes/steam.ts` for REST endpoints.
- [x] Env: `server/config/env.ts` add `STEAM_WEB_API_KEY`.
- [x] Client hook: `src/hooks/useSteam.ts` consuming our server endpoints.
- [x] Widgets: `src/features/dashboard-widgets/widgets/Steam*.tsx` entries and register in `src/features/dashboard-widgets/registry.tsx`.
- [x] Supabase config store: leverage `src/integrations/supabase/configStore.ts` for per‑user linkage metadata [[memory:5776629]].

---

### Supabase Data Model (proposed)

```sql
-- steam_accounts
create table if not exists steam_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steamid64 text not null unique,
  persona_name text,
  avatar_url text,
  profile_visibility text,
  country text,
  steam_level int,
  linked_at timestamptz not null default now(),
  synced_at timestamptz
);
create index on steam_accounts(user_id);

-- steam_games (static per appid; upsert from Storefront API)
create table if not exists steam_games (
  appid int primary key,
  name text,
  header_image text,
  genres jsonb,
  metascore int,
  is_free boolean,
  updated_at timestamptz not null default now()
);

-- steam_ownership (per user per game)
create table if not exists steam_ownership (
  user_id uuid not null references auth.users(id) on delete cascade,
  appid int not null references steam_games(appid) on delete cascade,
  playtime_forever_minutes int not null default 0,
  playtime_2weeks_minutes int not null default 0,
  last_played_at timestamptz,
  primary key (user_id, appid)
);
create index on steam_ownership(user_id);
create index on steam_ownership(last_played_at);

-- steam_achievements
create table if not exists steam_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  appid int not null,
  apiname text not null,
  achieved boolean not null,
  unlocktime timestamptz,
  primary key (user_id, appid, apiname)
);
create index on steam_achievements(user_id);

-- steam_game_stats
create table if not exists steam_game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  appid int not null,
  stat_name text not null,
  stat_value double precision not null,
  primary key (user_id, appid, stat_name)
);

-- RLS
alter table steam_accounts enable row level security;
create policy "own account" on steam_accounts for all using (user_id = auth.uid());
alter table steam_ownership enable row level security;
create policy "own ownership" on steam_ownership for all using (user_id = auth.uid());
alter table steam_achievements enable row level security;
create policy "own ach" on steam_achievements for all using (user_id = auth.uid());
alter table steam_game_stats enable row level security;
create policy "own stats" on steam_game_stats for all using (user_id = auth.uid());
```

---

### Server Endpoints (proposed)
- [x] **POST** `/api/steam/link/start` → initiate OpenID login.
- [x] **GET** `/api/steam/link/callback` → finalize link, store `steamid64`.
- [x] **POST** `/api/steam/sync` → sync profile + library now; returns `{ ok, count }`.
- [x] **GET** `/api/steam/profile` → profile from DB.
- [x] **GET** `/api/steam/library` → paginated owned games, sortable/filterable.
- [x] **GET** `/api/steam/recent` → recently played from DB.
- [x] **GET** `/api/steam/game/:appid` → game + user stats/achievements (achievements TBD).
- [x] **GET** `/api/steam/suggestions` → computed backlog suggestions (v0 heuristic).

Response example (library item):

```json
{
  "appid": 570,
  "name": "Dota 2",
  "header_image": "https://...",
  "genres": ["Action", "Strategy"],
  "playtime_forever_minutes": 12345,
  "playtime_2weeks_minutes": 120,
  "last_played_at": "2025-08-01T12:00:00Z"
}
```

---

### Sync Job Design
- [x] Fetch `GetPlayerSummaries`, `GetOwnedGames` (with `include_appinfo=true`, `include_played_free_games=true`).
- [x] Fetch `GetRecentlyPlayedGames` to enrich recency.
- [ ] Fetch achievements/user stats for top titles and persist.
- [ ] Upsert `steam_games` from Storefront `appdetails` in batches (genres, metascore).
- [x] Derive `last_played_at` from `rtime_last_played` where available.
- [x] Mark `synced_at` on `steam_accounts`.
- [x] Handle basic errors; [ ] add retry/backoff.

---

### "Games to Play" Algorithm (v1)
- **Base candidates**: owned games where `playtime_forever_minutes = 0` or `< 120`.
- **Recency boost**: recently acquired titles (first seen in ownership within last 90 days).
- **Popularity boost**: high metascore (>80) or high concurrent player count (if obtainable via Storefront; otherwise skip).
- **Staleness boost**: not played in > 6 months.
- **Penalty**: already heavily played, or multiplayer‑only if user tends to play single‑player (optional toggle).
- Output a score `p_score ∈ [0,1]` with weights configurable per user. Expose top 10.

---

### UI/UX
- [ ] Widgets: `SteamProfileCard`, `SteamRecentlyPlayed`, `SteamBacklog`, `SteamGameDetailModal`.
- [ ] Listing: virtualized grid/list, sort by name/playtime/last played; filters (installed, unplayed, <2h, genre).
- [ ] Empty states for private/no data; CTA to adjust Steam privacy or re‑sync.

---

### Security, Privacy, and Rate Limits
- [x] Keep API key server‑side only. Do not expose `steamid` until the user has linked.
- [x] Store minimum necessary PII. All rows RLS‑scoped to `auth.uid()`.
- [x] Throttle sync per user (once per 6 hours). Manual re‑sync returns 429 with retryAfter.
- [ ] Honor `Retry-After`. Cache Storefront lookups for 7 days.

---

### Acceptance Criteria
- [x] Link flow stores `steamid64` and redirects.
- [x] Library endpoint returns data with sorting and pagination.
- [x] Recent endpoint returns enriched playtime_2weeks; empty state handled by widget.
- [ ] Game detail shows achievements summary where available.
- [x] Suggestions endpoint returns deterministic results (v0).

---

### Rollout Plan
- [x] v0: manual sync; basic profile+library; suggestions v0.
- [ ] v1: achievements/stats for top titles; suggestions v1.
- [ ] v2: richer heuristics, optional friends overlay.

---

### Open Questions
- Do we want to fetch Steam level via `GetBadges`? Adds an extra call.
- Include friends’ trending games for suggestions? Requires `GetFriendList` and more calls.
- Should we support wishlists later via best‑effort scraping or user‑provided CSV?

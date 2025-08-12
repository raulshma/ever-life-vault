Environment

Create `server/.env` with values like:

```
PORT=8787
HOST=0.0.0.0
JELLYSEERR_BASE=http://192.168.1.10:5055
JELLYFIN_BASE=http://192.168.1.20:8096
KARAKEEP_BASE=http://192.168.1.30:3000/api/v1
ALLOWED_ORIGINS=http://localhost:8080
ALLOWED_TARGET_HOSTS=www.reddit.com,oauth.reddit.com,www.googleapis.com,oauth2.googleapis.com,accounts.google.com,login.microsoftonline.com,graph.microsoft.com,api.twitter.com,graph.facebook.com,api.instagram.com,api.spotify.com,accounts.spotify.com,www.youtube.com,music.youtube.com

# Supabase (for authenticating aggregator endpoints)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...

# OAuth redirect back to the frontend (Feeds page)
OAUTH_REDIRECT_BASE_URL=http://localhost:5173
OAUTH_REDIRECT_PATH=/feeds

# Reddit OAuth
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_REDIRECT_URI=http://localhost:8787/integrations/oauth/callback/reddit

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8787/integrations/oauth/callback/google

# Microsoft OAuth (Outlook)
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_REDIRECT_URI=http://localhost:8787/integrations/oauth/callback/microsoft

# YouTube (YouTube Data API)
YT_CLIENT_ID=...
YT_CLIENT_SECRET=...
YT_REDIRECT_URI=http://localhost:8787/integrations/oauth/callback/youtube

# YouTube Music (uses YouTube Data API scope)
YTM_CLIENT_ID=...
YTM_CLIENT_SECRET=...
YTM_REDIRECT_URI=http://localhost:8787/integrations/oauth/callback/youtubemusic

# Spotify OAuth
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:8787/integrations/oauth/callback/spotify

# Steam Web API
STEAM_WEB_API_KEY=...
```

Install dev dependency (first run only):

```
pnpm add -D tsx
```

Start the proxy (TypeScript):

```
pnpm proxy
```


Routes

- `/agp?url=...` Authenticated dynamic proxy for integrations; requires `Authorization: Bearer <supabase_access_token>`.
  You can optionally pass `X-Target-Authorization: Bearer <provider-token>` to forward specific provider tokens.
- `/dyn?url=...` Unauthenticated dynamic proxy (use only for public resources like RSS URLs if allowed by `ALLOWED_TARGET_HOSTS`).
- `/integrations/oauth/start?provider=<reddit|google|microsoft|youtube|youtubemusic|spotify>` Initiate OAuth; returns `{ url }` to redirect the user.
- `/integrations/oauth/callback/:provider` OAuth redirect target configured in provider apps.
- `/integrations/oauth/handoff?id=<handoffId>` Exchange ephemeral handoff ID for tokens; requires Supabase auth.
- `/integrations/oauth/refresh` Refresh tokens server-side; body `{ provider, refresh_token }`; requires Supabase auth.
 - `/aggregations/reddit?sub_limit=10&posts_per_sub=5` Fetch top reddit posts for subscribed subreddits using forwarded token.
 - `/aggregations/twitter?limit=20` Fetch recent tweets for the authenticated user.
 - `/aggregations/facebook?limit=20` Fetch recent Facebook feed items for the authenticated user.
 - `/aggregations/instagram?limit=20` Fetch recent Instagram media for the authenticated user.
 - `/aggregations/gmail?limit=25` Fetch unread Gmail messages metadata.
 - `/aggregations/outlook?limit=25` Fetch unread Outlook messages metadata.

Security

- Set `ALLOWED_TARGET_HOSTS` to restrict where `/agp` and `/dyn` can proxy.
- Never store tokens in plaintext; use the app's encrypted vault to persist them client-side.
- For RSS, either leave `ALLOWED_TARGET_HOSTS` empty (allow all), or add the feed hostnames you want to permit.


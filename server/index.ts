import Fastify, { FastifyInstance } from 'fastify'
import ClokiDefault from '@miketako3/cloki'
import { env } from './config/env.js'
import { registerCors } from './plugins/cors.js'
import { registerServiceProxies } from './plugins/proxies.js'
import { registerPerfPlugins } from './plugins/perf.js'
import { makeIsTargetAllowed } from './utils/allowedTargets.js'
import { createSupabaseClient, requireSupabaseUserFactory } from './auth/supabase.js'
import { registerDynRoute } from './routes/dyn.js'
import { registerAgpRoute } from './routes/agp.js'
import { registerIntegrationRoutes } from './routes/integrations.js'
import { registerLiveShareRoutes } from './routes/live-share.js'
import { registerSteamRoutes } from './routes/steam.js'
import { registerMALRoutes } from './routes/mal.js'
import { registerClipRoutes } from './routes/clips.js'
import { registerInfrastructureRoutes } from './routes/infrastructure.js'

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: true })

  // Configure Grafana Loki logger (non-blocking). Falls back silently if not configured.
  let loki: any | null = null
  try {
    if (env.GRAFANA_LOKI_ENABLED && env.GRAFANA_ACCESS_POLICY_TOKEN && env.GRAFANA_LOKI_HOST && env.GRAFANA_LOKI_USER) {
      // The package exports default in v0.1.x
      const Cloki = (ClokiDefault as any)?.default || ClokiDefault
      loki = new Cloki({
        lokiHost: env.GRAFANA_LOKI_HOST,
        lokiUser: env.GRAFANA_LOKI_USER,
        lokiToken: env.GRAFANA_ACCESS_POLICY_TOKEN,
        defaultLabels: { app: 'ever-life-vault', service: 'server', env: process.env.NODE_ENV || 'development' },
      } as any)
      // Test a startup log
      void loki.info({ message: 'server_start', port: env.PORT, host: env.HOST })
    }
  } catch (e) {
    server.log.warn({ err: e }, 'Failed to initialize Grafana Loki logging')
  }

  // Attach a tiny helper to server instance for route handlers
  ;(server as any).loki = loki

  await registerCors(server, env.ALLOWED_ORIGINS)
  await registerPerfPlugins(server)

  const targets: Record<string, string | undefined> = {
    jellyseerr: env.JELLYSEERR_BASE,
    jellyfin: env.JELLYFIN_BASE,
    karakeep: env.KARAKEEP_BASE,
  }
  await registerServiceProxies(server, targets)

  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  if (!supabase) {
    server.log.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set. Authenticated routes will be disabled.')
  }
  const requireSupabaseUser = requireSupabaseUserFactory(supabase, server.log)

  const isTargetAllowed = makeIsTargetAllowed(env.ALLOWED_TARGET_HOSTS)
  if (env.ALLOWED_TARGET_HOSTS.length === 0 && process.env.NODE_ENV === 'production') {
    server.log.error('ALLOWED_TARGET_HOSTS must be non-empty in production.')
    process.exit(1)
  }

  registerAgpRoute(server, isTargetAllowed, requireSupabaseUser, env.ALLOW_UNAUTH_AGP)
  registerDynRoute(server, isTargetAllowed)
  registerIntegrationRoutes(server, {
    requireSupabaseUser,
    OAUTH_REDIRECT_BASE_URL: env.OAUTH_REDIRECT_BASE_URL,
    OAUTH_REDIRECT_PATH: env.OAUTH_REDIRECT_PATH,
    REDDIT_CLIENT_ID: env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: env.REDDIT_CLIENT_SECRET,
    REDDIT_REDIRECT_URI: env.REDDIT_REDIRECT_URI,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
    MS_CLIENT_ID: env.MS_CLIENT_ID,
    MS_CLIENT_SECRET: env.MS_CLIENT_SECRET,
    MS_REDIRECT_URI: env.MS_REDIRECT_URI,
    YT_CLIENT_ID: env.YT_CLIENT_ID,
    YT_CLIENT_SECRET: env.YT_CLIENT_SECRET,
    YT_REDIRECT_URI: env.YT_REDIRECT_URI,
    YTM_CLIENT_ID: env.YTM_CLIENT_ID,
    YTM_CLIENT_SECRET: env.YTM_CLIENT_SECRET,
    YTM_REDIRECT_URI: env.YTM_REDIRECT_URI,
    SPOTIFY_CLIENT_ID: env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI: env.SPOTIFY_REDIRECT_URI,
  })

  // Live Share private API (requires supabase auth token for host actions)
  registerLiveShareRoutes(server, {
    requireSupabaseUser,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  })

  // Steam integration routes
  registerSteamRoutes(server, {
    requireSupabaseUser,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    STEAM_WEB_API_KEY: env.STEAM_WEB_API_KEY,
    OAUTH_REDIRECT_BASE_URL: env.OAUTH_REDIRECT_BASE_URL,
    OAUTH_REDIRECT_PATH: env.OAUTH_REDIRECT_PATH,
  })

  // MyAnimeList integration routes (v0)
  registerMALRoutes(server, {
    requireSupabaseUser,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    OAUTH_REDIRECT_BASE_URL: env.OAUTH_REDIRECT_BASE_URL,
    OAUTH_REDIRECT_PATH: env.OAUTH_REDIRECT_PATH,
    MAL_CLIENT_ID: env.MAL_CLIENT_ID,
    MAL_REDIRECT_URI: env.MAL_REDIRECT_URI,
    MAL_TOKENS_SECRET: env.MAL_TOKENS_SECRET,
  })

  // Clips (cl1p-like) routes (minimal helper; primary operations via Supabase RPCs)
  registerClipRoutes(server)

  // Infrastructure management routes
  registerInfrastructureRoutes(server, {
    requireSupabaseUser,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  })

  server.get('/', async () => ({
    ok: true,
    routes: Object.fromEntries(
      Object.entries(targets)
        .filter(([_, v]) => !!v)
        .map(([k, v]) => [k, { prefix: `/${k}`, upstream: v }])
    ),
    oauth: {
      reddit: !!(env.REDDIT_CLIENT_ID && env.REDDIT_REDIRECT_URI),
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_REDIRECT_URI),
      microsoft: !!(env.MS_CLIENT_ID && env.MS_REDIRECT_URI),
    },
  }))

  return server
}

if (process.env.NODE_ENV !== 'test') {
  const port = env.PORT
  const host = env.HOST
  buildServer()
    .then(async (server) => {
      try {
        const addr = await server.listen({ port, host })
        server.log.info(`Proxy server listening on ${addr}`)
      } catch (err) {
        server.log.error(err)
        process.exit(1)
      }
    })
    .catch((err) => {
      // Log error building server
      console.error(err)
      process.exit(1)
    })
}



import Fastify, { FastifyInstance } from 'fastify'
// @ts-ignore - types are provided via local shims
import fastifyWebsocket from '@fastify/websocket'
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
import { registerRepoFlattenRoutes } from './routes/repo-flatten.js'
import { registerLLMRoutes } from './routes/llm.js'
import cron from 'node-cron'
import { getLLMDataService } from './routes/llm.js'
import authRoutes from './routes/auth.js'
import { registerSshRoutes } from './routes/ssh.js'
import { registerReceiptRoutes } from './routes/receipts.js'
import { registerApiKeyRoutes } from './routes/api-keys.js'

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: true })

  await registerCors(server, env.ALLOWED_ORIGINS)
  await registerPerfPlugins(server)

  // Register WebSocket plugin globally (needed for SSH routes)
  await server.register(fastifyWebsocket as any)
  server.log.info('WebSocket plugin registered globally')

  // Register auth routes (including Turnstile verification)
  if (env.TURNSTILE_SECRET_KEY) {
    await server.register(authRoutes, { prefix: '/auth' })
    server.log.info('Turnstile auth routes registered')
  } else {
    server.log.warn('TURNSTILE_SECRET_KEY not set. Turnstile verification will be disabled.')
  }

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

  // Admin Supabase client (service role) for server-side writes (RLS bypass where appropriate)
  const supabaseAdmin = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  if (!supabaseAdmin) {
    server.log.warn('SUPABASE_SERVICE_ROLE_KEY not set. LLM cache writes may fail due to RLS.')
  }

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

  // Repository flattening routes
  registerRepoFlattenRoutes(server)

  // SSH/WebTerminal routes (authenticated over Supabase JWT)
  registerSshRoutes(server, { requireSupabaseUser })

  // Secure API key management routes
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    registerApiKeyRoutes(server, {
      requireSupabaseUser,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      GOOGLE_API_KEY: env.GOOGLE_API_KEY,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    })
    server.log.info('Secure API key management routes registered')
  } else {
    server.log.warn('Skipping API key routes: SUPABASE_URL or SUPABASE_ANON_KEY not configured')
  }

  // Receipt management routes with AI analysis
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    registerReceiptRoutes(server, {
      requireSupabaseUser,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      GOOGLE_API_KEY: env.GOOGLE_API_KEY,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    })
    server.log.info('Receipt management routes registered with AI provider support')
  } else {
    server.log.warn('Skipping receipt routes: SUPABASE_URL or SUPABASE_ANON_KEY not configured')
  }

  // RSS proxy route to avoid CORS issues (always available)
  server.get('/rss-proxy', async (request, reply) => {
    try {
      const { url } = request.query as { url?: string }

      // Basic URL validation
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return reply.status(400).send({ error: 'Invalid URL scheme' })
      }

      // Additional URL validation
      try {
        new URL(url)
      } catch {
        return reply.status(400).send({ error: 'Invalid URL format' })
      }

      // Fetch the RSS feed
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ever-Life-Vault/1.0 (RSS-Proxy)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      })

      if (!response.ok) {
        return reply.status(response.status).send({
          error: `Failed to fetch RSS feed: ${response.statusText}`
        })
      }

      const contentType = response.headers.get('content-type') || ''
      const content = await response.text()

      // Set appropriate headers
      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=300') // Cache for 5 minutes
      reply.header('Access-Control-Allow-Origin', '*')
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
      reply.header('Access-Control-Allow-Headers', 'Content-Type')

      return reply.send(content)
    } catch (error: unknown) {
      server.log.error({ err: error, url: (request.query as { url?: string })?.url }, 'RSS proxy error')
      return reply.status(500).send({
        error: 'Failed to fetch RSS feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Infrastructure management routes
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    registerInfrastructureRoutes(server, {
      requireSupabaseUser,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    })
  } else {
    server.log.warn('Skipping infrastructure routes: SUPABASE_URL or SUPABASE_ANON_KEY not configured')
  }

  // LLM models routes
  if (supabase && env.OPENROUTER_API_KEY) {
    registerLLMRoutes(server, {
      requireSupabaseUser,
      supabase: (supabaseAdmin || supabase)!,
      openRouterApiKey: env.OPENROUTER_API_KEY,
      modelsCacheTtlMs: env.LLM_MODELS_CACHE_TTL_MS,
      autoRefreshIntervalMs: 0,
      httpCacheSeconds: env.LLM_MODELS_HTTP_CACHE_SECONDS,
    })
    server.log.info('LLM routes registered with OpenRouter integration')
  } else if (supabase) {
    server.log.warn('LLM routes registered without OpenRouter integration (OPENROUTER_API_KEY not set)')
    registerLLMRoutes(server, {
      requireSupabaseUser,
      supabase: (supabaseAdmin || supabase)!,
      modelsCacheTtlMs: env.LLM_MODELS_CACHE_TTL_MS,
      autoRefreshIntervalMs: 0,
      httpCacheSeconds: env.LLM_MODELS_HTTP_CACHE_SECONDS,
    })
  } else {
    server.log.warn('Skipping LLM routes: Supabase not configured')
  }

  // Health check endpoint
  server.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  }))

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

        // Schedule background refresh of LLM models using cron
        if (env.LLM_MODELS_REFRESH_CRON) {
          try {
            cron.schedule(env.LLM_MODELS_REFRESH_CRON, async () => {
              const svc = getLLMDataService()
              if (!svc) return
              server.log.info('CRON: refreshing LLM models')
              try {
                await svc.refreshAll()
                server.log.info('CRON: refreshed LLM models successfully')
              } catch (e) {
                server.log.error({ err: e }, 'CRON: error refreshing LLM models')
              }
            }, { timezone: 'UTC' })
            server.log.info({ cron: env.LLM_MODELS_REFRESH_CRON }, 'LLM models refresh cron scheduled')
          } catch (e) {
            server.log.error({ err: e }, 'Failed to schedule LLM models refresh cron')
          }
        }
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



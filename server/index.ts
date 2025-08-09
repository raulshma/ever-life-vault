import Fastify, { FastifyInstance } from 'fastify'
import { env } from './config/env.js'
import { registerCors } from './plugins/cors.js'
import { registerServiceProxies } from './plugins/proxies.js'
import { makeIsTargetAllowed } from './utils/allowedTargets.js'
import { createSupabaseClient, requireSupabaseUserFactory } from './auth/supabase.js'
import { registerDynRoute } from './routes/dyn.js'
import { registerAgpRoute } from './routes/agp.js'
import { registerIntegrationRoutes } from './routes/integrations.js'

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: true })

  await registerCors(server, env.ALLOWED_ORIGINS)

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

  registerAgpRoute(server, isTargetAllowed, requireSupabaseUser)
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



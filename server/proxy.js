import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHttpProxy from '@fastify/http-proxy'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { Readable } from 'node:stream'

const envPath = fileURLToPath(new URL('./.env', import.meta.url))
dotenv.config({ path: envPath })

const server = Fastify({ logger: true })

// Basic CORS to allow the Vite dev server and same-origin requests
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Read target mappings from env. Minimal examples:
// JELLYSEERR_BASE=http://server:5055
// JELLYFIN_BASE=http://server:8096
// KARAKEEP_BASE=http://server:3000/api/v1
const targets = {
  jellyseerr: process.env.JELLYSEERR_BASE,
  jellyfin: process.env.JELLYFIN_BASE,
  karakeep: process.env.KARAKEEP_BASE,
}

function ensureTarget(name) {
  const url = targets[name]
  if (!url) {
    throw new Error(`Missing environment for ${name.toUpperCase()}_BASE`)
  }
  return url.replace(/\/$/, '')
}

// Register routes and plugins inside an async IIFE so we can await plugin registration
;(async () => {
  await server.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return cb(null, true)
      }
      if (/localhost:\d+$/.test(origin) || /^https?:\/\/(127\.0\.0\.1|\[::1\]):\d+$/.test(origin)) {
        return cb(null, true)
      }
      cb(null, false)
    },
    credentials: true,
  })

  // Generic pass-through: /<service>/* → target
  for (const service of Object.keys(targets)) {
    if (!targets[service]) continue
    await server.register(fastifyHttpProxy, {
      upstream: ensureTarget(service),
      prefix: `/${service}`,
      rewritePrefix: '',
      http2: false,
      undici: { requestTimeout: 30_000 },
    })
  }

  // Dynamic proxy: forward to any allowed absolute URL supplied via query param
  server.all('/dyn', async (request, reply) => {
    const { url: targetUrl } = request.query || {}
    if (!targetUrl || typeof targetUrl !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' })
    }
    if (!isTargetAllowed(targetUrl)) {
      return reply.code(403).send({ error: 'Target not allowed' })
    }

    // Build headers excluding hop-by-hop and browser-specific ones
    const incomingHeaders = request.headers
    const forwardHeaders = {}
    for (const [key, value] of Object.entries(incomingHeaders)) {
      const k = key.toLowerCase()
      if (['host', 'content-length', 'connection', 'origin', 'referer'].includes(k)) continue
      forwardHeaders[k] = value
    }

    // Prepare body if present
    let body
    const method = request.method.toUpperCase()
    if (!['GET', 'HEAD'].includes(method)) {
      const ct = (incomingHeaders['content-type'] || incomingHeaders['Content-Type'] || '').toString()
      if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
        body = request.body
      } else if (request.body && typeof request.body === 'object') {
        // If JSON-like, stringify and ensure content-type
        if (!ct) {
          forwardHeaders['content-type'] = 'application/json'
        }
        body = JSON.stringify(request.body)
      }
    }

    const res = await fetch(targetUrl, { method, headers: forwardHeaders, body })

    // Forward selected headers
    for (const [hk, hv] of res.headers) {
      if (['content-type', 'set-cookie', 'cache-control', 'etag', 'last-modified'].includes(hk.toLowerCase())) {
        reply.header(hk, hv)
      }
    }
    reply.code(res.status)

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const text = await res.text()
      return reply.send(text)
    }
    if (res.body) {
      return reply.send(Readable.fromWeb(res.body))
    }
    return reply.send()
  })

  // Fallback route to show configured routes
  server.get('/', async () => ({
    ok: true,
    routes: Object.fromEntries(
      Object.entries(targets)
        .filter(([_, v]) => !!v)
        .map(([k, v]) => [k, { prefix: `/${k}`, upstream: v }])
    ),
  }))

  const port = Number(process.env.PORT || 8787)
  const host = process.env.HOST || '0.0.0.0'

  try {
    const addr = await server.listen({ port, host })
    server.log.info(`Proxy server listening on ${addr}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
})()

// Optional host allowlist for the dynamic proxy
const allowedTargetHosts = (process.env.ALLOWED_TARGET_HOSTS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function isTargetAllowed(targetUrl) {
  try {
    const u = new URL(targetUrl)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    if (allowedTargetHosts.length === 0) return true
    return allowedTargetHosts.includes(u.hostname.toLowerCase())
  } catch (_) {
    return false
  }
}

// (server boot handled inside the IIFE above)



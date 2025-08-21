import type { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'

export async function registerCors(server: FastifyInstance, allowedOrigins: string[]): Promise<void> {
  await server.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow same-origin/no-origin (curl) and explicit allowlist only.
      if (!origin) return cb(null, true)
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return cb(null, true)
      }
      // In development, allow all localhost origins regardless of port for convenience
      if (process.env.NODE_ENV !== 'production' && (/localhost(:\d+)?$/.test(origin) || /^https?:\/\/(127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin))) {
        return cb(null, true)
      }
      // Allow frontend origins for WebSocket connections
      if (origin && (
        origin.includes('localhost:8080') ||
        origin.includes('127.0.0.1:8080') ||
        origin.includes('localhost:3000') ||
        origin.includes('127.0.0.1:3000')
      )) {
        return cb(null, true)
      }
      cb(null, false)
    },
    credentials: true, // Allow credentials for WebSocket authentication
    // WebSocket connections need special headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'User-Agent',
      'DNT',
      'Cache-Control',
      'X-Mx-ReqToken',
      'Keep-Alive',
      'X-Requested-With',
      'If-Modified-Since',
      'X-CSRF-Token',
      'Sec-WebSocket-Key',
      'Sec-WebSocket-Version',
      'Sec-WebSocket-Protocol',
      'Sec-WebSocket-Extensions'
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']
  })

  // Add specific WebSocket upgrade handling
  server.addHook('onRequest', (request, reply, done) => {
    // Handle WebSocket upgrade requests
    if (request.headers.upgrade && request.headers.upgrade.toLowerCase() === 'websocket') {
      const origin = request.headers.origin || ''
      const isAllowedOrigin = !origin || // Allow no origin (curl, direct connections)
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('[::1]') ||
        allowedOrigins.includes(origin)

      if (isAllowedOrigin) {
        // Set CORS headers for WebSocket upgrade
        reply.header('Access-Control-Allow-Origin', origin || '*')
        reply.header('Access-Control-Allow-Credentials', 'true')
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, User-Agent, DNT, Cache-Control, X-Mx-ReqToken, Keep-Alive, X-Requested-With, If-Modified-Since, X-CSRF-Token, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol, Sec-WebSocket-Extensions')
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD')

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
          reply.header('Access-Control-Max-Age', '86400') // 24 hours
          return reply.status(200).send()
        }
      }
    }
    done()
  })

  // Handle WebSocket upgrade events specifically
  server.addHook('onRequest', (request, reply, done) => {
    if (request.headers.upgrade === 'websocket') {
      server.log.debug({
        url: request.url,
        origin: request.headers.origin,
        upgrade: request.headers.upgrade,
        connection: request.headers.connection
      }, 'WebSocket upgrade request received')
    }
    done()
  })
}



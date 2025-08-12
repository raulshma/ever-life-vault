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
      // In development, allow localhost convenience
      if (process.env.NODE_ENV !== 'production' && (/localhost:\d+$/.test(origin) || /^https?:\/\/(127\.0\.0\.1|\[::1\]):\d+$/.test(origin))) {
        return cb(null, true)
      }
      cb(null, false)
    },
    credentials: false,
  })
}



import type { FastifyInstance } from 'fastify'

// Lazy import to keep type safety without forcing plugin presence at runtime
export async function registerPerfPlugins(server: FastifyInstance): Promise<void> {
  // Security headers
  try {
    const helmet = await import('@fastify/helmet').then(m => m.default || (m as any))
    await server.register(helmet, {
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      xssFilter: true,
      noSniff: true,
      hidePoweredBy: true,
      hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000 } : false,
    } as any)
  } catch (e) {
    server.log.warn('Helmet plugin not installed; skipping @fastify/helmet')
  }

  try {
    const compress = await import('@fastify/compress').then(m => m.default || (m as any))
    await server.register(compress, {
      global: true,
      encodings: ['gzip', 'deflate', 'br'],
      threshold: 1024,
    } as any)
  } catch (e) {
    server.log.warn('Compression plugin not installed; skipping @fastify/compress')
  }

  try {
    const etag = await import('@fastify/etag').then(m => m.default || (m as any))
    await server.register(etag)
  } catch (e) {
    server.log.warn('ETag plugin not installed; skipping @fastify/etag')
  }
}



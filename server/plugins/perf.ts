import type { FastifyInstance } from 'fastify'

// Lazy import to keep type safety without forcing plugin presence at runtime
export async function registerPerfPlugins(server: FastifyInstance): Promise<void> {
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



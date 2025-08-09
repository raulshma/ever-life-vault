import type { FastifyInstance } from 'fastify'
import fastifyHttpProxy from '@fastify/http-proxy'

function ensureTarget(name: string, targets: Record<string, string | undefined>): string {
  const url = targets[name]
  if (!url) throw new Error(`Missing environment for ${name.toUpperCase()}_BASE`)
  return url.replace(/\/$/, '')
}

export async function registerServiceProxies(
  server: FastifyInstance,
  targets: Record<string, string | undefined>
): Promise<void> {
  for (const service of Object.keys(targets)) {
    if (!targets[service]) continue
    await server.register(async (instance) => {
      await instance.register(fastifyHttpProxy, {
        upstream: ensureTarget(service, targets),
        rewritePrefix: '',
      } as any)
    }, { prefix: `/${service}` })
  }
}



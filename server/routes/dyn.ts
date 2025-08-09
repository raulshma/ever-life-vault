import type { FastifyInstance } from 'fastify'
import { buildForwardHeaders, prepareBody, sendUpstreamResponse } from './shared.js'

export function registerDynRoute(
  server: FastifyInstance,
  isTargetAllowed: (url: string) => boolean,
) {
  server.all('/dyn', async (request, reply) => {
    const { url: targetUrl } = (request as any).query || {}
    if (!targetUrl || typeof targetUrl !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' })
    }
    if (!isTargetAllowed(targetUrl)) {
      return reply.code(403).send({ error: 'Target not allowed' })
    }

    const incomingHeaders = request.headers as Record<string, any>
    const forwardHeaders = buildForwardHeaders(incomingHeaders)

    const method = request.method.toUpperCase()
    const body = prepareBody(method, incomingHeaders, (request as any).body, forwardHeaders)

    const res = await fetch(targetUrl, { method, headers: forwardHeaders as any, body: body as any })
    return sendUpstreamResponse(reply, res)
  })
}



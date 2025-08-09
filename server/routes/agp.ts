import type { FastifyInstance } from 'fastify'
import { buildForwardHeaders, prepareBody, sendUpstreamResponse } from './shared.js'

export function registerAgpRoute(
  server: FastifyInstance,
  isTargetAllowed: (url: string) => boolean,
  requireSupabaseUser: (request: any, reply: any) => Promise<any | null>
) {
  server.all('/agp', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return
    const { url: targetUrl } = (request as any).query || {}
    if (!targetUrl || typeof targetUrl !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' })
    }
    if (!isTargetAllowed(targetUrl)) {
      return reply.code(403).send({ error: 'Target not allowed' })
    }

    const incomingHeaders = request.headers as Record<string, any>
    const forwardHeaders = buildForwardHeaders(incomingHeaders, true)

    const targetAuth = incomingHeaders['x-target-authorization'] || (incomingHeaders as any)['X-Target-Authorization']
    if (targetAuth) {
      forwardHeaders['authorization'] = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth.toString()
    }

    const method = request.method.toUpperCase()
    const body = prepareBody(method, incomingHeaders, (request as any).body, forwardHeaders)

    const res = await fetch(targetUrl, { method, headers: forwardHeaders as any, body: body as any })
    return sendUpstreamResponse(reply, res)
  })
}



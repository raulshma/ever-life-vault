import type { FastifyInstance } from 'fastify'
import { buildForwardHeaders, prepareBody, sendUpstreamResponse } from './shared.js'

export function registerAgpRoute(
  server: FastifyInstance,
  isTargetAllowed: (url: string) => boolean,
  requireSupabaseUser: (request: any, reply: any) => Promise<any | null>,
  allowUnauthenticated: boolean = false,
) {
  server.all('/agp', async (request, reply) => {
    if (!allowUnauthenticated) {
      const user = await requireSupabaseUser(request, reply)
      if (!user) return
    }
    const { url: targetUrl } = (request as any).query || {}
    if (!targetUrl || typeof targetUrl !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' })
    }
    if (!isTargetAllowed(targetUrl)) {
      return reply.code(403).send({ error: 'Target not allowed' })
    }

    const incomingHeaders = request.headers as Record<string, any>
    // Do not forward Authorization or Cookie from the caller by default; we inject provider auth below
    const forwardHeaders = buildForwardHeaders(incomingHeaders, true, true)

    const targetAuth = incomingHeaders['x-target-authorization'] || (incomingHeaders as any)['X-Target-Authorization']
    if (targetAuth) {
      forwardHeaders['authorization'] = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth.toString()
    }

    const method = request.method.toUpperCase()
    const body = prepareBody(method, incomingHeaders, (request as any).body, forwardHeaders)

    // Add a timeout to avoid resource exhaustion from slow upstreams
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), 30_000)
    try {
      const res = await fetch(targetUrl, { method, headers: forwardHeaders as any, body: body as any, signal: ac.signal as any })
      // Allow Set-Cookie only if upstream is same-host as target? Keep default allow to not break integrations
      return sendUpstreamResponse(reply, res, false)
    } catch (err) {
      // Upstream error (network, DNS, CORS at upstream, etc.) — do not crash with 500
      request.log?.error?.({ err, targetUrl, method }, 'AGP upstream fetch failed')
      clearTimeout(to)
      return reply.code(502).send({ error: 'Upstream fetch failed' })
    } finally {
      clearTimeout(to)
    }
  })
}



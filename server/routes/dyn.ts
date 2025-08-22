import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { buildForwardHeaders, prepareBody, sendUpstreamResponse } from './shared.js'

function isLikelySupabaseAuthBearer(headerValue: string): boolean {
  const match = /^Bearer\s+([A-Za-z0-9-_]+)\.([A-Za-z0-9-_]+)\.[A-Za-z0-9-_]+$/.exec(headerValue)
  if (!match) return false
  try {
    const payloadJson = JSON.parse(Buffer.from(match[2], 'base64url').toString('utf8')) as Record<string, unknown>
    const iss = String(payloadJson?.iss || '')
    return iss.includes('supabase')
  } catch {
    return false
  }
}

export function registerDynRoute(
  server: FastifyInstance,
  isTargetAllowed: (url: string) => boolean,
): void {
  server.all('/dyn', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url: targetUrl } = (request.query as Record<string, unknown>) || {}
    if (!targetUrl || typeof targetUrl !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' })
    }
    if (!isTargetAllowed(targetUrl)) {
      return reply.code(403).send({ error: 'Target not allowed' })
    }

    const method = request.method.toUpperCase()

    const incomingHeaders = request.headers as Record<string, string | string[] | undefined>
    // Do not forward cookies; conditionally drop Supabase Authorization tokens
    const forwardHeaders = buildForwardHeaders(incomingHeaders, false, true)
    const authVal = forwardHeaders['authorization']
    if (typeof authVal === 'string' && isLikelySupabaseAuthBearer(authVal)) {
      delete forwardHeaders['authorization']
    }

    const body = prepareBody(method, incomingHeaders, request.body, forwardHeaders)

    // Add a timeout to avoid resource exhaustion from slow upstreams
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), 30_000) // 30s timeout
    let res: Response
    try {
      // Convert headers to fetch-compatible format
      const fetchHeaders: Record<string, string> = {}
      for (const [key, value] of Object.entries(forwardHeaders)) {
        if (value !== undefined) {
          fetchHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value)
        }
      }
      
      res = await fetch(targetUrl, { 
        method, 
        headers: fetchHeaders, 
        body: body as BodyInit, 
        signal: ac.signal 
      })
    } finally {
      clearTimeout(to)
    }
    // Do not allow Set-Cookie from third-party upstreams
    return sendUpstreamResponse(reply, res, false)
  })
}



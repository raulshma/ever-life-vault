import type { FastifyInstance } from 'fastify'
import { buildForwardHeaders, prepareBody, sendUpstreamResponse, sanitizeRequestBody, checkRateLimit } from './shared.js'

interface FastifyRequestWithUser {
  user?: { id: string };
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  query?: Record<string, unknown>;
  body?: unknown;
}

interface FastifyReplyWithCode {
  code: (statusCode: number) => FastifyReplyWithCode;
  send: (payload?: unknown) => FastifyReplyWithCode;
}

export function registerAgpRoute(
  server: FastifyInstance,
  isTargetAllowed: (url: string) => boolean,
  requireSupabaseUser: (request: FastifyRequestWithUser, reply: FastifyReplyWithCode) => Promise<{ id: string } | null>,
  allowUnauthenticated: boolean = false,
) {
  server.all('/agp', async (request, reply) => {
    // Rate limiting - configurable limits
    const clientId = (request as FastifyRequestWithUser).user?.id || request.ip;
    const rateLimit = process.env.AGP_RATE_LIMIT ? parseInt(process.env.AGP_RATE_LIMIT) : 100;
    const rateLimitWindow = process.env.AGP_RATE_LIMIT_WINDOW ? parseInt(process.env.AGP_RATE_LIMIT_WINDOW) : 60000;

    if (!checkRateLimit(`agp:${clientId}`, rateLimit, rateLimitWindow)) {
      server.log.warn({ event: 'agp_rate_limit', clientId, rateLimit, rateLimitWindow }, 'AGP rate limit exceeded')
      return reply.code(429).send({
        error: 'Rate limit exceeded',
        message: `Too many requests, please try again later. Limit: ${rateLimit} requests per ${rateLimitWindow / 1000} seconds.`,
        retryAfter: Math.ceil(rateLimitWindow / 1000)
      });
    }

    if (!allowUnauthenticated) {
      const user = await requireSupabaseUser(request, reply)
      if (!user) return
    }

    const { url: targetUrl } = (request as any).query || {}
    if (!targetUrl || typeof targetUrl !== 'string') {
      return reply.code(400).send({ error: 'Missing url query parameter' })
    }

    // Basic URL format validation
    try {
      new URL(targetUrl)
    } catch {
      return reply.code(400).send({ error: 'Invalid URL format' })
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

    // Sanitize request body
    const sanitizedBody = sanitizeRequestBody((request as any).body);
    const body = prepareBody(method, incomingHeaders, sanitizedBody, forwardHeaders)

    // Add a timeout to avoid resource exhaustion from slow upstreams
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), 30_000)
    try {
      const res = await fetch(targetUrl, { method, headers: forwardHeaders as any, body: body as any, signal: ac.signal as unknown })
      clearTimeout(to)
      return sendUpstreamResponse(reply, res)
    } catch (e: unknown) {
      clearTimeout(to)
      if (e instanceof Error && e.name === 'AbortError') {
        return reply.code(504).send({ error: 'Request timeout' })
      }
      return reply.code(500).send({ error: 'Upstream request failed' })
    }
  })
}



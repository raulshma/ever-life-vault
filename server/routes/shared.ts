import { Readable } from 'node:stream'

/**
 * Security utilities for route handlers
 */

/**
 * Validate and sanitize request body to prevent injection attacks
 */
export function sanitizeRequestBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Sanitize string values
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '')
        .substring(0, 10000); // Limit length
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeRequestBody(value);
    } else {
      // Keep other types as-is
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function validateUrl(url: string, allowedHosts: string[]): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    
    // Check if host is in allowed list
    return allowedHosts.some(allowed => {
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return host === domain || host.endsWith('.' + domain);
      }
      return host === allowed.toLowerCase();
    });
  } catch {
    return false;
  }
}

/**
 * Rate limiting helper (simple in-memory implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

export function buildForwardHeaders(
  incomingHeaders: Record<string, string | string[] | undefined>,
  omitAuthorization: boolean = false,
  omitCookies: boolean = false,
): Record<string, string | string[] | undefined> {
  const forwardHeaders: Record<string, string | string[] | undefined> = {}
  for (const [key, value] of Object.entries(incomingHeaders)) {
    const k = key.toLowerCase()
    // Never forward hop-by-hop headers
    if (['host', 'content-length', 'connection', 'origin', 'referer'].includes(k)) continue
    if (omitAuthorization && k === 'authorization') continue
    if (omitCookies && k === 'cookie') continue
    forwardHeaders[k] = value
  }
  return forwardHeaders
}

export async function sendUpstreamResponse(reply: { header: (key: string, value: string) => void; code: (status: number) => void; send: (payload?: unknown) => void }, res: Response, allowSetCookie: boolean = true): Promise<unknown> {
  // Forward only safe headers
  // Convert headers iterator to array for consistent typing across runtimes
  const headerEntries: Array<[string, string]> = (res && res.headers && typeof res.headers.entries === 'function')
    ? Array.from(res.headers.entries())
    : [];

  for (const [hk, hv] of headerEntries) {
    const lower = hk.toLowerCase()
    if (['content-type', 'cache-control', 'etag', 'last-modified'].includes(lower)) {
      reply.header(hk, hv)
    } else if (allowSetCookie && lower === 'set-cookie') {
      reply.header(hk, hv)
    }
  }
  reply.code(res.status)
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const text = await res.text()
    return reply.send(text)
  }
  if (res.body) {
    return reply.send(Readable.fromWeb(res.body))
  }
  return reply.send()
}

export function prepareBody(method: string, incomingHeaders: Record<string, string | string[] | undefined>, requestBody: unknown, forwardHeaders: Record<string, string | string[] | undefined>): string | Buffer | undefined {
  let body: string | Buffer | undefined
  if (!['GET', 'HEAD'].includes(method)) {
    const ct = (incomingHeaders['content-type'] || incomingHeaders['Content-Type'] || '').toString()
    if (typeof requestBody === 'string' || Buffer.isBuffer(requestBody)) {
      body = requestBody
    } else if (requestBody && typeof requestBody === 'object') {
      if (!ct) {
        forwardHeaders['content-type'] = 'application/json'
      }
      body = JSON.stringify(requestBody)
    }
  }
  return body
}



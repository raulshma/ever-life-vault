import type { FastifyInstance, FastifyRequest } from 'fastify'

interface RateLimitContext {
  after: number
}

interface RateLimitRequest extends FastifyRequest {
  user?: { id: string }
}

// Lazy import to keep type safety without forcing plugin presence at runtime
export async function registerPerfPlugins(server: FastifyInstance): Promise<void> {
  // Security headers
  try {
    const helmet = await import('@fastify/helmet').then(m => m.default || m)
    await server.register(helmet, {
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      xssFilter: true,
      noSniff: true,
      hidePoweredBy: true,
      hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000 } : false,
      // Additional security headers
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      originAgentCluster: true,
      // Custom security headers
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", "https://*.steamstatic.com", "https://*.akamaihd.net", "https://*.steampowered.com"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          // upgradeInsecureRequests: process.env.NODE_ENV === 'production',
        }
      }
    })
  } catch (e) {
    server.log.warn('Helmet plugin not installed; skipping @fastify/helmet')
  }

  // Rate limiting
  try {
    const rateLimit = await import('@fastify/rate-limit').then(m => m.default || m)
    await server.register(rateLimit, {
      global: true,
      max: 100, // Maximum 100 requests per window
      timeWindow: '1 minute', // Per minute
      allowList: ['127.0.0.1', '::1'], // Allow localhost
      skipOnError: false,
      keyGenerator: (request: RateLimitRequest) => {
        // Use user ID if authenticated, otherwise IP address
        const user = request.user;
        return user ? user.id : request.ip;
      },
      errorResponseBuilder: (request: FastifyRequest, context: RateLimitContext) => ({
        code: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.ceil(context.after / 1000)} seconds`,
        retryAfter: Math.ceil(context.after / 1000)
      })
    })
  } catch (e) {
    server.log.warn('Rate limit plugin not installed; skipping @fastify/rate-limit')
  }

  // Compression
  try {
    const compress = await import('@fastify/compress').then(m => m.default || m)
    await server.register(compress, {
      global: true,
      encodings: ['gzip', 'deflate', 'br'],
      threshold: 1024,
    })
  } catch (e) {
    server.log.warn('Compression plugin not installed; skipping @fastify/compress')
  }

  // ETags
  try {
    const etag = await import('@fastify/etag').then(m => m.default || m)
    await server.register(etag)
  } catch (e) {
    server.log.warn('ETag plugin not installed; skipping @fastify/etag')
  }
}



/**
 * Security configuration and policies for the Ever Life Vault server
 */

export const SECURITY_CONFIG = {
  // Rate limiting configuration
  RATE_LIMITS: {
    DEFAULT: { maxRequests: 100, windowMs: 60000 },
    AGP: { maxRequests: 50, windowMs: 60000 },
    AUTH: { maxRequests: 10, windowMs: 300000 }, // 5 minutes for auth endpoints
    API: { maxRequests: 200, windowMs: 60000 },
  },
  
  // Input validation limits
  INPUT_LIMITS: {
    MAX_STRING_LENGTH: 10000,
    MAX_OBJECT_DEPTH: 10,
    MAX_ARRAY_LENGTH: 1000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  },
  
  // Allowed file types for uploads
  ALLOWED_FILE_TYPES: [
    'txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv',
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'pdf',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
  ],
  
  // Security headers configuration
  SECURITY_HEADERS: {
    FRAME_ANCESTORS: "'none'",
    CONTENT_TYPE_OPTIONS: 'nosniff',
    XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'no-referrer',
    PERMISSIONS_POLICY: 'geolocation=(), microphone=(), camera=()',
  },
  
  // CORS configuration
  CORS: {
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    EXPOSED_HEADERS: ['X-Total-Count'],
    MAX_AGE: 86400, // 24 hours
  },
  
  // Session security
  SESSION: {
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    SECURE: process.env.NODE_ENV === 'production',
    HTTP_ONLY: true,
    SAME_SITE: 'strict' as const,
  },
  
  // Password policy
  PASSWORD_POLICY: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    MAX_AGE_DAYS: 90,
  },
  
  // API security
  API: {
    MAX_REQUEST_SIZE: '10mb',
    TIMEOUT_MS: 30000,
    MAX_REDIRECTS: 5,
    ALLOW_INSECURE_HTTP: process.env.NODE_ENV !== 'production',
  },
  
  // Logging and monitoring
  MONITORING: {
    LOG_AUTH_ATTEMPTS: true,
    LOG_RATE_LIMIT_VIOLATIONS: true,
    LOG_SECURITY_EVENTS: true,
    ALERT_ON_MULTIPLE_FAILURES: true,
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  }
} as const;

/**
 * Security utility functions
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function getSecurityLevel(): 'low' | 'medium' | 'high' {
  if (isProduction()) return 'high';
  if (isDevelopment()) return 'medium';
  return 'low';
}

export function shouldEnforceStrictSecurity(): boolean {
  return getSecurityLevel() === 'high';
}

export function getRateLimitConfig(endpoint: keyof typeof SECURITY_CONFIG.RATE_LIMITS) {
  return SECURITY_CONFIG.RATE_LIMITS[endpoint] || SECURITY_CONFIG.RATE_LIMITS.DEFAULT;
}

export class IntegrationError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown
  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.status = status
    this.details = details
  }
}

export class UnsupportedProviderError extends IntegrationError {
  constructor(provider: string) {
    super(`Unsupported provider: ${provider}`, 'unsupported_provider', 400)
  }
}

export class ProviderNotConfiguredError extends IntegrationError {
  constructor(provider: string) {
    super(`Provider not configured: ${provider}`, 'provider_not_configured', 500)
  }
}

export class InvalidStateError extends IntegrationError {
  constructor() {
    super('Invalid OAuth state', 'invalid_state', 400)
  }
}

export class TokenExchangeError extends IntegrationError {
  constructor(provider: string, details?: unknown) {
    super(`Token exchange failed for ${provider}`, 'token_exchange_failed', 502, details)
  }
}

export class TokenRefreshError extends IntegrationError {
  constructor(provider: string, details?: unknown) {
    super(`Token refresh failed for ${provider}`, 'token_refresh_failed', 502, details)
  }
}

export function toHttpError(err: unknown): { status: number; body: { error: string; code?: string } } {
  if (err instanceof IntegrationError) {
    return { status: err.status, body: { error: err.message, code: err.code } }
  }
  return { status: 500, body: { error: 'Internal Server Error' } }
}



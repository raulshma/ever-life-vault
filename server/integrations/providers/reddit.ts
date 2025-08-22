import { OAuthProvider, ProviderCommonConfig, OAuthTokens } from '../types.js'
import { ProviderNotConfiguredError, TokenExchangeError, TokenRefreshError } from '../errors.js'

export class RedditProvider implements OAuthProvider {
  readonly name = 'reddit' as const
  constructor(private readonly cfg: ProviderCommonConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.clientId && this.cfg.redirectUri)
  }

  buildAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const scopes = 'read mysubreddits history'
    const u = new URL('https://www.reddit.com/api/v1/authorize')
    u.searchParams.set('client_id', this.cfg.clientId!)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('redirect_uri', this.cfg.redirectUri!)
    u.searchParams.set('duration', 'permanent')
    u.searchParams.set('scope', scopes)
    u.searchParams.set('state', state)
    return u.toString()
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.cfg.redirectUri!,
    })
    const auth = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret || ''}`).toString('base64')
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    try {
      return (await res.json()) as OAuthTokens
    } catch (e) {
      throw new TokenExchangeError(this.name, e)
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    const auth = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret || ''}`).toString('base64')
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    try {
      return (await res.json()) as OAuthTokens
    } catch (e) {
      throw new TokenRefreshError(this.name, e)
    }
  }
}



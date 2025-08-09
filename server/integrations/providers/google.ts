import { OAuthProvider, ProviderCommonConfig } from '../types.js'
import { ProviderNotConfiguredError, TokenExchangeError, TokenRefreshError } from '../errors.js'

export class GoogleProvider implements OAuthProvider {
  readonly name = 'google' as const
  constructor(private readonly cfg: ProviderCommonConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.clientId && this.cfg.redirectUri)
  }

  buildAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'openid',
      'email',
      'profile',
    ].join(' ')
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    u.searchParams.set('client_id', this.cfg.clientId!)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('redirect_uri', this.cfg.redirectUri!)
    u.searchParams.set('scope', scopes)
    u.searchParams.set('access_type', 'offline')
    u.searchParams.set('include_granted_scopes', 'true')
    u.searchParams.set('prompt', 'consent')
    u.searchParams.set('state', state)
    return u.toString()
  }

  async exchangeCodeForTokens(code: string): Promise<Record<string, any>> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const body = new URLSearchParams({
      client_id: this.cfg.clientId!,
      client_secret: this.cfg.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.cfg.redirectUri!,
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    try {
      return (await res.json()) as Record<string, any>
    } catch (e) {
      throw new TokenExchangeError(this.name, e)
    }
  }

  async refreshTokens(refreshToken: string): Promise<Record<string, any>> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const body = new URLSearchParams({
      client_id: this.cfg.clientId!,
      client_secret: this.cfg.clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    try {
      return (await res.json()) as Record<string, any>
    } catch (e) {
      throw new TokenRefreshError(this.name, e)
    }
  }
}



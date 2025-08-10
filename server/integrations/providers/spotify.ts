import { OAuthProvider, ProviderCommonConfig } from '../types.js'
import { ProviderNotConfiguredError, TokenExchangeError, TokenRefreshError } from '../errors.js'

export class SpotifyProvider implements OAuthProvider {
  readonly name = 'spotify' as const
  constructor(private readonly cfg: ProviderCommonConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.clientId && this.cfg.redirectUri)
  }

  buildAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const scopes = [
      'user-read-recently-played',
      'user-top-read',
    ].join(' ')
    const u = new URL('https://accounts.spotify.com/authorize')
    u.searchParams.set('client_id', this.cfg.clientId!)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('redirect_uri', this.cfg.redirectUri!)
    u.searchParams.set('scope', scopes)
    u.searchParams.set('state', state)
    return u.toString()
  }

  async exchangeCodeForTokens(code: string): Promise<Record<string, any>> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.cfg.redirectUri!,
      client_id: this.cfg.clientId!,
      client_secret: this.cfg.clientSecret!,
    })
    const res = await fetch('https://accounts.spotify.com/api/token', {
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
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.cfg.clientId!,
      client_secret: this.cfg.clientSecret!,
    })
    const res = await fetch('https://accounts.spotify.com/api/token', {
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




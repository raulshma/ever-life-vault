import { OAuthProvider, ProviderCommonConfig, OAuthTokens } from '../types.js'
import { ProviderNotConfiguredError, TokenExchangeError, TokenRefreshError } from '../errors.js'

export class MicrosoftProvider implements OAuthProvider {
  readonly name = 'microsoft' as const
  constructor(private readonly cfg: ProviderCommonConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.clientId && this.cfg.redirectUri)
  }

  buildAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const scopes = [
      'offline_access',
      'openid',
      'profile',
      'https://graph.microsoft.com/Mail.Read',
    ].join(' ')
    const u = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    u.searchParams.set('client_id', this.cfg.clientId!)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('redirect_uri', this.cfg.redirectUri!)
    u.searchParams.set('response_mode', 'query')
    u.searchParams.set('scope', scopes)
    u.searchParams.set('state', state)
    return u.toString()
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name)
    const body = new URLSearchParams({
      client_id: this.cfg.clientId!,
      scope: 'offline_access openid profile https://graph.microsoft.com/Mail.Read',
      code,
      redirect_uri: this.cfg.redirectUri!,
      grant_type: 'authorization_code',
      client_secret: this.cfg.clientSecret!,
    })
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      client_id: this.cfg.clientId!,
      scope: 'offline_access openid profile https://graph.microsoft.com/Mail.Read',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_secret: this.cfg.clientSecret!,
    })
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    try {
      return (await res.json()) as OAuthTokens
    } catch (e) {
      throw new TokenRefreshError(this.name, e)
    }
  }
}



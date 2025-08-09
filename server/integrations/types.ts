export interface OAuthProvider {
  /** Provider key used in routes and UI */
  readonly name: string
  /** Returns true if required env/config is present */
  isConfigured(): boolean
  /** Build the authorization URL for this provider */
  buildAuthorizationUrl(state: string): string
  /** Exchange authorization code for tokens */
  exchangeCodeForTokens(code: string): Promise<Record<string, any>>
  /** Refresh tokens */
  refreshTokens(refreshToken: string): Promise<Record<string, any>>
}

export interface ProviderCommonConfig {
  clientId?: string
  clientSecret?: string
  redirectUri?: string
}

export interface OAuthRouteConfig {
  OAUTH_REDIRECT_BASE_URL: string
  OAUTH_REDIRECT_PATH: string
}



import { OAuthProvider, ProviderCommonConfig } from './types.js'
import { RedditProvider } from './providers/reddit.js'
import { GoogleProvider } from './providers/google.js'
import { MicrosoftProvider } from './providers/microsoft.js'

export type ProviderName = 'reddit' | 'google' | 'microsoft'

export interface RegistryInitConfig {
  reddit: ProviderCommonConfig
  google: ProviderCommonConfig
  microsoft: ProviderCommonConfig
}

export class ProviderRegistry {
  private readonly providers: Map<ProviderName, OAuthProvider>
  constructor(cfg: RegistryInitConfig) {
    this.providers = new Map<ProviderName, OAuthProvider>([
      ['reddit', new RedditProvider(cfg.reddit)],
      ['google', new GoogleProvider(cfg.google)],
      ['microsoft', new MicrosoftProvider(cfg.microsoft)],
    ])
  }

  get(name: string): OAuthProvider | undefined {
    return this.providers.get(name as ProviderName)
  }

  list(): Array<{ name: string; configured: boolean }> {
    return Array.from(this.providers.values()).map((p) => ({ name: p.name, configured: p.isConfigured() }))
  }
}



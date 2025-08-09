import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { ProviderRegistry } from '../integrations/registry.js'
import { HandoffStore } from '../integrations/handoffStore.js'
import { InvalidStateError, UnsupportedProviderError, toHttpError } from '../integrations/errors.js'

type RequireUser = (request: any, reply: any) => Promise<any | null>

export interface IntegrationConfig {
  requireSupabaseUser: RequireUser
  OAUTH_REDIRECT_BASE_URL: string
  OAUTH_REDIRECT_PATH: string
  REDDIT_CLIENT_ID?: string
  REDDIT_CLIENT_SECRET?: string
  REDDIT_REDIRECT_URI?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_REDIRECT_URI?: string
  MS_CLIENT_ID?: string
  MS_CLIENT_SECRET?: string
  MS_REDIRECT_URI?: string
}

export function registerIntegrationRoutes(server: FastifyInstance, cfg: IntegrationConfig) {
  const registry = new ProviderRegistry({
    reddit: { clientId: cfg.REDDIT_CLIENT_ID, clientSecret: cfg.REDDIT_CLIENT_SECRET, redirectUri: cfg.REDDIT_REDIRECT_URI },
    google: { clientId: cfg.GOOGLE_CLIENT_ID, clientSecret: cfg.GOOGLE_CLIENT_SECRET, redirectUri: cfg.GOOGLE_REDIRECT_URI },
    microsoft: { clientId: cfg.MS_CLIENT_ID, clientSecret: cfg.MS_CLIENT_SECRET, redirectUri: cfg.MS_REDIRECT_URI },
  })
  const handoffs = new HandoffStore<any>()

  server.get('/integrations/oauth/start', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { provider } = (request as any).query || {}
    if (!provider || typeof provider !== 'string') return reply.code(400).send({ error: 'Missing provider' })

    try {
      const state = crypto.randomUUID()
      const p = registry.get(provider)
      if (!p) throw new UnsupportedProviderError(provider)
      const url = p.buildAuthorizationUrl(state)
      handoffs.put(`state:${state}`, { userId: user.id, provider })
      return reply.send({ url })
    } catch (err) {
      const { status, body } = toHttpError(err)
      return reply.code(status).send(body)
    }
  })

  server.get('/integrations/oauth/callback/:provider', async (request, reply) => {
    const { provider } = (request as any).params
    const { code, state, error } = (request as any).query || {}
    if (error) {
      server.log.error({ provider, error }, 'OAuth error')
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(provider)}&reason=${encodeURIComponent(error)}`)
    }
    try {
      const p = registry.get(provider)
      if (!p) throw new UnsupportedProviderError(provider)
      const stateInfo = handoffs.take(`state:${state}`)
      if (!stateInfo) throw new InvalidStateError()
      const tokenResult = await p.exchangeCodeForTokens(code)
      const handoffId = `handoff:${crypto.randomUUID()}`
      handoffs.put(handoffId, { provider, tokens: tokenResult })
      const redirectUrl = `${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?handoff=${encodeURIComponent(handoffId)}&provider=${encodeURIComponent(provider)}`
      return reply.redirect(redirectUrl)
    } catch (err) {
      server.log.error(err as any)
      const reason = (err as any)?.code || 'exception'
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(provider)}&reason=${encodeURIComponent(reason)}`)
    }
  })

  server.get('/integrations/oauth/handoff', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { id } = (request as any).query || {}
    if (!id || typeof id !== 'string') return reply.code(400).send({ error: 'Missing id' })
    const payload = handoffs.take(id)
    if (!payload) return reply.code(404).send({ error: 'Not found or expired' })
    return reply.send(payload)
  })

  server.post('/integrations/oauth/refresh', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { provider, refresh_token } = (request as any).body || {}
    if (!provider || !refresh_token) return reply.code(400).send({ error: 'Missing provider or refresh_token' })
    try {
      const p = registry.get(provider)
      if (!p) throw new UnsupportedProviderError(provider)
      const tokenResult = await p.refreshTokens(refresh_token)
      return reply.send({ provider, tokens: tokenResult })
    } catch (err) {
      const { status, body } = toHttpError(err)
      return reply.code(status).send(body)
    }
  })
}



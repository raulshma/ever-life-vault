import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'

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

interface HandoffRecord {
  payload: any
  expiresAt: number
}

export function registerIntegrationRoutes(server: FastifyInstance, cfg: IntegrationConfig) {
  const store = new Map<string, HandoffRecord>()

  function putHandoff(handoffId: string, payload: any, ttlMs = 5 * 60_000) {
    const expiresAt = Date.now() + ttlMs
    store.set(handoffId, { payload, expiresAt })
    setTimeout(() => {
      const v = store.get(handoffId)
      if (v && v.expiresAt <= Date.now()) store.delete(handoffId)
    }, ttlMs + 1_000)
  }

  server.get('/integrations/oauth/start', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { provider } = (request as any).query || {}
    if (!provider) return reply.code(400).send({ error: 'Missing provider' })

    const state = crypto.randomUUID()
    let url: string | undefined
    if (provider === 'reddit') {
      const clientId = cfg.REDDIT_CLIENT_ID
      const redirectUri = cfg.REDDIT_REDIRECT_URI
      if (!clientId || !redirectUri) return reply.code(500).send({ error: 'Reddit OAuth not configured' })
      const scopes = 'read mysubreddits history'
      const u = new URL('https://www.reddit.com/api/v1/authorize')
      u.searchParams.set('client_id', clientId)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('redirect_uri', redirectUri)
      u.searchParams.set('duration', 'permanent')
      u.searchParams.set('scope', scopes)
      u.searchParams.set('state', state)
      url = u.toString()
    } else if (provider === 'google') {
      const clientId = cfg.GOOGLE_CLIENT_ID
      const redirectUri = cfg.GOOGLE_REDIRECT_URI
      if (!clientId || !redirectUri) return reply.code(500).send({ error: 'Google OAuth not configured' })
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'openid',
        'email',
        'profile',
      ].join(' ')
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      u.searchParams.set('client_id', clientId)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('redirect_uri', redirectUri)
      u.searchParams.set('scope', scopes)
      u.searchParams.set('access_type', 'offline')
      u.searchParams.set('include_granted_scopes', 'true')
      u.searchParams.set('prompt', 'consent')
      u.searchParams.set('state', state)
      url = u.toString()
    } else if (provider === 'microsoft') {
      const clientId = cfg.MS_CLIENT_ID
      const redirectUri = cfg.MS_REDIRECT_URI
      if (!clientId || !redirectUri) return reply.code(500).send({ error: 'Microsoft OAuth not configured' })
      const scopes = [
        'offline_access',
        'openid',
        'profile',
        'https://graph.microsoft.com/Mail.Read',
      ].join(' ')
      const u = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
      u.searchParams.set('client_id', clientId)
      u.searchParams.set('response_type', 'code')
      u.searchParams.set('redirect_uri', redirectUri)
      u.searchParams.set('response_mode', 'query')
      u.searchParams.set('scope', scopes)
      u.searchParams.set('state', state)
      url = u.toString()
    } else {
      return reply.code(400).send({ error: 'Unsupported provider' })
    }

    putHandoff(`state:${state}`, { userId: user.id, provider })
    return reply.send({ url })
  })

  server.get('/integrations/oauth/callback/:provider', async (request, reply) => {
    const { provider } = (request as any).params
    const { code, state, error } = (request as any).query || {}
    if (error) {
      server.log.error({ provider, error }, 'OAuth error')
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(provider)}&reason=${encodeURIComponent(error)}`)
    }
    const stateInfo = store.get(`state:${state}`)
    if (!stateInfo) {
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(provider)}&reason=invalid_state`)
    }
    store.delete(`state:${state}`)

    try {
      let tokenResult: any
      if (provider === 'reddit') {
        const clientId = cfg.REDDIT_CLIENT_ID!
        const clientSecret = cfg.REDDIT_CLIENT_SECRET || ''
        const redirectUri = cfg.REDDIT_REDIRECT_URI!
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        })
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const res = await fetch('https://www.reddit.com/api/v1/access_token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })
        tokenResult = await res.json()
      } else if (provider === 'google') {
        const clientId = cfg.GOOGLE_CLIENT_ID!
        const clientSecret = cfg.GOOGLE_CLIENT_SECRET!
        const redirectUri = cfg.GOOGLE_REDIRECT_URI!
        const body = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        })
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
        tokenResult = await res.json()
      } else if (provider === 'microsoft') {
        const clientId = cfg.MS_CLIENT_ID!
        const clientSecret = cfg.MS_CLIENT_SECRET!
        const redirectUri = cfg.MS_REDIRECT_URI!
        const body = new URLSearchParams({
          client_id: clientId,
          scope: 'offline_access openid profile https://graph.microsoft.com/Mail.Read',
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          client_secret: clientSecret,
        })
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
        tokenResult = await res.json()
      } else {
        return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(provider)}&reason=unsupported_provider`)
      }

      const handoffId = `handoff:${crypto.randomUUID()}`
      putHandoff(handoffId, { provider, tokens: tokenResult })
      const redirectUrl = `${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?handoff=${encodeURIComponent(handoffId)}&provider=${encodeURIComponent(provider)}`
      return reply.redirect(redirectUrl)
    } catch (e) {
      server.log.error(e as any)
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(provider)}&reason=exception`)
    }
  })

  server.get('/integrations/oauth/handoff', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { id } = (request as any).query || {}
    if (!id || typeof id !== 'string') return reply.code(400).send({ error: 'Missing id' })
    const v = store.get(id)
    if (!v || v.expiresAt <= Date.now()) {
      return reply.code(404).send({ error: 'Not found or expired' })
    }
    store.delete(id)
    return reply.send(v.payload)
  })

  server.post('/integrations/oauth/refresh', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { provider, refresh_token } = (request as any).body || {}
    if (!provider || !refresh_token) return reply.code(400).send({ error: 'Missing provider or refresh_token' })
    try {
      let tokenResult: any
      if (provider === 'reddit') {
        const clientId = cfg.REDDIT_CLIENT_ID!
        const clientSecret = cfg.REDDIT_CLIENT_SECRET || ''
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token,
        })
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const res = await fetch('https://www.reddit.com/api/v1/access_token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })
        tokenResult = await res.json()
      } else if (provider === 'google') {
        const clientId = cfg.GOOGLE_CLIENT_ID!
        const clientSecret = cfg.GOOGLE_CLIENT_SECRET!
        const body = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token,
          grant_type: 'refresh_token',
        })
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
        tokenResult = await res.json()
      } else if (provider === 'microsoft') {
        const clientId = cfg.MS_CLIENT_ID!
        const clientSecret = cfg.MS_CLIENT_SECRET!
        const body = new URLSearchParams({
          client_id: clientId,
          scope: 'offline_access openid profile https://graph.microsoft.com/Mail.Read',
          refresh_token,
          grant_type: 'refresh_token',
          client_secret: clientSecret,
        })
        const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
        tokenResult = await res.json()
      } else {
        return reply.code(400).send({ error: 'Unsupported provider' })
      }
      return reply.send({ provider, tokens: tokenResult })
    } catch (e) {
      server.log.error(e as any)
      return reply.code(500).send({ error: 'Refresh failed' })
    }
  })
}



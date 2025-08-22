import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'node:crypto'
import { HandoffStore } from '../integrations/handoffStore.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface RequireUserFunction {
  (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null>
}

interface MALRouteConfig {
  requireSupabaseUser: RequireUserFunction
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  OAUTH_REDIRECT_BASE_URL?: string
  OAUTH_REDIRECT_PATH?: string
  MAL_CLIENT_ID?: string
  MAL_REDIRECT_URI?: string
  MAL_TOKENS_SECRET?: string
}

function makeSupabaseForRequest(cfg: MALRouteConfig, req: FastifyRequest): SupabaseClient | null {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
}

function makeAdminSupabase(cfg: MALRouteConfig): SupabaseClient | null {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function buildServerBaseUrl(request: FastifyRequest): string {
  const proto = ((request.headers['x-forwarded-proto'] as string) || '').split(',')[0]?.trim() || 'http'
  const host = (request.headers['x-forwarded-host'] as string) || (request.headers['host'] as string) || 'localhost:8787'
  return `${proto}://${host}`
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomCodeVerifier(): string {
  // 64-byte -> 86 char base64url
  const bytes = crypto.randomBytes(64)
  return base64url(bytes)
}

function getCipherKey(secretB64?: string): Buffer | null {
  if (!secretB64) return null
  try {
    const raw = Buffer.from(secretB64, 'base64')
    if (raw.length !== 32) return null
    return raw
  } catch {
    return null
  }
}

function encryptString(plaintext: string, key: Buffer): { ivB64: string; tagB64: string; cipherB64: string } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { ivB64: iv.toString('base64'), tagB64: tag.toString('base64'), cipherB64: enc.toString('base64') }
}

function decryptString(cipherB64: string, ivB64: string, tagB64: string, key: Buffer): string {
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(cipherB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function registerMALRoutes(server: FastifyInstance, cfg: MALRouteConfig): void {
  const handoffs = new HandoffStore<{ userId: string; codeVerifier: string }>()
  const tokenKey = getCipherKey(cfg.MAL_TOKENS_SECRET)

  // Start PKCE OAuth flow
  server.post('/api/mal/link/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    if (!cfg.MAL_CLIENT_ID || !cfg.MAL_REDIRECT_URI) return reply.code(500).send({ error: 'server_not_configured' })

    const state = crypto.randomUUID()
    const codeVerifier = randomCodeVerifier()
    handoffs.put(`state:${state}`, { userId: user.id, codeVerifier })

    const u = new URL('https://myanimelist.net/v1/oauth2/authorize')
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('client_id', cfg.MAL_CLIENT_ID)
    // RFC 7636 recommends S256 over plain
    const challenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    u.searchParams.set('state', state)
    u.searchParams.set('redirect_uri', cfg.MAL_REDIRECT_URI)
    // MAL scopes: default read access. Leave empty or 'read'. We'll be explicit.
    u.searchParams.set('scope', 'read')

    return reply.send({ url: u.toString() })
  })

  // OAuth callback
  server.get('/api/mal/link/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = (request.query as Record<string, unknown>) || {}
    const code = (q?.code as string | undefined) || undefined
    const state = (q?.state as string | undefined) || undefined
    if (!code || !state) return reply.code(400).send({ error: 'missing_code_or_state' })
    const info = handoffs.take(`state:${state}`)
    if (!info) return reply.code(400).send({ error: 'invalid_state' })
    if (!cfg.MAL_CLIENT_ID || !cfg.MAL_REDIRECT_URI) return reply.code(500).send({ error: 'server_not_configured' })

    // Exchange code using PKCE
    const body = new URLSearchParams()
    body.set('client_id', cfg.MAL_CLIENT_ID)
    body.set('code', code)
    body.set('code_verifier', info.codeVerifier)
    body.set('grant_type', 'authorization_code')
    body.set('redirect_uri', cfg.MAL_REDIRECT_URI)
    const tokenRes = await fetch('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!tokenRes.ok) {
      server.log.error({ event: 'mal_token_exchange_failed', status: tokenRes.status }, 'MAL token exchange failed')
      return reply.code(400).send({ error: 'token_exchange_failed' })
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string; refresh_token?: string }
    const accessToken: string | undefined = tokenJson?.access_token
    const refreshToken: string | undefined = tokenJson?.refresh_token
    if (!accessToken) return reply.code(400).send({ error: 'no_access_token' })

    // Fetch profile snapshot
    const meRes = await fetch('https://api.myanimelist.net/v2/users/@me?fields=anime_statistics', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!meRes.ok) {
      server.log.error({ event: 'mal_me_failed', status: meRes.status }, 'MAL /users/@me failed')
      return reply.code(400).send({ error: 'profile_fetch_failed' })
    }
    const me = (await meRes.json()) as { 
      id?: number; 
      name?: string; 
      picture?: string; 
      anime_statistics?: { 
        mean_score?: number; 
        num_days?: number 
      } 
    }
    const malUserId: number | undefined = me?.id
    const malUsername: string | undefined = me?.name
    const displayName: string | undefined = me?.name
    const avatarUrl: string | undefined = me?.picture
    const meanScore: number | undefined = me?.anime_statistics?.mean_score
    const daysWatched: number | undefined = me?.anime_statistics?.num_days

    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })

    // Upsert mal_accounts
    const { error: acctErr } = await supabase
      .from('mal_accounts')
      .upsert(
        {
          user_id: info.userId,
          mal_user_id: malUserId,
          mal_username: malUsername,
          display_name: displayName,
          avatar_url: avatarUrl,
          mean_score: typeof meanScore === 'number' ? meanScore : null,
          days_watched: typeof daysWatched === 'number' ? daysWatched : null,
          linked_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    if (acctErr) return reply.code(400).send({ error: acctErr.message })

    // Store encrypted tokens (if configured)
    if (tokenKey) {
      const { ivB64, tagB64, cipherB64 } = encryptString(accessToken, tokenKey)
      const refreshEnc = refreshToken ? encryptString(refreshToken, tokenKey) : null
      const { error: tokErr } = await supabase
        .from('mal_tokens')
        .upsert(
          {
            user_id: info.userId,
            access_encrypted: cipherB64,
            refresh_encrypted: refreshEnc?.cipherB64 || null,
            iv: ivB64,
            auth_tag: tagB64,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      if (tokErr) server.log.error({ event: 'mal_token_store_failed', err: tokErr }, 'Failed to store MAL tokens')
    }

    const redirectBase = cfg.OAUTH_REDIRECT_BASE_URL || 'http://localhost:8080'
    const redirectPath = cfg.OAUTH_REDIRECT_PATH || '/feeds'
    const url = `${redirectBase}${redirectPath}?mal_linked=1`
    return reply.redirect(url)
  })

  // Manual sync (v0: profile refresh + recent history)
  server.post('/api/mal/sync', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    if (!cfg.MAL_CLIENT_ID) return reply.code(500).send({ error: 'server_not_configured' })
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const admin = makeAdminSupabase(cfg)
    if (!admin) return reply.code(500).send({ error: 'server_not_configured' })

    // Throttle: allow at most once per 30 minutes
    {
      const { data: row } = await supabase.from('mal_accounts').select('synced_at').eq('user_id', user.id).maybeSingle()
      const last = row?.synced_at ? Date.parse(row.synced_at) : 0
      const cooldown = 30 * 60 * 1000
      if (last && Date.now() - last < cooldown) {
        return reply.code(429).send({ error: 'too_many_requests', retryAfterSec: Math.ceil((cooldown - (Date.now() - last)) / 1000) })
      }
    }

    // Load tokens + username
    const [{ data: acct }, { data: tok }] = await Promise.all([
      supabase.from('mal_accounts').select('mal_username').eq('user_id', user.id).maybeSingle(),
      supabase.from('mal_tokens').select('access_encrypted, refresh_encrypted, iv, auth_tag').eq('user_id', user.id).maybeSingle(),
    ])
    const username: string | undefined = (acct as { mal_username?: string })?.mal_username
    if (!username) return reply.code(400).send({ error: 'not_linked' })

    let accessToken: string | null = null
    if (tok && tokenKey) {
      try {
        accessToken = decryptString(tok.access_encrypted, tok.iv, tok.auth_tag, tokenKey)
      } catch (err) {
        server.log.error({ event: 'mal_token_decrypt_failed', err }, 'Failed to decrypt MAL access token')
      }
    }
    if (!accessToken) return reply.code(400).send({ error: 'missing_access_token' })

    // Fetch history (latest 50)
    const histUrl = `https://api.myanimelist.net/v2/users/${encodeURIComponent(username)}/history?type=anime&limit=50`
    const histRes = await fetch(histUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!histRes.ok) return reply.code(400).send({ error: 'history_fetch_failed' })
    const hist = (await histRes.json()) as { 
      history?: Array<{ 
        node?: { id?: number; title?: string }; 
        anime?: { id?: number; title?: string }; 
        entry?: { id?: number; title?: string }; 
        episode?: number; 
        increment?: number; 
        episodes_watched?: number; 
        date?: string; 
        updated_at?: string; 
        watching_date?: string 
      }> 
    }
    const items: Array<{ mal_id: number; episode: number; watched_at: string; title?: string }> = []
    for (const h of hist?.history || []) {
      // MAL returns { node: { id, title }, list_status? } or { anime: { id, title }, episode, date }
      const node = h?.node || h?.anime || h?.entry
      const id = Number(node?.id)
      if (!Number.isFinite(id)) continue
      const episode = Number(h?.episode || h?.increment || h?.episodes_watched || 0)
      const dateStr: string | undefined = h?.date || h?.updated_at || h?.watching_date
      const watchedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()
      items.push({ mal_id: id, episode: Number.isFinite(episode) && episode > 0 ? episode : 1, watched_at: watchedAt, title: node?.title })
    }

    // Optimized: Batch all database operations
    const historyRows = items.map((it) => ({ user_id: user.id, mal_id: it.mal_id, episode: it.episode, watched_at: it.watched_at }))
    const animeRows = items.map((it) => ({ mal_id: it.mal_id, title: it.title || `Anime #${it.mal_id}`, updated_at: new Date().toISOString() }))
    
    // Execute all database operations in parallel
    const dbOperations = []
    
    if (historyRows.length > 0) {
      dbOperations.push(
        supabase.from('mal_watch_history').upsert(historyRows, { onConflict: 'user_id,mal_id,episode' })
      )
    }
    
    if (animeRows.length > 0) {
      dbOperations.push(
        admin.from('mal_anime').upsert(animeRows, { onConflict: 'mal_id' })
      )
    }
    
    // Update synced_at timestamp
    dbOperations.push(
      supabase.from('mal_accounts').update({ synced_at: new Date().toISOString() }).eq('user_id', user.id)
    )
    
    // Execute all operations in parallel
    if (dbOperations.length > 0) {
      await Promise.all(dbOperations)
    }

    return reply.send({ ok: true, count: historyRows.length })
  })

  // Profile from DB
  server.get('/api/mal/profile', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const { data, error } = await supabase
      .from('mal_accounts')
      .select('mal_user_id, mal_username, display_name, avatar_url, mean_score, days_watched, linked_at, synced_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return reply.code(400).send({ error: error.message })
    return reply.send(data || null)
  })

  // Recent watched items
  server.get('/api/mal/recent', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const { data: hist, error } = await supabase
      .from('mal_watch_history')
      .select('mal_id, episode, watched_at')
      .eq('user_id', user.id)
      .order('watched_at', { ascending: false })
      .limit(25)
    if (error) return reply.code(400).send({ error: error.message })
    const ids = (hist || []).map((h: { mal_id: number }) => h.mal_id)
    const { data: anime } = await supabase.from('mal_anime').select('mal_id, title, main_picture').in('mal_id', ids.length ? ids : [-1])
    const byId: Record<number, { mal_id: number; title?: string; main_picture?: string | null }> = Object.fromEntries((anime || []).map((a: { mal_id: number; title?: string; main_picture?: string | null }) => [a.mal_id, a]))
    const out = (hist || []).map((h: { mal_id: number; episode: number; watched_at: string }) => ({
      mal_id: h.mal_id,
      episode: h.episode,
      watched_at: h.watched_at,
      title: byId[h.mal_id]?.title || `Anime #${h.mal_id}`,
      main_picture: byId[h.mal_id]?.main_picture || null,
    }))
    return reply.send({ items: out })
  })

  // Seasonal lineup (server-cached by MAL, we just proxy and lightly cache in DB)
  server.get('/api/mal/seasonal', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    if (!cfg.MAL_CLIENT_ID) return reply.code(500).send({ error: 'server_not_configured' })
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const admin = makeAdminSupabase(cfg)
    if (!admin) return reply.code(500).send({ error: 'server_not_configured' })
    const now = new Date()
    const m = now.getUTCMonth() + 1
    const year = now.getUTCFullYear()
    const season = m <= 3 ? 'winter' : m <= 6 ? 'spring' : m <= 9 ? 'summer' : 'fall'

    const url = `https://api.myanimelist.net/v2/anime/season/${year}/${season}?limit=100&sort=anime_num_list_users`
    const res = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': cfg.MAL_CLIENT_ID } })
    if (!res.ok) return reply.code(400).send({ error: 'seasonal_fetch_failed' })
    const json = (await res.json()) as { 
      data?: Array<{ 
        node?: { id?: number; title?: string; main_picture?: string | null }; 
        id?: number; 
        title?: string; 
        main_picture?: string | null 
      }>; 
      anime?: Array<{ 
        node?: { id?: number; title?: string; main_picture?: string | null }; 
        id?: number; 
        title?: string; 
        main_picture?: string | null 
      }> 
    }
    const items: Array<{ mal_id: number; title?: string; main_picture: string | null }> = []
    for (const it of json?.data || json?.anime || []) {
      const node = it?.node || it
      const id = Number(node?.id)
      if (!Number.isFinite(id)) continue
      items.push({ mal_id: id, title: node?.title, main_picture: node?.main_picture || null })
    }
    if (items.length > 0) {
      const rows = items.map((a) => ({ mal_id: a.mal_id, title: a.title, main_picture: a.main_picture || null, updated_at: new Date().toISOString() }))
      await admin.from('mal_anime').upsert(rows, { onConflict: 'mal_id' })
    }
    return reply.send({ items })
  })
}



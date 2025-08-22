import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { HandoffStore } from '../integrations/handoffStore.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface RequireUserFunction {
  (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null>
}

interface SteamRouteConfig {
  requireSupabaseUser: RequireUserFunction
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  STEAM_WEB_API_KEY?: string
  OAUTH_REDIRECT_BASE_URL?: string
  OAUTH_REDIRECT_PATH?: string
}

function makeSupabaseForRequest(cfg: SteamRouteConfig, req: FastifyRequest): SupabaseClient | null {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
}

function makeAdminSupabase(cfg: SteamRouteConfig): SupabaseClient | null {
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

function parseSteamIdFromClaimedId(claimedId: string | undefined): string | null {
  if (!claimedId) return null
  // Expected: https://steamcommunity.com/openid/id/76561198000000000
  const m = claimedId.match(/\/openid\/id\/(\d{17})$/)
  return m ? m[1] : null
}

async function verifyOpenIdResponse(params: Record<string, string>): Promise<boolean> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'openid.mode') continue
    body.append(k, v)
  }
  body.append('openid.mode', 'check_authentication')
  const res = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await res.text()
  return /is_valid\s*:\s*true/i.test(text)
}

export function registerSteamRoutes(server: FastifyInstance, cfg: SteamRouteConfig): void {
  const handoffs = new HandoffStore<{ userId: string }>()

  // Start OpenID link flow
  server.post('/api/steam/link/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const state = crypto.randomUUID()
    handoffs.put(`state:${state}`, { userId: user.id })

    const base = buildServerBaseUrl(request)
    const returnTo = `${base}/api/steam/link/callback?state=${encodeURIComponent(state)}`
    const realm = base

    const u = new URL('https://steamcommunity.com/openid/login')
    u.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0')
    u.searchParams.set('openid.mode', 'checkid_setup')
    u.searchParams.set('openid.return_to', returnTo)
    u.searchParams.set('openid.realm', realm)
    u.searchParams.set('openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select')
    u.searchParams.set('openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select')

    const url = u.toString()
    server.log.info({ event: 'steam_link_start', userId: user.id })
    return reply.send({ url })
  })

  // OpenID callback
  server.get('/api/steam/link/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = (request.query as Record<string, unknown>) || {}
    const state = q?.state as string | undefined
    if (!state) return reply.code(400).send({ error: 'missing_state' })
    const stateInfo = handoffs.take(`state:${state}`)
    if (!stateInfo) return reply.code(400).send({ error: 'invalid_state' })

    // Collect all openid.* params from query into a map
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(q)) {
      if (k.startsWith('openid.')) params[k] = String(v)
    }
    const ok = await verifyOpenIdResponse(params)
    if (!ok) return reply.code(400).send({ error: 'verification_failed' })

    const steamid = parseSteamIdFromClaimedId(params['openid.claimed_id'])
    if (!steamid) return reply.code(400).send({ error: 'invalid_claimed_id' })

    // Use admin client to bypass RLS for linking
    const admin = makeAdminSupabase(cfg)
    if (!admin) return reply.code(500).send({ error: 'server_not_configured' })

    // Upsert steam_accounts (RLS-bypassed)
    const { error } = await admin
      .from('steam_accounts')
      .upsert({ user_id: stateInfo.userId, steamid64: steamid, linked_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) return reply.code(400).send({ error: error.message })

    const redirectBase = cfg.OAUTH_REDIRECT_BASE_URL || 'http://localhost:8080'
    const redirectPath = cfg.OAUTH_REDIRECT_PATH || '/steam'
    const url = `${redirectBase}${redirectPath}?steam_linked=1`
    server.log.info({ event: 'steam_link_callback_ok', userId: stateInfo.userId, steamid })
    return reply.redirect(url)
  })

  // Trigger sync
  server.post('/api/steam/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    if (!cfg.STEAM_WEB_API_KEY) return reply.code(500).send({ error: 'missing_steam_api_key' })

    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const admin = makeAdminSupabase(cfg)
    if (!admin) return reply.code(500).send({ error: 'server_not_configured' })

    // Optimized: Fetch account data and check throttling in one call
    const { data: acct } = await supabase
      .from('steam_accounts')
      .select('steamid64, synced_at')
      .eq('user_id', user.id)
      .maybeSingle()
    
    const steamid: string | undefined = acct?.steamid64
    if (!steamid) return reply.code(400).send({ error: 'not_linked' })
    
    // Check throttling using the data we already fetched
    const last = acct?.synced_at ? Date.parse(acct.synced_at) : 0
    const sixHours = 6 * 60 * 60 * 1000
    if (last && Date.now() - last < sixHours) {
      return reply.code(429).send({ error: 'too_many_requests', retryAfterSec: Math.ceil((sixHours - (Date.now() - last)) / 1000) })
    }
    
    server.log.info({ event: 'steam_sync_start', userId: user.id })

    const key = cfg.STEAM_WEB_API_KEY

    // Fetch player summaries
    const sumRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(key!)}&steamids=${encodeURIComponent(steamid)}`)
    const sumJson = (await sumRes.json()) as { response?: { players?: Array<{ personaname?: string; avatarfull?: string; avatar?: string; communityvisibilitystate?: number; loccountrycode?: string }> } }
    const player = (sumJson?.response?.players || [])[0] || {}

    // Update profile fields
    await (admin)
      .from('steam_accounts')
      .update({
        persona_name: player?.personaname || null,
        avatar_url: player?.avatarfull || player?.avatar || null,
        profile_visibility: typeof player?.communityvisibilitystate === 'number' ? String(player.communityvisibilitystate) : null,
        country: player?.loccountrycode || null,
        synced_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    // Fetch owned games with appinfo
    const ownRes = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(key!)}&steamid=${encodeURIComponent(steamid)}&include_appinfo=1&include_played_free_games=1&format=json`)
    const ownJson = (await ownRes.json()) as { response?: { games?: Array<{ appid?: number; name?: string; is_free?: boolean; playtime_forever?: number; playtime_2weeks?: number; rtime_last_played?: number }> } }
    const games = ownJson?.response?.games || []

    // Upsert steam_games and steam_ownership
    const ownershipRows: Array<{ user_id: string; appid: number; playtime_forever_minutes: number; playtime_2weeks_minutes: number; last_played_at: string | null }> = []
    const gameRows: Array<{ appid: number; name: string | null; header_image: string; genres: string | null; metascore: number | null; is_free: boolean | null; updated_at: string }> = []
    for (const g of games) {
      const appid = Number(g?.appid)
      if (!Number.isFinite(appid)) continue
      const header = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
      gameRows.push({
        appid,
        name: typeof g?.name === 'string' ? g.name : null,
        header_image: header,
        genres: null,
        metascore: null,
        is_free: typeof g?.is_free === 'boolean' ? g.is_free : null,
        updated_at: new Date().toISOString(),
      })
      const rtime = typeof g?.rtime_last_played === 'number' ? g.rtime_last_played : null
      ownershipRows.push({
        user_id: user.id,
        appid,
        playtime_forever_minutes: typeof g?.playtime_forever === 'number' ? g.playtime_forever : 0,
        playtime_2weeks_minutes: typeof g?.playtime_2weeks === 'number' ? g.playtime_2weeks : 0,
        last_played_at: rtime ? new Date(rtime * 1000).toISOString() : null,
      })
    }

    // Optimized: Batch all database operations
    const dbOperations = []
    
    if (gameRows.length > 0) {
      dbOperations.push(
        admin.from('steam_games').upsert(gameRows, { onConflict: 'appid' })
      )
    }
    
    if (ownershipRows.length > 0) {
      dbOperations.push(
        admin.from('steam_ownership').upsert(ownershipRows, { onConflict: 'user_id,appid' })
      )
    }
    
    // Execute all operations in parallel
    if (dbOperations.length > 0) {
      await Promise.all(dbOperations)
    }

    // Optionally enrich recent with GetRecentlyPlayedGames
    try {
      const recentRes = await fetch(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${encodeURIComponent(key!)}&steamid=${encodeURIComponent(steamid)}&count=100&format=json`)
      if (recentRes.ok) {
        const recentJson = (await recentRes.json()) as { response?: { games?: Array<{ appid?: number; playtime_2weeks?: number }> } }
        const rec = recentJson?.response?.games || []
        if (rec.length > 0) {
          const recRows = rec.map((g) => ({
            user_id: user.id,
            appid: Number(g?.appid),
            playtime_2weeks_minutes: typeof g?.playtime_2weeks === 'number' ? g.playtime_2weeks : 0,
          })).filter((r) => Number.isFinite(r.appid))
          if (recRows.length > 0) await admin.from('steam_ownership').upsert(recRows, { onConflict: 'user_id,appid' })
        }
      }
    } catch (err) {
      server.log.error({ event: 'steam_recent_enrich_failed', err }, 'Failed to enrich with recently played games')
    }

    server.log.info({ event: 'steam_sync_ok', userId: user.id, count: ownershipRows.length })
    return reply.send({ ok: true, count: ownershipRows.length })
  })

  // Get profile
  server.get('/api/steam/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const { data, error } = await supabase
      .from('steam_accounts')
      .select('steamid64, persona_name, avatar_url, profile_visibility, country, steam_level, linked_at, synced_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return reply.code(400).send({ error: error.message })
    return reply.send(data || null)
  })

  // Get library with pagination/sort (DB-side)
  server.get('/api/steam/library', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })

    const q = (request.query as Record<string, unknown>) || {}
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 50))
    const sort = (q.sort as string) || 'name'
    const order: 'asc' | 'desc' = (String(q.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc')
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Join ownership with games and order at DB level
    let query = supabase
      .from('steam_ownership')
      .select('appid, playtime_forever_minutes, playtime_2weeks_minutes, last_played_at, steam_games(name, header_image, genres, metascore, is_free)', { count: 'exact' })
      .eq('user_id', user.id)

    if (sort === 'playtime') {
      query = query.order('playtime_forever_minutes', { ascending: order === 'asc' })
    } else if (sort === 'last_played') {
      query = query.order('last_played_at', { ascending: order === 'asc', nullsFirst: order === 'asc' })
    } else {
      // sort by game name via foreign table
      query = query.order('name', { ascending: order === 'asc', foreignTable: 'steam_games' })
    }

    const { data, error, count } = await query.range(from, to)
    if (error) return reply.code(400).send({ error: error.message })

    const items = (data || []).map((row) => {
      const gameInfo = Array.isArray(row.steam_games) ? row.steam_games[0] : row.steam_games
      return {
        appid: row.appid,
        name: gameInfo?.name || String(row.appid),
        header_image: gameInfo?.header_image || null,
        genres: gameInfo?.genres || null,
        metascore: gameInfo?.metascore ?? null,
        is_free: gameInfo?.is_free ?? null,
        playtime_forever_minutes: row.playtime_forever_minutes || 0,
        playtime_2weeks_minutes: row.playtime_2weeks_minutes || 0,
        last_played_at: row.last_played_at || null,
      }
    })


    return reply.send({ items, page, pageSize, total: count || 0 })
  })

  // Recently played (with names)
  server.get('/api/steam/recent', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const { data, error } = await supabase
      .from('steam_ownership')
      .select('appid, playtime_2weeks_minutes, last_played_at, steam_games(name)')
      .eq('user_id', user.id)
      .order('playtime_2weeks_minutes', { ascending: false })
    if (error) return reply.code(400).send({ error: error.message })
    const recent = (data || [])
      .filter((o) => (o.playtime_2weeks_minutes || 0) > 0)
      .map((o) => {
        const gameInfo = Array.isArray(o.steam_games) ? o.steam_games[0] : o.steam_games
        return {
          appid: o.appid,
          name: gameInfo?.name || String(o.appid),
          playtime_2weeks_minutes: o.playtime_2weeks_minutes,
          last_played_at: o.last_played_at || null
        }
      })

    return reply.send({ items: recent })
  })

  // Basic game detail for user
  server.get('/api/steam/game/:appid', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const params = z.object({ appid: z.string() }).parse(request.params as Record<string, unknown>)
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const id = Number(params.appid)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_appid' })
    const [{ data: game }, { data: own }] = await Promise.all([
      supabase.from('steam_games').select('*').eq('appid', id).maybeSingle(),
      supabase.from('steam_ownership').select('*').eq('user_id', user.id).eq('appid', id).maybeSingle(),
    ])

    return reply.send({ game: game || null, ownership: own || null })
  })

  // Suggestions v0 (include names)
  server.get('/api/steam/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const supabase = makeSupabaseForRequest(cfg, request)
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' })
    const { data: own, error } = await supabase
      .from('steam_ownership')
      .select('appid, playtime_forever_minutes, playtime_2weeks_minutes, last_played_at')
      .eq('user_id', user.id)
    if (error) return reply.code(400).send({ error: error.message })
    const now = Date.now()
    const items = (own || []).map((o) => {
      const minutes = o.playtime_forever_minutes || 0
      const twoWeeks = o.playtime_2weeks_minutes || 0
      const last = o.last_played_at ? Date.parse(o.last_played_at) : 0
      const months6 = 1000 * 60 * 60 * 24 * 30 * 6
      const stale = last ? (now - last) > months6 : true
      // v1 heuristic simplified
      let score = 0
      if (minutes === 0 || minutes < 120) score += 0.4
      if (twoWeeks === 0) score += 0.2
      if (stale) score += 0.2
      return { appid: o.appid, score }
    })
    const top = items.filter((i) => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 10)
    const ids = top.map((t) => t.appid)
    const { data: games } = await supabase
      .from('steam_games')
      .select('appid, name')
      .in('appid', ids.length ? ids : [-1])
    const nameById = Object.fromEntries((games || []).map((g) => [g.appid, g.name]))
    const withNames = top.map((t) => ({ ...t, name: nameById[t.appid] || String(t.appid) }))

    return reply.send({ items: withNames })
  })
}



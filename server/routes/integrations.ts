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
  YT_CLIENT_ID?: string
  YT_CLIENT_SECRET?: string
  YT_REDIRECT_URI?: string
  YTM_CLIENT_ID?: string
  YTM_CLIENT_SECRET?: string
  YTM_REDIRECT_URI?: string
  SPOTIFY_CLIENT_ID?: string
  SPOTIFY_CLIENT_SECRET?: string
  SPOTIFY_REDIRECT_URI?: string
}

export function registerIntegrationRoutes(server: FastifyInstance, cfg: IntegrationConfig) {
  const registry = new ProviderRegistry({
    reddit: { clientId: cfg.REDDIT_CLIENT_ID, clientSecret: cfg.REDDIT_CLIENT_SECRET, redirectUri: cfg.REDDIT_REDIRECT_URI },
    google: { clientId: cfg.GOOGLE_CLIENT_ID, clientSecret: cfg.GOOGLE_CLIENT_SECRET, redirectUri: cfg.GOOGLE_REDIRECT_URI },
    microsoft: { clientId: cfg.MS_CLIENT_ID, clientSecret: cfg.MS_CLIENT_SECRET, redirectUri: cfg.MS_REDIRECT_URI },
    youtube: { clientId: cfg.YT_CLIENT_ID, clientSecret: cfg.YT_CLIENT_SECRET, redirectUri: cfg.YT_REDIRECT_URI },
    youtubemusic: { clientId: cfg.YTM_CLIENT_ID, clientSecret: cfg.YTM_CLIENT_SECRET, redirectUri: cfg.YTM_REDIRECT_URI },
    spotify: { clientId: cfg.SPOTIFY_CLIENT_ID, clientSecret: cfg.SPOTIFY_CLIENT_SECRET, redirectUri: cfg.SPOTIFY_REDIRECT_URI },
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

  // Aggregation endpoints to centralize fetchers and hide token usage specifics
  server.get('/aggregations/reddit', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { sub_limit, posts_per_sub } = (request.query as any) || {}
    const subLimit = Number(sub_limit) > 0 ? Number(sub_limit) : 10
    const postsPerSub = Number(posts_per_sub) > 0 ? Number(posts_per_sub) : 5

    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString(), 'User-Agent': 'ever-life-vault/1.0' }
    const subsRes = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber', { headers })
    if (!subsRes.ok) return reply.code(200).send({ items: [] })
    const subsJson = (await subsRes.json()) as any
    const subNames: string[] = (subsJson?.data?.children || []).map((c: any) => c?.data?.display_name).filter(Boolean)
    const out: any[] = []
    for (const sub of subNames.slice(0, subLimit)) {
      const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/top?t=day&limit=${postsPerSub}`, { headers })
      if (!res.ok) continue
      const json = (await res.json()) as any
      for (const child of json?.data?.children || []) {
        const d = child?.data
        out.push({
          id: `reddit_${d?.id}`,
          provider: 'reddit',
          title: d?.title,
          url: d?.url_overridden_by_dest || `https://reddit.com${d?.permalink}`,
          author: d?.author,
          timestamp: d?.created_utc ? d.created_utc * 1000 : undefined,
          score: d?.score,
          extra: { subreddit: d?.subreddit, comments: d?.num_comments },
        })
      }
    }
    return reply.send({ items: out })
  })

  server.get('/aggregations/twitter', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    let username: string | undefined
    let userId: string | undefined
    const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name', { headers })
    if (meRes.ok) {
      const me = (await meRes.json()) as any
      userId = me?.data?.id
      username = me?.data?.username
    }
    if (!userId) return reply.send({ items: [] })
    const url = `https://api.twitter.com/2/users/${encodeURIComponent(userId)}/tweets?max_results=${Math.min(100, max)}&tweet.fields=created_at,public_metrics&exclude=replies`
    const res = await fetch(url, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const out: any[] = []
    for (const t of json?.data || []) {
      const metrics = t?.public_metrics || {}
      const score = [metrics.like_count, metrics.retweet_count, metrics.reply_count, metrics.quote_count]
        .map((n: any) => (typeof n === 'number' ? n : 0))
        .reduce((a: number, b: number) => a + b, 0)
      out.push({
        id: `twitter_${t.id}`,
        provider: 'twitter',
        title: typeof t.text === 'string' ? t.text : '(tweet)',
        url: username ? `https://twitter.com/${username}/status/${t.id}` : `https://twitter.com/i/web/status/${t.id}`,
        author: username ? `@${username}` : undefined,
        timestamp: t?.created_at ? Date.parse(t.created_at) : undefined,
        score,
      })
    }
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/facebook', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://graph.facebook.com/v19.0/me/feed?fields=message,story,permalink_url,created_time,from&limit=${Math.min(100, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const out: any[] = []
    for (const p of json?.data || []) {
      const title: string = p?.message || p?.story || '(post)'
      const author: string | undefined = p?.from?.name
      const timestamp = p?.created_time ? Date.parse(p.created_time) : undefined
      const url: string | undefined = typeof p?.permalink_url === 'string' ? p.permalink_url : undefined
      out.push({ id: `facebook_${p.id}`, provider: 'facebook', title, author, timestamp, url })
    }
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/instagram', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,permalink,timestamp,username&limit=${Math.min(100, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const out: any[] = []
    for (const m of json?.data || []) {
      out.push({
        id: `instagram_${m.id}`,
        provider: 'instagram',
        title: m?.caption || '(media)',
        url: m?.permalink,
        author: m?.username ? `@${m.username}` : undefined,
        timestamp: m?.timestamp ? Date.parse(m.timestamp) : undefined,
      })
    }
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/gmail', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 25
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread&maxResults=${Math.min(500, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const ids: string[] = (json?.messages || []).map((m: any) => (m as any).id)
    const out: any[] = []
    for (const id of ids.slice(0, max)) {
      const mRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers })
      if (!mRes.ok) continue
      const m = (await mRes.json()) as any
      const headersArr: Array<{ name: string; value: string }> = m?.payload?.headers || []
      const subject = headersArr.find(h => h.name === 'Subject')?.value
      const from = headersArr.find(h => h.name === 'From')?.value
      const date = headersArr.find(h => h.name === 'Date')?.value
      out.push({ id: `gmail_${(m as any).id}`, provider: 'gmail', title: subject || '(no subject)', author: from, timestamp: date ? Date.parse(date) : undefined, url: `https://mail.google.com/mail/u/0/#all/${(m as any).id}` })
    }
    return reply.send({ items: out })
  })

  server.get('/aggregations/outlook', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 25
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$filter=isRead%20eq%20false&$top=${Math.min(50, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const out: any[] = []
    for (const m of (json?.value || []) as any[]) {
      out.push({ id: `outlook_${(m as any).id}`, provider: 'outlook', title: (m as any).subject || '(no subject)', author: (m as any).from?.emailAddress?.name, timestamp: (m as any).receivedDateTime ? Date.parse((m as any).receivedDateTime) : undefined, url: undefined })
    }
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/youtube', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    // Fetch latest uploads from subscriptions
    const subsRes = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', { headers: { ...headers, Accept: 'application/json' } })
    if (!subsRes.ok) return reply.send({ items: [] })
    const subsJson = (await subsRes.json()) as any
    const channelIds: string[] = (subsJson?.items || []).map((it: any) => it?.snippet?.resourceId?.channelId).filter(Boolean)
    const out: any[] = []
    // Fetch latest videos for each channel via search (publishedAfter not used here; limit overall)
    for (const channelId of channelIds.slice(0, 25)) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=5`
      const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } })
      if (!res.ok) continue
      const json = (await res.json()) as any
      for (const it of json?.items || []) {
        if ((it?.id?.kind as string) !== 'youtube#video') continue
        const vid = it?.id?.videoId
        const snippet = it?.snippet
        out.push({
          id: `youtube_${vid}`,
          provider: 'youtube',
          title: snippet?.title || '(video)',
          url: vid ? `https://www.youtube.com/watch?v=${vid}` : undefined,
          author: snippet?.channelTitle,
          timestamp: snippet?.publishedAt ? Date.parse(snippet.publishedAt) : undefined,
        })
      }
      if (out.length >= max) break
    }
    out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/youtubemusic', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    // YouTube Music doesn't have a distinct public API; use YouTube Data API liked videos as proxy for music activity
    const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&myRating=like&maxResults=50', { headers: { ...headers, Accept: 'application/json' } })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const out: any[] = []
    for (const v of json?.items || []) {
      const vid = v?.id
      const sn = v?.snippet
      out.push({
        id: `youtubemusic_${vid}`,
        provider: 'youtubemusic',
        title: sn?.title || '(liked video)',
        url: vid ? `https://music.youtube.com/watch?v=${vid}` : undefined,
        author: sn?.channelTitle,
        timestamp: sn?.publishedAt ? Date.parse(sn.publishedAt) : undefined,
      })
    }
    out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/spotify', async (request, reply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as any
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as any) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${Math.min(50, max)}`, { headers: { ...headers, Accept: 'application/json' } })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as any
    const out: any[] = []
    for (const it of json?.items || []) {
      const track = it?.track
      const playedAt = it?.played_at
      if (!track) continue
      const url = (track?.external_urls?.spotify as string | undefined)
      const name = (track?.name as string | undefined)
      const artists = Array.isArray(track?.artists) ? track.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : undefined
      out.push({
        id: `spotify_${track?.id || playedAt}`,
        provider: 'spotify',
        title: name || '(track)',
        url,
        author: artists,
        timestamp: playedAt ? Date.parse(playedAt) : undefined,
      })
    }
    out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return reply.send({ items: out.slice(0, max) })
  })
}



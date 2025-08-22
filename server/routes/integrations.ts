import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'node:crypto'
import { ProviderRegistry } from '../integrations/registry.js'
import { HandoffStore } from '../integrations/handoffStore.js'
import { InvalidStateError, UnsupportedProviderError, toHttpError } from '../integrations/errors.js'

interface RequireUserFunction {
  (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null>
}

export interface IntegrationConfig {
  requireSupabaseUser: RequireUserFunction
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

export function registerIntegrationRoutes(server: FastifyInstance, cfg: IntegrationConfig): void {
  const registry = new ProviderRegistry({
    reddit: { clientId: cfg.REDDIT_CLIENT_ID, clientSecret: cfg.REDDIT_CLIENT_SECRET, redirectUri: cfg.REDDIT_REDIRECT_URI },
    google: { clientId: cfg.GOOGLE_CLIENT_ID, clientSecret: cfg.GOOGLE_CLIENT_SECRET, redirectUri: cfg.GOOGLE_REDIRECT_URI },
    microsoft: { clientId: cfg.MS_CLIENT_ID, clientSecret: cfg.MS_CLIENT_SECRET, redirectUri: cfg.MS_REDIRECT_URI },
    youtube: { clientId: cfg.YT_CLIENT_ID, clientSecret: cfg.YT_CLIENT_SECRET, redirectUri: cfg.YT_REDIRECT_URI },
    youtubemusic: { clientId: cfg.YTM_CLIENT_ID, clientSecret: cfg.YTM_CLIENT_SECRET, redirectUri: cfg.YTM_REDIRECT_URI },
    spotify: { clientId: cfg.SPOTIFY_CLIENT_ID, clientSecret: cfg.SPOTIFY_CLIENT_SECRET, redirectUri: cfg.SPOTIFY_REDIRECT_URI },
  })
  const handoffs = new HandoffStore<{ provider: string; tokens: unknown; userId?: string }>()

  server.get('/integrations/oauth/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { provider } = (request.query as Record<string, unknown>) || {}
    if (!provider || typeof provider !== 'string') return reply.code(400).send({ error: 'Missing provider' })

    try {
      const state = crypto.randomUUID()
      const p = registry.get(provider)
      if (!p) throw new UnsupportedProviderError(provider)
      const url = p.buildAuthorizationUrl(state)
      handoffs.put(`state:${state}`, { provider, tokens: null, userId: user.id })
      server.log.info({ event: 'oauth_start', provider, userId: user.id }, 'OAuth start')
      return reply.send({ url })
    } catch (err) {
      const { status, body } = toHttpError(err)
      server.log.error({ event: 'oauth_start_error', provider, err }, 'OAuth start error')
      return reply.code(status).send(body)
    }
  })

  server.get('/integrations/oauth/callback/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    const { provider } = (request.params as Record<string, unknown>)
    const { code, state, error } = (request.query as Record<string, unknown>) || {}
    if (error) {
      server.log.error({ provider, error }, 'OAuth error')
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(String(provider))}&reason=${encodeURIComponent(String(error))}`)
    }
    try {
      const p = registry.get(String(provider))
      if (!p) throw new UnsupportedProviderError(String(provider))
      const stateInfo = handoffs.take(`state:${state}`)
      if (!stateInfo) throw new InvalidStateError()
      const tokenResult = await p.exchangeCodeForTokens(String(code))
      const handoffId = `handoff:${crypto.randomUUID()}`
      handoffs.put(handoffId, { provider: String(provider), tokens: tokenResult })
      server.log.info({ event: 'oauth_callback', provider, userId: stateInfo.userId, handoffId }, 'OAuth callback success')
      const redirectUrl = `${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?handoff=${encodeURIComponent(handoffId)}&provider=${encodeURIComponent(String(provider))}`
      return reply.redirect(redirectUrl)
    } catch (err) {
      server.log.error(err)
      const reason = err instanceof Error && 'code' in err ? (err as { code: string }).code : 'exception'
      server.log.error({ event: 'oauth_callback_error', provider, reason, err }, 'OAuth callback error')
      return reply.redirect(`${cfg.OAUTH_REDIRECT_BASE_URL}${cfg.OAUTH_REDIRECT_PATH}?oauth=error&provider=${encodeURIComponent(String(provider))}&reason=${encodeURIComponent(reason)}`)
    }
  })

  server.get('/integrations/oauth/handoff', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { id } = (request.query as Record<string, unknown>) || {}
    if (!id || typeof id !== 'string') return reply.code(400).send({ error: 'Missing id' })
    
    const payload = handoffs.take(id)
    if (!payload) {
      server.log.warn({ event: 'oauth_handoff_not_found', handoffId: id, userId: user.id }, 'OAuth handoff not found or expired')
      return reply.code(404).send({ error: 'Handoff not found or expired' })
    }
    
    server.log.info({ event: 'oauth_handoff_success', handoffId: id, provider: payload.provider, userId: user.id }, 'OAuth handoff completed')
    return reply.send(payload)
  })

  server.get('/integrations/oauth/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { handoff, provider } = (request.query as Record<string, unknown>) || {}
    if (!handoff || typeof handoff !== 'string') return reply.code(400).send({ error: 'Missing handoff parameter' })
    
    try {
      const payload = handoffs.take(handoff)
      if (!payload) {
        return reply.code(404).send({ error: 'Handoff not found or expired' })
      }
      
      server.log.info({ event: 'oauth_complete_success', handoff, provider: payload.provider, userId: user.id }, 'OAuth completion successful')
      return reply.send({ success: true, provider: payload.provider, tokens: payload.tokens })
    } catch (error) {
      server.log.error({ event: 'oauth_complete_error', handoff, provider, userId: user.id, error }, 'OAuth completion failed')
      return reply.code(500).send({ error: 'Failed to complete OAuth' })
    }
  })

  server.post('/integrations/oauth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { provider, refresh_token } = (request.body as Record<string, unknown>) || {}
    if (!provider || !refresh_token || typeof provider !== 'string' || typeof refresh_token !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid provider or refresh_token' })
    }
    try {
      const p = registry.get(provider)
      if (!p) throw new UnsupportedProviderError(provider)
      const tokenResult = await p.refreshTokens(refresh_token)
      server.log.info({ event: 'oauth_refresh_success', provider, userId: user.id }, 'OAuth refresh success')
      return reply.send({ provider, tokens: tokenResult })
    } catch (err) {
      const { status, body } = toHttpError(err)
      server.log.error({ event: 'oauth_refresh_error', provider, userId: user.id, err }, 'OAuth refresh error')
      return reply.code(status).send(body)
    }
  })

  // Aggregation endpoints to centralize fetchers and hide token usage specifics
  server.get('/aggregations/reddit', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { sub_limit, posts_per_sub } = (request.query as Record<string, unknown>) || {}
    const subLimit = Number(sub_limit) > 0 ? Number(sub_limit) : 10
    const postsPerSub = Number(posts_per_sub) > 0 ? Number(posts_per_sub) : 5

    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString(), 'User-Agent': 'ever-life-vault/1.0' }
    const subsRes = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber', { headers })
    try {
      const rateRemaining = subsRes.headers?.get?.('x-ratelimit-remaining')
      const rateUsed = subsRes.headers?.get?.('x-ratelimit-used')
      const rateReset = subsRes.headers?.get?.('x-ratelimit-reset')
      server.log.info({
        event: 'aggregation_upstream',
        provider: 'reddit',
        step: 'subreddits',
        status: subsRes.status,
        ratelimit_remaining: rateRemaining,
        ratelimit_used: rateUsed,
        ratelimit_reset: rateReset,
      }, 'Upstream request')
    } catch {}
    if (!subsRes.ok) {
      if (subsRes.status === 429) {
        const retryAfter = subsRes.headers.get('retry-after')
        server.log.warn({ event: 'reddit_rate_limit', retryAfter }, 'Reddit rate limit hit')
        return reply.code(429).send({ 
          error: 'Rate limited by Reddit', 
          retryAfter: retryAfter ? parseInt(retryAfter) : 60 
        })
      }
      return reply.code(200).send({ items: [] })
    }
    const subsJson = (await subsRes.json()) as { data?: { children?: Array<{ data?: { display_name?: string } }> } }
    const subNames: string[] = (subsJson?.data?.children || [])
      .map((c) => c?.data?.display_name)
      .filter((name): name is string => Boolean(name))
      .filter((name: string) => /^[A-Za-z0-9_]{1,21}$/.test(name)) // Valid subreddit name pattern
    const out: Array<{ id: string; provider: string; title?: string; url: string; author?: string; timestamp?: number; score?: number; extra: { subreddit?: string; comments?: number } }> = []
    for (const sub of subNames.slice(0, subLimit)) {
      const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/top?t=day&limit=${postsPerSub}`, { headers })
      try {
        const rateRemaining = res.headers?.get?.('x-ratelimit-remaining')
        const rateUsed = res.headers?.get?.('x-ratelimit-used')
        const rateReset = res.headers?.get?.('x-ratelimit-reset')
        server.log.info({
          event: 'aggregation_upstream',
          provider: 'reddit',
          step: 'sub_top',
          subreddit: sub,
          status: res.status,
          ratelimit_remaining: rateRemaining,
          ratelimit_used: rateUsed,
          ratelimit_reset: rateReset,
        }, 'Upstream request')
      } catch {}
      if (!res.ok) continue
      const json = (await res.json()) as { data?: { children?: Array<{ data?: { id?: string; title?: string; url_overridden_by_dest?: string; permalink?: string; author?: string; created_utc?: number; score?: number; subreddit?: string; num_comments?: number } }> } }
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
    server.log.info({ event: 'aggregation_result', provider: 'reddit', userId: user.id, count: out.length, subLimit, postsPerSub }, 'Aggregation result')
    return reply.send({ items: out })
  })

  server.get('/aggregations/twitter', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    let username: string | undefined
    let userId: string | undefined
    const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name', { headers })
    if (meRes.ok) {
      const me = (await meRes.json()) as { data?: { id?: string; username?: string } }
      userId = me?.data?.id
      username = me?.data?.username
    }
    if (!userId) return reply.send({ items: [] })
    const url = `https://api.twitter.com/2/users/${encodeURIComponent(userId)}/tweets?max_results=${Math.min(100, max)}&tweet.fields=created_at,public_metrics&exclude=replies`
    const res = await fetch(url, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { data?: Array<{ id: string; text?: string; created_at?: string; public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number } }> }
    const out: Array<{ id: string; provider: string; title: string; url: string; author?: string; timestamp?: number; score: number }> = []
    for (const t of json?.data || []) {
      const metrics = t?.public_metrics || {}
      const score = [metrics.like_count, metrics.retweet_count, metrics.reply_count, metrics.quote_count]
        .map((n) => (typeof n === 'number' ? n : 0))
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

  server.get('/aggregations/facebook', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://graph.facebook.com/v19.0/me/feed?fields=message,story,permalink_url,created_time,from&limit=${Math.min(100, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { data?: Array<{ id: string; message?: string; story?: string; permalink_url?: string; created_time?: string; from?: { name?: string } }> }
    const out: Array<{ id: string; provider: string; title: string; author?: string; timestamp?: number; url?: string }> = []
    for (const p of json?.data || []) {
      const title: string = p?.message || p?.story || '(post)'
      const author: string | undefined = p?.from?.name
      const timestamp = p?.created_time ? Date.parse(p.created_time) : undefined
      const url: string | undefined = typeof p?.permalink_url === 'string' ? p.permalink_url : undefined
      out.push({ id: `facebook_${p.id}`, provider: 'facebook', title, author, timestamp, url })
    }
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/instagram', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,permalink,timestamp,username&limit=${Math.min(100, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { data?: Array<{ id: string; caption?: string; permalink?: string; timestamp?: string; username?: string }> }
    const out: Array<{ id: string; provider: string; title: string; url?: string; author?: string; timestamp?: number }> = []
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

  server.get('/aggregations/gmail', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 25
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread&maxResults=${Math.min(500, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { messages?: Array<{ id: string }> }
    const ids: string[] = (json?.messages || []).map((m) => m.id)
    const out: Array<{ id: string; provider: string; title: string; author?: string; timestamp?: number; url: string }> = []
    for (const id of ids.slice(0, max)) {
      const mRes = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers })
      if (!mRes.ok) continue
      const m = (await mRes.json()) as { id: string; payload?: { headers?: Array<{ name: string; value: string }> } }
      const headersArr: Array<{ name: string; value: string }> = m?.payload?.headers || []
      const subject = headersArr.find(h => h.name === 'Subject')?.value
      const from = headersArr.find(h => h.name === 'From')?.value
      const date = headersArr.find(h => h.name === 'Date')?.value
      out.push({ id: `gmail_${m.id}`, provider: 'gmail', title: subject || '(no subject)', author: from, timestamp: date ? Date.parse(date) : undefined, url: `https://mail.google.com/mail/u/0/#all/${m.id}` })
    }
    return reply.send({ items: out })
  })

  server.get('/aggregations/outlook', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 25
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$filter=isRead%20eq%20false&$top=${Math.min(50, max)}`, { headers })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { value?: Array<{ id: string; subject?: string; from?: { emailAddress?: { name?: string } }; receivedDateTime?: string }> }
    const out: Array<{ id: string; provider: string; title: string; author?: string; timestamp?: number; url: undefined }> = []
    for (const m of (json?.value || [])) {
      out.push({ id: `outlook_${m.id}`, provider: 'outlook', title: m.subject || '(no subject)', author: m.from?.emailAddress?.name, timestamp: m.receivedDateTime ? Date.parse(m.receivedDateTime) : undefined, url: undefined })
    }
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/youtube', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    // Fetch latest uploads from subscriptions
    const subsRes = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', { headers: { ...headers, Accept: 'application/json' } })
    server.log.info({ event: 'aggregation_upstream', provider: 'youtube', step: 'subscriptions', status: subsRes.status }, 'Upstream request')
    if (!subsRes.ok) return reply.send({ items: [] })
    const subsJson = (await subsRes.json()) as { items?: Array<{ snippet?: { resourceId?: { channelId?: string } } }> }
    const channelIds: string[] = (subsJson?.items || [])
      .map((it) => it?.snippet?.resourceId?.channelId)
      .filter((id): id is string => Boolean(id))
    const out: Array<{ id: string; provider: string; title: string; url?: string; author?: string; timestamp?: number }> = []
    // Fetch latest videos for each channel via search (publishedAfter not used here; limit overall)
    for (const channelId of channelIds.slice(0, 25)) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=5`
      const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } })
      server.log.info({ event: 'aggregation_upstream', provider: 'youtube', step: 'search', channelId, status: res.status }, 'Upstream request')
      if (!res.ok) continue
      const json = (await res.json()) as { items?: Array<{ id?: { kind?: string; videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }> }
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
    server.log.info({ event: 'aggregation_result', provider: 'youtube', userId: user.id, count: out.length, limit: max }, 'Aggregation result')
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/youtubemusic', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    // YouTube Music doesn't have a distinct public API; use YouTube Data API liked videos as proxy for music activity
    const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&myRating=like&maxResults=50', { headers: { ...headers, Accept: 'application/json' } })
    server.log.info({ event: 'aggregation_upstream', provider: 'youtubemusic', step: 'liked_videos', status: res.status }, 'Upstream request')
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { items?: Array<{ id?: string; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }> }
    const out: Array<{ id: string; provider: string; title: string; url?: string; author?: string; timestamp?: number }> = []
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
    server.log.info({ event: 'aggregation_result', provider: 'youtubemusic', userId: user.id, count: out.length, limit: max }, 'Aggregation result')
    return reply.send({ items: out.slice(0, max) })
  })

  server.get('/aggregations/spotify', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return
    const { ['x-target-authorization']: targetAuth } = request.headers as Record<string, string | string[] | undefined>
    const token = Array.isArray(targetAuth) ? targetAuth[0] : targetAuth
    const { limit } = (request.query as Record<string, unknown>) || {}
    const max = Number(limit) > 0 ? Number(limit) : 20
    if (!token) return reply.code(400).send({ error: 'Missing provider token' })
    const headers: Record<string, string> = { Authorization: token.toString() }
    const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${Math.min(50, max)}`, { headers: { ...headers, Accept: 'application/json' } })
    if (!res.ok) return reply.send({ items: [] })
    const json = (await res.json()) as { items?: Array<{ track?: { id?: string; name?: string; external_urls?: { spotify?: string }; artists?: Array<{ name?: string }> }; played_at?: string }> }
    const out: Array<{ id: string; provider: string; title: string; url?: string; author?: string; timestamp?: number }> = []
    for (const it of json?.items || []) {
      const track = it?.track
      const playedAt = it?.played_at
      if (!track) continue
      const url = (track?.external_urls?.spotify as string | undefined)
      const name = (track?.name as string | undefined)
      const artists = Array.isArray(track?.artists) ? track.artists.map((a) => a?.name).filter(Boolean).join(', ') : undefined
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



import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useVaultSession } from '@/hooks/useVaultSession'
import { useToast } from '@/hooks/use-toast'
import { agpFetch, dynFetch, fetchWithAuth } from '@/lib/aggregatorClient'

export type AggregatedItem = {
  id: string
  provider: 'reddit' | 'twitter' | 'facebook' | 'instagram' | 'rss' | 'gmail' | 'outlook'
  title: string
  url?: string
  author?: string
  timestamp?: number
  score?: number
  extra?: Record<string, any>
}

export type RssSource = { id: string; title?: string; url: string; limit?: number }

type ProviderConfig = {
  // token payloads are stored in vault under api/login items
  // For OAuth-based providers: { access_token, refresh_token, expires_at } within data
  vaultItemName: string
}

const PROVIDERS: Record<AggregatedItem['provider'], ProviderConfig> = {
  reddit: { vaultItemName: 'reddit' },
  twitter: { vaultItemName: 'twitter' },
  facebook: { vaultItemName: 'facebook' },
  instagram: { vaultItemName: 'instagram' },
  rss: { vaultItemName: 'rss' },
  gmail: { vaultItemName: 'gmail' },
  outlook: { vaultItemName: 'outlook' },
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

const DEFAULT_LIMITS: Record<AggregatedItem['provider'], number> = {
  reddit: 50, // effective cap; controlled via reddit-specific options below
  twitter: 20,
  facebook: 20,
  instagram: 20,
  rss: 20, // per-source default
  gmail: 25,
  outlook: 25,
}

const DEFAULT_REDDIT: { subLimit: number; postsPerSub: number } = {
  subLimit: 10,
  postsPerSub: 5,
}

const CACHE_TTLS_MS: Record<AggregatedItem['provider'], number> = {
  reddit: 2 * 60_000,
  twitter: 2 * 60_000,
  facebook: 2 * 60_000,
  instagram: 2 * 60_000,
  rss: 5 * 60_000,
  gmail: 60_000,
  outlook: 60_000,
}

export function useAggregator() {
  const { isUnlocked } = useVaultSession()
  const { itemsByType, addItem, updateItem } = useEncryptedVault()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AggregatedItem[]>([])
  const cacheRef = useRef<Record<string, { items: AggregatedItem[]; fetchedAt: number }>>({})

  const vaultItems = useMemo(() => [...itemsByType.api, ...itemsByType.login], [itemsByType.api, itemsByType.login])

  const getVaultItemByName = useCallback((name: string) => vaultItems.find(i => i.name.toLowerCase() === name.toLowerCase()), [vaultItems])

  const ensureProviderEntry = useCallback(async (name: string) => {
    if (getVaultItemByName(name)) return
    await addItem({ type: 'api', name, data: {} })
  }, [addItem, getVaultItemByName])

  const startOAuth = useCallback(async (provider: 'reddit' | 'gmail' | 'outlook') => {
    try {
      const res = await fetchWithAuth(`/integrations/oauth/start?provider=${provider === 'gmail' ? 'google' : provider === 'outlook' ? 'microsoft' : provider}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to start OAuth')
      window.location.href = json.url
    } catch (e) {
      toast({ title: 'OAuth error', description: e instanceof Error ? e.message : 'Failed to start', variant: 'destructive' })
    }
  }, [toast])

  const completeOAuthFromHandoff = useCallback(async (handoffId: string, providerParam?: string) => {
    try {
      if (!isUnlocked) {
        toast({ title: 'Vault locked', description: 'Unlock your vault to save tokens securely, then refresh this page.', variant: 'destructive' })
        return
      }
      const res = await fetchWithAuth(`/integrations/oauth/handoff?id=${encodeURIComponent(handoffId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Handoff failed')
      const provider = (json.provider as string) || providerParam
      const name = provider === 'google' ? 'gmail' : provider === 'microsoft' ? 'outlook' : provider
      await ensureProviderEntry(name)
      const item = getVaultItemByName(name)
      const data = { ...(item?.data || {}), ...json.tokens }
      if (item) await updateItem(item.id, { data })
      setTimeout(() => window.history.replaceState({}, document.title, window.location.pathname), 0)
      toast({ title: 'Connected', description: `${name} connected.` })
    } catch (e) {
      toast({ title: 'OAuth error', description: e instanceof Error ? e.message : 'Failed to complete OAuth', variant: 'destructive' })
    }
  }, [ensureProviderEntry, getVaultItemByName, toast, updateItem, isUnlocked])

  const refreshTokenIfNeeded = useCallback(async (name: string) => {
    const item = getVaultItemByName(name)
    if (!item) return null
    const { access_token, expires_in, expires_at, refresh_token, token_type } = item.data || {}
    if (!refresh_token) return access_token || null
    const exp = typeof expires_at === 'number' ? expires_at : 0
    if (access_token && exp > nowSeconds() + 60) return access_token
    // refresh
    const provider = name === 'gmail' ? 'google' : name === 'outlook' ? 'microsoft' : name
    const res = await fetchWithAuth('/integrations/oauth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, refresh_token }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'Refresh failed')
    const tokens = json.tokens || {}
    const newExpiresAt = tokens.expires_in ? nowSeconds() + Number(tokens.expires_in) : (tokens.expires_at || exp)
    await updateItem(item.id, { data: { ...item.data, ...tokens, expires_at: newExpiresAt } })
    return tokens.access_token || null
  }, [getVaultItemByName, updateItem])

  // Provider settings: enabled and limits (declared early for use in fetchers)
  const isProviderEnabled = useCallback((name: AggregatedItem['provider']): boolean => {
    const it = getVaultItemByName(name)
    if (!it) return true
    const enabled = it.data?.enabled
    return typeof enabled === 'boolean' ? enabled : true
  }, [getVaultItemByName])

  const setProviderEnabled = useCallback(async (name: AggregatedItem['provider'], enabled: boolean) => {
    await ensureProviderEntry(name)
    const it = getVaultItemByName(name)
    if (!it) return false
    await updateItem(it.id, { data: { ...it.data, enabled } })
    delete cacheRef.current[name]
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  const getProviderLimit = useCallback((name: AggregatedItem['provider']): number => {
    const it = getVaultItemByName(name)
    const lim = it?.data?.limit
    const n = Number(lim)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_LIMITS[name]
  }, [getVaultItemByName])

  const setProviderLimit = useCallback(async (name: AggregatedItem['provider'], limit: number) => {
    await ensureProviderEntry(name)
    const it = getVaultItemByName(name)
    if (!it) return false
    const safe = Math.max(1, Math.floor(Number(limit) || 1))
    await updateItem(it.id, { data: { ...it.data, limit: safe } })
    delete cacheRef.current[name]
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  // Reddit-specific settings
  const getRedditSettings = useCallback((): { subLimit: number; postsPerSub: number } => {
    const it = getVaultItemByName('reddit')
    const subLimit = Number(it?.data?.sub_limit)
    const postsPerSub = Number(it?.data?.posts_per_sub)
    return {
      subLimit: Number.isFinite(subLimit) && subLimit > 0 ? subLimit : DEFAULT_REDDIT.subLimit,
      postsPerSub: Number.isFinite(postsPerSub) && postsPerSub > 0 ? postsPerSub : DEFAULT_REDDIT.postsPerSub,
    }
  }, [getVaultItemByName])

  const setRedditSettings = useCallback(async (opts: { subLimit?: number; postsPerSub?: number }) => {
    await ensureProviderEntry('reddit')
    const it = getVaultItemByName('reddit')
    if (!it) return false
    const next: Record<string, any> = { ...it.data }
    if (typeof opts.subLimit === 'number') next.sub_limit = Math.max(1, Math.floor(opts.subLimit))
    if (typeof opts.postsPerSub === 'number') next.posts_per_sub = Math.max(1, Math.floor(opts.postsPerSub))
    await updateItem(it.id, { data: next })
    delete cacheRef.current.reddit
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  // Provider fetchers
  const fetchRedditTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const token = await refreshTokenIfNeeded('reddit')
    if (!token) return []
    const { subLimit, postsPerSub } = getRedditSettings()
    const qs = new URLSearchParams({ sub_limit: String(subLimit), posts_per_sub: String(postsPerSub) })
    const res = await fetchWithAuth(`/aggregations/reddit?${qs.toString()}`, { headers: { 'X-Target-Authorization': `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  }, [refreshTokenIfNeeded, getRedditSettings])

  // Twitter/Facebook/Instagram: use manual tokens stored in Vault
  const fetchTwitterTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const item = getVaultItemByName('twitter')
    const token = item?.data?.bearer || item?.data?.access_token
    if (!token) return []
    const limit = getProviderLimit('twitter')
    const qs = new URLSearchParams({ limit: String(limit) })
    const res = await fetchWithAuth(`/aggregations/twitter?${qs.toString()}`, { headers: { 'X-Target-Authorization': `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  }, [getVaultItemByName, getProviderLimit])

  const fetchFacebookTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const item = getVaultItemByName('facebook')
    const token = item?.data?.access_token
    if (!token) return []
    const limit = getProviderLimit('facebook')
    const qs = new URLSearchParams({ limit: String(limit) })
    const res = await fetchWithAuth(`/aggregations/facebook?${qs.toString()}`, { headers: { 'X-Target-Authorization': `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  }, [getVaultItemByName, getProviderLimit])

  const fetchInstagramTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const item = getVaultItemByName('instagram')
    const token = item?.data?.access_token
    if (!token) return []
    const limit = getProviderLimit('instagram')
    const qs = new URLSearchParams({ limit: String(limit) })
    const res = await fetchWithAuth(`/aggregations/instagram?${qs.toString()}`, { headers: { 'X-Target-Authorization': `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  }, [getVaultItemByName, getProviderLimit])

  const listRssSources = useCallback((): RssSource[] => {
    const item = getVaultItemByName('rss')
    const arr = Array.isArray(item?.data?.sources) ? item?.data?.sources as RssSource[] : []
    return arr
  }, [getVaultItemByName])

  const addRssSource = useCallback(async (url: string, title?: string) => {
    let item = getVaultItemByName('rss')
    if (!item) {
      await addItem({ type: 'api', name: 'rss', data: { sources: [] } })
      item = getVaultItemByName('rss')
    }
    if (!item) return
    const sources: RssSource[] = Array.isArray(item.data.sources) ? item.data.sources : []
    const id = cryptoRandomId()
    sources.push({ id, url, title })
    await updateItem(item.id, { data: { ...item.data, sources } })
  }, [addItem, getVaultItemByName, updateItem])

  const removeRssSource = useCallback(async (id: string) => {
    const item = getVaultItemByName('rss')
    if (!item) return
    const sources: RssSource[] = Array.isArray(item.data.sources) ? item.data.sources : []
    const next = sources.filter(s => s.id !== id)
    await updateItem(item.id, { data: { ...item.data, sources: next } })
  }, [getVaultItemByName, updateItem])

  const fetchRssItemsInner = useCallback(async (providerLimit: number): Promise<AggregatedItem[]> => {
    const sources = listRssSources()
    const out: AggregatedItem[] = []
    for (const s of sources) {
      try {
        const res = await dynFetch(s.url)
        if (!res.ok) continue
        const text = await res.text()
        const parsed = parseRss(text)
        const limit = typeof s.limit === 'number' && s.limit > 0 ? s.limit : providerLimit
        for (const it of parsed.slice(0, limit)) {
          out.push({
            id: `rss_${s.id}_${hashString(it.link || it.title)}`,
            provider: 'rss',
            title: it.title,
            url: it.link,
            author: it.author,
            timestamp: it.pubDate ? Date.parse(it.pubDate) : undefined,
            extra: { source: s.title || s.url },
          })
        }
      } catch {}
    }
    return out
  }, [listRssSources])

  const fetchGmailUnread = useCallback(async (): Promise<AggregatedItem[]> => {
    const token = await refreshTokenIfNeeded('gmail')
    if (!token) return []
    const limit = getProviderLimit('gmail')
    const qs = new URLSearchParams({ limit: String(limit) })
    const res = await fetchWithAuth(`/aggregations/gmail?${qs.toString()}`, { headers: { 'X-Target-Authorization': `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  }, [refreshTokenIfNeeded, getProviderLimit])

  const fetchOutlookUnread = useCallback(async (): Promise<AggregatedItem[]> => {
    const token = await refreshTokenIfNeeded('outlook')
    if (!token) return []
    const limit = getProviderLimit('outlook')
    const qs = new URLSearchParams({ limit: String(limit) })
    const res = await fetchWithAuth(`/aggregations/outlook?${qs.toString()}`, { headers: { 'X-Target-Authorization': `Bearer ${token}` } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  }, [refreshTokenIfNeeded, getProviderLimit])

  type AggregationProviderDef = {
    name: AggregatedItem['provider']
    category: 'social' | 'rss' | 'mail'
    fetch: () => Promise<AggregatedItem[]>
  }

  const aggregationProviders: AggregationProviderDef[] = useMemo(() => ([
    { name: 'reddit', category: 'social', fetch: fetchRedditTop },
    { name: 'twitter', category: 'social', fetch: fetchTwitterTop },
    { name: 'facebook', category: 'social', fetch: fetchFacebookTop },
    { name: 'instagram', category: 'social', fetch: fetchInstagramTop },
    { name: 'rss', category: 'rss', fetch: () => fetchRssItemsInner(getProviderLimit('rss')) },
    { name: 'gmail', category: 'mail', fetch: fetchGmailUnread },
    { name: 'outlook', category: 'mail', fetch: fetchOutlookUnread },
  ]), [fetchFacebookTop, fetchGmailUnread, fetchInstagramTop, fetchOutlookUnread, fetchRedditTop, fetchRssItemsInner, fetchTwitterTop, getProviderLimit])

  const refreshAll = useCallback(async () => {
    if (!isUnlocked) return
    setLoading(true)
    try {
      const results = await Promise.all(aggregationProviders.map(async (p) => {
        if (!isProviderEnabled(p.name)) return []
        const cached = cacheRef.current[p.name]
        const ttl = CACHE_TTLS_MS[p.name]
        const now = Date.now()
        if (cached && now - cached.fetchedAt < ttl) {
          return cached.items
        }
        const items = await p.fetch()
        cacheRef.current[p.name] = { items, fetchedAt: now }
        return items
      }))
      const combined = results.flat()
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setItems(combined)
    } finally {
      setLoading(false)
    }
  }, [aggregationProviders, isUnlocked])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const handoff = params.get('handoff')
    const provider = params.get('provider') || undefined
    if (handoff) completeOAuthFromHandoff(handoff, provider || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getProviderData = useCallback((name: 'reddit' | 'twitter' | 'facebook' | 'instagram' | 'gmail' | 'outlook' | 'rss') => {
    const it = getVaultItemByName(name)
    return it?.data || {}
  }, [getVaultItemByName])

  const isConnected = useCallback((name: 'reddit' | 'gmail' | 'outlook') => {
    const data = getProviderData(name as any)
    return !!(data.access_token || data.refresh_token)
  }, [getProviderData])

  const saveManualToken = useCallback(async (name: 'twitter' | 'facebook' | 'instagram', data: Record<string, any>) => {
    await ensureProviderEntry(name)
    const item = getVaultItemByName(name)
    if (!item) return false
    await updateItem(item.id, { data: { ...item.data, ...data } })
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  

  // RSS source limit update
  const setRssSourceLimit = useCallback(async (id: string, limit: number) => {
    const it = getVaultItemByName('rss')
    if (!it) return false
    const sources: RssSource[] = Array.isArray(it.data.sources) ? it.data.sources : []
    const safe = Math.max(1, Math.floor(Number(limit) || 1))
    const next = sources.map((s) => (s.id === id ? { ...s, limit: safe } : s))
    await updateItem(it.id, { data: { ...it.data, sources: next } })
    delete cacheRef.current.rss
    return true
  }, [getVaultItemByName, updateItem])

  return {
    items,
    loading,
    refreshAll,
    startOAuth,
    addRssSource,
    removeRssSource,
    listRssSources,
    getProviderData,
    isConnected,
    saveManualToken,
    isProviderEnabled,
    setProviderEnabled,
    getProviderLimit,
    setProviderLimit,
    getRedditSettings,
    setRedditSettings,
    setRssSourceLimit,
  }
}

function cryptoRandomId(): string {
  const arr = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function parseRss(xml: string): Array<{ title: string; link?: string; author?: string; pubDate?: string }> {
  try {
    const doc = new window.DOMParser().parseFromString(xml, 'text/xml')
    const out: Array<{ title: string; link?: string; author?: string; pubDate?: string }> = []
    const items = Array.from(doc.querySelectorAll('item'))
    if (items.length > 0) {
      for (const it of items) {
        out.push({
          title: textContent(it, 'title') || '(no title)',
          link: textContent(it, 'link') || undefined,
          author: textContent(it, 'author') || textContent(it, 'dc\:creator') || undefined,
          pubDate: textContent(it, 'pubDate') || undefined,
        })
      }
      return out
    }
    const entries = Array.from(doc.querySelectorAll('entry'))
    for (const e of entries) {
      const linkEl = e.querySelector('link[rel="alternate"]') || e.querySelector('link')
      out.push({
        title: textContent(e, 'title') || '(no title)',
        link: linkEl?.getAttribute('href') || undefined,
        author: textContent(e, 'author > name') || undefined,
        pubDate: textContent(e, 'updated') || textContent(e, 'published') || undefined,
      })
    }
    return out
  } catch {
    return []
  }
}

function textContent(root: Element, selector: string): string | null {
  const el = root.querySelector(selector)
  return el ? (el.textContent || '').trim() : null
}

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}



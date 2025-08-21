import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useVaultSession } from '@/hooks/useVaultSession'
import { useToast } from '@/hooks/use-toast'
import { agpFetch, dynFetch, fetchWithAuth } from '@/lib/aggregatorClient'

// Simple HTML sanitization function
function sanitizeHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .substring(0, 500) // Limit length
}

export type AggregatedItem = {
  id: string
  provider: 'reddit' | 'twitter' | 'facebook' | 'instagram' | 'rss' | 'gmail' | 'outlook' | 'youtube' | 'youtubemusic' | 'spotify'
  title: string
  url?: string
  author?: string
  timestamp?: number
  score?: number
  extra?: Record<string, unknown>
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
  youtube: { vaultItemName: 'youtube' },
  youtubemusic: { vaultItemName: 'youtubemusic' },
  spotify: { vaultItemName: 'spotify' },
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
  youtube: 20,
  youtubemusic: 20,
  spotify: 20,
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
  youtube: 2 * 60_000,
  youtubemusic: 2 * 60_000,
  spotify: 2 * 60_000,
}

export function useAggregator() {
  const { isUnlocked } = useVaultSession()
  const { itemsByType, addItem, updateItem } = useEncryptedVault()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AggregatedItem[]>([])
  const [providerLoading, setProviderLoading] = useState<Record<string, boolean>>({})
  const cacheRef = useRef<Record<string, { items: AggregatedItem[]; fetchedAt: number }>>({})

  // Memoize vault items to prevent unnecessary re-renders
  const vaultItems = useMemo(() => [...itemsByType.api, ...itemsByType.login], [itemsByType.api, itemsByType.login])

  // Cache cleanup function
  const cleanupCache = useCallback(() => {
    const now = Date.now()
    const maxAge = 30 * 60 * 1000 // 30 minutes
    const cache = cacheRef.current

    Object.keys(cache).forEach(key => {
      if (now - cache[key].fetchedAt > maxAge) {
        delete cache[key]
      }
    })

    // Limit cache size to prevent memory issues
    const entries = Object.entries(cache)
    if (entries.length > 15) {
      // Keep only the 10 most recent entries to be more aggressive about memory management
      entries
        .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
        .slice(10)
        .forEach(([key]) => delete cache[key])
    }
  }, [])

  // Memoize the getVaultItemByName function to prevent recreation
  const getVaultItemByName = useCallback((name: string) =>
    vaultItems.find(i => i.name.toLowerCase() === name.toLowerCase()),
    [vaultItems]
  )

  // Memoize ensureProviderEntry to prevent recreation
  const ensureProviderEntry = useCallback(async (name: string) => {
    if (getVaultItemByName(name)) return
    await addItem({ type: 'api', name, data: {} })
  }, [addItem, getVaultItemByName])

  // Memoize startOAuth to prevent recreation
  const startOAuth = useCallback(async (provider: 'reddit' | 'gmail' | 'outlook' | 'youtube' | 'youtubemusic' | 'spotify') => {
    try {
      const res = await fetchWithAuth(`/integrations/oauth/start?provider=${provider === 'gmail' ? 'google' : provider === 'outlook' ? 'microsoft' : provider}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to start OAuth')
      window.location.href = json.url
    } catch (e) {
      toast({ title: 'OAuth error', description: e instanceof Error ? e.message : 'Failed to start', variant: 'destructive' })
    }
  }, [toast])

  // Memoize getProviderData to prevent recreation
  const getProviderData = useCallback((name: 'reddit' | 'twitter' | 'facebook' | 'instagram' | 'gmail' | 'outlook' | 'rss' | 'youtube' | 'youtubemusic' | 'spotify') => {
    const it = getVaultItemByName(name)
    return it?.data || {}
  }, [getVaultItemByName])

  // Memoize isConnected to prevent recreation
  const isConnected = useCallback((name: 'reddit' | 'gmail' | 'outlook') => {
    const data = getProviderData(name)
    return !!(data.access_token || data.refresh_token)
  }, [getProviderData])

  // Memoize saveManualToken to prevent recreation
  const saveManualToken = useCallback(async (name: 'twitter' | 'facebook' | 'instagram', data: Record<string, unknown>) => {
    await ensureProviderEntry(name)
    const item = getVaultItemByName(name)
    if (!item) return false
    await updateItem(item.id, { data: { ...item.data, ...data } })
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  // Memoize RSS source functions to prevent recreation
  const listRssSources = useCallback((): RssSource[] => {
    const it = getVaultItemByName('rss')
    if (!it) return []
    return Array.isArray(it.data.sources) ? it.data.sources : []
  }, [getVaultItemByName])

  const addRssSource = useCallback(async (url: string) => {
    const it = getVaultItemByName('rss')
    const sources: RssSource[] = Array.isArray(it?.data.sources) ? it.data.sources : []
    const existing = sources.find(s => s.url === url)
    if (existing) return false
    const newSource: RssSource = { id: cryptoRandomId(), url, limit: 20 }
    const next = [...sources, newSource]
    if (it) {
      await updateItem(it.id, { data: { ...it.data, sources: next } })
    } else {
      await addItem({ type: 'api', name: 'rss', data: { sources: next } })
    }
    delete cacheRef.current.rss
    return true
  }, [getVaultItemByName, updateItem, addItem])

  const removeRssSource = useCallback(async (id: string) => {
    const it = getVaultItemByName('rss')
    if (!it) return false
    const sources: RssSource[] = Array.isArray(it.data.sources) ? it.data.sources : []
    const next = sources.filter(s => s.id !== id)
    await updateItem(it.id, { data: { ...it.data, sources: next } })
    delete cacheRef.current.rss
    return true
  }, [getVaultItemByName, updateItem])

  // Memoize provider configuration functions to prevent recreation
  const isProviderEnabled = useCallback((name: AggregatedItem['provider']) => {
    const it = getVaultItemByName(name)
    if (!it) return false
    return it.data.enabled !== false
  }, [getVaultItemByName])

  const setProviderEnabled = useCallback(async (name: AggregatedItem['provider'], enabled: boolean) => {
    await ensureProviderEntry(name)
    const item = getVaultItemByName(name)
    if (!item) return false
    await updateItem(item.id, { data: { ...item.data, enabled } })
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  const getProviderLimit = useCallback((name: AggregatedItem['provider']) => {
    const it = getVaultItemByName(name)
    if (!it) return DEFAULT_LIMITS[name]
    return it.data.limit || DEFAULT_LIMITS[name]
  }, [getVaultItemByName])

  const setProviderLimit = useCallback(async (name: AggregatedItem['provider'], limit: number) => {
    await ensureProviderEntry(name)
    const item = getVaultItemByName(name)
    if (!item) return false
    const safe = Math.max(1, Math.floor(Number(limit) || 1))
    await updateItem(item.id, { data: { ...item.data, limit: safe } })
    delete cacheRef.current[name]
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem])

  // Memoize Reddit settings functions to prevent recreation
  const getRedditSettings = useCallback(() => {
    const it = getVaultItemByName('reddit')
    if (!it) return DEFAULT_REDDIT
    return {
      subLimit: it.data.subLimit || DEFAULT_REDDIT.subLimit,
      postsPerSub: it.data.postsPerSub || DEFAULT_REDDIT.postsPerSub,
    }
  }, [getVaultItemByName])

  const setRedditSettings = useCallback(async (settings: Partial<typeof DEFAULT_REDDIT>) => {
    await ensureProviderEntry('reddit')
    const item = getVaultItemByName('reddit')
    if (!item) return false
    const current = getRedditSettings()
    const next = { ...current, ...settings }
    await updateItem(item.id, { data: { ...item.data, ...next } })
    delete cacheRef.current.reddit
    return true
  }, [ensureProviderEntry, getVaultItemByName, updateItem, getRedditSettings])

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

  // Memoize fetch functions to prevent recreation
  const fetchRedditTop = useCallback(async () => {
    const data = getProviderData('reddit')
    if (!data.access_token && !data.refresh_token) return []
    const settings = getRedditSettings()
    const res = await agpFetch(`/reddit/top?subLimit=${settings.subLimit}&postsPerSub=${settings.postsPerSub}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getRedditSettings])

  const fetchTwitterTop = useCallback(async () => {
    const data = getProviderData('twitter')
    if (!data.bearer) return []
    const limit = getProviderLimit('twitter')
    const res = await agpFetch(`/twitter/top?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchFacebookTop = useCallback(async () => {
    const data = getProviderData('facebook')
    if (!data.access_token) return []
    const limit = getProviderLimit('facebook')
    const res = await agpFetch(`/facebook/top?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchInstagramTop = useCallback(async () => {
    const data = getProviderData('instagram')
    if (!data.access_token) return []
    const limit = getProviderLimit('instagram')
    const res = await agpFetch(`/instagram/top?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchYoutubeTop = useCallback(async () => {
    const data = getProviderData('youtube')
    if (!data.access_token && !data.refresh_token) return []
    const limit = getProviderLimit('youtube')
    const res = await agpFetch(`/youtube/recent?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchYoutubeMusic = useCallback(async () => {
    const data = getProviderData('youtubemusic')
    if (!data.access_token && !data.refresh_token) return []
    const limit = getProviderLimit('youtubemusic')
    const res = await agpFetch(`/youtubemusic/recent?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchSpotifyRecent = useCallback(async () => {
    const data = getProviderData('spotify')
    if (!data.access_token && !data.refresh_token) return []
    const limit = getProviderLimit('spotify')
    const res = await agpFetch(`/spotify/recent?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchGmailUnread = useCallback(async () => {
    const data = getProviderData('gmail')
    if (!data.access_token && !data.refresh_token) return []
    const limit = getProviderLimit('gmail')
    const res = await agpFetch(`/gmail/unread?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchOutlookUnread = useCallback(async () => {
    const data = getProviderData('outlook')
    if (!data.access_token && !data.refresh_token) return []
    const limit = getProviderLimit('outlook')
    const res = await agpFetch(`/outlook/unread?limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.items || []
  }, [getProviderData, getProviderLimit])

  const fetchRssItemsInner = useCallback(async () => {
    const sources = listRssSources()
    if (sources.length === 0) return []

    console.log('RSS sources found:', sources)
    const allItems: AggregatedItem[] = []
    const failedSources: string[] = []

    for (const source of sources) {
      try {
        console.log('Fetching RSS from:', source.url)
        // Use the server proxy to avoid CORS issues
        const proxyUrl = `/rss-proxy?url=${encodeURIComponent(source.url)}`
        const res = await fetch(proxyUrl)
        if (!res.ok) {
          console.error(`Failed to fetch RSS from ${source.url}: ${res.status} ${res.statusText}`)
          failedSources.push(source.url)
          continue
        }
        const xml = await res.text()
        const parsed = parseRss(xml)
        const items: AggregatedItem[] = parsed.slice(0, source.limit || 20).map((item) => ({
          id: cryptoRandomId(),
          provider: 'rss' as const,
          title: sanitizeHtml(item.title),
          url: item.link,
          author: sanitizeHtml(item.author || ''),
          timestamp: item.pubDate ? new Date(item.pubDate).getTime() : undefined,
          extra: { source: source.url },
        }))
        allItems.push(...items)
        console.log(`Parsed ${items.length} RSS items from ${source.url}`)
      } catch (error) {
        console.error(`Error fetching RSS from ${source.url}:`, error)
        failedSources.push(source.url)
      }
    }

    // Show toast notification for failed sources
    if (failedSources.length > 0) {
      toast({
        title: 'RSS Feed Errors',
        description: `Failed to fetch ${failedSources.length} RSS source(s). Check console for details.`,
        variant: 'destructive'
      })
    }

    console.log('Total RSS items collected:', allItems.length)
    return allItems
  }, [listRssSources, toast])

  // Memoize aggregation providers to prevent recreation
  const aggregationProviders = useMemo(() => [
    { name: 'reddit' as const, fetch: fetchRedditTop },
    { name: 'twitter' as const, fetch: fetchTwitterTop },
    { name: 'facebook' as const, fetch: fetchFacebookTop },
    { name: 'instagram' as const, fetch: fetchInstagramTop },
    { name: 'youtube' as const, fetch: fetchYoutubeTop },
    { name: 'youtubemusic' as const, fetch: fetchYoutubeMusic },
    { name: 'spotify' as const, fetch: fetchSpotifyRecent },
    { name: 'rss' as const, fetch: fetchRssItemsInner },
    { name: 'gmail' as const, fetch: fetchGmailUnread },
    { name: 'outlook' as const, fetch: fetchOutlookUnread },
  ], [fetchRedditTop, fetchTwitterTop, fetchFacebookTop, fetchInstagramTop, fetchYoutubeTop, fetchYoutubeMusic, fetchSpotifyRecent, fetchRssItemsInner, fetchGmailUnread, fetchOutlookUnread])

  // Memoize refreshAll to prevent recreation
  const refreshAll = useCallback(async () => {
    if (!isUnlocked) return
    console.log('Starting refreshAll, isUnlocked:', isUnlocked)
    console.log('Available providers:', aggregationProviders.map(p => ({ name: p.name, enabled: isProviderEnabled(p.name) })))
    console.log('Vault items:', vaultItems)

    // Clean up old cache entries
    cleanupCache()

    // Check if there are any configured providers
    const hasConfiguredProviders = aggregationProviders.some(p => {
      if (p.name === 'rss') {
        const sources = listRssSources()
        return sources.length > 0
      }
      if (p.name === 'twitter' || p.name === 'facebook' || p.name === 'instagram') {
        const data = getProviderData(p.name)
        return !!(data.bearer || data.access_token)
      }
      if (p.name === 'reddit' || p.name === 'gmail' || p.name === 'outlook' || p.name === 'youtube' || p.name === 'youtubemusic' || p.name === 'spotify') {
        const data = getProviderData(p.name)
        return !!(data.access_token || data.refresh_token)
      }
      return false
    })

    if (!hasConfiguredProviders) {
      console.log('No configured providers found, skipping refreshAll')
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    const failedProviders: string[] = []

    try {
      const results = await Promise.all(aggregationProviders.map(async (p) => {
        if (!isProviderEnabled(p.name)) {
          console.log(`Provider ${p.name} is disabled`)
          return []
        }
        const cached = cacheRef.current[p.name]
        const ttl = CACHE_TTLS_MS[p.name]
        const now = Date.now()
        if (cached && now - cached.fetchedAt < ttl) {
          console.log(`Using cached data for ${p.name}`)
          return cached.items
        }
        console.log(`Fetching fresh data for ${p.name}`)

        // Retry logic for failed requests
        let retries = 2
        while (retries > 0) {
          try {
            const items = await p.fetch()
            console.log(`Fetched ${items.length} items for ${p.name}`)
            cacheRef.current[p.name] = { items, fetchedAt: now }
            return items
          } catch (error) {
            retries--
            if (retries === 0) {
              console.error(`Error fetching from provider ${p.name} after retries:`, error)
              failedProviders.push(p.name)
              return []
            }
            console.warn(`Retrying ${p.name} (${retries} attempts left)`)
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
          }
        }
        return []
      }))

      const combined = results.flat()
      console.log(`Total items fetched: ${combined.length}`)
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setItems(combined)

      // Show notification for failed providers
      if (failedProviders.length > 0) {
        toast({
          title: 'Provider Errors',
          description: `Failed to fetch from: ${failedProviders.join(', ')}. Check your connections.`,
          variant: 'destructive'
        })
      }

      // If no items were fetched and no providers are configured, log this for debugging
      if (combined.length === 0) {
        console.log('No feed items were fetched. This might be normal if no providers are configured.')
        console.log('Provider status:', aggregationProviders.map(p => ({
          name: p.name,
          enabled: isProviderEnabled(p.name),
          hasData: getProviderData(p.name)
        })))
      }
    } catch (error) {
      console.error('Error in refreshAll:', error)
      toast({
        title: 'Feed Refresh Error',
        description: 'An unexpected error occurred while refreshing feeds.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [isUnlocked, aggregationProviders, isProviderEnabled, listRssSources, getProviderData, cleanupCache, toast])

  // Memoize refreshProvider to prevent recreation
  const refreshProvider = useCallback(async (name: AggregatedItem['provider']): Promise<AggregatedItem[]> => {
    if (!isUnlocked) return []
    const provider = aggregationProviders.find((p) => p.name === name)
    if (!provider) return []
    if (!isProviderEnabled(name)) return []

    setProviderLoading(prev => ({ ...prev, [name]: true }))

    try {
      const items = await provider.fetch()
      cacheRef.current[name] = { items, fetchedAt: Date.now() }
      const combined = Object.values(cacheRef.current).flatMap((c) => c.items)
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setItems(combined)
      return items
    } catch (error) {
      console.error(`Error refreshing provider ${name}:`, error)
      toast({
        title: 'Provider Error',
        description: `Failed to refresh ${name}. Please try again.`,
        variant: 'destructive'
      })
      return []
    } finally {
      setProviderLoading(prev => ({ ...prev, [name]: false }))
    }
  }, [aggregationProviders, isProviderEnabled, isUnlocked, toast])

  // Auto-refresh feeds when vault becomes unlocked (only once, with better protection)
  const hasAttemptedInitialLoad = useRef(false)
  const lastRefreshTime = useRef(0)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced refresh to prevent race conditions
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = setTimeout(() => {
      const now = Date.now()
      if (now - lastRefreshTime.current > 2000) { // Minimum 2 seconds between refreshes
        lastRefreshTime.current = now
        refreshAll()
      }
    }, 500) // 500ms debounce
  }, [refreshAll])

  // Token refresh function
  const refreshToken = useCallback(async (provider: string, refreshToken: string) => {
    try {
      const res = await fetchWithAuth('/integrations/oauth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, refresh_token: refreshToken })
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json?.error || 'Failed to refresh token')
      }

      const { tokens } = await res.json()

      // Update the token in vault
      await ensureProviderEntry(provider)
      const item = getVaultItemByName(provider)
      if (item) {
        await updateItem(item.id, {
          data: {
            ...item.data,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at
          }
        })
      }

      return tokens
    } catch (error) {
      console.error(`Failed to refresh token for ${provider}:`, error)
      throw error
    }
  }, [fetchWithAuth, ensureProviderEntry, getVaultItemByName, updateItem])

  // Memoize completeOAuthFromHandoff to prevent recreation
  const completeOAuthFromHandoff = useCallback(async (handoff: string, provider?: string) => {
    try {
      const res = await fetchWithAuth(`/integrations/oauth/complete?handoff=${handoff}${provider ? `&provider=${provider}` : ''}`)
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json?.error || 'Failed to complete OAuth')
      }

      const { tokens, provider: completedProvider } = await res.json()

      // Store tokens in vault
      await ensureProviderEntry(completedProvider)
      const item = getVaultItemByName(completedProvider)
      if (item) {
        await updateItem(item.id, {
          data: {
            ...item.data,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at
          }
        })
      }

      toast({ title: 'OAuth successful', description: `${completedProvider} has been connected successfully` })
      // Refresh feeds after successful OAuth
      setTimeout(() => debouncedRefresh(), 1000)
    } catch (e) {
      toast({ title: 'OAuth error', description: e instanceof Error ? e.message : 'Failed to complete', variant: 'destructive' })
    }
  }, [toast, debouncedRefresh, ensureProviderEntry, getVaultItemByName, updateItem])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const handoff = params.get('handoff')
    const provider = params.get('provider') || undefined
    if (handoff) completeOAuthFromHandoff(handoff, provider || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      // Clear cache on unmount to prevent memory leaks
      cacheRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (isUnlocked && !hasAttemptedInitialLoad.current) {
      hasAttemptedInitialLoad.current = true
      console.log('Initial feed load triggered')
      debouncedRefresh()
    }

    // Reset flag when vault is locked
    if (!isUnlocked) {
      hasAttemptedInitialLoad.current = false
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [isUnlocked, debouncedRefresh])

  return {
    items,
    loading,
    providerLoading,
    refreshAll,
    refreshProvider,
    refreshToken,
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
    const doc = new window.DOMParser().parseFromString(xml, 'application/xml')
    const out: Array<{ title: string; link?: string; author?: string; pubDate?: string }> = []

    // RSS 2.0 items
    let items = Array.from(doc.getElementsByTagName('item'))
    if (items.length === 0) {
      items = Array.from(doc.querySelectorAll('item'))
    }
    if (items.length > 0) {
      for (const it of items) {
        out.push({
          title: firstNonEmpty([
            textContent(it, 'title'),
          ]) || '(no title)',
          link: firstNonEmpty([
            textContent(it, 'link'),
            textContentNS(it, '*', 'link'),
          ]) || undefined,
          author: firstNonEmpty([
            textContent(it, 'author'),
            textContent(it, 'dc\\:creator'),
            textContentNS(it, '*', 'creator'),
          ]) || undefined,
          pubDate: firstNonEmpty([
            textContent(it, 'pubDate'),
            textContent(it, 'dc\\:date'),
            textContentNS(it, '*', 'date'),
          ]) || undefined,
        })
      }
      return out
    }

    // Atom entries (with or without default namespace)
    let entries: Element[] = []
    if ((doc as unknown) && typeof (doc as Document).getElementsByTagNameNS === 'function') {
        entries = Array.from((doc as Document).getElementsByTagNameNS('*', 'entry') as HTMLCollectionOf<Element>)
      }
    if (entries.length === 0) {
      entries = Array.from(doc.getElementsByTagName('entry'))
    }
    if (entries.length === 0) {
      entries = Array.from(doc.querySelectorAll('entry'))
    }
    for (const e of entries) {
      const linkEl = (e.querySelector('link[rel="alternate"]') || e.querySelector('link')) as Element | null
      const href = linkEl?.getAttribute('href') || textContentNS(e, '*', 'link') || undefined
      out.push({
        title: firstNonEmpty([
          textContent(e, 'title'),
          textContentNS(e, '*', 'title'),
        ]) || '(no title)',
        link: href,
        author: firstNonEmpty([
          textContent(e, 'author > name'),
          textContentNS(e, '*', 'name'),
          textContent(e, 'author'),
        ]) || undefined,
        pubDate: firstNonEmpty([
          textContent(e, 'updated'),
          textContent(e, 'published'),
          textContentNS(e, '*', 'updated'),
          textContentNS(e, '*', 'published'),
        ]) || undefined,
      })
    }
    return out
  } catch {
    return []
  }
}

function textContent(root: Element, selector: string): string | null {
  try {
    const el = root.querySelector(selector)
    return el ? (el.textContent || '').trim() : null
  } catch {
    return null
  }
}

function textContentNS(root: Element, ns: string, localName: string): string | null {
  try {
  const fn = (root as Document).getElementsByTagNameNS as (ns: string, localName: string) => HTMLCollectionOf<Element>                                                                                
    if (typeof fn !== 'function') return null
    const els = Array.from(fn.call(root, ns, localName)) as Element[]
    const el = els[0] as Element | undefined
    return el ? ((el as Element).textContent || '').trim() : null
  } catch {
    return null
  }
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}



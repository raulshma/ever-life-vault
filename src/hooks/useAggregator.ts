import { useCallback, useEffect, useMemo, useState } from 'react'
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

export type RssSource = { id: string; title?: string; url: string }

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

export function useAggregator() {
  const { isUnlocked } = useVaultSession()
  const { itemsByType, addItem, updateItem } = useEncryptedVault()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AggregatedItem[]>([])

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

  // Provider fetchers
  const fetchRedditTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const token = await refreshTokenIfNeeded('reddit')
    if (!token) return []
    const headers: Record<string, string> = { 'X-Target-Authorization': `Bearer ${token}`, 'User-Agent': 'ever-life-vault/1.0' }
    const subsRes = await agpFetch('https://oauth.reddit.com/subreddits/mine/subscriber', { headers })
    if (!subsRes.ok) return []
    const subsJson = await subsRes.json()
    const subNames: string[] = (subsJson?.data?.children || []).map((c: any) => c?.data?.display_name).filter(Boolean)
    const topItems: AggregatedItem[] = []
    for (const sub of subNames.slice(0, 10)) {
      const res = await agpFetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/top?t=day&limit=5`, { headers })
      if (!res.ok) continue
      const json = await res.json()
      for (const child of json?.data?.children || []) {
        const d = child?.data
        topItems.push({
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
    return topItems
  }, [refreshTokenIfNeeded])

  // Twitter/Facebook/Instagram placeholders (require app keys); allow users to store bearer/API keys in vault
  const fetchTwitterTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const item = getVaultItemByName('twitter')
    const bearer = item?.data?.bearer || item?.data?.access_token
    if (!bearer) return []
    // Example: get user timeline likes/retweets would require Elevated API; placeholder returns []
    return []
  }, [getVaultItemByName])

  const fetchFacebookTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const item = getVaultItemByName('facebook')
    const token = item?.data?.access_token
    if (!token) return []
    return []
  }, [getVaultItemByName])

  const fetchInstagramTop = useCallback(async (): Promise<AggregatedItem[]> => {
    const item = getVaultItemByName('instagram')
    const token = item?.data?.access_token
    if (!token) return []
    return []
  }, [getVaultItemByName])

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

  const fetchRssItems = useCallback(async (): Promise<AggregatedItem[]> => {
    const sources = listRssSources()
    const out: AggregatedItem[] = []
    for (const s of sources) {
      try {
        const res = await dynFetch(s.url)
        if (!res.ok) continue
        const text = await res.text()
        const parsed = parseRss(text)
        for (const it of parsed) {
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
    const headers: Record<string, string> = { 'X-Target-Authorization': `Bearer ${token}` }
    const res = await agpFetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread&maxResults=25', { headers })
    if (!res.ok) return []
    const json = await res.json()
    const ids: string[] = (json?.messages || []).map((m: any) => m.id)
    const out: AggregatedItem[] = []
    for (const id of ids) {
      const mRes = await agpFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers })
      if (!mRes.ok) continue
      const m = await mRes.json()
      const headersArr: Array<{ name: string; value: string }> = m?.payload?.headers || []
      const subject = headersArr.find(h => h.name === 'Subject')?.value
      const from = headersArr.find(h => h.name === 'From')?.value
      const date = headersArr.find(h => h.name === 'Date')?.value
      out.push({ id: `gmail_${m.id}`, provider: 'gmail', title: subject || '(no subject)', author: from, timestamp: date ? Date.parse(date) : undefined, url: `https://mail.google.com/mail/u/0/#all/${m.id}` })
    }
    return out
  }, [refreshTokenIfNeeded])

  const fetchOutlookUnread = useCallback(async (): Promise<AggregatedItem[]> => {
    const token = await refreshTokenIfNeeded('outlook')
    if (!token) return []
    const headers: Record<string, string> = { 'X-Target-Authorization': `Bearer ${token}` }
    const res = await agpFetch('https://graph.microsoft.com/v1.0/me/messages?$filter=isRead%20eq%20false&$top=25', { headers })
    if (!res.ok) return []
    const json = await res.json()
    const out: AggregatedItem[] = []
    for (const m of json?.value || []) {
      out.push({ id: `outlook_${m.id}`, provider: 'outlook', title: m.subject || '(no subject)', author: m.from?.emailAddress?.name, timestamp: m.receivedDateTime ? Date.parse(m.receivedDateTime) : undefined, url: undefined })
    }
    return out
  }, [refreshTokenIfNeeded])

  const refreshAll = useCallback(async () => {
    if (!isUnlocked) return
    setLoading(true)
    try {
      const [reddit, twitter, facebook, instagram, rss, gmail, outlook] = await Promise.all([
        fetchRedditTop(),
        fetchTwitterTop(),
        fetchFacebookTop(),
        fetchInstagramTop(),
        fetchRssItems(),
        fetchGmailUnread(),
        fetchOutlookUnread(),
      ])
      const combined = [...reddit, ...twitter, ...facebook, ...instagram, ...rss, ...gmail, ...outlook]
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setItems(combined)
    } finally {
      setLoading(false)
    }
  }, [fetchFacebookTop, fetchGmailUnread, fetchInstagramTop, fetchOutlookUnread, fetchRedditTop, fetchRssItems, fetchTwitterTop, isUnlocked])

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



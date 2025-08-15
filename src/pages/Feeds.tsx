import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Earth, Mail, Rss, ThumbsUp, Lock } from 'lucide-react'
import { useAggregator } from '@/hooks/useAggregator'
import { useVaultSession } from '@/hooks/useVaultSession'
import { Separator } from '@/components/ui/separator'

export default function Feeds() {
  const { isUnlocked } = useVaultSession()
  const {
    items,
    loading,
    refreshAll,
    refreshProvider,
    startOAuth,
    listRssSources,
    addRssSource,
    removeRssSource,
    saveManualToken,
    getProviderData,
    isProviderEnabled,
    setProviderEnabled,
    getProviderLimit,
    setProviderLimit,
    getRedditSettings,
    setRedditSettings,
    setRssSourceLimit,
  } = useAggregator()
  
  const [rssUrl, setRssUrl] = useState('')
  const [twitterBearer, setTwitterBearer] = useState(() => (getProviderData('twitter').bearer as string) || '')
  const [facebookToken, setFacebookToken] = useState(() => (getProviderData('facebook').access_token as string) || '')
  const [instagramToken, setInstagramToken] = useState(() => (getProviderData('instagram').access_token as string) || '')
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const hasAttemptedInitialLoad = useRef(false)
  
  // Show debug info in development mode
  const isDevelopment = import.meta.env.DEV
  
  // Memoize expensive computations
  const sources = useMemo(() => listRssSources(), [listRssSources])
  
  const grouped = useMemo(() => {
    const m = new Map<string, ReturnType<typeof Array.prototype.slice>>()
    for (const it of items) {
      const arr = m.get(it.provider) || []
      arr.push(it)
      m.set(it.provider, arr)
    }
    return m
  }, [items])

  // Memoize provider configuration check to prevent recalculation
  const hasConfiguredProviders = useMemo(() => {
    if (!isUnlocked) return false
    
    // Check RSS sources
    if (sources.length > 0) return true
    
    // Check for any configured social/email providers
    const hasSocialProviders = ['reddit', 'twitter', 'facebook', 'instagram', 'youtube', 'youtubemusic', 'spotify'].some(provider => {
      const data = getProviderData(provider as any)
      if (provider === 'twitter' || provider === 'facebook' || provider === 'instagram') {
        return !!(data.bearer || data.access_token)
      }
      return !!(data.access_token || data.refresh_token)
    })
    
    const hasEmailProviders = ['gmail', 'outlook'].some(provider => {
      const data = getProviderData(provider as any)
      return !!(data.access_token || data.refresh_token)
    })
    
    return hasSocialProviders || hasEmailProviders
  }, [isUnlocked, sources.length, getProviderData])

  // Memoize the initial load effect to prevent double execution
  const shouldTriggerInitialLoad = useMemo(() => {
    return isUnlocked && hasConfiguredProviders && !loading
  }, [isUnlocked, hasConfiguredProviders, loading])

  // Reset initial load flag when vault is locked
  useEffect(() => {
    if (!isUnlocked) {
      hasAttemptedInitialLoad.current = false
    }
  }, [isUnlocked])

  // Memoize callback functions to prevent recreation
  const handleRefreshAll = useCallback(() => {
    refreshAll()
  }, [refreshAll])

  const handleAddRssSource = useCallback(async () => {
    if (rssUrl) {
      await addRssSource(rssUrl)
      setRssUrl('')
      await refreshProvider('rss')
    }
  }, [rssUrl, addRssSource, refreshProvider])

  const handleRemoveRssSource = useCallback(async (id: string) => {
    await removeRssSource(id)
    await refreshProvider('rss')
  }, [removeRssSource, refreshProvider])

  const handleSetRssSourceLimit = useCallback(async (id: string, limit: number) => {
    await setRssSourceLimit(id, limit)
    await refreshProvider('rss')
  }, [setRssSourceLimit, refreshProvider])

  const handleProviderToggle = useCallback(async (provider: string, enabled: boolean) => {
    await setProviderEnabled(provider as any, enabled)
    await refreshAll()
  }, [setProviderEnabled, refreshAll])

  const handleProviderLimitChange = useCallback(async (provider: string, limit: number) => {
    await setProviderLimit(provider as any, limit)
    await refreshAll()
  }, [setProviderLimit, refreshAll])

  const handleRedditSettingsChange = useCallback(async (settings: { subLimit?: number; postsPerSub?: number }) => {
    await setRedditSettings(settings)
  }, [setRedditSettings])

  const handleSaveTwitterToken = useCallback(async () => {
    await saveManualToken('twitter', { bearer: twitterBearer })
    await refreshAll()
  }, [saveManualToken, twitterBearer, refreshAll])

  const handleSaveFacebookToken = useCallback(async () => {
    await saveManualToken('facebook', { access_token: facebookToken })
    await refreshAll()
  }, [saveManualToken, facebookToken, refreshAll])

  const handleSaveInstagramToken = useCallback(async () => {
    await saveManualToken('instagram', { access_token: instagramToken })
    await refreshAll()
  }, [saveManualToken, instagramToken, refreshAll])

  // Handle loading timeout
  useEffect(() => {
    if (loading && items.length === 0) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true)
      }, 10000) // 10 second timeout
      
      return () => clearTimeout(timer)
    } else {
      setLoadingTimeout(false)
    }
  }, [loading, items.length])

  useEffect(() => {
    // Load initial feed items when opening the page or when vault becomes unlocked
    // Only if there are configured providers to prevent infinite loops
    if (shouldTriggerInitialLoad && !hasAttemptedInitialLoad.current) {
      hasAttemptedInitialLoad.current = true
      console.log('Feeds: Initial load triggered with configured providers')
      refreshAll()
    } else if (isUnlocked && !hasConfiguredProviders) {
      console.log('Feeds: No configured providers, skipping initial load')
      // Set loading to false since there's nothing to load
      // This will show the "Get Started" message instead of loading state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldTriggerInitialLoad, isUnlocked, hasConfiguredProviders])

  // Show vault locked message if vault is not unlocked
  if (!isUnlocked) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Feeds"
          description="Aggregated social, RSS, and email updates"
          icon={Earth}
        />
        
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Vault is Locked</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Your feeds cannot be loaded because the vault is locked. Unlock your vault to access your connected accounts and RSS sources.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state when initially loading feeds (with timeout protection)
  // Only show loading if there are actually configured providers
  if (loading && items.length === 0 && !loadingTimeout && hasConfiguredProviders) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Feeds"
          description="Aggregated social, RSS, and email updates"
          icon={Earth}
        />
        
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading Feeds</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Fetching your configured feeds from all connected providers...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show timeout message if loading takes too long
  // Only show timeout if there are actually configured providers
  if (loadingTimeout && items.length === 0 && hasConfiguredProviders) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Feeds"
          description="Aggregated social, RSS, and email updates"
          icon={Earth}
        />
        
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 border-2 border-muted-foreground rounded-full mb-4 flex items-center justify-center">
              <span className="text-2xl">⏰</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Loading Taking Longer Than Expected</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              The feed loading is taking longer than usual. This might be due to network issues or provider timeouts.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => { setLoadingTimeout(false); refreshAll(); }} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Page
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <p>If the issue persists, check the browser console for error messages.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feeds"
        description="Aggregated social, RSS, and email updates"
        icon={Earth}
      >
        <Button variant="outline" onClick={handleRefreshAll} disabled={loading || !isUnlocked} title={!isUnlocked ? "Vault must be unlocked to refresh feeds" : undefined}>
          {loading ? <span className="inline-flex items-center"><span className="w-3.5 h-3.5 mr-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />Refreshing</span> : 'Refresh'}
        </Button>
      </PageHeader>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="rss">RSS</TabsTrigger>
          <TabsTrigger value="mail">Mail</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <FeedList items={items} emptyLabel={!isUnlocked ? "Vault is locked. Unlock to load feeds." : "No items yet. Connect providers and refresh."} />
          {isUnlocked && items.length === 0 && !loading && (
            <Card className="mt-4 border-dashed border-2 border-muted-foreground/25">
              <CardContent className="py-6 text-center">
                <h3 className="text-sm font-medium mb-2">Get Started with Feeds</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Connect your social media accounts, add RSS sources, or connect email providers to start seeing aggregated content here.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => startOAuth('reddit')} variant="outline" size="sm"><ThumbsUp className="h-4 w-4 mr-1"/>Connect Reddit</Button>
                  <Button onClick={() => startOAuth('youtube')} variant="outline" size="sm">Connect YouTube</Button>
                  <Button variant="outline" size="sm" onClick={() => (document.querySelector('[data-value="rss"]') as HTMLElement)?.click()}>Add RSS Source</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="social">
          <div className="mb-3 flex gap-2 flex-wrap">
            <Button onClick={() => startOAuth('reddit')} variant="secondary" size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to connect accounts" : undefined}><ThumbsUp className="h-4 w-4 mr-1"/>Connect Reddit</Button>
            <Button onClick={() => startOAuth('youtube')} variant="secondary" size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to connect accounts" : undefined}>Connect YouTube</Button>
            <Button onClick={() => startOAuth('youtubemusic')} variant="secondary" size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to connect accounts" : undefined}>Connect YouTube Music</Button>
            <Button onClick={() => startOAuth('spotify')} variant="secondary" size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to connect accounts" : undefined}>Connect Spotify</Button>
          </div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Provider settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['reddit','twitter','facebook','instagram','youtube','youtubemusic','spotify'].map((p) => (
                  <ProviderToggle
                    key={p}
                    label={p}
                    enabled={isProviderEnabled(p as any)}
                    onToggle={(v) => handleProviderToggle(p, v)}
                    limit={getProviderLimit(p as any)}
                    onLimitChange={(n) => handleProviderLimitChange(p, n)}
                    disabled={!isUnlocked}
                  />
                ))}
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Reddit options</label>
                <div className="flex flex-wrap gap-2 mt-1 items-center">
                  <small className="text-muted-foreground">Subs:</small>
                  <Input
                    className="w-24"
                    type="number"
                    min={1}
                    defaultValue={getRedditSettings().subLimit}
                    onBlur={(e) => handleRedditSettingsChange({ subLimit: Number(e.target.value) })}
                    disabled={!isUnlocked}
                  />
                  <small className="text-muted-foreground">Posts/sub:</small>
                  <Input
                    className="w-24"
                    type="number"
                    min={1}
                    defaultValue={getRedditSettings().postsPerSub}
                    onBlur={(e) => handleRedditSettingsChange({ postsPerSub: Number(e.target.value) })}
                    disabled={!isUnlocked}
                  />
                </div>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Manual tokens (stored securely in Vault)</label>
                <div className="space-y-3 mt-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Twitter/X Bearer token</label>
                    <div className="flex gap-2 mt-1">
                      <Input placeholder="Bearer ..." value={twitterBearer} onChange={(e) => setTwitterBearer(e.target.value)} disabled={!isUnlocked} />
                      <Button onClick={handleSaveTwitterToken} size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to save tokens" : undefined}>Save</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Facebook Graph API token</label>
                    <div className="flex gap-2 mt-1">
                      <Input placeholder="EAAB..." value={facebookToken} onChange={(e) => setFacebookToken(e.target.value)} disabled={!isUnlocked} />
                      <Button onClick={handleSaveFacebookToken} size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to save tokens" : undefined}>Save</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Instagram API token</label>
                    <div className="flex gap-2 mt-1">
                      <Input placeholder="IGQV..." value={instagramToken} onChange={(e) => setInstagramToken(e.target.value)} disabled={!isUnlocked} />
                      <Button onClick={handleSaveInstagramToken} size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to save tokens" : undefined}>Save</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <FeedList items={[
            ...(grouped.get('reddit') || []),
            ...(grouped.get('twitter') || []),
            ...(grouped.get('facebook') || []),
            ...(grouped.get('instagram') || []),
            ...(grouped.get('youtube') || []),
            ...(grouped.get('youtubemusic') || []),
            ...(grouped.get('spotify') || []),
          ]} emptyLabel={!isUnlocked ? "Vault is locked. Unlock to load social feeds." : "No social items yet."} />
          {isUnlocked && !loading && (grouped.get('reddit')?.length || 0) + (grouped.get('twitter')?.length || 0) + (grouped.get('facebook')?.length || 0) + (grouped.get('instagram')?.length || 0) + (grouped.get('youtube')?.length || 0) + (grouped.get('youtubemusic')?.length || 0) + (grouped.get('spotify')?.length || 0) === 0 && (
            <Card className="mt-4 border-dashed border-2 border-muted-foreground/25">
              <CardContent className="py-6 text-center">
                <h3 className="text-sm font-medium mb-2">Connect Social Accounts</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Connect your social media accounts to see posts, videos, and updates from your favorite platforms.
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={() => startOAuth('reddit')} variant="outline" size="sm"><ThumbsUp className="h-4 w-4 mr-1"/>Connect Reddit</Button>
                  <Button onClick={() => startOAuth('youtube')} variant="outline" size="sm">Connect YouTube</Button>
                  <Button onClick={() => startOAuth('youtubemusic')} variant="outline" size="sm">Connect YouTube Music</Button>
                  <Button onClick={() => startOAuth('spotify')} variant="outline" size="sm">Connect Spotify</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rss">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">RSS Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input placeholder="https://example.com/feed.xml" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} disabled={!isUnlocked} />
                <Button onClick={handleAddRssSource} disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to add RSS sources" : undefined}><Rss className="h-4 w-4 mr-1"/>Add</Button>
              </div>
              {sources.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {!isUnlocked ? "Vault is locked. Unlock to manage RSS sources." : "No sources yet."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {sources.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <a href={s.url} target="_blank" className="truncate hover:underline">{s.title || s.url}</a>
                      <div className="flex items-center gap-2">
                        <small className="text-muted-foreground">Limit</small>
                        <Input className="w-20" type="number" min={1} defaultValue={s.limit || 20} onBlur={(e) => handleSetRssSourceLimit(s.id, Number(e.target.value))} disabled={!isUnlocked} />
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveRssSource(s.id)} disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to modify RSS sources" : undefined}>Remove</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <FeedList items={grouped.get('rss') || []} emptyLabel={!isUnlocked ? "Vault is locked. Unlock to load RSS feeds." : "No RSS items yet."} />
          {isUnlocked && !loading && (grouped.get('rss')?.length || 0) === 0 && (
            <Card className="mt-4 border-dashed border-2 border-muted-foreground/25">
              <CardContent className="py-6 text-center">
                <h3 className="text-sm font-medium mb-2">Add RSS Sources</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Add RSS feeds from your favorite websites, blogs, and news sources to get updates in one place.
                </p>
                <div className="flex gap-2 justify-center">
                  <Input placeholder="https://example.com/feed.xml" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} className="w-64" />
                  <Button onClick={handleAddRssSource}><Rss className="h-4 w-4 mr-1"/>Add</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mail">
          <div className="mb-3 flex gap-2 flex-wrap">
            <Button onClick={() => startOAuth('gmail')} variant="secondary" size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to connect accounts" : undefined}><Mail className="h-4 w-4 mr-1"/>Connect Gmail</Button>
            <Button onClick={() => startOAuth('outlook')} variant="secondary" size="sm" disabled={!isUnlocked} title={!isUnlocked ? "Vault must be unlocked to connect accounts" : undefined}><Mail className="h-4 w-4 mr-1"/>Connect Outlook</Button>
          </div>
          <FeedList items={[...(grouped.get('gmail') || []), ...(grouped.get('outlook') || [])]} emptyLabel={!isUnlocked ? "Vault is locked. Unlock to load emails." : "No unread emails."} />
          {isUnlocked && !loading && (grouped.get('gmail')?.length || 0) + (grouped.get('outlook')?.length || 0) === 0 && (
            <Card className="mt-4 border-dashed border-2 border-muted-foreground/25">
              <CardContent className="py-6 text-center">
                <h3 className="text-sm font-medium mb-2">Connect Email Accounts</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Connect your email accounts to see unread messages and stay on top of your inbox.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => startOAuth('gmail')} variant="outline" size="sm"><Mail className="h-4 w-4 mr-1"/>Connect Gmail</Button>
                  <Button onClick={() => startOAuth('outlook')} variant="outline" size="sm"><Mail className="h-4 w-4 mr-1"/>Connect Outlook</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Debug panel for development */}
      {isDevelopment && (
        <Card className="mt-6 border-dashed border-2 border-muted-foreground/25">
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div><strong>Vault Status:</strong> {isUnlocked ? 'Unlocked' : 'Locked'}</div>
            <div><strong>Loading State:</strong> {loading ? 'Loading' : 'Not Loading'}</div>
            <div><strong>Items Count:</strong> {items.length}</div>
            <div><strong>Loading Timeout:</strong> {loadingTimeout ? 'Timed Out' : 'Not Timed Out'}</div>
            <div><strong>RSS Sources:</strong> {sources.length}</div>
            <div className="pt-2">
              <Button 
                onClick={() => { 
                  console.log('Manual refresh triggered'); 
                  refreshAll(); 
                }} 
                variant="outline" 
                size="sm"
              >
                Force Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Memoize child components to prevent unnecessary re-renders
const ProviderToggle = React.memo(({ label, enabled, onToggle, limit, onLimitChange, disabled }: { label: string; enabled: boolean; onToggle: (v: boolean) => void | Promise<void>; limit: number; onLimitChange: (n: number) => void | Promise<void>; disabled?: boolean }) => {
  return (
    <div className="border rounded p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{label}</span>
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} disabled={disabled} />
          <span>Enabled</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <small className="text-muted-foreground">Limit</small>
        <Input className="w-24" type="number" min={1} defaultValue={limit} onBlur={(e) => onLimitChange(Number(e.target.value))} disabled={disabled} />
      </div>
    </div>
  )
})

const FeedList = React.memo(({ items, emptyLabel }: { items: ReturnType<typeof Array.prototype.slice>, emptyLabel: string }) => {
  if (!items || items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>
  }
  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((it) => (
        <Card key={it.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <span className="inline-flex items-center gap-2">
                <ProviderBadge provider={it.provider} />
                <a href={it.url || '#'} target="_blank" rel="noreferrer noopener" className="hover:underline truncate inline-block max-w-[14rem] align-middle">{it.title}</a>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="truncate">{it.author || ''}</span>
              {it.timestamp && <span>{new Date(it.timestamp).toLocaleString()}</span>}
            </div>
            {it.extra?.source && (
              <div className="mt-1 truncate" title={it.extra.source as string}>
                <span>Source: {String(it.extra.source)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
})

const ProviderBadge = React.memo(({ provider }: { provider: string }) => {
  const map: Record<string, React.ReactNode> = {
    reddit: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Reddit</span>,
    twitter: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Twitter</span>,
    facebook: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Facebook</span>,
    instagram: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Instagram</span>,
    rss: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">RSS</span>,
    gmail: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Gmail</span>,
    outlook: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Outlook</span>,
    youtube: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">YouTube</span>,
    youtubemusic: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">YT Music</span>,
    spotify: <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[11px]">Spotify</span>,
  }
  return <>{map[provider] || <span className="px-2 py-0.5 rounded bg-muted text-foreground/60 text-[11px]">{provider}</span>}</>
})



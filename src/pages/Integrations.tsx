import React, { useMemo, useState, useCallback, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useVaultSession } from '@/hooks/useVaultSession'
import { useToast } from '@/hooks/use-toast'
import { useAggregator } from '@/hooks/useAggregator'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useServiceApiConfig } from '@/hooks/useServiceApiConfig'
import { Plug, Lock, ExternalLink, RefreshCw, CheckCircle2, CircleX, Rss, Shield } from 'lucide-react'
import { ViewTransitionLink } from '@/components/ViewTransitionLink'
import { useMAL } from '@/hooks/useMAL'
import { useSteam } from '@/hooks/useSteam'

type OAuthProvider = 'reddit' | 'youtube' | 'youtubemusic' | 'spotify' | 'gmail' | 'outlook'
type ManualProvider = 'twitter' | 'facebook' | 'instagram'

export default function Integrations() {
  const { isUnlocked } = useVaultSession()
  const { toast } = useToast()
  const { startOAuth, getProviderData, saveManualToken, listRssSources } = useAggregator()
  const { itemsByType, updateItem, addItem } = useEncryptedVault()

  const jellyfin = useServiceApiConfig('jellyfin')
  const jellyseerr = useServiceApiConfig('jellyseerr')
  const karakeep = useServiceApiConfig('karakeep')

  const { startLink: startMalLink, getProfile: getMalProfile } = useMAL()
  const { startLink: startSteamLink, getProfile: getSteamProfile } = useSteam()

  const [malLinked, setMalLinked] = useState<boolean>(false)
  const [steamLinked, setSteamLinked] = useState<boolean>(false)

  const [manualTokens, setManualTokens] = useState<Record<ManualProvider, string>>(() => ({
    twitter: (getProviderData('twitter').bearer as string) || '',
    facebook: (getProviderData('facebook').access_token as string) || '',
    instagram: (getProviderData('instagram').access_token as string) || '',
  }))

  const rssCount = useMemo(() => listRssSources().length, [listRssSources])

  const isProviderConnected = useCallback((name: OAuthProvider | ManualProvider) => {
    const data = getProviderData(name as any)
    if (name === 'twitter') return !!data.bearer
    if (name === 'facebook' || name === 'instagram') return !!data.access_token
    return !!(data.access_token || data.refresh_token)
  }, [getProviderData])

  const findOrCreateProviderItem = useCallback(async (name: string) => {
    const item = [...itemsByType.api, ...itemsByType.login].find(i => i.name.toLowerCase() === name.toLowerCase())
    if (item) return item
    const created = await addItem({ type: 'api', name, data: {} })
    return created
  }, [itemsByType.api, itemsByType.login, addItem])

  const handleDisconnect = useCallback(async (name: OAuthProvider | ManualProvider) => {
    if (!isUnlocked) return
    const item = await findOrCreateProviderItem(name)
    if (!item) return
    const cleared = { ...item.data }
    delete (cleared as any).access_token
    delete (cleared as any).refresh_token
    delete (cleared as any).expires_at
    delete (cleared as any).bearer
    const ok = await updateItem(item.id, { data: cleared })
    if (ok) {
      toast({ title: 'Disconnected', description: `${name} connection has been removed.` })
    }
  }, [isUnlocked, findOrCreateProviderItem, updateItem, toast])

  const handleSaveManual = useCallback(async (name: ManualProvider) => {
    if (!isUnlocked) return
    const val = manualTokens[name].trim()
    if (!val) {
      toast({ title: 'Missing token', description: 'Please enter a token value before saving.', variant: 'destructive' })
      return
    }
    const payload = name === 'twitter' ? { bearer: val } : { access_token: val }
    await saveManualToken(name, payload)
    toast({ title: 'Saved', description: `${name} token saved in your vault.` })
  }, [isUnlocked, manualTokens, saveManualToken, toast])

  const oAuthProviders: Array<{ key: OAuthProvider; label: string; helper?: string }> = [
    { key: 'reddit', label: 'Reddit' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'youtubemusic', label: 'YouTube Music' },
    { key: 'spotify', label: 'Spotify' },
    { key: 'gmail', label: 'Gmail' },
    { key: 'outlook', label: 'Outlook' },
  ]

  const manualProviders: Array<{ key: ManualProvider; label: string; placeholder: string }> = [
    { key: 'twitter', label: 'Twitter/X', placeholder: 'Bearer ...' },
    { key: 'facebook', label: 'Facebook', placeholder: 'EAAB...' },
    { key: 'instagram', label: 'Instagram', placeholder: 'IGQV...' },
  ]

  // Fetch link status for MAL and Steam
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [mal, steam] = await Promise.all([getMalProfile(), getSteamProfile()])
        if (!cancelled) {
          setMalLinked(!!mal)
          setSteamLinked(!!steam)
        }
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Integrations"
        description="Connect external services and manage credentials"
        icon={Plug}
      />

      {!isUnlocked && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="py-10 text-center">
            <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">Vault is locked</h3>
            <p className="text-sm text-muted-foreground">Unlock your vault to connect integrations. Your tokens are stored encrypted.</p>
            <div className="mt-3">
              <ViewTransitionLink to="/vault">
                <Button variant="outline"><Shield className="h-4 w-4 mr-2"/>Open Vault</Button>
              </ViewTransitionLink>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OAuth providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {oAuthProviders.map(p => {
              const connected = isProviderConnected(p.key)
              return (
                <div key={p.key} className="border rounded-md p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.label}</span>
                    {connected ? (
                      <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Connected</Badge>
                    ) : (
                      <Badge variant="secondary" className="inline-flex items-center gap-1"><CircleX className="h-3.5 w-3.5"/>Not connected</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => startOAuth(p.key)} disabled={!isUnlocked} title={!isUnlocked ? 'Unlock vault to connect' : undefined}>
                      {connected ? 'Reconnect' : 'Connect'}
                    </Button>
                    {connected && (
                      <Button size="sm" variant="outline" onClick={() => handleDisconnect(p.key)} disabled={!isUnlocked}>Disconnect</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Manual tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {manualProviders.map((m) => {
            const connected = isProviderConnected(m.key)
            return (
              <div key={m.key} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{m.label}</span>
                  {connected ? (
                    <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Configured</Badge>
                  ) : (
                    <Badge variant="secondary">Not configured</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={m.placeholder}
                    value={manualTokens[m.key]}
                    onChange={(e) => setManualTokens((prev) => ({ ...prev, [m.key]: e.target.value }))}
                    disabled={!isUnlocked}
                  />
                  <Button size="sm" onClick={() => handleSaveManual(m.key)} disabled={!isUnlocked}>Save</Button>
                  {connected && (
                    <Button size="sm" variant="outline" onClick={() => handleDisconnect(m.key)} disabled={!isUnlocked}>Clear</Button>
                  )}
                </div>
                {m.key === 'twitter' && (
                  <p className="text-xs text-muted-foreground mt-1">Provide a Twitter API v2 Bearer token.</p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* App Accounts (link flows) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">App Accounts</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* MyAnimeList */}
          <div className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">MyAnimeList</span>
              {malLinked ? (
                <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Linked</Badge>
              ) : (
                <Badge variant="secondary" className="inline-flex items-center gap-1"><CircleX className="h-3.5 w-3.5"/>Not linked</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => { const url = await startMalLink(); window.location.href = url }}>
                {malLinked ? 'Relink' : 'Link'}
              </Button>
              <ViewTransitionLink to="/anime"><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1"/>Open</Button></ViewTransitionLink>
            </div>
          </div>
          {/* Steam */}
          <div className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Steam</span>
              {steamLinked ? (
                <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Linked</Badge>
              ) : (
                <Badge variant="secondary" className="inline-flex items-center gap-1"><CircleX className="h-3.5 w-3.5"/>Not linked</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={async () => { const url = await startSteamLink(); window.location.href = url }}>
                {steamLinked ? 'Relink' : 'Link'}
              </Button>
              <ViewTransitionLink to="/steam"><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1"/>Open</Button></ViewTransitionLink>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media Servers & Homelab */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media & Homelab</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Jellyfin</span>
              {jellyfin.isConfigured ? (
                <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Configured</Badge>
              ) : (
                <Badge variant="secondary">Not configured</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <ViewTransitionLink to="/homelab/jellyfin"><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1"/>Open</Button></ViewTransitionLink>
            </div>
            {jellyfin.isConfigured && jellyfin.config.serverUrl && (
              <p className="text-xs text-muted-foreground mt-2 truncate">{jellyfin.config.serverUrl}</p>
            )}
          </div>
          <div className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Jellyseerr</span>
              {jellyseerr.isConfigured ? (
                <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Configured</Badge>
              ) : (
                <Badge variant="secondary">Not configured</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <ViewTransitionLink to="/homelab/media-requests"><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1"/>Open</Button></ViewTransitionLink>
            </div>
            {jellyseerr.isConfigured && jellyseerr.config.serverUrl && (
              <p className="text-xs text-muted-foreground mt-2 truncate">{jellyseerr.config.serverUrl}</p>
            )}
          </div>
          <div className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Karakeep</span>
              {karakeep.isConfigured ? (
                <Badge variant="success" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Configured</Badge>
              ) : (
                <Badge variant="secondary">Not configured</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <ViewTransitionLink to="/homelab/karakeep"><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1"/>Open</Button></ViewTransitionLink>
            </div>
            {karakeep.isConfigured && karakeep.config.serverUrl && (
              <p className="text-xs text-muted-foreground mt-2 truncate">{karakeep.config.serverUrl}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RSS quick link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">RSS Sources</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Rss className="h-4 w-4"/>
            <span>{rssCount} source{rssCount === 1 ? '' : 's'}</span>
          </div>
          <ViewTransitionLink to="/feeds">
            <Button variant="outline" size="sm">
              Manage in Feeds
            </Button>
          </ViewTransitionLink>
        </CardContent>
      </Card>
    </div>
  )
}

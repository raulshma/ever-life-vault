import React from 'react'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { WidgetShell } from '../components/WidgetShell'
import { Button } from '@/components/ui/button'
import { useSteam } from '@/hooks/useSteam'
import { useAuth } from '@/hooks/useAuth'
import PrereqGuard from '@/components/PrereqGuard'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type SteamProfileConfig = BaseWidgetConfig & {}

export default function SteamProfileWidget({ config, onConfigChange, isEditing }: WidgetProps<SteamProfileConfig>) {
  const { startLink, sync, getProfile, loading } = useSteam()
  const [profile, setProfile] = React.useState<any | null>(null)
  const [busy, setBusy] = React.useState(false)
  const { user } = useAuth()
  
  const { getCached, setCached } = useApiCache<any>()

  const load = React.useCallback(async () => {
    // Check cache first
    const cacheKey = generateCacheKey('steam-profile', { userId: user?.id })
    const cached = getCached(cacheKey, config.cacheTimeMs)
    if (cached) {
      setProfile(cached)
      return
    }
    
    setBusy(true)
    try {
      const p = await getProfile()
      setProfile(p)
      // Cache the result
      setCached(cacheKey, p, config.cacheTimeMs)
    } finally {
      setBusy(false)
    }
  }, [getProfile, user?.id, config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { void load() }, [load])

  const onLink = async () => {
    const url = await startLink()
    window.location.href = url
  }

  const onSync = async () => {
    await sync()
    await load()
  }

  const prereqs = [
    { ok: Boolean(user), label: 'Sign in to manage Steam', actionLabel: 'Sign in', onAction: () => (window.location.href = '/auth') },
  ]

  return (
    <WidgetShell
      title="Steam Profile"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onSync} disabled={loading || busy}>Sync</Button>
          <Button size="sm" onClick={onLink}>Link</Button>
        </div>
      }
    >
      <PrereqGuard title="Steam requires sign in" checks={prereqs}>
        {!profile ? (
          <p className="text-sm text-muted-foreground">Not linked yet or no data. Link and sync to load your Steam profile.</p>
        ) : (
          <div className="flex items-center gap-3">
            {profile.avatar_url && (
              <img src={profile.avatar_url} alt="avatar" className="w-14 h-14 rounded" />
            )}
            <div className="min-w-0">
              <div className="font-semibold truncate">{profile.persona_name || profile.steamid64}</div>
              <div className="text-xs text-muted-foreground">{profile.country || '—'}</div>
            </div>
          </div>
        )}
        
        {/* Cache Configuration */}
        {isEditing && (
          <CacheConfig config={config} onConfigChange={onConfigChange} />
        )}
      </PrereqGuard>
    </WidgetShell>
  )
}



import React from 'react'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { WidgetShell } from '../components/WidgetShell'
import { Button } from '@/components/ui/button'
import { useSteam } from '@/hooks/useSteam'
import { useAuth } from '@/hooks/useAuth'
import PrereqGuard from '@/components/PrereqGuard'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type SteamRecentConfig = BaseWidgetConfig & { max?: number }

export default function SteamRecentlyPlayedWidget({ config, onConfigChange, isEditing }: WidgetProps<SteamRecentConfig>) {
  const { getRecent, sync, loading } = useSteam()
  const [items, setItems] = React.useState<Array<{ appid: number; name?: string; playtime_2weeks_minutes: number; last_played_at?: string | null }>>([])
  const [busy, setBusy] = React.useState(false)
  const { user } = useAuth()
  
  const { getCached, setCached } = useApiCache<Array<{ appid: number; name?: string; playtime_2weeks_minutes: number; last_played_at?: string | null }>>()

  const load = React.useCallback(async () => {
    // Check cache first
    const cacheKey = generateCacheKey('steam-recent', { userId: user?.id })
    const cached = getCached(cacheKey, config.cacheTimeMs)
    if (cached) {
      setItems(cached)
      return
    }
    
    setBusy(true)
    try {
      const json = await getRecent()
      const recentItems = Array.isArray(json?.items) ? json.items : []
      setItems(recentItems)
      // Cache the result
      setCached(cacheKey, recentItems, config.cacheTimeMs)
    } finally {
      setBusy(false)
    }
  }, [getRecent, user?.id, config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { void load() }, [load])

  const onSync = async () => { await sync(); await load() }

  const prereqs = [
    { ok: Boolean(user), label: 'Sign in to view Steam activity', actionLabel: 'Sign in', onAction: () => (window.location.href = '/auth') },
  ]

  return (
    <WidgetShell title="Steam Recently Played" actions={<Button size="sm" variant="outline" onClick={onSync} disabled={loading || busy}>Sync</Button>}>
      <PrereqGuard title="Steam requires sign in" checks={prereqs}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent playtime detected.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.slice(0, config?.max || 10).map((it) => (
              <li key={it.appid} className="flex items-center justify-between gap-3">
                <span className="truncate" title={it.name || String(it.appid)}>{it.name || `App ${it.appid}`}</span>
                <span className="text-muted-foreground tabular-nums">{it.playtime_2weeks_minutes} min</span>
              </li>
            ))}
          </ul>
        )}
        
        {/* Cache Configuration */}
        {isEditing && (
          <CacheConfig config={config} onConfigChange={onConfigChange} />
        )}
      </PrereqGuard>
    </WidgetShell>
  )
}



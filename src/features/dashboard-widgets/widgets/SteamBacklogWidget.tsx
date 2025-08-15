import React from 'react'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { WidgetShell } from '../components/WidgetShell'
import { Button } from '@/components/ui/button'
import { useSteam } from '@/hooks/useSteam'
import { useAuth } from '@/hooks/useAuth'
import PrereqGuard from '@/components/PrereqGuard'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type SteamBacklogConfig = BaseWidgetConfig & { max?: number }

export default function SteamBacklogWidget({ config, onConfigChange, isEditing }: WidgetProps<SteamBacklogConfig>) {
  const { getSuggestions, sync, loading } = useSteam()
  const [items, setItems] = React.useState<Array<{ appid: number; name?: string; score: number }>>([])
  const [busy, setBusy] = React.useState(false)
  const { user } = useAuth()
  
  const { getCached, getCachedAsync, setCached } = useApiCache<Array<{ appid: number; name?: string; score: number }>>()

  const load = React.useCallback(async () => {
    // Check cache first
    const cacheKey = generateCacheKey('steam-backlog', { userId: user?.id })
    const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
    if (cached) {
      setItems(cached)
      return
    }
    
    setBusy(true)
    try {
      const json = await getSuggestions()
      const backlogItems = Array.isArray(json?.items) ? json.items : []
      setItems(backlogItems)
      // Cache the result
      setCached(cacheKey, backlogItems, config.cacheTimeMs)
    } finally {
      setBusy(false)
    }
  }, [getSuggestions, user?.id, config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { void load() }, [load])

  const onSync = async () => { await sync(); await load() }

  const prereqs = [
    { ok: Boolean(user), label: 'Sign in to view Steam suggestions', actionLabel: 'Sign in', onAction: () => (window.location.href = '/auth') },
  ]

  return (
    <WidgetShell title="Steam Backlog" actions={<Button size="sm" variant="outline" onClick={onSync} disabled={loading || busy}>Sync</Button>}>
      <PrereqGuard title="Steam requires sign in" checks={prereqs}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions yet. Sync to generate a backlog.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.slice(0, config?.max || 10).map((it) => (
              <li key={it.appid} className="flex items-center justify-between gap-3">
                <span className="truncate" title={it.name || String(it.appid)}>{it.name || `App ${it.appid}`}</span>
                <span className="text-muted-foreground tabular-nums">{(it.score * 100).toFixed(0)}%</span>
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



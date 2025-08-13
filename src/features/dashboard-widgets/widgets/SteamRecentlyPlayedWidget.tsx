import React from 'react'
import type { WidgetProps } from '../types'
import { WidgetShell } from '../components/WidgetShell'
import { Button } from '@/components/ui/button'
import { useSteam } from '@/hooks/useSteam'

type SteamRecentConfig = { max?: number }

export default function SteamRecentlyPlayedWidget({ config }: WidgetProps<SteamRecentConfig>) {
  const { getRecent, sync, loading } = useSteam()
  const [items, setItems] = React.useState<Array<{ appid: number; name?: string; playtime_2weeks_minutes: number; last_played_at?: string | null }>>([])
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setBusy(true)
    try {
      const json = await getRecent()
      setItems(Array.isArray(json?.items) ? json.items : [])
    } finally {
      setBusy(false)
    }
  }, [getRecent])

  React.useEffect(() => { void load() }, [load])

  const onSync = async () => { await sync(); await load() }

  return (
    <WidgetShell title="Steam Recently Played" actions={<Button size="sm" variant="outline" onClick={onSync} disabled={loading || busy}>Sync</Button>}>
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
    </WidgetShell>
  )
}



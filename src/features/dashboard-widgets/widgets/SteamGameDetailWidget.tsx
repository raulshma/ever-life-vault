import React from 'react'
import type { WidgetProps } from '../types'
import { WidgetShell } from '../components/WidgetShell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useSteam } from '@/hooks/useSteam'

type SteamDetailConfig = { appid?: number }

export default function SteamGameDetailWidget({ config, onConfigChange }: WidgetProps<SteamDetailConfig>) {
  const { getGame } = useSteam()
  const [data, setData] = React.useState<any | null>(null)
  const [appid, setAppid] = React.useState<number | undefined>(config?.appid)

  const load = React.useCallback(async () => {
    if (!appid) return
    const json = await getGame(appid)
    setData(json)
  }, [appid, getGame])

  React.useEffect(() => { void load() }, [load])

  const apply = () => { onConfigChange({ ...config, appid }); void load() }

  return (
    <WidgetShell title="Steam Game Detail">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="AppID" type="number" value={appid ?? ''} onChange={(e) => setAppid(Number(e.target.value))} />
          <Button onClick={apply}>Load</Button>
        </div>
        {!data ? (
          <p className="text-sm text-muted-foreground">Enter an AppID and click Load.</p>
        ) : (
          <div className="text-sm space-y-2">
            <div className="font-semibold">{data?.game?.name || `App ${data?.game?.appid}`}</div>
            {data?.game?.header_image && (
              <img src={data.game.header_image} alt="header" className="w-full max-w-xs rounded" />
            )}
            <div className="text-muted-foreground">
              Playtime: {data?.ownership?.playtime_forever_minutes ?? 0} min{data?.ownership?.last_played_at ? ` · Last played ${new Date(data?.ownership?.last_played_at).toLocaleString()}` : ''}
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  )
}



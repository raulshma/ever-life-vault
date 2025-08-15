import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LocateFixed, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { agpFetch } from '@/lib/aggregatorClient'

type WindConfig = {
  lat?: number
  lon?: number
  units?: 'kmh' | 'ms' | 'mph'
}

type WindData = {
  speedMs?: number
  gustMs?: number
  directionDeg?: number
  time?: string
}

function msTo(valueMs: number, units: WindConfig['units']): number {
  switch (units) {
    case 'kmh': return valueMs * 3.6
    case 'mph': return valueMs * 2.23693629
    default: return valueMs
  }
}

function formatSpeed(ms: number | undefined, units: WindConfig['units']): string {
  if (typeof ms !== 'number') return '—'
  const v = msTo(ms, units)
  const rounded = Math.round(v)
  return `${rounded} ${units}`
}

function degToCompass(deg?: number): string {
  if (typeof deg !== 'number') return '—'
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  const ix = Math.round((deg % 360) / 22.5) % 16
  return dirs[ix]
}

async function fetchWind(lat: number, lon: number): Promise<WindData | null> {
  // Open-Meteo current weather
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m`;
  try {
    const res = await agpFetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as any
    const cur = json?.current || {}
    return {
      speedMs: typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m / 3.6 /* API returns km/h */ : undefined,
      gustMs: typeof cur.wind_gusts_10m === 'number' ? cur.wind_gusts_10m / 3.6 : undefined,
      directionDeg: typeof cur.wind_direction_10m === 'number' ? cur.wind_direction_10m : undefined,
      time: typeof cur.time === 'string' ? cur.time : undefined,
    }
  } catch {
    return null
  }
}

export default function WindFocusWidget({ config, onConfigChange }: WidgetProps<WindConfig>) {
  const [data, setData] = React.useState<WindData>({})
  const [loading, setLoading] = React.useState(false)
  const lat = typeof config?.lat === 'number' ? config.lat : undefined
  const lon = typeof config?.lon === 'number' ? config.lon : undefined
  const units = config?.units || 'kmh'

  const refresh = React.useCallback(async () => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    setLoading(true)
    const w = await fetchWind(lat, lon)
    setLoading(false)
    if (w) setData(w)
  }, [lat, lon])

  React.useEffect(() => { void refresh() }, [refresh])

  const setLat = React.useCallback((v: string) => {
    const n = Number(v)
    onConfigChange({ ...config, lat: Number.isFinite(n) ? n : undefined })
  }, [config, onConfigChange])
  
  const setLon = React.useCallback((v: string) => {
    const n = Number(v)
    onConfigChange({ ...config, lon: Number.isFinite(n) ? n : undefined })
  }, [config, onConfigChange])
  const setUnits = React.useCallback((v: string) => {
    onConfigChange({ ...config, units: (v as WindConfig['units']) })
  }, [config, onConfigChange])

  const useMyLocation = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Geolocation not available')); return }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords
            onConfigChange({ ...config, lat: Math.round(latitude * 1000) / 1000, lon: Math.round(longitude * 1000) / 1000 })
            resolve()
          },
          (err) => reject(err),
          { enableHighAccuracy: false, maximumAge: 60_000 }
        )
      })
    } catch {
      // ignore
    }
  }

  return (
    <WidgetShell
      title="Wind Focus"
      actions={
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Use my location" onClick={useMyLocation}>
                <LocateFixed className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Use my location</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Refresh" onClick={() => void refresh()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Speed</div>
            <div className="font-medium">{formatSpeed(data.speedMs, units)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Gust</div>
            <div className="font-medium">{formatSpeed(data.gustMs, units)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Direction</div>
            <div className="font-medium">{degToCompass(data.directionDeg)}{typeof data.directionDeg === 'number' ? ` (${Math.round(data.directionDeg)}°)` : ''}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <Input className="w-28" placeholder="Latitude" value={lat ?? ''} onChange={(e) => setLat(e.target.value)} />
            <Input className="w-28" placeholder="Longitude" value={lon ?? ''} onChange={(e) => setLon(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={units === 'kmh' ? 'default' : 'outline'} onClick={() => setUnits('kmh')}>km/h</Button>
            <Button size="sm" variant={units === 'ms' ? 'default' : 'outline'} onClick={() => setUnits('ms')}>m/s</Button>
            <Button size="sm" variant={units === 'mph' ? 'default' : 'outline'} onClick={() => setUnits('mph')}>mph</Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Data via Open-Meteo (proxied). Coordinates are stored only in this widget's settings.</div>
      </div>
    </WidgetShell>
  )
}



import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LocateFixed, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { agpFetch } from '@/lib/aggregatorClient'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type PrecipConfig = BaseWidgetConfig & {
  lat?: number
  lon?: number
}

type MinutePrecip = { time: string; mm: number }

async function fetchNowcast(lat: number, lon: number): Promise<MinutePrecip[] | null> {
  // Open-Meteo nowcast: 1-minute precipitation for next hour
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&minutely_15=precipitation&forecast_hours=2&timezone=auto`
  try {
    const res = await agpFetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as { minutely_15?: { time?: string[]; precipitation?: number[] } }
    const times: string[] = json?.minutely_15?.time || []
    const prec: number[] = json?.minutely_15?.precipitation || []
    if (!Array.isArray(times) || !Array.isArray(prec)) return null
    const out: MinutePrecip[] = []
    for (let i = 0; i < Math.min(times.length, prec.length, 60); i++) {
      const p = typeof prec[i] === 'number' ? prec[i] : 0
      out.push({ time: times[i], mm: p })
    }
    return out
  } catch {
    return null
  }
}

export default function PrecipNowcastWidget({ config, onConfigChange, isEditing }: WidgetProps<PrecipConfig>) {
  const [points, setPoints] = React.useState<MinutePrecip[]>([])
  const [loading, setLoading] = React.useState(false)
  const lat = typeof config?.lat === 'number' ? config.lat : undefined
  const lon = typeof config?.lon === 'number' ? config.lon : undefined
  
  const { getCached, getCachedAsync, setCached } = useApiCache<MinutePrecip[]>()

  const refresh = React.useCallback(async () => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    
    // Check cache first
    const cacheKey = generateCacheKey('precip-nowcast', { lat, lon })
    const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
    if (cached) {
      setPoints(cached)
      return
    }
    
    setLoading(true)
    const arr = await fetchNowcast(lat, lon)
    setLoading(false)
    if (Array.isArray(arr)) {
      setPoints(arr)
      // Cache the result
      setCached(cacheKey, arr, config.cacheTimeMs)
    } else {
      setPoints([])
    }
  }, [lat, lon, config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { void refresh() }, [refresh])

  const setLat = (v: string) => {
    const n = Number(v)
    onConfigChange({ ...config, lat: Number.isFinite(n) ? n : undefined })
  }
  const setLon = (v: string) => {
    const n = Number(v)
    onConfigChange({ ...config, lon: Number.isFinite(n) ? n : undefined })
  }

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
    } catch (error) {
      console.error('Failed to fetch precipitation data:', error)
      return null
    }
  }

  const willRain = points.some((p) => p.mm > 0.01)
  const startIdx = points.findIndex((p) => p.mm > 0.01)
  const startInMin = startIdx >= 0 ? startIdx : null

  return (
    <WidgetShell
      title="Precip Nowcast"
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
        <div className="flex items-center gap-2">
          <Input className="w-28" placeholder="Latitude" value={lat ?? ''} onChange={(e) => setLat(e.target.value)} />
          <Input className="w-28" placeholder="Longitude" value={lon ?? ''} onChange={(e) => setLon(e.target.value)} />
        </div>
        <div className="text-xs text-muted-foreground">{willRain ? (startInMin != null ? `Starts in ~${startInMin} min` : 'Rain expected') : 'No rain expected next hour'}</div>
        <div className="h-16 w-full rounded-md border p-2 grid grid-cols-60 gap-[1px] bg-muted/40">
          {points.slice(0, 60).map((p, i) => {
            const h = Math.min(1, p.mm / 2) // scale bars; 2mm/h = full height
            return <div key={i} className="bg-[hsl(var(--info)/0.7)]" style={{ height: `${h * 100}%`, alignSelf: 'end' }} />
          })}
        </div>
        <div className="text-xs text-muted-foreground">Data via Open-Meteo (proxied). Coordinates are stored only in this widget's settings.</div>
        
        {/* Cache Configuration */}
        {isEditing && (
          <CacheConfig config={config} onConfigChange={onConfigChange} />
        )}
      </div>
    </WidgetShell>
  )
}



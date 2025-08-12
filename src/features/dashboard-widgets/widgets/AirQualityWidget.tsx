import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LocateFixed, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { agpFetch } from '@/lib/aggregatorClient'

type AQConfig = {
  lat?: number
  lon?: number
  scale?: 'us' // future: 'eu'
}

type AQData = {
  aqi?: number
  pm25?: number
  pm10?: number
  o3?: number
  no2?: number
  so2?: number
  co?: number
  time?: string
}

function categoryUS(aqi?: number): { label: string; className: string } {
  if (typeof aqi !== 'number') return { label: '—', className: 'text-muted-foreground' }
  if (aqi <= 50) return { label: 'Good', className: 'text-green-600' }
  if (aqi <= 100) return { label: 'Moderate', className: 'text-yellow-600' }
  if (aqi <= 150) return { label: 'USG', className: 'text-amber-700' }
  if (aqi <= 200) return { label: 'Unhealthy', className: 'text-red-600' }
  if (aqi <= 300) return { label: 'Very Unhealthy', className: 'text-purple-600' }
  return { label: 'Hazardous', className: 'text-rose-700' }
}

async function fetchAQ(lat: number, lon: number): Promise<AQData | null> {
  // Open-Meteo Air Quality API
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&hourly=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide&timezone=auto&past_days=0&forecast_days=1`
  try {
    const res = await agpFetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as any
    const hours: string[] = json?.hourly?.time || []
    const idx = hours.length > 0 ? nearestIndex(hours) : -1
    if (idx < 0) return null
    return {
      aqi: numberAt(json?.hourly?.us_aqi, idx),
      pm25: numberAt(json?.hourly?.pm2_5, idx),
      pm10: numberAt(json?.hourly?.pm10, idx),
      o3: numberAt(json?.hourly?.ozone, idx),
      no2: numberAt(json?.hourly?.nitrogen_dioxide, idx),
      so2: numberAt(json?.hourly?.sulphur_dioxide, idx),
      co: numberAt(json?.hourly?.carbon_monoxide, idx),
      time: hours[idx],
    }
  } catch {
    return null
  }
}

function numberAt(arr: any, i: number): number | undefined {
  const v = Array.isArray(arr) ? arr[i] : undefined
  return typeof v === 'number' ? v : undefined
}

function nearestIndex(isoTimes: string[]): number {
  const now = Date.now()
  let best = -1
  let bestDelta = Infinity
  for (let i = 0; i < isoTimes.length; i++) {
    const t = Date.parse(isoTimes[i])
    const d = Math.abs(t - now)
    if (d < bestDelta) { best = i; bestDelta = d }
  }
  return best
}

export default function AirQualityWidget({ config, onConfigChange }: WidgetProps<AQConfig>) {
  const [data, setData] = React.useState<AQData>({})
  const [loading, setLoading] = React.useState(false)
  const lat = typeof config?.lat === 'number' ? config.lat : undefined
  const lon = typeof config?.lon === 'number' ? config.lon : undefined
  const scale = config?.scale || 'us'

  const refresh = React.useCallback(async () => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    setLoading(true)
    const v = await fetchAQ(lat, lon)
    setLoading(false)
    if (v) setData(v)
  }, [lat, lon])

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
    } catch {}
  }

  const cat = categoryUS(data.aqi)

  return (
    <WidgetShell
      title="Air Quality"
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
        <div className="flex items-baseline gap-3">
          <div className={`text-2xl font-bold ${cat.className}`}>{typeof data.aqi === 'number' ? Math.round(data.aqi) : '—'}</div>
          <div className={`text-xs ${cat.className}`}>{scale.toUpperCase()} AQI · {cat.label}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Metric label="PM2.5" value={fmt(data.pm25, 'µg/m³')} />
          <Metric label="PM10" value={fmt(data.pm10, 'µg/m³')} />
          <Metric label="O₃" value={fmt(data.o3, 'µg/m³')} />
          <Metric label="NO₂" value={fmt(data.no2, 'µg/m³')} />
          <Metric label="SO₂" value={fmt(data.so2, 'µg/m³')} />
          <Metric label="CO" value={fmt(data.co, 'µg/m³')} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex items-center gap-2">
            <Input className="w-28" placeholder="Latitude" value={lat ?? ''} onChange={(e) => setLat(e.target.value)} />
            <Input className="w-28" placeholder="Longitude" value={lon ?? ''} onChange={(e) => setLon(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground ml-auto">{data.time ? new Date(data.time).toLocaleString() : ''}</div>
        </div>
        <div className="text-xs text-muted-foreground">Data via Open-Meteo (proxied). Coordinates are stored only in this widget's settings.</div>
      </div>
    </WidgetShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function fmt(v?: number, unit?: string): string {
  if (typeof v !== 'number') return '—'
  return `${Math.round(v)}${unit ? ` ${unit}` : ''}`
}



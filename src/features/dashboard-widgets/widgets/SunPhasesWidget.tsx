import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LocateFixed } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type SunPhasesConfig = {
  lat?: number
  lon?: number
  mode?: 'official' | 'civil' | 'nautical' | 'astronomical'
}

type SunTimes = {
  sunrise?: Date
  sunset?: Date
  solarNoon?: Date
  dayLengthMs?: number
  polarDay?: boolean
  polarNight?: boolean
}

function toFixed(n: number, d = 2): number {
  const p = Math.pow(10, d)
  return Math.round(n * p) / p
}

function clampHour(h: number): number {
  let x = h % 24
  if (x < 0) x += 24
  return x
}

function degToRad(d: number): number { return (d * Math.PI) / 180 }
function radToDeg(r: number): number { return (r * 180) / Math.PI }

function dayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0))
  const diff = (date.getTime() - start.getTime())
  return Math.floor(diff / 86400000)
}

function computeSunTimes(date: Date, lat: number, lon: number, mode: SunPhasesConfig['mode'] = 'official'): SunTimes {
  const N = dayOfYear(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())))
  const lngHour = lon / 15
  const zenithDeg = mode === 'civil' ? 96 : mode === 'nautical' ? 102 : mode === 'astronomical' ? 108 : 90.833
  const zenith = degToRad(zenithDeg)

  function calc(isSunrise: boolean): number | null {
    const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24
    const M = (0.9856 * t) - 3.289
    let L = M + (1.916 * Math.sin(degToRad(M))) + (0.020 * Math.sin(degToRad(2 * M))) + 282.634
    L = ((L % 360) + 360) % 360
    let RA = radToDeg(Math.atan(0.91764 * Math.tan(degToRad(L))))
    RA = ((RA % 360) + 360) % 360
    const Lquadrant = Math.floor(L / 90) * 90
    const RAquadrant = Math.floor(RA / 90) * 90
    RA = (RA + (Lquadrant - RAquadrant)) / 15
    const sinDec = 0.39782 * Math.sin(degToRad(L))
    const cosDec = Math.cos(Math.asin(sinDec))
    const cosH = (Math.cos(zenith) - (sinDec * Math.sin(degToRad(lat)))) / (cosDec * Math.cos(degToRad(lat)))
    if (cosH > 1) return null // polar night for sunrise
    if (cosH < -1) return null // polar day for sunset
    const H = isSunrise ? 360 - radToDeg(Math.acos(cosH)) : radToDeg(Math.acos(cosH))
    const Hhours = H / 15
    const T = Hhours + RA - (0.06571 * t) - 6.622
    const UT = clampHour(T - lngHour)
    return UT
  }

  const UT_rise = calc(true)
  const UT_set = calc(false)
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const d = date.getUTCDate()

  if (UT_rise == null && UT_set == null) {
    // cannot compute; either polar day or night
    // Determine which by checking maximum altitude; use cosH check sign from sunrise path
    const polarNight = true // default; caller can interpret
    return { polarNight }
  }

  const sunrise = UT_rise != null ? new Date(Date.UTC(y, m, d, Math.floor(UT_rise), Math.floor((UT_rise % 1) * 60))) : undefined
  const sunset = UT_set != null ? new Date(Date.UTC(y, m, d, Math.floor(UT_set), Math.floor((UT_set % 1) * 60))) : undefined
  let solarNoon: Date | undefined
  let dayLengthMs: number | undefined
  if (sunrise && sunset) {
    solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2)
    dayLengthMs = sunset.getTime() - sunrise.getTime()
  }
  return {
    sunrise,
    sunset,
    solarNoon,
    dayLengthMs,
    polarDay: UT_rise == null && UT_set != null,
    polarNight: UT_set == null && UT_rise != null ? false : UT_rise == null && UT_set == null ? true : false,
  }
}

function formatTime(d?: Date): string {
  if (!d) return '—'
  try { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return d.toISOString().slice(11,16) }
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default function SunPhasesWidget({ config, onConfigChange }: WidgetProps<SunPhasesConfig>) {
  const [now, setNow] = React.useState<Date>(new Date())
  const [times, setTimes] = React.useState<SunTimes>({})
  const lat = typeof config?.lat === 'number' ? config.lat : undefined
  const lon = typeof config?.lon === 'number' ? config.lon : undefined
  const mode = config?.mode || 'official'

  const compute = React.useCallback(() => {
    if (typeof lat !== 'number' || typeof lon !== 'number') { setTimes({}); return }
    const date = new Date()
    const utcMid = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    setTimes(computeSunTimes(utcMid, lat, lon, mode))
  }, [lat, lon, mode])

  React.useEffect(() => { compute() }, [compute])
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const setLat = (v: string) => {
    const n = Number(v)
    onConfigChange({ ...config, lat: Number.isFinite(n) ? n : undefined })
  }
  const setLon = (v: string) => {
    const n = Number(v)
    onConfigChange({ ...config, lon: Number.isFinite(n) ? n : undefined })
  }
  const setMode = (v: SunPhasesConfig['mode']) => onConfigChange({ ...config, mode: v })

  const useMyLocation = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Geolocation not available')); return }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords
            onConfigChange({ ...config, lat: toFixed(latitude, 6), lon: toFixed(longitude, 6) })
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
      title="Sun Phases"
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
          <Select value={mode} onValueChange={(v) => setMode(v as SunPhasesConfig['mode'])}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="official">Official</SelectItem>
              <SelectItem value="civil">Civil</SelectItem>
              <SelectItem value="nautical">Nautical</SelectItem>
              <SelectItem value="astronomical">Astronomical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-muted-foreground text-xs">Sunrise</div>
            <div className="font-medium">{formatTime(times.sunrise)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Solar noon</div>
            <div className="font-medium">{formatTime(times.solarNoon)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Sunset</div>
            <div className="font-medium">{formatTime(times.sunset)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Day length</div>
            <div className="font-medium">{formatDuration(times.dayLengthMs)}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Now: {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input className="w-36" placeholder="Latitude" value={lat ?? ''} onChange={(e) => setLat(e.target.value)} />
            <Input className="w-36" placeholder="Longitude" value={lon ?? ''} onChange={(e) => setLon(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground">Coordinates are stored only in this widget's settings.</div>
        </div>
        {(times.polarDay || times.polarNight) && (
          <div className="text-xs text-amber-600">{times.polarDay ? 'Polar day (no night)' : 'Polar night (no sunrise)'} at this latitude today.</div>
        )}
      </div>
    </WidgetShell>
  )
}



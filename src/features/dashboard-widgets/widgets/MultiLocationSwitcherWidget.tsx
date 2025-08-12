import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LocateFixed, Copy, Trash2, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

type MultiLocationConfig = {
  // Intentionally empty: favorites are local-only in localStorage per privacy spec
}

type Favorite = { id: string; name: string; lat: number; lon: number }

const LS_KEY = 'weather:favorites'
const LS_ACTIVE = 'weather:active'

function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) as Favorite[] : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x?.lat === 'number' && typeof x?.lon === 'number') : []
  } catch { return [] }
}

function saveFavorites(list: Favorite[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch {}
}

function getActiveId(): string | null {
  try { return localStorage.getItem(LS_ACTIVE) } catch { return null }
}

function setActiveId(id: string) {
  try { localStorage.setItem(LS_ACTIVE, id) } catch {}
}

export default function MultiLocationSwitcherWidget(_props: WidgetProps<MultiLocationConfig>) {
  const [favorites, setFavorites] = React.useState<Favorite[]>([])
  const [active, setActive] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const [lat, setLat] = React.useState('')
  const [lon, setLon] = React.useState('')

  React.useEffect(() => {
    setFavorites(loadFavorites())
    setActive(getActiveId())
  }, [])

  const add = () => {
    const nLat = Number(lat)
    const nLon = Number(lon)
    if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return
    const entry: Favorite = { id: cryptoRandomId(), name: name.trim() || `${nLat},${nLon}`, lat: nLat, lon: nLon }
    const next = [...favorites, entry]
    setFavorites(next)
    saveFavorites(next)
    setName(''); setLat(''); setLon('')
  }

  const remove = (id: string) => {
    const next = favorites.filter((f) => f.id !== id)
    setFavorites(next)
    saveFavorites(next)
    if (active === id) { setActive(null); setActiveId('') }
  }

  const useMyLocation = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Geolocation not available')); return }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords
            setLat(String(Math.round(latitude * 1000) / 1000))
            setLon(String(Math.round(longitude * 1000) / 1000))
            resolve()
          },
          (err) => reject(err),
          { enableHighAccuracy: false, maximumAge: 60_000 }
        )
      })
    } catch {}
  }

  const activate = (id: string) => {
    setActive(id)
    setActiveId(id)
  }

  const copyActive = async () => {
    try {
      const f = favorites.find((x) => x.id === active)
      if (!f) return
      await navigator.clipboard.writeText(`${f.lat},${f.lon}`)
    } catch {}
  }

  return (
    <WidgetShell
      title="Locations"
      actions={
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Copy active" onClick={copyActive} disabled={!active}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy active</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Clear" onClick={() => { setFavorites([]); saveFavorites([]); setActive(null); setActiveId('') }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-36" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-28" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
          <Input className="w-28" placeholder="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Add" onClick={add}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Use my location" onClick={useMyLocation}>
                <LocateFixed className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Use my location</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-2">
          {favorites.length === 0 && <div className="text-muted-foreground">No favorites yet.</div>}
          {favorites.map((f) => (
            <div key={f.id} className={`px-3 py-1 rounded-full border text-xs cursor-pointer ${active === f.id ? 'bg-primary/10 border-primary' : 'bg-background/60'}`} onClick={() => activate(f.id)}>
              <span className="font-medium">{f.name}</span>
              <span className="text-muted-foreground ml-2">{f.lat},{f.lon}</span>
              <button aria-label="Remove" title="Remove" className="ml-2 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); remove(f.id) }}>×</button>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">Favorites are stored locally in your browser and not synced.</div>
      </div>
    </WidgetShell>
  )
}

function cryptoRandomId(): string {
  const arr = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}



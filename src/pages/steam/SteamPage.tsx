import React from 'react'
import { useSteam, type SteamLibraryItem } from '@/hooks/useSteam'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, Link2, RefreshCw, Sparkles, Timer, TrendingUp } from 'lucide-react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import PrereqGuard from '@/components/PrereqGuard'
import { useAuth } from '@/hooks/useAuth'

const SteamPage: React.FC = () => {
  const { startLink, sync, getProfile, getLibrary, getRecent, getSuggestions, loading } = useSteam()
  const { toast } = useToast()
  const { user } = useAuth()

  const [profile, setProfile] = React.useState<any | null>(null)
  const [library, setLibrary] = React.useState<SteamLibraryItem[]>([])
  const [recent, setRecent] = React.useState<any[]>([])
  const [suggestions, setSuggestions] = React.useState<Array<{ appid: number; score: number }>>([])
  const [busy, setBusy] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    setBusy(true)
    try {
      const [p, lib, rec, sugg] = await Promise.all([
        getProfile(),
        getLibrary({ page: 1, pageSize: 60, sort: 'last_played', order: 'desc' }),
        getRecent(),
        getSuggestions(),
      ])
      setProfile(p)
      setLibrary(lib.items)
      setRecent(Array.isArray(rec?.items) ? rec.items : [])
      setSuggestions(Array.isArray(sugg?.items) ? sugg.items : [])
    } catch (e) {
      toast({ description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }, [getProfile, getLibrary, getRecent, getSuggestions, toast])

  React.useEffect(() => { void loadAll() }, [loadAll])

  const onConnect = async () => {
    try {
      const url = await startLink()
      window.location.href = url
    } catch (e) {
      toast({ description: e instanceof Error ? e.message : String(e) })
    }
  }

  const onSync = async () => {
    const res = await sync()
    if (!res) return
    if ((res as any).error) {
      const retry = (res as any).retryAfterSec
      toast({ description: retry ? `Try again in ${retry} seconds` : 'Please try again later' })
      return
    }
    toast({ description: `Synced ${res.count} games` })
    await loadAll()
  }

  const heroCandidates =
    recent.length > 0 ? recent.slice(0, 6).map(r => r.appid) : library.slice(0, 6).map(g => g.appid)

  const prereqs = [
    { ok: Boolean(user), label: 'Sign in to link your Steam account', actionLabel: 'Sign in', onAction: () => (window.location.href = '/auth') },
  ]

  return (
    <div className="p-3 sm:p-4">
      <PrereqGuard title="Steam setup required" checks={prereqs}>
      {/* Hero area */}
      <section className="relative rounded-2xl overflow-hidden border border-white/10 bg-[radial-gradient(60%_60%_at_20%_20%,hsl(265_85%_60%/.15),transparent),radial-gradient(40%_40%_at_80%_0%,hsl(190_70%_55%/.12),transparent)]">
        <div className="p-4 sm:p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-white/90">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wider">Featured</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold mt-1">Welcome back{profile?.persona_name ? `, ${profile.persona_name}` : ''}</h2>
              <p className="text-white/80 text-sm mt-1">Jump back into your recent adventures or discover a perfect match</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onSync} variant="secondary" disabled={loading || busy} className="border-white/20 text-white">
                <RefreshCw className={cn('h-4 w-4 mr-2', (loading || busy) && 'animate-spin')} /> Sync
              </Button>
              <Button onClick={onConnect} variant="default" className="bg-indigo-500 hover:bg-indigo-400">
                <Link2 className="h-4 w-4 mr-2" /> Connect
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <Carousel className="w-full">
              <CarouselContent>
                <CarouselItem>
                  <HeroCard title="Jump back in" subtitle="Continue your recent adventures" icon={<Timer className="h-5 w-5" />} gradient="from-indigo-500 via-sky-500 to-emerald-500">
                    <HeroScroller appIds={heroCandidates.slice(0, 10)} />
                  </HeroCard>
                </CarouselItem>
                <CarouselItem>
                  <HeroCard title="What to play next" subtitle="Curated from your backlog" icon={<Sparkles className="h-5 w-5" />} gradient="from-fuchsia-500 via-pink-500 to-rose-500">
                    <SuggestionScroller items={suggestions.slice(0, 10)} />
                  </HeroCard>
                </CarouselItem>
                <CarouselItem>
                  <HeroCard title="All-time favorites" subtitle="Most played in your library" icon={<TrendingUp className="h-5 w-5" />} gradient="from-amber-500 via-orange-500 to-red-500">
                    <TopPlaytimeScroller items={[...library].sort((a, b) => (b.playtime_forever_minutes || 0) - (a.playtime_forever_minutes || 0)).slice(0, 10)} />
                  </HeroCard>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </div>
      </section>

      {/* Main content grid (center + right rail) */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          <h3 className="text-white/90 font-semibold mb-2">Actual games</h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {library.slice(0, 25).map((g) => (
              <div key={g.appid} className="shine-card rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors">
                <GameHeaderImage appid={g.appid} className="h-40" />
                <div className="p-2">
                  <div className="text-[13px] font-medium truncate" title={g.name}>{g.name}</div>
                  <div className="flex items-center justify-between text-[11px] text-white/60 mt-0.5">
                    <span>{(g.playtime_forever_minutes || 0).toLocaleString()} min</span>
                    {g.last_played_at && <span>{new Date(g.last_played_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Friends online</h4>
              <span className="text-xs text-white/60">{Math.max(1, Math.round(library.length * 0.02))}</span>
            </div>
            <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
              {fakeFriends().map((f) => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 grid place-items-center text-xs font-semibold">
                    {f.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{f.name}</div>
                    <div className="text-xs text-white/60 truncate">{f.status}</div>
                  </div>
                  <Badge variant="secondary" className="ml-auto bg-white/10 border-white/15 text-white">{f.game}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Recently played</h4>
              <span className="text-xs text-white/60">{recent.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {recent.slice(0, 6).map((it) => (
                <div key={it.appid} className="flex items-center gap-3">
                  <GameHeaderImage appid={it.appid} className="h-12 w-20 rounded-md" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{findName(library, it.appid)}</div>
                    <div className="text-xs text-white/60">{it.last_played_at ? new Date(it.last_played_at).toLocaleString() : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      </PrereqGuard>
    </div>
  )
}

export default SteamPage

function findName(library: SteamLibraryItem[], appid: number): string {
  return library.find((g) => g.appid === appid)?.name || `App ${appid}`
}

function HeroCard({ title, subtitle, gradient, icon, children }: { title: string; subtitle: string; gradient: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-4 sm:p-6 md:p-8',
      'bg-gradient-to-br text-white shadow-glow',
      `from-30% ${gradient}`,
      'group'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-white/90">
            {icon}
            <span className="text-xs uppercase tracking-wider">Steam</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold mt-1">{title}</h2>
          <p className="text-white/80 text-sm mt-1">{subtitle}</p>
        </div>
        <Button variant="secondary" size="icon" className="rounded-full bg-white/20 border-white/30 text-white hover:bg-white/30">
          <Heart className="w-4 h-4" />
        </Button>
      </div>
      <div className="mt-4 sm:mt-6">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute -inset-[20%] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.1),transparent_35%),radial-gradient(circle_at_60%_80%,rgba(255,255,255,0.08),transparent_45%)]" />
      </div>
    </div>
  )
}

function HeroScroller({ appIds }: { appIds: number[] }) {
  if (!appIds || appIds.length === 0) return <p className="text-white/85 text-sm">No recent games. Try syncing.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x scrollbar-hide">
      {appIds.map((appid) => (
        <div key={appid} className="snap-start shrink-0 w-56">
          <GameHeaderImage appid={appid} className="h-28 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function SuggestionScroller({ items }: { items: Array<{ appid: number; score: number }> }) {
  if (!items || items.length === 0) return <p className="text-white/85 text-sm">No suggestions yet.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x scrollbar-hide">
      {items.map((it) => (
        <div key={it.appid} className="snap-start shrink-0 w-56">
          <GameHeaderImage appid={it.appid} className="h-28 rounded-lg" />
          <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">{Math.round(it.score * 100)}%</Badge>
            <span>Match</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function TopPlaytimeScroller({ items }: { items: SteamLibraryItem[] }) {
  if (!items || items.length === 0) return <p className="text-white/85 text-sm">No data yet.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x scrollbar-hide">
      {items.map((it) => (
        <div key={it.appid} className="snap-start shrink-0 w-56">
          <GameHeaderImage appid={it.appid} className="h-28 rounded-lg" />
          <div className="mt-1 text-xs text-white/80">{(it.playtime_forever_minutes || 0).toLocaleString()} min</div>
        </div>
      ))}
    </div>
  )
}

function GameHeaderImage({ appid, className }: { appid: number; className?: string }) {
  const src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
  return (
    <img
      src={src}
      alt="header"
      className={cn('w-full object-cover select-none shadow-sm transition-all duration-300 hover:shadow-xl hover:scale-[1.02]', className)}
      draggable={false}
    />
  )
}

function fakeFriends() {
  return [
    { id: 1, name: 'CrimsonTiger67', status: 'Playing', game: 'Fortnite' },
    { id: 2, name: 'st3alth_sniper', status: 'Playing', game: 'Roblox' },
    { id: 3, name: 'IceDragon', status: 'Online', game: 'Resident Evil' },
    { id: 4, name: 'Blitzkrieg66', status: 'Playing', game: 'EA FC 24' },
    { id: 5, name: 'phoenix_rising', status: 'Playing', game: 'Rocket League' },
    { id: 6, name: 'neonNova', status: 'Online', game: 'GTA V' },
  ]
}



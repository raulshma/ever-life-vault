import React from 'react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { useSteam, type SteamLibraryItem } from '@/hooks/useSteam'
import { Gamepad2, Link2, RefreshCw, Search, Sparkles, Timer, TrendingUp } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

export default function Steam() {
  const { startLink, sync, getProfile, getLibrary, getRecent, getSuggestions, loading } = useSteam()
  const { toast } = useToast()

  const [profile, setProfile] = React.useState<any | null>(null)
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<'name' | 'playtime' | 'last_played'>('last_played')
  const [order, setOrder] = React.useState<'asc' | 'desc'>('desc')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(24)
  const [library, setLibrary] = React.useState<SteamLibraryItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [recent, setRecent] = React.useState<any[]>([])
  const [suggestions, setSuggestions] = React.useState<Array<{ appid: number; score: number }>>([])
  const [busy, setBusy] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    setBusy(true)
    try {
      const [p, lib, rec, sugg] = await Promise.all([
        getProfile(),
        getLibrary({ page, pageSize, sort, order }),
        getRecent(),
        getSuggestions(),
      ])
      setProfile(p)
      setLibrary(lib.items)
      setTotal(lib.total)
      setRecent(Array.isArray(rec?.items) ? rec.items : [])
      setSuggestions(Array.isArray(sugg?.items) ? sugg.items : [])
    } catch (e) {
      toast({ description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }, [getProfile, getLibrary, getRecent, getSuggestions, page, pageSize, sort, order, toast])

  React.useEffect(() => { void loadAll() }, [loadAll])

  // If redirected from link callback, trigger an initial sync then reload
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('steam_linked') === '1') {
      void (async () => {
        const res = await sync()
        if (res && !(res as any).error) {
          toast({ description: `Synced ${res.count} games` })
          await loadAll()
        }
        params.delete('steam_linked')
        const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
        window.history.replaceState({}, '', url)
      })()
    }
  }, [sync, loadAll, toast])

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

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return library
    return library.filter((g) => g.name.toLowerCase().includes(q))
  }, [library, query])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Steam Games"
        description="Your library, recent playtime, and a smart backlog — with delightful motion."
        icon={Gamepad2}
        meta={profile ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            {profile?.avatar_url && (
              <img src={profile.avatar_url} alt="avatar" className="w-5 h-5 rounded" />
            )}
            <span className="truncate max-w-[12rem]">{profile?.persona_name || 'Unknown'}</span>
          </span>
        ) : null}
      >
        <Button onClick={onSync} variant="outline" disabled={loading || busy}>
          <RefreshCw className={cn('h-4 w-4 mr-2', (loading || busy) && 'animate-spin')} /> Sync
        </Button>
        <Button onClick={onConnect} variant="default">
          <Link2 className="h-4 w-4 mr-2" /> Connect
        </Button>
      </PageHeader>

      {/* Hero carousel with micro-interactions */}
      <section className="relative">
        <Carousel className="w-full">
          <CarouselContent>
            <CarouselItem>
              <HeroCard
                title="Jump back in"
                subtitle="Continue your recent adventures"
                icon={<Timer className="h-5 w-5" />}
                gradient="from-indigo-500 via-sky-500 to-emerald-500"
              >
                <GameScroller items={recent.slice(0, 12)} />
              </HeroCard>
            </CarouselItem>
            <CarouselItem>
              <HeroCard
                title="What to play next"
                subtitle="Curated from your backlog"
                icon={<Sparkles className="h-5 w-5" />}
                gradient="from-fuchsia-500 via-pink-500 to-rose-500"
              >
                <SuggestionScroller items={suggestions.slice(0, 12)} />
              </HeroCard>
            </CarouselItem>
            <CarouselItem>
              <HeroCard
                title="All-time favorites"
                subtitle="Most played in your library"
                icon={<TrendingUp className="h-5 w-5" />}
                gradient="from-amber-500 via-orange-500 to-red-500"
              >
                <TopPlaytimeScroller items={[...library].sort((a, b) => (b.playtime_forever_minutes || 0) - (a.playtime_forever_minutes || 0)).slice(0, 12)} />
              </HeroCard>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </section>

      {/* Library controls */}
      <section className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search library…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
            >
              <option value="last_played">Last played</option>
              <option value="name">Name</option>
              <option value="playtime">Playtime</option>
            </select>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={order}
              onChange={(e) => setOrder(e.target.value as any)}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{total} games</div>
      </section>

      {/* Library grid */}
      <Tabs defaultValue="grid" className="w-full">
        <TabsList>
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <TabsContent value="grid">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
            {filtered.map((g) => (
              <GameCard key={g.appid} game={g} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="list">
          <div className="divide-y border rounded-md">
            {filtered.map((g) => (
              <GameRow key={g.appid} game={g} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || busy}
            onClick={() => { setPage((p) => Math.max(1, p - 1)) }}>Prev</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages || busy}
            onClick={() => { setPage((p) => Math.min(totalPages, p + 1)) }}>Next</Button>
        </div>
      </div>
    </div>
  )
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

function GameScroller({ items }: { items: Array<{ appid: number; last_played_at?: string | null }> }) {
  if (!items || items.length === 0) return <p className="text-white/85 text-sm">No recent games. Try syncing.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x">
      {items.map((it) => (
        <div key={it.appid} className="snap-start shrink-0 w-48">
          <GameHeaderImage appid={it.appid} className="h-24 rounded-lg" />
          <div className="mt-1 text-xs text-white/80">
            {it.last_played_at ? new Date(it.last_played_at).toLocaleString() : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

function SuggestionScroller({ items }: { items: Array<{ appid: number; score: number }> }) {
  if (!items || items.length === 0) return <p className="text-white/85 text-sm">No suggestions yet.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x">
      {items.map((it) => (
        <div key={it.appid} className="snap-start shrink-0 w-48">
          <GameHeaderImage appid={it.appid} className="h-24 rounded-lg" />
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
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x">
      {items.map((it) => (
        <div key={it.appid} className="snap-start shrink-0 w-48">
          <GameHeaderImage appid={it.appid} className="h-24 rounded-lg" />
          <div className="mt-1 text-xs text-white/80">
            {(it.playtime_forever_minutes || 0).toLocaleString()} min
          </div>
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

function GameCard({ game }: { game: SteamLibraryItem }) {
  return (
    <Card className="group overflow-hidden border-muted/60 hover:border-primary/40 transition-colors">
      <div className="relative">
        <GameHeaderImage appid={game.appid} className="h-28" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <CardContent className="p-2">
        <div className="text-[13px] font-medium truncate" title={game.name}>{game.name}</div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
          <span>{(game.playtime_forever_minutes || 0).toLocaleString()} min</span>
          {game.last_played_at && <span>{new Date(game.last_played_at).toLocaleDateString()}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function GameRow({ game }: { game: SteamLibraryItem }) {
  return (
    <div className="grid grid-cols-[96px_1fr_auto] items-center gap-3 p-2 hover:bg-muted/40">
      <GameHeaderImage appid={game.appid} className="h-12 rounded" />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate" title={game.name}>{game.name}</div>
        <div className="text-xs text-muted-foreground">
          {(game.playtime_forever_minutes || 0).toLocaleString()} min
          {game.last_played_at && <span className="ml-2">· Last played {new Date(game.last_played_at).toLocaleString()}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {Array.isArray(game.genres) && (game.genres as any[]).slice(0, 3).map((g, i) => (
          <Badge key={i} variant="outline" className="text-[10px]">{String(g)}</Badge>
        ))}
      </div>
    </div>
  )
}



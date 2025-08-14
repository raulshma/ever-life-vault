import React from 'react'
import { useMAL } from '@/hooks/useMAL'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { useToast } from '@/components/ui/use-toast'
import { CalendarDays, Link2, RefreshCw, Sparkles, Star, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import PrereqGuard from '@/components/PrereqGuard'
import { useAuth } from '@/hooks/useAuth'

const MALPage: React.FC = () => {
  const { startLink, sync, getProfile, getRecent, getSeasonal, loading } = useMAL()
  const { toast } = useToast()
  const { user } = useAuth()

  const [profile, setProfile] = React.useState<any | null>(null)
  const [recent, setRecent] = React.useState<any[]>([])
  const [seasonal, setSeasonal] = React.useState<Array<{ mal_id: number; title: string; main_picture?: any }>>([])
  const [busy, setBusy] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    setBusy(true)
    try {
      const [p, r, s] = await Promise.all([
        getProfile(),
        getRecent(),
        getSeasonal(),
      ])
      setProfile(p)
      setRecent(Array.isArray(r?.items) ? r.items : [])
      setSeasonal(Array.isArray(s?.items) ? s.items : [])
    } catch (e) {
      toast({ description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }, [getProfile, getRecent, getSeasonal, toast])

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
    toast({ description: `Synced ${res.count} items` })
    await loadAll()
  }

  const heroItems = (recent || []).slice(0, 5)

  return (
    <div className="p-3 sm:p-4">
      <PrereqGuard
        title="MyAnimeList setup required"
        checks={[
          { ok: Boolean(user), label: 'Sign in to connect MyAnimeList', actionLabel: 'Sign in', onAction: () => (window.location.href = '/auth') },
          { ok: Boolean(profile), label: 'Connect your MyAnimeList account', actionLabel: 'Connect', onAction: onConnect },
        ]}
      >
      {/* Hero area */}
      <section className="relative rounded-2xl overflow-hidden border border-border bg-gradient-card">
        <div className="p-4 sm:p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-foreground/90">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wider">MyAnimeList</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold mt-1">{profile?.display_name ? `${profile.display_name}'s anime hub` : 'Your anime hub'}</h2>
              <p className="text-muted-foreground text-sm mt-1">Jump back into what you watched, discover seasonal picks, and explore trends</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onSync} variant="secondary" disabled={loading || busy}>
                <RefreshCw className={cn('h-4 w-4 mr-2', (loading || busy) && 'animate-spin')} /> Sync
              </Button>
              <Button onClick={onConnect} variant="default">
                <Link2 className="h-4 w-4 mr-2" /> Connect
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <Carousel className="w-full">
              <CarouselContent>
                <CarouselItem>
                  <HeroCard title="Continue watching" subtitle="Your latest episodes" icon={<CalendarDays className="h-5 w-5" />} gradient="from-[hsl(var(--accent))] via-[hsl(var(--primary-glow))] to-[hsl(var(--primary))]">
                    <RecentScroller items={heroItems} />
                  </HeroCard>
                </CarouselItem>
                <CarouselItem>
                  <HeroCard title="Seasonal highlights" subtitle="What’s airing now" icon={<TrendingUp className="h-5 w-5" />} gradient="from-[hsl(var(--accent))] via-[hsl(var(--primary-glow))] to-[hsl(var(--primary))]">
                    <SeasonalScroller items={seasonal.slice(0, 10)} />
                  </HeroCard>
                </CarouselItem>
                <CarouselItem>
                  <HeroCard title="Favorite picks" subtitle="Top-rated classics" icon={<Star className="h-5 w-5" />} gradient="from-[hsl(var(--accent))] via-[hsl(var(--primary-glow))] to-[hsl(var(--primary))]">
                    <ClassicPicks />
                  </HeroCard>
                </CarouselItem>
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </div>
      </section>

      {/* Main content grid */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          <h3 className="text-foreground/90 font-semibold mb-2">Recent activity</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {recent.slice(0, 9).map((it, idx) => (
              <div key={`${it.mal_id}-${idx}`} className="shine-card rounded-xl overflow-hidden border border-border bg-card/50 hover:bg-card transition-colors">
                <AnimeCover malId={it.mal_id} picture={it.main_picture} className="h-44" />
                <div className="p-3">
                  <div className="text-[13px] font-medium truncate" title={it.title || ''}>{it.title || `Anime ${it.mal_id}`}</div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                    <span>Ep {it.episode}</span>
                    <span>{it.watched_at ? new Date(it.watched_at).toLocaleString() : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Seasonal now</h4>
              <span className="text-xs text-muted-foreground">{seasonal.length}</span>
            </div>
            <div className="mt-2 space-y-2 max-h-[360px] overflow-y-auto scrollbar-hide">
              {seasonal.slice(0, 8).map((a) => (
                <div key={a.mal_id} className="flex items-center gap-3">
                  <AnimeCover malId={a.mal_id} picture={a.main_picture} className="h-12 w-20 rounded-md" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">Seasonal</div>
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

export default MALPage

function HeroCard({ title, subtitle, gradient, icon, children }: { title: string; subtitle: string; gradient: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-4 sm:p-6 md:p-8',
      'bg-gradient-to-br text-foreground shadow-glow',
      `from-30% ${gradient}`,
      'group'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-foreground/90">
            {icon}
            <span className="text-xs uppercase tracking-wider">MAL</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold mt-1">{title}</h2>
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        </div>
        <Button variant="secondary" size="icon" className="rounded-full">
          <Sparkles className="w-4 h-4" />
        </Button>
      </div>
      <div className="mt-4 sm:mt-6">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute -inset-[20%] bg-[radial-gradient(circle_at_20%_20%,hsl(var(--foreground)/0.15),transparent_40%),radial-gradient(circle_at_80%_0%,hsl(var(--foreground)/0.1),transparent_35%),radial-gradient(circle_at_60%_80%,hsl(var(--foreground)/0.08),transparent_45%)]" />
      </div>
    </div>
  )
}

function RecentScroller({ items }: { items: Array<{ mal_id: number; title?: string; episode: number; main_picture?: any }> }) {
  if (!items || items.length === 0) return <p className="text-muted-foreground text-sm">No recent episodes. Try syncing.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x scrollbar-hide">
      {items.map((it, idx) => (
        <div key={`${it.mal_id}-${idx}`} className="snap-start shrink-0 w-56">
          <AnimeCover malId={it.mal_id} picture={it.main_picture} className="h-28 rounded-lg" />
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Ep {it.episode}</Badge>
            <span className="truncate" title={it.title || ''}>{it.title || `#${it.mal_id}`}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function SeasonalScroller({ items }: { items: Array<{ mal_id: number; title: string; main_picture?: any }> }) {
  if (!items || items.length === 0) return <p className="text-muted-foreground text-sm">No seasonal titles yet.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 snap-x scrollbar-hide">
      {items.map((a) => (
        <div key={a.mal_id} className="snap-start shrink-0 w-56">
          <AnimeCover malId={a.mal_id} picture={a.main_picture} className="h-28 rounded-lg" />
          <div className="mt-1 text-xs text-muted-foreground truncate" title={a.title}>{a.title}</div>
        </div>
      ))}
    </div>
  )
}

function ClassicPicks() {
  // Placeholder micro-interaction area; could be powered by recommendations later
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {[11061, 16498, 5114, 9253, 32281, 4181].map((id) => (
        <AnimeCover key={id} malId={id} className="h-24 rounded-lg" />
      ))}
    </div>
  )
}

function AnimeCover({ malId, picture, className }: { malId: number; picture?: any; className?: string }) {
  const src = picture?.medium || picture?.large || `https://api-cdn.myanimelist.net/images/anime/${malId % 1000}/${malId}.jpg`
  return (
    <img
      src={src}
      alt="cover"
      className={cn('w-full object-cover select-none shadow-sm transition-all duration-300 hover:shadow-xl hover:scale-[1.02]', className)}
      draggable={false}
      loading="lazy"
    />
  )
}



import React from 'react'
import { cn } from '@/lib/utils'
import { ViewTransitionLink } from '@/components/ViewTransitionLink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Gamepad2, Home, LibraryBig, Users, Heart, Settings, HelpCircle, ShoppingBag, Bookmark, Download, Search } from 'lucide-react'

interface SteamLayoutProps {
  children: React.ReactNode
}

/**
 * Standalone gaming layout inspired by modern game launchers.
 * Provides its own left navigation, header search, and immersive background.
 */
const SteamLayout: React.FC<SteamLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full relative bg-gradient-to-br from-[#0b1020] via-[#0a0f1a] to-[#0f182e] text-zinc-100">
      {/* Aurora blobs for subtle gaming vibes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob--accent float-slow w-[40rem] h-[40rem] -top-40 -left-32 opacity-30" />
        <div className="aurora-blob aurora-blob--violet float-med w-[30rem] h-[30rem] -bottom-40 -right-24 opacity-25" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-4 grid grid-cols-12 gap-4">
        {/* Left rail */}
        <aside className="hidden md:flex md:col-span-2 lg:col-span-2 xl:col-span-2 flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 grid place-items-center shadow-glow">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold">Steam Hub</div>
              <div className="text-xs text-white/60">Games Library</div>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { to: '/steam', label: 'Home', icon: Home },
              { to: '/steam/library', label: 'Library', icon: LibraryBig },
              { to: '/steam/community', label: 'Community', icon: Users },
              { to: '/steam/wishlist', label: 'Wishlist', icon: Heart },
              { to: '/steam/downloads', label: 'Downloads', icon: Download },
            ].map((item) => (
              <ViewTransitionLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/85 hover:text-white hover:bg-white/5 transition-colors"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </ViewTransitionLink>
            ))}
          </nav>

          <div className="mt-6 p-3 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 text-rose-50 shadow-elegant">
            <div className="text-xs uppercase tracking-wider opacity-90">50% discount</div>
            <div className="text-sm mt-1 leading-tight">on selected games for a limited time</div>
            <Button asChild size="sm" variant="secondary" className="mt-2 h-8">
              <a href="#">Go to library</a>
            </Button>
          </div>

          <div className="mt-auto pt-2 border-t border-white/10 space-y-1">
            <ViewTransitionLink to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">
              <Bookmark className="w-4 h-4" />
              <span>Back to Life OS</span>
            </ViewTransitionLink>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5">
              <HelpCircle className="w-4 h-4" />
              <span>Help</span>
            </button>
          </div>
        </aside>

        {/* Content with header */}
        <main className="col-span-12 md:col-span-10 lg:col-span-10 xl:col-span-10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/50" />
              <Input className="pl-9 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/50" placeholder="Search games" />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="secondary" className="h-10">
                <ShoppingBag className="w-4 h-4 mr-2" /> Store
              </Button>
              <Button asChild variant="outline" className="h-10 border-white/20 text-white hover:bg-white/10">
                <ViewTransitionLink to="/">Back</ViewTransitionLink>
              </Button>
            </div>
          </div>

          <div className={cn('rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md')}> 
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default SteamLayout



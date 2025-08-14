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
    <div className="min-h-screen w-full relative bg-gradient-hero text-foreground">
      {/* Aurora blobs for subtle gaming vibes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob--accent float-slow w-[40rem] h-[40rem] -top-40 -left-32 opacity-30" />
        <div className="aurora-blob aurora-blob--violet float-med w-[30rem] h-[30rem] -bottom-40 -right-24 opacity-25" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-4 grid grid-cols-12 gap-4">
        {/* Content with header (no internal sidebar) */}
        <main className="col-span-12">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-10" placeholder="Search games" />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="secondary" className="h-10">
                <ShoppingBag className="w-4 h-4 mr-2" /> Store
              </Button>
              <Button asChild variant="outline" className="h-10">
                <ViewTransitionLink to="/">Back</ViewTransitionLink>
              </Button>
            </div>
          </div>

          <div className={cn('rounded-2xl border border-border bg-card/50 backdrop-blur-md')}> 
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default SteamLayout



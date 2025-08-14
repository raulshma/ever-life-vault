import React from 'react'
import { ViewTransitionLink } from '@/components/ViewTransitionLink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface MALLayoutProps {
  children: React.ReactNode
}

/**
 * Immersive MyAnimeList hub layout. Inspired by modern media hubs with a hero backdrop
 * and focused content container. Separate from the main app layout (similar to Steam page).
 */
const MALLayout: React.FC<MALLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full relative bg-gradient-hero text-foreground">
      {/* Aurora blobs for subtle anime vibes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob--violet float-slow w-[42rem] h-[42rem] -top-36 -left-28 opacity-30" />
        <div className="aurora-blob aurora-blob--accent float-med w-[34rem] h-[34rem] -bottom-36 -right-24 opacity-25" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-4 grid grid-cols-12 gap-4">
        <main className="col-span-12">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9 h-10" placeholder="Search anime" />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Button asChild variant="outline" className="h-10">
                <ViewTransitionLink to="/">Back</ViewTransitionLink>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-md">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default MALLayout



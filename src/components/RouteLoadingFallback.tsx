import React from 'react'
import PageSkeleton from '@/components/PageSkeleton'
import { cn } from '@/lib/utils'

type RouteLoadingFallbackProps = {
  variant?: 'inline' | 'fullscreen'
  className?: string
}

/**
 * Lightweight loading UI shown while a lazy route is fetched.
 * - Always shows a thin, animated top progress bar
 * - Inline variant: compact skeleton in content area
 * - Fullscreen variant: centers a subtle spinner without shifting layout
 */
export const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({ variant = 'inline', className }) => {
  return (
    <div className={cn('relative', className)}>
      {/* Local styles for indeterminate top bar animation */}
      <style>{`
        @keyframes routeProgress {
          0% { transform: translateX(-35%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(115%); }
        }
      `}</style>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 overflow-hidden bg-border/40">
        <div
          className="h-full w-1/3 bg-primary/80"
          style={{ animation: 'routeProgress 1.2s var(--transition-smooth, ease-in-out) infinite' }}
        />
      </div>

      {variant === 'inline' ? (
        <div className="p-2 sm:p-4">
          <PageSkeleton withHeader={false} cards={3} cardHeightClassName="h-20" />
        </div>
      ) : (
        <div className="min-h-[60vh] grid place-items-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 rounded-full border-2 border-primary/70 border-t-transparent animate-spin" />
            <span>Loading…</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RouteLoadingFallback

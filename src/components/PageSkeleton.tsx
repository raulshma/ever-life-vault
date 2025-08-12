import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface PageSkeletonProps {
  className?: string
  /** Number of card-like blocks to render */
  cards?: number
  /** Height of each card block */
  cardHeightClassName?: string
  /** Show header skeleton (title + description) */
  withHeader?: boolean
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  className,
  cards = 6,
  cardHeightClassName = 'h-24',
  withHeader = true,
}) => {
  return (
    <div className={cn('p-6', className)}>
      {withHeader && (
        <div className="space-y-3 max-w-4xl mx-auto mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className={cn('w-full rounded-md', cardHeightClassName)} />
        ))}
      </div>
    </div>
  )
}

export default PageSkeleton



import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ListSkeletonProps {
  rows?: number
  withAvatar?: boolean
  withMeta?: boolean
  className?: string
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ rows = 8, withAvatar = false, withMeta = true, className }) => {
  return (
    <ul className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3">
          {withAvatar && <Skeleton className="h-8 w-8 rounded" />}
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-2/3 mb-1" />
            {withMeta && <Skeleton className="h-3 w-1/3" />}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ListSkeleton



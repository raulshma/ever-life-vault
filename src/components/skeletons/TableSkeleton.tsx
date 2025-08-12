import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TableSkeletonProps {
  headers?: number
  rows?: number
  className?: string
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ headers = 5, rows = 8, className }) => {
  return (
    <div className={cn('w-full border rounded-md overflow-hidden', className)}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${headers}, minmax(0, 1fr))` }}>
        {Array.from({ length: headers }).map((_, i) => (
          <div key={i} className="p-2 border-b bg-muted/50">
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid" style={{ gridTemplateColumns: `repeat(${headers}, minmax(0, 1fr))` }}>
          {Array.from({ length: headers }).map((_, c) => (
            <div key={c} className="p-2 border-t">
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default TableSkeleton



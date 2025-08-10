import React from 'react'
import { DashboardRuntimeProvider, DashboardStackView } from '../runtime'
import { AddWidgetDialog } from './AddWidgetDialog'
import { Button } from '@/components/ui/button'
import { Download, Upload, RefreshCw } from 'lucide-react'
import { useDashboardRuntime } from '../runtime'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const EditingStackView = React.lazy(() => import('./EditingStackView'))

export default function DashboardMosaic() {
  return (
    <DashboardRuntimeProvider>
      <DashboardMosaicInner />
    </DashboardRuntimeProvider>
  )
}

function DashboardMosaicInner() {
  const { exportLayout, importLayout, resetLayout } = useDashboardRuntime()
  const [isEditing, setIsEditing] = React.useState(false)
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Dashboard</h2>
          <p className="hidden sm:block text-xs text-muted-foreground">Arrange and resize widgets to make this space yours</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end pr-1 min-w-0 w-full">
          <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={() => {
            const data = exportLayout()
            navigator.clipboard.writeText(data).catch(() => {})
          }}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={async () => {
            const json = prompt('Paste layout JSON to import:')
            if (json) importLayout(json)
          }}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <div className="flex items-center gap-2 mr-1">
            <Label htmlFor="edit-layout" className="text-xs hidden sm:inline">Edit layout</Label>
            <Switch id="edit-layout" aria-label="Edit layout" checked={isEditing} onCheckedChange={setIsEditing} />
          </div>
          <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={() => resetLayout()}>
            <RefreshCw className="h-4 w-4" /> Reset
          </Button>
          <AddWidgetDialog />
        </div>
      </div>
      <div className="pb-mobile-tabbar overflow-visible min-w-0 no-page-h-scroll">
        <div className="flex items-center justify-end mb-2 gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Default size</span>
          <InlineSpanSelector />
        </div>
        {isEditing ? (
          <React.Suspense fallback={<div className="glass rounded-xl p-4">Loading editor…</div>}>
            <EditingStackView />
          </React.Suspense>
        ) : (
          <DashboardStackView />
        )}
      </div>
    </>
  )
}

function InlineSpanSelector() {
  const { spans, setSpan, layout } = useDashboardRuntime()
  // Apply to last added widget for quick control; on a richer UI, this could be per-tile control.
  const lastId = React.useMemo(() => {
    if (!layout || (layout as any).kind !== 'grid') return undefined
    const ids = (layout as any).order as string[]
    return ids[ids.length - 1]
  }, [layout])
  if (!lastId) return null
  const value = String(spans[lastId] || 1)
  return (
    <ToggleGroup type="single" value={value} onValueChange={(v) => v && setSpan(lastId, Number(v) as any)}>
      {[1,2,3,4].map((n) => (
        <ToggleGroupItem key={n} value={String(n)} size="sm" aria-label={`Span ${n} columns`}>
          {n}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}



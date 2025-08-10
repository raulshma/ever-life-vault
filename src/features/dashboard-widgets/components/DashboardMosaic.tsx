import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DashboardRuntimeProvider, DashboardMosaicView, DashboardStackView } from '../runtime'
import { AddWidgetDialog } from './AddWidgetDialog'
import { Button } from '@/components/ui/button'
import { LayoutPanelTop, Grid2x2, Download, Upload, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDashboardRuntime } from '../runtime'
import { useIsMobile } from '@/hooks/use-mobile'

export default function DashboardMosaic() {
  return (
    <DndProvider backend={HTML5Backend}>
      <DashboardRuntimeProvider>
        <DashboardMosaicInner />
      </DashboardRuntimeProvider>
    </DndProvider>
  )
}

function DashboardMosaicInner() {
  const isMobile = useIsMobile()
  const { exportLayout, importLayout, resetLayout } = useDashboardRuntime()
  const [mode, setMode] = useState<'flow' | 'mosaic'>(() => {
    const saved = localStorage.getItem('dashboard:layout-mode')
    return saved === 'mosaic' ? 'mosaic' : 'flow'
  })
  useEffect(() => { localStorage.setItem('dashboard:layout-mode', mode) }, [mode])
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Dashboard</h2>
          <p className="hidden sm:block text-xs text-muted-foreground">Arrange and resize widgets to make this space yours</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-card/60 border">
            <Button variant={mode === 'flow' ? 'default' : 'ghost'} size="sm" className="gap-1" onClick={() => setMode('flow')}>
              <Grid2x2 className="h-4 w-4" /> Flow
            </Button>
            <Button variant={mode === 'mosaic' ? 'default' : 'ghost'} size="sm" className="gap-1" onClick={() => setMode('mosaic')}>
              <LayoutPanelTop className="h-4 w-4" /> Mosaic
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => {
            const data = exportLayout()
            navigator.clipboard.writeText(data).catch(() => {})
          }}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={async () => {
            const json = prompt('Paste layout JSON to import:')
            if (json) importLayout(json)
          }}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => resetLayout()}>
            <RefreshCw className="h-4 w-4" /> Reset
          </Button>
          <AddWidgetDialog />
        </div>
      </div>
      {isMobile || mode === 'flow' ? (
        <div className="space-y-3">
          <DashboardStackView />
        </div>
      ) : (
        <div className="min-h-[60vh] h-full rounded-xl border glass shadow-card overflow-hidden">
          <DashboardMosaicView />
        </div>
      )}
    </>
  )
}



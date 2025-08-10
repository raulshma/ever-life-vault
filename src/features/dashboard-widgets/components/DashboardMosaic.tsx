import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DashboardRuntimeProvider, DashboardStackView } from '../runtime'
import { AddWidgetDialog } from './AddWidgetDialog'
import { Button } from '@/components/ui/button'
import { Download, Upload, RefreshCw } from 'lucide-react'
import { useDashboardRuntime } from '../runtime'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

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
          <div className="hidden sm:flex items-center gap-2 mr-1">
            <Label htmlFor="edit-layout" className="text-xs">Edit layout</Label>
            <Switch id="edit-layout" checked={isEditing} onCheckedChange={setIsEditing} />
          </div>
          <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={() => resetLayout()}>
            <RefreshCw className="h-4 w-4" /> Reset
          </Button>
          <AddWidgetDialog />
        </div>
      </div>
      <div className="pb-mobile-tabbar overflow-visible min-w-0 no-page-h-scroll">
        <DashboardStackView isEditing={isEditing} />
      </div>
    </>
  )
}



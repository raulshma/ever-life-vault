import React from 'react'
import { DashboardRuntimeProvider, DashboardStackView } from '../runtime'
import { AddWidgetDialog } from './AddWidgetDialog'
import { Button } from '@/components/ui/button'
import { Download, Upload, RefreshCw, Plus } from 'lucide-react'
import { useDashboardRuntime } from '../runtime'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
 

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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Export layout"
                onClick={() => {
                  const data = exportLayout()
                  navigator.clipboard.writeText(data).catch(() => {})
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export layout</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Import layout"
                onClick={async () => {
                  const json = prompt('Paste layout JSON to import:')
                  if (json) importLayout(json)
                }}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import layout</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2 mr-1">
            <Label htmlFor="edit-layout" className="text-xs hidden sm:inline">Edit layout</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch id="edit-layout" aria-label="Edit layout" checked={isEditing} onCheckedChange={setIsEditing} />
              </TooltipTrigger>
              <TooltipContent>Edit layout</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Reset layout"
                onClick={() => resetLayout()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset layout</TooltipContent>
          </Tooltip>

          {/* Use a plain button as the dialog trigger to ensure onOpenChange works reliably */}
          <AddWidgetDialog
            trigger={
              <Button variant="default" size="icon" aria-label="Add widget" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>
      <div className="pb-mobile-tabbar overflow-visible min-w-0 no-page-h-scroll">
        {isEditing ? (
          <React.Suspense fallback={<div className="glass rounded-xl p-4"><div className="space-y-2"><div className="h-5 w-1/4 bg-muted rounded" /><div className="h-4 w-2/3 bg-muted rounded" /></div></div>}>
            <EditingStackView />
          </React.Suspense>
        ) : (
          <DashboardStackView />
        )}
      </div>
    </>
  )
}

 



import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DashboardRuntimeProvider, DashboardMosaicView } from '../runtime'
import { AddWidgetDialog } from './AddWidgetDialog'

export default function DashboardMosaic() {
  return (
    <DndProvider backend={HTML5Backend}>
      <DashboardRuntimeProvider>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Dashboard</h2>
          <AddWidgetDialog />
        </div>
      <div className="h-[70vh] min-h-[480px] rounded-md overflow-hidden">
          <DashboardMosaicView />
        </div>
      </DashboardRuntimeProvider>
    </DndProvider>
  )
}



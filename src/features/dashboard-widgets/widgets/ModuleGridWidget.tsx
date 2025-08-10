import React from 'react'
import ModuleGrid from '@/components/dashboard/ModuleGrid'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'

export default function ModuleGridWidget(_props: WidgetProps<{}>) {
  return (
    <WidgetShell title="Modules">
      <ModuleGrid />
    </WidgetShell>
  )
}



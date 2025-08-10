import React from 'react'
import RecentActivity from '@/components/dashboard/RecentActivity'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'

export default function RecentActivityWidget(_props: WidgetProps<{}>) {
  return (
    <WidgetShell title="Recent Activity">
      <RecentActivity />
    </WidgetShell>
  )
}



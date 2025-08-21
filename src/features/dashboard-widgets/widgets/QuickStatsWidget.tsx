import React from 'react'
import QuickStats from '@/components/dashboard/QuickStats'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'

export default function QuickStatsWidget(_props: WidgetProps<Record<string, never>>) {
  return (
    <WidgetShell title="Quick Stats">
      <QuickStats />
    </WidgetShell>
  )
}



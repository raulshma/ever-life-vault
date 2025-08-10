import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { FocusTimer } from '@/components/focus/FocusTimer'

export default function FocusWidget(_props: WidgetProps<{}>) {
  return (
    <WidgetShell title="Focus">
      <div className="flex justify-center">
        <FocusTimer />
      </div>
    </WidgetShell>
  )
}



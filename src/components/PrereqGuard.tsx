import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface PrereqCheck {
  ok: boolean
  label: string
  actionLabel?: string
  onAction?: () => void
  actionElement?: React.ReactNode
  helperText?: string
}

export function PrereqGuard({
  title = 'Before you continue',
  checks,
  children,
}: {
  title?: string
  checks: PrereqCheck[]
  children: React.ReactNode
}) {
  const missing = checks.filter((c) => !c.ok)
  if (missing.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {missing.map((c, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 border rounded-md p-3">
              <div className="min-w-0">
                <div className="font-medium">{c.label}</div>
                {c.helperText && <div className="text-sm text-muted-foreground mt-0.5">{c.helperText}</div>}
              </div>
              <div className="shrink-0">
                {c.actionElement ? (
                  c.actionElement
                ) : c.onAction && c.actionLabel ? (
                  <Button size="sm" onClick={c.onAction}>{c.actionLabel}</Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}

export default PrereqGuard



import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, DollarSign, X } from 'lucide-react'
import { LLMModel } from '../types'
import { PROVIDER_COLORS, CAPABILITY_COLORS } from '../constants'

interface ModelDetailModalProps {
  model: LLMModel | null
  onClose: () => void
}

export function ModelDetailModal({ model, onClose }: ModelDetailModalProps) {
  if (!model) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{model.name}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  style={{ backgroundColor: `${PROVIDER_COLORS[model.provider]}20`, color: PROVIDER_COLORS[model.provider] }}
                >
                  {model.provider}
                </Badge>
                {model.company && (
                  <Badge variant="outline">{model.company}</Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {model.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{model.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {model.contextLength && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Context Length</span>
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {(model.contextLength / 1000).toFixed(0)}K tokens
                </p>
              </div>
            )}

            {model.pricing && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Pricing</span>
                </div>
                <div className="text-sm">
                  <p>Input: ${(model.pricing.input || 0 * 1000000).toFixed(2)}/M</p>
                  <p>Output: ${(model.pricing.output || 0 * 1000000).toFixed(2)}/M</p>
                </div>
              </div>
            )}
          </div>

          {model.capabilities && (
            <div>
              <h4 className="font-medium mb-3">Capabilities</h4>
              <div className="flex flex-wrap gap-2">
                {model.capabilities.map(capability => (
                  <Badge
                    key={capability}
                    className="text-sm px-3 py-1"
                    style={{ backgroundColor: `${CAPABILITY_COLORS[capability]}20`, color: CAPABILITY_COLORS[capability] }}
                  >
                    {capability.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

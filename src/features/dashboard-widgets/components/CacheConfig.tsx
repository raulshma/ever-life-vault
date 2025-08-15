import React from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Clock, RefreshCw } from 'lucide-react'
import { CACHE_TIMES, type CacheTimePreset } from '../hooks/useApiCache'
import type { BaseWidgetConfig } from '../types'

interface CacheConfigProps<T extends BaseWidgetConfig> {
  config: T
  onConfigChange: (config: T) => void
  disabled?: boolean
}

export function CacheConfig<T extends BaseWidgetConfig>({ 
  config, 
  onConfigChange, 
  disabled = false 
}: CacheConfigProps<T>) {
  const handlePresetChange = (preset: CacheTimePreset) => {
    const cacheTimeMs = preset === 'DISABLED' ? undefined : CACHE_TIMES[preset]
    onConfigChange({ ...config, cacheTimeMs })
  }

  const handleCustomChange = (value: string) => {
    const num = parseInt(value, 10)
    const cacheTimeMs = isNaN(num) ? undefined : num * 1000 // Convert seconds to milliseconds
    onConfigChange({ ...config, cacheTimeMs })
  }

  const handleClearCache = () => {
    // This will trigger a re-fetch in the parent widget
    onConfigChange({ ...config })
  }

  const getCurrentPreset = (): CacheTimePreset => {
    if (!config.cacheTimeMs) return 'DISABLED'
    
    const seconds = config.cacheTimeMs / 1000
    if (seconds <= 30) return 'SHORT'
    if (seconds <= 300) return 'MEDIUM'
    if (seconds <= 900) return 'LONG'
    if (seconds <= 3600) return 'VERY_LONG'
    return 'DISABLED'
  }

  const getCurrentCustomValue = (): string => {
    if (!config.cacheTimeMs) return ''
    return String(Math.round(config.cacheTimeMs / 1000))
  }

  const isCustom = () => {
    const preset = getCurrentPreset()
    if (preset === 'DISABLED') return !config.cacheTimeMs
    return config.cacheTimeMs !== CACHE_TIMES[preset]
  }

  const formatCacheTime = (ms?: number): string => {
    if (!ms) return 'No caching'
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h`
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <Label className="text-sm font-medium">Cache Settings</Label>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Preset</Label>
        <Select 
          value={getCurrentPreset()} 
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DISABLED">No caching</SelectItem>
            <SelectItem value="SHORT">Short (30s)</SelectItem>
            <SelectItem value="MEDIUM">Medium (5m)</SelectItem>
            <SelectItem value="LONG">Long (15m)</SelectItem>
            <SelectItem value="VERY_LONG">Very Long (1h)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Custom (seconds)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Custom cache time"
            value={getCurrentCustomValue()}
            onChange={(e) => handleCustomChange(e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={disabled}
                className="px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear cache and refresh data</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {config.cacheTimeMs && (
        <div className="text-xs text-muted-foreground">
          Current: {formatCacheTime(config.cacheTimeMs)}
          {isCustom() && ' (custom)'}
        </div>
      )}
    </div>
  )
}

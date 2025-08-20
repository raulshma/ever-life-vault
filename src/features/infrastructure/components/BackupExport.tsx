import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Download, Loader2, FileText, FileCode } from 'lucide-react'
import { toast } from 'sonner'
import type { DockerComposeConfig } from '../types'

interface BackupExportOptions {
  config_ids?: string[]
  include_secrets: boolean
  format: 'json' | 'yaml'
}

export function BackupExport() {
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>([])
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [format, setFormat] = useState<'json' | 'yaml'>('json')
  const [selectAll, setSelectAll] = useState(false)

  // Fetch configurations
  const { data: configurationsData, isLoading: isLoadingConfigs } = useQuery({
    queryKey: ['infrastructure', 'configs'],
    queryFn: async () => {
      const response = await fetch('/api/infrastructure/configs')
      if (!response.ok) {
        throw new Error('Failed to fetch configurations')
      }
      const data = await response.json()
      return data.configurations as DockerComposeConfig[]
    }
  })

  const configurations = configurationsData || []

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (options: BackupExportOptions) => {
      const response = await fetch('/api/infrastructure/backup/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create backup')
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
        `infrastructure-backup-${new Date().toISOString().split('T')[0]}.${options.format}`

      const blob = await response.blob()
      return { blob, filename }
    },
    onSuccess: ({ blob, filename }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Backup exported successfully')
    },
    onError: (error: Error) => {
      toast.error('Failed to export backup', {
        description: error.message
      })
    }
  })

  const handleConfigSelection = (configId: string, checked: boolean) => {
    if (checked) {
      setSelectedConfigs(prev => [...prev, configId])
    } else {
      setSelectedConfigs(prev => prev.filter(id => id !== configId))
      setSelectAll(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedConfigs(configurations.map(config => config.id))
    } else {
      setSelectedConfigs([])
    }
  }

  const handleExport = () => {
    const options: BackupExportOptions = {
      include_secrets: includeSecrets,
      format
    }

    // Only include config_ids if not all are selected
    if (selectedConfigs.length > 0 && selectedConfigs.length < configurations.length) {
      options.config_ids = selectedConfigs
    }

    exportMutation.mutate(options)
  }

  const isExportDisabled = selectedConfigs.length === 0 && !selectAll

  return (
    <div className="space-y-6">
      {/* Configuration Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Select Configurations</Label>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={handleSelectAll}
              disabled={isLoadingConfigs}
            />
            <Label htmlFor="select-all" className="text-sm">
              Select All ({configurations.length})
            </Label>
          </div>
        </div>

        {isLoadingConfigs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading configurations...</span>
          </div>
        ) : configurations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No configurations found. Create some configurations first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 max-h-64 overflow-y-auto">
            {configurations.map(config => (
              <Card key={config.id} className="p-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={config.id}
                    checked={selectAll || selectedConfigs.includes(config.id)}
                    onCheckedChange={(checked) => handleConfigSelection(config.id, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={config.id} className="font-medium cursor-pointer">
                      {config.name}
                    </Label>
                    {config.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {config.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {config.metadata.services.length} services • 
                      Updated {new Date(config.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Export Options */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Export Options</Label>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-secrets"
            checked={includeSecrets}
            onCheckedChange={(v) => setIncludeSecrets(Boolean(v))}
          />
          <Label htmlFor="include-secrets" className="text-sm">
            Include secret keys (values not included for security)
          </Label>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Format</Label>
          <RadioGroup value={format} onValueChange={(value) => setFormat(value as 'json' | 'yaml')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="json" id="format-json" />
              <Label htmlFor="format-json" className="flex items-center gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                JSON (.json)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yaml" id="format-yaml" />
              <Label htmlFor="format-yaml" className="flex items-center gap-2 cursor-pointer">
                <FileCode className="h-4 w-4" />
                YAML (.yaml)
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Separator />

      {/* Export Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Configurations:</span>
            <span className="font-medium">
              {selectAll ? configurations.length : selectedConfigs.length} selected
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Include secrets:</span>
            <span className="font-medium">{includeSecrets ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Format:</span>
            <span className="font-medium uppercase">{format}</span>
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        disabled={isExportDisabled || exportMutation.isPending}
        className="w-full"
        size="lg"
      >
        {exportMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Backup...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export Backup
          </>
        )}
      </Button>
    </div>
  )
}
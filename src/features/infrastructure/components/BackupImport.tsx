import React, { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  Loader2, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import type { BackupData, RestoreResult } from '../types'

interface BackupValidation {
  valid: boolean
  format?: 'json' | 'yaml'
  errors: string[]
  warnings: string[]
  metadata?: any
}

interface RestoreOptions {
  overwrite_existing: boolean
  selective_restore?: {
    config_ids?: string[]
    secret_keys?: string[]
  }
}

export function BackupImport() {
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupContent, setBackupContent] = useState<string>('')
  const [validation, setValidation] = useState<BackupValidation | null>(null)
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null)
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>([])
  const [selectedSecrets, setSelectedSecrets] = useState<string[]>([])
  const [importResult, setImportResult] = useState<RestoreResult | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Validate backup mutation
  const validateMutation = useMutation({
    mutationFn: async (backupData: string) => {
      const response = await fetch('/api/infrastructure/backup/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backup_data: backupData })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to validate backup')
      }

      return response.json() as Promise<BackupValidation>
    },
    onSuccess: (result) => {
      setValidation(result)
      if (result.valid) {
        try {
          const parsed = JSON.parse(backupContent)
          setParsedBackup(parsed)
          // Pre-select all items
          setSelectedConfigs(parsed.configurations?.map((c: any) => c.id) || [])
          setSelectedSecrets(parsed.secrets?.map((s: any) => s.key) || [])
        } catch {
          try {
            const yaml = require('yaml')
            const parsed = yaml.parse(backupContent)
            setParsedBackup(parsed)
            setSelectedConfigs(parsed.configurations?.map((c: any) => c.id) || [])
            setSelectedSecrets(parsed.secrets?.map((s: any) => s.key) || [])
          } catch (error) {
            console.error('Failed to parse backup data:', error)
          }
        }
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to validate backup', {
        description: error.message
      })
    }
  })

  // Import backup mutation
  const importMutation = useMutation({
    mutationFn: async (options: { backup_data: string } & RestoreOptions) => {
      const response = await fetch('/api/infrastructure/backup/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to import backup')
      }

      return response.json() as Promise<RestoreResult>
    },
    onSuccess: (result) => {
      setImportResult(result)
      if (result.success) {
        toast.success('Backup imported successfully', {
          description: `Imported ${result.imported_configs} configurations and ${result.imported_secrets} secrets`
        })
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['infrastructure'] })
      } else {
        toast.warning('Import completed with errors', {
          description: `${result.errors.length} errors occurred during import`
        })
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to import backup', {
        description: error.message
      })
    }
  })

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setBackupFile(file)
    setValidation(null)
    setParsedBackup(null)
    setImportResult(null)

    try {
      const content = await file.text()
      setBackupContent(content)
      validateMutation.mutate(content)
    } catch (error) {
      toast.error('Failed to read file')
    }
  }

  const handleImport = () => {
    if (!backupContent || !validation?.valid) return

    const options: { backup_data: string } & RestoreOptions = {
      backup_data: backupContent,
      overwrite_existing: overwriteExisting
    }

    // Add selective restore options if not all items are selected
    if (parsedBackup) {
      const allConfigIds = parsedBackup.configurations?.map(c => c.id) || []
      const allSecretKeys = parsedBackup.secrets?.map(s => s.key) || []

      if (selectedConfigs.length < allConfigIds.length || selectedSecrets.length < allSecretKeys.length) {
        options.selective_restore = {}
        
        if (selectedConfigs.length < allConfigIds.length) {
          options.selective_restore.config_ids = selectedConfigs
        }
        
        if (selectedSecrets.length < allSecretKeys.length) {
          options.selective_restore.secret_keys = selectedSecrets
        }
      }
    }

    importMutation.mutate(options)
  }

  const resetForm = () => {
    setBackupFile(null)
    setBackupContent('')
    setValidation(null)
    setParsedBackup(null)
    setSelectedConfigs([])
    setSelectedSecrets([])
    setImportResult(null)
    setOverwriteExisting(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Select Backup File</Label>
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={validateMutation.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose File
          </Button>
          {backupFile && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm">{backupFile.name}</span>
              <Badge variant="secondary">
                {(backupFile.size / 1024).toFixed(1)} KB
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Validation Results */}
      {validateMutation.isPending && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Validating backup file...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {validation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <Badge variant={validation.valid ? 'default' : 'destructive'}>
                {validation.valid ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
            
            {validation.format && (
              <div className="flex items-center justify-between">
                <span>Format:</span>
                <Badge variant="secondary">{validation.format.toUpperCase()}</Badge>
              </div>
            )}

            {validation.metadata && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Configurations:</span>
                  <span>{validation.metadata.total_configs || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Secrets:</span>
                  <span>{validation.metadata.total_secrets || 0}</span>
                </div>
              </div>
            )}

            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <strong>Errors:</strong>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <strong>Warnings:</strong>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index} className="text-sm">{warning}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Options */}
      {validation?.valid && parsedBackup && (
        <>
          <Separator />
          
          <div className="space-y-4">
            <Label className="text-base font-medium">Import Options</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                  id="overwrite-existing"
                  checked={overwriteExisting}
                  onCheckedChange={(v) => setOverwriteExisting(Boolean(v))}
                />
              <Label htmlFor="overwrite-existing" className="text-sm">
                Overwrite existing configurations and secrets
              </Label>
            </div>

            {/* Configuration Selection */}
            {parsedBackup.configurations && parsedBackup.configurations.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Select Configurations ({selectedConfigs.length}/{parsedBackup.configurations.length})
                </Label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {parsedBackup.configurations.map((config: any) => (
                    <div key={config.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`config-${config.id}`}
                        checked={selectedConfigs.includes(config.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedConfigs(prev => [...prev, config.id])
                          } else {
                            setSelectedConfigs(prev => prev.filter(id => id !== config.id))
                          }
                        }}
                      />
                      <Label htmlFor={`config-${config.id}`} className="text-sm cursor-pointer">
                        {config.name}
                        {config.description && (
                          <span className="text-muted-foreground"> - {config.description}</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secret Selection */}
            {parsedBackup.secrets && parsedBackup.secrets.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Select Secrets ({selectedSecrets.length}/{parsedBackup.secrets.length})
                </Label>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Secret values are not included in backups. Imported secrets will have placeholder values that you need to update.
                  </AlertDescription>
                </Alert>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {parsedBackup.secrets.map((secret: any) => (
                    <div key={secret.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`secret-${secret.key}`}
                        checked={selectedSecrets.includes(secret.key)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSecrets(prev => [...prev, secret.key])
                          } else {
                            setSelectedSecrets(prev => prev.filter(key => key !== secret.key))
                          }
                        }}
                      />
                      <Label htmlFor={`secret-${secret.key}`} className="text-sm cursor-pointer font-mono">
                        {secret.key}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Import Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={
                importMutation.isPending || 
                (selectedConfigs.length === 0 && selectedSecrets.length === 0)
              }
              className="flex-1"
              size="lg"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Backup
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </>
      )}

      {/* Import Results */}
      {importResult && (
        <>
          <Separator />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Imported Configurations:</span>
                    <Badge variant="default">{importResult.imported_configs}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Imported Secrets:</span>
                    <Badge variant="default">{importResult.imported_secrets}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Skipped Configurations:</span>
                    <Badge variant="secondary">{importResult.skipped_configs.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Skipped Secrets:</span>
                    <Badge variant="secondary">{importResult.skipped_secrets.length}</Badge>
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <strong>Errors:</strong>
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {(importResult.skipped_configs.length > 0 || importResult.skipped_secrets.length > 0) && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <strong>Skipped items (already exist):</strong>
                      {importResult.skipped_configs.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Configurations: </span>
                          <span className="text-sm">{importResult.skipped_configs.join(', ')}</span>
                        </div>
                      )}
                      {importResult.skipped_secrets.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Secrets: </span>
                          <span className="text-sm font-mono">{importResult.skipped_secrets.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
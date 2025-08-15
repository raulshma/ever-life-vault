import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BackupExport } from './BackupExport'
import { BackupImport } from './BackupImport'
import { Download, Upload, Shield, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function BackupManager() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Backup & Restore</h2>
          <p className="text-muted-foreground">
            Export and import your infrastructure configurations and secrets
          </p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          For security reasons, secret values are not included in backups. Only secret keys are exported, 
          and you'll need to manually update the values after importing.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Backup
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Configuration Backup
              </CardTitle>
              <CardDescription>
                Create a backup of your Docker Compose configurations and secret keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BackupExport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Configuration Backup
              </CardTitle>
              <CardDescription>
                Restore configurations and secrets from a backup file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BackupImport />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
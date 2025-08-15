import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, FileText, Eye, Shield } from 'lucide-react';
import { SecretsManager } from './SecretsManager';
import { SecretTemplates } from './SecretTemplates';
import { SecretInjectionPreview } from './SecretInjectionPreview';
import { 
  SecretFormData, 
  SecretImportData, 
  SecretExportData, 
  SecretTemplate, 
  SecretInjectionPreview as SecretInjectionPreviewType 
} from '../types';

interface SecretsManagementPageProps {
  // Secrets management
  secrets: Array<{ key: string; description?: string; created_at: string }>;
  onCreateSecret: (data: SecretFormData) => Promise<void>;
  onUpdateSecret: (key: string, data: SecretFormData) => Promise<void>;
  onDeleteSecret: (key: string) => Promise<void>;
  onImportSecrets: (data: SecretImportData) => Promise<void>;
  onExportSecrets: () => Promise<SecretExportData>;
  
  // Template management
  templates: SecretTemplate[];
  onCreateTemplate: (template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateTemplate: (id: string, template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => Promise<void>;
  
  // Preview functionality
  onPreviewInjection: (composeContent: string) => Promise<SecretInjectionPreviewType>;
  
  // Current compose content for preview
  currentComposeContent?: string;
  
  loading?: boolean;
}

export function SecretsManagementPage({
  secrets = [],
  onCreateSecret,
  onUpdateSecret,
  onDeleteSecret,
  onImportSecrets,
  onExportSecrets,
  templates = [],
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  onPreviewInjection,
  currentComposeContent = '',
  loading = false
}: SecretsManagementPageProps) {
  const [activeTab, setActiveTab] = useState('secrets');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Secrets Management</h1>
          <p className="text-muted-foreground">
            Securely manage environment variables, secrets, and templates for your infrastructure
          </p>
        </div>
      </div>

      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Notice:</strong> All secrets are encrypted at rest using AES-256 encryption. 
          Secret values are never stored in Docker Compose files - only placeholder references are used.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="secrets" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Secrets
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="secrets" className="space-y-6">
          <SecretsManager
            secrets={secrets}
            onCreateSecret={onCreateSecret}
            onUpdateSecret={onUpdateSecret}
            onDeleteSecret={onDeleteSecret}
            onImportSecrets={onImportSecrets}
            onExportSecrets={onExportSecrets}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <SecretTemplates
            templates={templates}
            onCreateTemplate={onCreateTemplate}
            onUpdateTemplate={onUpdateTemplate}
            onDeleteTemplate={onDeleteTemplate}
            onApplyTemplate={onApplyTemplate}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <SecretInjectionPreview
            composeContent={currentComposeContent}
            onPreview={onPreviewInjection}
            loading={loading}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Secrets</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{secrets?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Encrypted and secure
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Reusable configurations
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Secure</div>
            <p className="text-xs text-muted-foreground">
              AES-256 encrypted
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
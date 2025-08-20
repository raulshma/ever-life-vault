import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, AlertTriangle, CheckCircle, Key, FileText } from 'lucide-react';
import { SecretInjectionPreview as SecretInjectionPreviewType } from '../types';
import SimpleYamlPreview from './SimpleYamlPreview';
import { generateSecretInjectionPreview } from '../utils/secretInjection';

interface SecretInjectionPreviewProps {
  composeContent: string;
  onPreview: (composeContent: string) => Promise<SecretInjectionPreviewType>;
  loading?: boolean;
}

export function SecretInjectionPreview({
  composeContent,
  onPreview,
  loading = false
}: SecretInjectionPreviewProps) {
  const [preview, setPreview] = useState<SecretInjectionPreviewType | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const generatePreview = useCallback(async () => {
    if (!composeContent.trim()) {
      setPreview(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const result = await onPreview(composeContent);
      setPreview(result);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [composeContent, onPreview]);

  // Auto-generate preview when compose content changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      generatePreview();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [generatePreview]);

  const getDisplayContent = useCallback((content: string) => {
    if (showSecrets) {
      return content;
    }
    
    // Mask secret values in the preview
    return content.replace(/^(\s*[A-Z_][A-Z0-9_]*\s*=\s*)(.+)$/gm, (match, prefix, value) => {
      if (value.length > 8) {
        return `${prefix}${'*'.repeat(8)}...`;
      }
      return `${prefix}${'*'.repeat(value.length)}`;
    });
  }, [showSecrets]);

  if (!composeContent.trim()) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No compose content</h3>
          <p className="text-muted-foreground text-center">
            Add some Docker Compose content to see the secret injection preview
          </p>
        </CardContent>
      </Card>
    );
  }

  if (previewLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Generating preview...</p>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Preview unavailable</h3>
          <p className="text-muted-foreground text-center">
            Unable to generate secret injection preview
          </p>
          <Button onClick={generatePreview} className="mt-4" disabled={loading}>
            Retry Preview
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasPlaceholders = preview.placeholders_found.length > 0;
  const hasMissingSecrets = preview.missing_secrets.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Secret Injection Preview</h3>
          <p className="text-sm text-muted-foreground">
            Preview how secrets will be injected into your Docker Compose file
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSecrets(!showSecrets)}
          >
            {showSecrets ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showSecrets ? 'Hide' : 'Show'} Secrets
          </Button>
          <Button onClick={generatePreview} disabled={previewLoading || loading}>
            Refresh Preview
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Placeholders Found</p>
                <p className="text-2xl font-bold">{preview.placeholders_found.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {hasMissingSecrets ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <div>
                <p className="text-sm font-medium">Missing Secrets</p>
                <p className="text-2xl font-bold">{preview.missing_secrets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Ready to Deploy</p>
                <p className="text-2xl font-bold">{hasMissingSecrets ? 'No' : 'Yes'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {hasMissingSecrets && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Missing secrets detected:</strong> The following secret placeholders don't have corresponding secrets defined: {preview.missing_secrets.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {!hasPlaceholders && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>No secret placeholders found:</strong> Your compose file doesn't contain any secret placeholders. Use the format <code>${'{SECRET_NAME}'}</code> to reference secrets.
          </AlertDescription>
        </Alert>
      )}

      {/* Placeholder Details */}
      {hasPlaceholders && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Secret Placeholders</CardTitle>
            <CardDescription>
              Placeholders found in your Docker Compose file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {preview.placeholders_found.map((placeholder) => (
                <Badge
                  key={placeholder}
                  variant={preview.missing_secrets.includes(placeholder) ? "destructive" : "secondary"}
                >
                  <code>${'{' + placeholder + '}'}</code>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Tabs */}
      <Tabs defaultValue="original" className="w-full">
        <div className="bg-muted rounded-md p-1 border border-border">
          <TabsList className="w-full flex flex-wrap h-auto min-h-[2.5rem]">
            <TabsTrigger value="original">Original Compose</TabsTrigger>
            <TabsTrigger value="injected">With Secrets Injected</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="original" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Original Docker Compose</CardTitle>
              <CardDescription>
                Your compose file with secret placeholders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleYamlPreview content={preview.original_compose} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="injected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">With Secrets Injected</CardTitle>
              <CardDescription>
                How your compose file will look when deployed with secrets injected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleYamlPreview content={getDisplayContent(preview.injected_compose)} />
              {!showSecrets && hasPlaceholders && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Secret values are masked for security. Click "Show Secrets" to reveal actual values.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Secret Placeholder Syntax</CardTitle>
          <CardDescription>
            How to reference secrets in your Docker Compose files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Environment Variables</h4>
            <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - API_KEY=\${API_KEY}
      - SECRET_TOKEN=\${SECRET_TOKEN}`}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Environment Files</h4>
            <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`services:
  app:
    env_file:
      - .env  # Will be generated with injected secrets`}
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Labels and Other Fields</h4>
            <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
{`services:
  app:
    labels:
      - "traefik.http.middlewares.auth.basicauth.users=\${BASIC_AUTH_USERS}"
    command: ["--token", "\${SERVICE_TOKEN}"]`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
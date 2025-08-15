import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Plus, Download, Upload, Trash2, Edit, Copy, AlertTriangle, Key, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { SecretFormData, SecretImportData, SecretExportData } from '../types';
import { validateSecretKey, validateSecretValue, validateSecretFormData } from '../validation/schemas';
import { ValidationDisplay } from './ValidationDisplay';

interface SecretsManagerProps {
  secrets: Array<{ key: string; description?: string; created_at: string }>;
  onCreateSecret: (data: SecretFormData) => Promise<void>;
  onUpdateSecret: (key: string, data: SecretFormData) => Promise<void>;
  onDeleteSecret: (key: string) => Promise<void>;
  onImportSecrets: (data: SecretImportData) => Promise<void>;
  onExportSecrets: () => Promise<SecretExportData>;
  loading?: boolean;
}

export function SecretsManager({
  secrets,
  onCreateSecret,
  onUpdateSecret,
  onDeleteSecret,
  onImportSecrets,
  onExportSecrets,
  loading = false
}: SecretsManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingSecret, setEditingSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState<SecretFormData>({
    key: '',
    value: '',
    description: ''
  });
  const [importData, setImportData] = useState<SecretImportData>({
    secrets: [],
    overwrite_existing: false
  });
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormData({ key: '', value: '', description: '' });
    setValidationErrors({});
  }, []);

  const validateForm = useCallback((data: SecretFormData) => {
    const errors: Record<string, string> = {};
    
    const keyValidation = validateSecretKey(data.key);
    if (!keyValidation.valid) {
      errors.key = keyValidation.errors[0]?.message || 'Invalid key';
    }
    
    const valueValidation = validateSecretValue(data.value);
    if (!valueValidation.valid) {
      errors.value = valueValidation.errors[0]?.message || 'Invalid value';
    }
    
    // Check for duplicate keys when creating new secrets
    if (!editingSecret && secrets.some(s => s.key === data.key)) {
      errors.key = 'A secret with this key already exists';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [secrets, editingSecret]);

  const handleCreateSecret = useCallback(async () => {
    if (!validateForm(formData)) return;
    
    try {
      await onCreateSecret(formData);
      setShowCreateDialog(false);
      resetForm();
      toast.success('Secret created successfully');
    } catch (error) {
      toast.error('Failed to create secret');
    }
  }, [formData, validateForm, onCreateSecret, resetForm]);

  const handleUpdateSecret = useCallback(async () => {
    if (!editingSecret || !validateForm(formData)) return;
    
    try {
      await onUpdateSecret(editingSecret, formData);
      setEditingSecret(null);
      resetForm();
      toast.success('Secret updated successfully');
    } catch (error) {
      toast.error('Failed to update secret');
    }
  }, [editingSecret, formData, validateForm, onUpdateSecret, resetForm]);

  const handleDeleteSecret = useCallback(async (key: string) => {
    try {
      await onDeleteSecret(key);
      toast.success('Secret deleted successfully');
    } catch (error) {
      toast.error('Failed to delete secret');
    }
  }, [onDeleteSecret]);

  const handleExportSecrets = useCallback(async () => {
    try {
      const exportData = await onExportSecrets();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `secrets-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Secrets exported successfully');
    } catch (error) {
      toast.error('Failed to export secrets');
    }
  }, [onExportSecrets]);

  const handleImportFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        // Try to parse as JSON first (our export format)
        try {
          const jsonData = JSON.parse(content);
          if (jsonData.secrets && Array.isArray(jsonData.secrets)) {
            setImportData({
              secrets: jsonData.secrets,
              overwrite_existing: false
            });
            return;
          }
        } catch {
          // Not JSON, try as .env format
        }
        
        // Parse as .env format
        const lines = content.split('\n');
        const secrets: SecretFormData[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
              secrets.push({ key: key.trim(), value, description: '' });
            }
          }
        }
        
        setImportData({
          secrets,
          overwrite_existing: false
        });
      } catch (error) {
        toast.error('Failed to parse import file');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImportSecrets = useCallback(async () => {
    try {
      await onImportSecrets(importData);
      setShowImportDialog(false);
      setImportData({ secrets: [], overwrite_existing: false });
      toast.success(`Imported ${importData.secrets.length} secrets successfully`);
    } catch (error) {
      toast.error('Failed to import secrets');
    }
  }, [importData, onImportSecrets]);

  const toggleValueVisibility = useCallback((key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const startEdit = useCallback((secret: { key: string; description?: string }) => {
    setEditingSecret(secret.key);
    setFormData({
      key: secret.key,
      value: '', // Don't pre-fill value for security
      description: secret.description || ''
    });
    setValidationErrors({});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Secrets Management</h2>
          <p className="text-muted-foreground">
            Securely manage environment variables and secrets for your services
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportSecrets} disabled={loading || secrets.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Secrets</DialogTitle>
                <DialogDescription>
                  Import secrets from a JSON file or .env file
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-file">Select File</Label>
                  <Input
                    id="import-file"
                    type="file"
                    accept=".json,.env,.txt"
                    onChange={handleImportFile}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports JSON export files and .env format files
                  </p>
                </div>
                
                {importData.secrets.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <Label>Preview ({importData.secrets.length} secrets)</Label>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 mt-1">
                        {importData.secrets.map((secret, index) => (
                          <div key={index} className="flex items-center justify-between py-1">
                            <span className="font-mono text-sm">{secret.key}</span>
                            <Badge variant="secondary">
                              {secret.value.length} chars
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="overwrite"
                        checked={importData.overwrite_existing}
                        onCheckedChange={(checked) =>
                          setImportData(prev => ({ ...prev, overwrite_existing: checked }))
                        }
                      />
                      <Label htmlFor="overwrite">Overwrite existing secrets</Label>
                    </div>
                    
                    {!importData.overwrite_existing && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Existing secrets with the same keys will be skipped
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImportSecrets} 
                  disabled={importData.secrets.length === 0}
                >
                  Import {importData.secrets.length} Secrets
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Secret
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Secret</DialogTitle>
                <DialogDescription>
                  Add a new environment variable or secret
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="secret-key">Key</Label>
                  <Input
                    id="secret-key"
                    value={formData.key}
                    onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                    placeholder="MY_SECRET_KEY"
                    className="font-mono"
                  />
                  {validationErrors.key && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.key}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="secret-value">Value</Label>
                  <div className="relative">
                    <Input
                      id="secret-value"
                      type={showValues.create ? 'text' : 'password'}
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="Enter secret value"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleValueVisibility('create')}
                    >
                      {showValues.create ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {validationErrors.value && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.value}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="secret-description">Description (Optional)</Label>
                  <Textarea
                    id="secret-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this secret"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSecret} disabled={loading}>
                  Create Secret
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {secrets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No secrets configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by adding your first secret or importing from a file
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Secret
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {secrets.map((secret) => (
            <Card key={secret.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="font-mono text-sm font-semibold">{secret.key}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(secret.key)}
                        className="h-6 w-6 p-0"
                        aria-label="Copy secret key"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {secret.description && (
                      <p className="text-sm text-muted-foreground">{secret.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(secret.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(secret)}
                      aria-label="Edit secret"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSecret(secret.key)}
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete secret"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Secret Dialog */}
      <Dialog open={editingSecret !== null} onOpenChange={(open) => !open && setEditingSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Secret</DialogTitle>
            <DialogDescription>
              Update the value and description for {editingSecret}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-key">Key</Label>
              <Input
                id="edit-key"
                value={formData.key}
                disabled
                className="font-mono bg-muted"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-value">New Value</Label>
              <div className="relative">
                <Input
                  id="edit-value"
                  type={showValues.edit ? 'text' : 'password'}
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter new secret value"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => toggleValueVisibility('edit')}
                >
                  {showValues.edit ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {validationErrors.value && (
                <p className="text-sm text-destructive mt-1">{validationErrors.value}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this secret"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSecret(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSecret} disabled={loading}>
              Update Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
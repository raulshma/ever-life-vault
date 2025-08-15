import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Copy, FileText, Key, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SecretTemplate } from '../types';
import { secretTemplateSchema } from '../validation/schemas';

interface SecretTemplatesProps {
  templates: SecretTemplate[];
  onCreateTemplate: (template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateTemplate: (id: string, template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => Promise<void>;
  loading?: boolean;
}

interface TemplateFormData {
  name: string;
  description: string;
  template: Record<string, string>;
}

export function SecretTemplates({
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  loading = false
}: SecretTemplatesProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SecretTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    template: {}
  });
  const [newKeyValue, setNewKeyValue] = useState({ key: '', value: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormData({ name: '', description: '', template: {} });
    setNewKeyValue({ key: '', value: '' });
    setValidationErrors({});
  }, []);

  const validateForm = useCallback((data: TemplateFormData) => {
    const errors: Record<string, string> = {};
    
    const validation = secretTemplateSchema.safeParse(data);
    if (!validation.success) {
      validation.error.errors.forEach(error => {
        const field = error.path.join('.');
        errors[field] = error.message;
      });
    }
    
    // Check for duplicate template names when creating
    if (!editingTemplate && templates.some(t => t.name === data.name)) {
      errors.name = 'A template with this name already exists';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [templates, editingTemplate]);

  const handleCreateTemplate = useCallback(async () => {
    if (!validateForm(formData)) return;
    
    try {
      await onCreateTemplate(formData);
      setShowCreateDialog(false);
      resetForm();
      toast.success('Template created successfully');
    } catch (error) {
      toast.error('Failed to create template');
    }
  }, [formData, validateForm, onCreateTemplate, resetForm]);

  const handleUpdateTemplate = useCallback(async () => {
    if (!editingTemplate || !validateForm(formData)) return;
    
    try {
      await onUpdateTemplate(editingTemplate.id, formData);
      setEditingTemplate(null);
      resetForm();
      toast.success('Template updated successfully');
    } catch (error) {
      toast.error('Failed to update template');
    }
  }, [editingTemplate, formData, validateForm, onUpdateTemplate, resetForm]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    try {
      await onDeleteTemplate(id);
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error('Failed to delete template');
    }
  }, [onDeleteTemplate]);

  const handleApplyTemplate = useCallback(async (templateId: string) => {
    try {
      await onApplyTemplate(templateId);
      toast.success('Template applied successfully');
    } catch (error) {
      toast.error('Failed to apply template');
    }
  }, [onApplyTemplate]);

  const addKeyValue = useCallback(() => {
    if (!newKeyValue.key.trim() || !newKeyValue.value.trim()) {
      toast.error('Both key and value are required');
      return;
    }
    
    if (formData.template[newKeyValue.key]) {
      toast.error('Key already exists in template');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      template: {
        ...prev.template,
        [newKeyValue.key]: newKeyValue.value
      }
    }));
    setNewKeyValue({ key: '', value: '' });
  }, [newKeyValue, formData.template]);

  const removeKeyValue = useCallback((key: string) => {
    setFormData(prev => {
      const newTemplate = { ...prev.template };
      delete newTemplate[key];
      return { ...prev, template: newTemplate };
    });
  }, []);

  const startEdit = useCallback((template: SecretTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      template: { ...template.template }
    });
    setValidationErrors({});
  }, []);

  const copyTemplateToClipboard = useCallback(async (template: SecretTemplate) => {
    const templateText = Object.entries(template.template)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(templateText);
      toast.success('Template copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy template');
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Secret Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable templates for common secret configurations
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Secret Template</DialogTitle>
              <DialogDescription>
                Create a reusable template for common secret configurations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="database-config"
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="template-description">Description</Label>
                  <Input
                    id="template-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Database connection secrets"
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label>Template Variables</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="SECRET_KEY"
                      value={newKeyValue.key}
                      onChange={(e) => setNewKeyValue(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                      className="font-mono"
                    />
                    <Input
                      placeholder="default_value"
                      value={newKeyValue.value}
                      onChange={(e) => setNewKeyValue(prev => ({ ...prev, value: e.target.value }))}
                    />
                    <Button onClick={addKeyValue} size="sm">
                      Add
                    </Button>
                  </div>
                  
                  {Object.keys(formData.template).length > 0 && (
                    <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                      {Object.entries(formData.template).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between bg-muted p-2 rounded">
                          <div className="flex-1">
                            <code className="text-sm font-mono">{key}</code>
                            <span className="text-muted-foreground mx-2">=</span>
                            <span className="text-sm">{value}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeKeyValue(key)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {validationErrors.template && (
                    <p className="text-sm text-destructive">{validationErrors.template}</p>
                  )}
                </div>
              </div>
              
              {Object.keys(formData.template).length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Add at least one key-value pair to create a template
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTemplate} 
                disabled={loading || Object.keys(formData.template).length === 0}
              >
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates created</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create templates to quickly apply common secret configurations
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {Object.keys(template.template).length} variables
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyTemplateToClipboard(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {Object.entries(template.template).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                      <code className="font-mono">{key}</code>
                      <span className="text-muted-foreground truncate max-w-xs">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => handleApplyTemplate(template.id)}
                    disabled={loading}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Apply Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Template Dialog */}
      <Dialog open={editingTemplate !== null} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-template-name">Template Name</Label>
                <Input
                  id="edit-template-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="database-config"
                />
                {validationErrors.name && (
                  <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-template-description">Description</Label>
                <Input
                  id="edit-template-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Database connection secrets"
                />
              </div>
            </div>
            
            <Separator />
            
            <div>
              <Label>Template Variables</Label>
              <div className="space-y-2 mt-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="SECRET_KEY"
                    value={newKeyValue.key}
                    onChange={(e) => setNewKeyValue(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                    className="font-mono"
                  />
                  <Input
                    placeholder="default_value"
                    value={newKeyValue.value}
                    onChange={(e) => setNewKeyValue(prev => ({ ...prev, value: e.target.value }))}
                  />
                  <Button onClick={addKeyValue} size="sm">
                    Add
                  </Button>
                </div>
                
                {Object.keys(formData.template).length > 0 && (
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {Object.entries(formData.template).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between bg-muted p-2 rounded">
                        <div className="flex-1">
                          <code className="text-sm font-mono">{key}</code>
                          <span className="text-muted-foreground mx-2">=</span>
                          <span className="text-sm">{value}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeKeyValue(key)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTemplate} 
              disabled={loading || Object.keys(formData.template).length === 0}
            >
              Update Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
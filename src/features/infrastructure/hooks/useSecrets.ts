import { useState, useCallback, useEffect } from 'react';
import { secretsApi } from '../services/secretsApi';
import { useSecretsErrorHandling } from './useErrorHandling';
import { 
  SecretFormData, 
  SecretImportData, 
  SecretExportData, 
  SecretTemplate, 
  SecretInjectionPreview 
} from '../types';

export function useSecrets() {
  const [secrets, setSecrets] = useState<Array<{ key: string; description?: string; created_at: string }>>([]);
  const [templates, setTemplates] = useState<SecretTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const { executeSecretsOperation, handleSecretsError } = useSecretsErrorHandling();

  // Load secrets on mount
  useEffect(() => {
    loadSecrets();
    loadTemplates();
  }, []);

  const loadSecrets = useCallback(async () => {
    try {
      setLoading(true);
      const secretsList = await secretsApi.listSecrets();
      setSecrets(secretsList);
    } catch (error) {
      handleSecretsError(error);
    } finally {
      setLoading(false);
    }
  }, [handleSecretsError]);

  const loadTemplates = useCallback(async () => {
    try {
      const templatesList = await secretsApi.listTemplates();
      setTemplates(templatesList);
    } catch (error) {
      // Templates are optional, don't show error for now
      console.warn('Failed to load templates:', error);
    }
  }, []);

  const createSecret = useCallback(async (data: SecretFormData) => {
    await executeSecretsOperation(
      () => secretsApi.createSecret(data),
      'Secret created successfully',
      {
        onSuccess: () => loadSecrets()
      }
    );
  }, [executeSecretsOperation, loadSecrets]);

  const updateSecret = useCallback(async (key: string, data: SecretFormData) => {
    await executeSecretsOperation(
      () => secretsApi.updateSecret(key, data),
      'Secret updated successfully',
      {
        onSuccess: () => loadSecrets()
      }
    );
  }, [executeSecretsOperation, loadSecrets]);

  const deleteSecret = useCallback(async (key: string) => {
    await executeSecretsOperation(
      () => secretsApi.deleteSecret(key),
      'Secret deleted successfully',
      {
        onSuccess: () => loadSecrets()
      }
    );
  }, [executeSecretsOperation, loadSecrets]);

  const importSecrets = useCallback(async (data: SecretImportData) => {
    await executeSecretsOperation(
      () => secretsApi.importSecrets(data),
      `Successfully imported ${data.secrets.length} secrets`,
      {
        onSuccess: () => loadSecrets()
      }
    );
  }, [executeSecretsOperation, loadSecrets]);

  const exportSecrets = useCallback(async (): Promise<SecretExportData> => {
    return await executeSecretsOperation(
      () => secretsApi.exportSecrets(),
      'Secrets exported successfully'
    );
  }, [executeSecretsOperation]);

  const createTemplate = useCallback(async (template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await executeSecretsOperation(
      () => secretsApi.createTemplate(template),
      'Template created successfully',
      {
        onSuccess: () => loadTemplates()
      }
    );
  }, [executeSecretsOperation, loadTemplates]);

  const updateTemplate = useCallback(async (id: string, template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    await executeSecretsOperation(
      () => secretsApi.updateTemplate(id, template),
      'Template updated successfully',
      {
        onSuccess: () => loadTemplates()
      }
    );
  }, [executeSecretsOperation, loadTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await executeSecretsOperation(
      () => secretsApi.deleteTemplate(id),
      'Template deleted successfully',
      {
        onSuccess: () => loadTemplates()
      }
    );
  }, [executeSecretsOperation, loadTemplates]);

  const applyTemplate = useCallback(async (templateId: string) => {
    await executeSecretsOperation(
      () => secretsApi.applyTemplate(templateId),
      'Template applied successfully',
      {
        onSuccess: () => loadSecrets()
      }
    );
  }, [executeSecretsOperation, loadSecrets]);

  const previewInjection = useCallback(async (composeContent: string): Promise<SecretInjectionPreview> => {
    return await executeSecretsOperation(
      () => secretsApi.previewInjection(composeContent),
      'Preview generated successfully'
    );
  }, [executeSecretsOperation]);

  return {
    secrets,
    templates,
    loading,
    createSecret,
    updateSecret,
    deleteSecret,
    importSecrets,
    exportSecrets,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    previewInjection,
    refreshSecrets: loadSecrets,
    refreshTemplates: loadTemplates,
  };
}
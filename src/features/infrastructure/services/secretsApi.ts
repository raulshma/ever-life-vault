import { SecretFormData, SecretImportData, SecretExportData, SecretTemplate, SecretInjectionPreview } from '../types';
import { fetchWithAuth } from '@/lib/aggregatorClient';

const API_BASE = '/api/infrastructure';

export class SecretsApiService {

    async createSecret(data: SecretFormData): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE}/secrets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: data.key,
                value: data.value,
                description: data.description
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create secret' }));
            throw new Error(error.error || 'Failed to create secret');
        }
    }

    async updateSecret(key: string, data: SecretFormData): Promise<void> {
        // The server uses POST for both create and update (upsert)
        const response = await fetchWithAuth(`${API_BASE}/secrets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: data.key,
                value: data.value,
                description: data.description
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to update secret' }));
            throw new Error(error.error || 'Failed to update secret');
        }
    }

    async deleteSecret(key: string): Promise<void> {
        const response = await fetchWithAuth(`${API_BASE}/secrets/${encodeURIComponent(key)}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to delete secret' }));
            throw new Error(error.error || 'Failed to delete secret');
        }
    }

    async listSecrets(): Promise<Array<{ key: string; description?: string; created_at: string }>> {
        const response = await fetchWithAuth(`${API_BASE}/secrets`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch secrets' }));
            throw new Error(error.error || 'Failed to fetch secrets');
        }

        const data = await response.json();
        // Convert the server response format to what the UI expects
        const secretKeys = data.secret_keys || [];
        return secretKeys.map((key: string) => ({
            key,
            description: undefined, // Server doesn't provide descriptions yet
            created_at: new Date().toISOString() // Placeholder since server doesn't provide this
        }));
    }

    async importSecrets(data: SecretImportData): Promise<void> {
        // Convert to the format expected by the bulk endpoint
        const secrets: Record<string, string> = {};
        data.secrets.forEach(secret => {
            secrets[secret.key] = secret.value;
        });

        const response = await fetchWithAuth(`${API_BASE}/secrets/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ secrets }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to import secrets' }));
            throw new Error(error.error || 'Failed to import secrets');
        }
    }

    async exportSecrets(): Promise<SecretExportData> {
        const response = await fetchWithAuth(`${API_BASE}/secrets/export`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to export secrets' }));
            throw new Error(error.error || 'Failed to export secrets');
        }

        const data = await response.json();
        // Convert server response to expected format
        return {
            secrets: data.export_data.keys.map((key: string) => ({
                key,
                description: undefined // Server doesn't provide descriptions yet
            })),
            exported_at: data.exported_at,
            total_count: data.export_data.count
        };
    }

    // Template management methods (placeholder implementations)
    async createTemplate(template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<void> {
        // TODO: Implement when template API is available
        console.log('Creating template:', template);
        throw new Error('Template creation not yet implemented');
    }

    async updateTemplate(id: string, template: Omit<SecretTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<void> {
        // TODO: Implement when template API is available
        console.log('Updating template:', id, template);
        throw new Error('Template update not yet implemented');
    }

    async deleteTemplate(id: string): Promise<void> {
        // TODO: Implement when template API is available
        console.log('Deleting template:', id);
        throw new Error('Template deletion not yet implemented');
    }

    async applyTemplate(templateId: string): Promise<void> {
        // TODO: Implement when template API is available
        console.log('Applying template:', templateId);
        throw new Error('Template application not yet implemented');
    }

    async listTemplates(): Promise<SecretTemplate[]> {
        // TODO: Implement when template API is available
        return [];
    }

    async previewInjection(composeContent: string): Promise<SecretInjectionPreview> {
        const response = await fetchWithAuth(`${API_BASE}/secrets/preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ compose_content: composeContent }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to preview injection' }));
            throw new Error(error.error || 'Failed to preview injection');
        }

        return await response.json();
    }
}

export const secretsApi = new SecretsApiService();
import { useCallback, useMemo, useState } from 'react';
import { useVaultSession } from './useVaultSession';
import { useEncryptedVault } from './useEncryptedVault';

/**
 * Generic service API credential management backed by the encrypted vault.
 * Each service config is a vault item of type "api" with name = serviceName.
 * data = { serverUrl, apiKey, ...custom }
 */
export interface ServiceApiConfig {
  serverUrl: string;
  apiKey: string;
  // Allow additional dynamic keys
  [key: string]: any;
}

export interface UseServiceApiConfigReturn {
  // The effective config (either manual or from linked vault item)
  config: ServiceApiConfig;
  // Update (manual) config values stored directly on the service item
  updateConfig: (partial: Partial<ServiceApiConfig>) => Promise<void>;
  // Link to an existing vault api credential item (or unlink with null)
  linkVaultItem: (vaultItemId: string | null) => Promise<void>;
  // Currently linked vault api credential item id (if any)
  linkedVaultItemId: string | null;
  // Available vault api credential items that look like usable service configs
  availableVaultItems: Array<{
    id: string;
    name: string;
    serverUrl?: string;
    apiKey?: string;
  }>;
  // Whether effective config has serverUrl+apiKey
  isConfigured: boolean;
  vaultUnlocked: boolean;
  saving: boolean;
  error: string | null;
  source: 'linked' | 'manual';
}

export function useServiceApiConfig(serviceName: string): UseServiceApiConfigReturn {
  const { isUnlocked: vaultUnlocked } = useVaultSession();
  const { itemsByType, addItem, updateItem, loading } = useEncryptedVault();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceItem = useMemo(() => {
    if (!vaultUnlocked) return undefined;
    return itemsByType.api.find(
      (i) => i.name.toLowerCase() === serviceName.toLowerCase()
    );
  }, [itemsByType.api, serviceName, vaultUnlocked]);

  // Collect all candidate items (api + login) that have plausible serverUrl/apiKey so user can select
  // This lets a user reuse a generic API or login credential they already stored.
  const availableVaultItems = useMemo(() => {
    if (!vaultUnlocked) return [];
    const candidates = [...itemsByType.api, ...itemsByType.login];
    return candidates
      .filter(
        (i) =>
          (typeof i.data.serverUrl === 'string' && i.data.serverUrl.length > 0) ||
          (typeof i.data.apiKey === 'string' && i.data.apiKey.length > 0)
      )
      .map((i) => ({
        id: i.id,
        name: i.name,
        serverUrl: i.data.serverUrl as string | undefined,
        apiKey: i.data.apiKey as string | undefined,
      }));
  }, [itemsByType.api, itemsByType.login, vaultUnlocked]);

  const linkedVaultItemId = (serviceItem?.data.linkedVaultItemId as string) || null;
  const linkedItem = useMemo(
    () => availableVaultItems.find((i) => i.id === linkedVaultItemId) || null,
    [availableVaultItems, linkedVaultItemId]
  );

  // Effective config: if linked to another vault item, use its values; else manual
  const config: ServiceApiConfig = useMemo(() => {
    if (linkedItem) {
      return {
        serverUrl: linkedItem.serverUrl || '',
        apiKey: linkedItem.apiKey || '',
        // expose also which item is linked
        linkedVaultItemId: linkedItem.id,
        source: 'linked',
      } as ServiceApiConfig;
    }
    return {
      serverUrl: (serviceItem?.data.serverUrl as string) || '',
      apiKey: (serviceItem?.data.apiKey as string) || '',
      ...serviceItem?.data,
    } as ServiceApiConfig;
  }, [serviceItem, linkedItem]);

  const updateConfig = useCallback(
    async (partial: Partial<ServiceApiConfig>) => {
      if (!vaultUnlocked) {
        setError('Vault is locked');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        // If we are currently linked, unlink for manual override unless explicitly preserving link
        const newData = serviceItem?.data ? { ...serviceItem.data } : {} as any;
        if (newData.linkedVaultItemId) delete newData.linkedVaultItemId;
        const dataToStore = { ...newData, ...partial };

        if (serviceItem) {
          await updateItem(serviceItem.id, { data: dataToStore });
        } else {
          await addItem({
            type: 'api',
            name: serviceName,
            data: { serverUrl: '', apiKey: '', ...dataToStore },
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save config');
      } finally {
        setSaving(false);
      }
    },
    [vaultUnlocked, serviceItem, updateItem, addItem, serviceName]
  );

  const linkVaultItem = useCallback(
    async (vaultItemId: string | null) => {
      if (!vaultUnlocked) {
        setError('Vault is locked');
        return;
      }
      setSaving(true);
      setError(null);
      try {
        if (serviceItem) {
          await updateItem(serviceItem.id, {
            data: {
              ...serviceItem.data,
              linkedVaultItemId: vaultItemId || undefined,
            },
          });
        } else {
          await addItem({
            type: 'api',
            name: serviceName,
            data: {
              serverUrl: '',
              apiKey: '',
              linkedVaultItemId: vaultItemId || undefined,
            },
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to link credential');
      } finally {
        setSaving(false);
      }
    },
    [vaultUnlocked, serviceItem, updateItem, addItem, serviceName]
  );

  const isConfigured = !!(config.serverUrl && config.apiKey);
  const source: 'linked' | 'manual' = linkedItem ? 'linked' : 'manual';

  return {
    config,
    updateConfig,
    linkVaultItem,
    linkedVaultItemId,
    availableVaultItems,
    isConfigured,
    vaultUnlocked,
    saving: saving || loading,
    error,
    source,
  };
}

export default useServiceApiConfig;

import { useState, useEffect, useCallback, useDeferredValue, startTransition, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useVaultSession } from './useVaultSession';
import {
  VaultItem,
  EncryptedVaultItem,
  encryptVaultItem,
  decryptVaultItem,
  encryptData,
  decryptData,
  generateIV,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '@/lib/crypto';

export function useEncryptedVault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { isUnlocked, masterKey } = useVaultSession();
  const latestDecryptAbortRef = useRef<{ aborted: boolean } | null>(null);

  // Fetch and decrypt vault items
  const fetchItems = useCallback(async () => {
    if (!user || !isUnlocked || !masterKey) {
      setItems([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('encrypted_vault_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Decrypt items client-side with controlled concurrency
      const encryptedList = (data || []).map((encryptedItem) => ({
        ...encryptedItem,
        item_type: encryptedItem.item_type as 'login' | 'note' | 'api' | 'document',
      }));

      const concurrency = Math.min(8, Math.max(2, (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) || 4));
      const results: VaultItem[] = [];

      const abortRef = { aborted: false } as { aborted: boolean };
      latestDecryptAbortRef.current = abortRef;

      const worker = async (queue: typeof encryptedList) => {
        while (queue.length && !abortRef.aborted) {
          const next = queue.shift();
          if (!next) break;
          try {
            const decrypted = await decryptVaultItem(next as any, masterKey);
            results.push(decrypted);
          } catch (decryptError) {
            console.error('Failed to decrypt item:', (next as any).id, decryptError);
            toast({
              title: 'Decryption Warning',
              description: `Failed to decrypt item "${(next as any).name}". It may be corrupted.`,
              variant: 'destructive',
            });
          }
          // Yield back to event loop between items
          // eslint-disable-next-line no-await-in-loop
          await Promise.resolve();
        }
      };

      const queue = [...encryptedList];
      await Promise.all(Array.from({ length: concurrency }).map(() => worker(queue)));

      if (abortRef.aborted || latestDecryptAbortRef.current !== abortRef) return;

      startTransition(() => {
        setItems(results);
      });
    } catch (error) {
      console.error('Error fetching vault items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vault items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, isUnlocked, masterKey, toast]);

  // Add new vault item
  const addItem = useCallback(async (
    itemData: Omit<VaultItem, 'id' | 'created_at' | 'updated_at'>
  ): Promise<VaultItem | null> => {
    if (!user || !isUnlocked || !masterKey) return null;
    
    try {
      // Encrypt item data
      const encryptedData = await encryptVaultItem(itemData, masterKey, user.id);
      
      // Store encrypted item
      const { data, error } = await supabase
        .from('encrypted_vault_items')
        .insert({
          user_id: encryptedData.user_id,
          encrypted_data: encryptedData.encrypted_data,
          iv: encryptedData.iv,
          auth_tag: encryptedData.auth_tag,
          item_type: encryptedData.item_type,
          name: encryptedData.name,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Create the decrypted item for local state
      const newItem: VaultItem = {
        id: data.id,
        type: itemData.type,
        name: itemData.name,
        data: itemData.data,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      
      setItems(prev => [newItem, ...prev]);
      
      toast({
        title: "Success",
        description: "Vault item added successfully",
      });
      
      return newItem;
    } catch (error) {
      console.error('Error adding vault item:', error);
      toast({
        title: "Error",
        description: "Failed to add vault item",
        variant: "destructive",
      });
      return null;
    }
  }, [user, isUnlocked, masterKey, toast]);

  // Update existing vault item
  const updateItem = useCallback(async (
    id: string,
    updates: Partial<Omit<VaultItem, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> => {
    if (!user || !isUnlocked || !masterKey) return false;
    
    try {
      // Find the current item
      const currentItem = items.find(item => item.id === id);
      if (!currentItem) throw new Error('Item not found');
      
      // Merge updates with current item
      const updatedItem = {
        ...currentItem,
        ...updates,
        data: { ...currentItem.data, ...updates.data },
      };
      
      // Encrypt updated item data
      const encryptedData = await encryptVaultItem(
        {
          type: updatedItem.type,
          name: updatedItem.name,
          data: updatedItem.data,
        },
        masterKey,
        user.id
      );
      
      // Update encrypted item in database
      const { data, error } = await supabase
        .from('encrypted_vault_items')
        .update({
          encrypted_data: encryptedData.encrypted_data,
          iv: encryptedData.iv,
          auth_tag: encryptedData.auth_tag,
          item_type: encryptedData.item_type,
          name: encryptedData.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Update local state
      setItems(prev => prev.map(item => 
        item.id === id 
          ? { ...updatedItem, updated_at: data.updated_at }
          : item
      ));
      
      toast({
        title: "Success",
        description: "Vault item updated successfully",
      });
      
      return true;
    } catch (error) {
      console.error('Error updating vault item:', error);
      toast({
        title: "Error",
        description: "Failed to update vault item",
        variant: "destructive",
      });
      return false;
    }
  }, [user, isUnlocked, masterKey, items, toast]);

  // Delete vault item
  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !isUnlocked) return false;
    
    try {
      const { error } = await supabase
        .from('encrypted_vault_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setItems(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Success",
        description: "Vault item deleted successfully",
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting vault item:', error);
      toast({
        title: "Error",
        description: "Failed to delete vault item",
        variant: "destructive",
      });
      return false;
    }
  }, [user, isUnlocked, toast]);

  // Search through decrypted items
  const searchItems = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Export all vault data
  const exportVaultData = useCallback(async (): Promise<string | null> => {
    if (!user || !isUnlocked || !masterKey) return null;
    
    try {
      // Create export data structure
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        itemCount: items.length,
        items: items.map(item => ({
          type: item.type,
          name: item.name,
          data: item.data,
          created_at: item.created_at,
          updated_at: item.updated_at,
        })),
      };

      // Encrypt the export data
      const exportJson = JSON.stringify(exportData, null, 2);
      const { encryptedData, iv, authTag } = await encryptData(exportJson, masterKey);
      
      // Create encrypted export file
      const encryptedExport = {
        version: '1.0',
        encrypted: true,
        data: arrayBufferToBase64(encryptedData),
        iv: uint8ArrayToBase64(iv),
        authTag: uint8ArrayToBase64(authTag),
        timestamp: new Date().toISOString(),
      };

      return JSON.stringify(encryptedExport, null, 2);
    } catch (error) {
      console.error('Error exporting vault data:', error);
      toast({
        title: "Export Error",
        description: "Failed to export vault data",
        variant: "destructive",
      });
      return null;
    }
  }, [user, isUnlocked, masterKey, items, toast]);

  // Import vault data
  const importVaultData = useCallback(async (importData: string): Promise<boolean> => {
    if (!user || !isUnlocked || !masterKey) return false;
    
    try {
      const parsedImport = JSON.parse(importData);
      
      // Validate import file structure
      if (!parsedImport.version || !parsedImport.encrypted || !parsedImport.data) {
        throw new Error('Invalid import file format');
      }

      // Decrypt the import data
      const encryptedData = base64ToArrayBuffer(parsedImport.data);
      const iv = base64ToUint8Array(parsedImport.iv);
      const authTag = base64ToUint8Array(parsedImport.authTag);
      
      const decryptedJson = await decryptData(encryptedData, masterKey, iv, authTag);
      const vaultData = JSON.parse(decryptedJson);
      
      // Validate decrypted data structure
      if (!vaultData.items || !Array.isArray(vaultData.items)) {
        throw new Error('Invalid vault data structure');
      }

      // Import items one by one
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const itemData of vaultData.items) {
        try {
          // Validate item structure
          if (!itemData.type || !itemData.name || !itemData.data) {
            console.warn('Skipping invalid item:', itemData);
            errorCount++;
            continue;
          }

          // Check if item with same name and type already exists
          const existingItem = items.find(item => 
            item.name === itemData.name && item.type === itemData.type
          );
          
          if (existingItem) {
            skippedCount++;
            continue;
          }

          // Add the item
          await addItem({
            type: itemData.type,
            name: itemData.name,
            data: itemData.data,
          });
          
          importedCount++;
        } catch (itemError) {
          console.error('Error importing item:', itemData.name, itemError);
          errorCount++;
        }
      }

      // Provide detailed feedback
      let message = `Imported ${importedCount} items successfully.`;
      if (skippedCount > 0) {
        message += ` ${skippedCount} duplicates were skipped.`;
      }
      if (errorCount > 0) {
        message += ` ${errorCount} items had errors and were not imported.`;
      }

      toast({
        title: "Import Complete",
        description: message,
        variant: importedCount > 0 ? "default" : "destructive",
      });

      return true;
    } catch (error) {
      console.error('Error importing vault data:', error);
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Failed to import vault data",
        variant: "destructive",
      });
      return false;
    }
  }, [user, isUnlocked, masterKey, items, addItem, toast]);

  // Deferred search query keeps typing snappy for large lists
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredItems = items.filter(item => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return true;
    const searchableText = [
      item.name,
      item.data?.username,
      item.data?.url,
      item.data?.notes,
      item.data?.content,
    ].filter(Boolean).join(' ').toLowerCase();
    return searchableText.includes(q);
  });

  // Group items by type
  const itemsByType = {
    login: filteredItems.filter(item => item.type === 'login'),
    note: filteredItems.filter(item => item.type === 'note'),
    api: filteredItems.filter(item => item.type === 'api'),
    document: filteredItems.filter(item => item.type === 'document'),
  };

  // Fetch items when vault is unlocked
  useEffect(() => {
    if (isUnlocked && masterKey) {
      fetchItems();
    } else {
      setItems([]);
      setLoading(false);
    }
    return () => {
      if (latestDecryptAbortRef.current) {
        latestDecryptAbortRef.current.aborted = true;
      }
    };
  }, [isUnlocked, masterKey, fetchItems]);

  // Clear items when vault is locked
  useEffect(() => {
    if (!isUnlocked) {
      setItems([]);
      setSearchQuery('');
    }
  }, [isUnlocked]);

  return {
    // State
    items: filteredItems,
    itemsByType,
    loading,
    searchQuery,
    
    // Actions
    addItem,
    updateItem,
    deleteItem,
    searchItems,
    exportVaultData,
    importVaultData,
    refetch: fetchItems,
    
    // Computed
    totalItems: items.length,
    hasItems: items.length > 0,
  };
}
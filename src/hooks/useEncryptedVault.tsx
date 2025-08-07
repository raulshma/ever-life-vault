import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useVaultSession } from './useVaultSession';
import {
  VaultItem,
  EncryptedVaultItem,
  encryptVaultItem,
  decryptVaultItem,
} from '@/lib/crypto';

export function useEncryptedVault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { isUnlocked, masterKey } = useVaultSession();

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
      
      // Decrypt items client-side
      const decryptedItems: VaultItem[] = [];
      
      for (const encryptedItem of data || []) {
        try {
          const decryptedItem = await decryptVaultItem(encryptedItem, masterKey);
          decryptedItems.push(decryptedItem);
        } catch (decryptError) {
          console.error('Failed to decrypt item:', encryptedItem.id, decryptError);
          // Skip corrupted items but don't fail the entire operation
          toast({
            title: "Decryption Warning",
            description: `Failed to decrypt item "${encryptedItem.name}". It may be corrupted.`,
            variant: "destructive",
          });
        }
      }
      
      setItems(decryptedItems);
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
          name: encryptedData.metadata.name,
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
          name: encryptedData.metadata.name,
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

  // Filter items based on search query
  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const searchableText = [
      item.name,
      item.data.username,
      item.data.url,
      item.data.notes,
      item.data.content,
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchableText.includes(query);
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
    refetch: fetchItems,
    
    // Computed
    totalItems: items.length,
    hasItems: items.length > 0,
  };
}
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  location_id?: string;
  value?: number;
  purchase_date?: string;
  warranty_expires?: string;
  image_url?: string;
  has_qr_code: boolean;
  qr_code_data?: string;
  is_lent: boolean;
  lent_to?: string;
  lent_date?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Location {
  id: string;
  name: string;
  description?: string;
  icon: string;
  created_at: string;
  user_id: string;
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchItems = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory items",
        variant: "destructive",
      });
    }
  };

  const fetchLocations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: "Error",
        description: "Failed to fetch locations",
        variant: "destructive",
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchItems(), fetchLocations()]);
    setLoading(false);
  };

  const addItem = async (itemData: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          ...itemData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      setItems(prev => [data, ...prev]);
      
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error adding item:', error);
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    }
  };

  const addLocation = async (locationData: Omit<Location, 'id' | 'created_at' | 'user_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('locations')
        .insert({
          ...locationData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      setLocations(prev => [...prev, data]);
      
      toast({
        title: "Success",
        description: "Location added successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error adding location:', error);
      toast({
        title: "Error",
        description: "Failed to add location",
        variant: "destructive",
      });
    }
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setItems(prev => prev.map(item => item.id === id ? data : item));
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const getItemsByLocation = (locationId: string) => {
    return items.filter(item => item.location_id === locationId);
  };

  const getTotalValue = () => {
    return items.reduce((total, item) => total + (item.value || 0), 0);
  };

  const getItemsWithQR = () => {
    return items.filter(item => item.has_qr_code);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return {
    items,
    locations,
    loading,
    addItem,
    addLocation,
    updateItem,
    deleteItem,
    getItemsByLocation,
    getTotalValue,
    getItemsWithQR,
    refetch: fetchData
  };
}
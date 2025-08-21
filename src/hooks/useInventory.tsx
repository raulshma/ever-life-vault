import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  location_id?: string | null;
  value?: number | null;
  purchase_date?: string | null;
  warranty_expires?: string | null;
  image_url?: string | null;
  has_qr_code: boolean;
  qr_code_data?: string | null;
  is_lent: boolean;
  lent_to?: string | null;
  lent_date?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Location {
  id: string;
  name: string;
  description?: string | null;
  icon: string | null;
  created_at: string;
  user_id: string;
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchInventory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Optimized: Fetch both items and locations in parallel
      const [itemsResult, locationsResult] = await Promise.all([
        supabase
          .from('inventory_items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('locations')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (locationsResult.error) throw locationsResult.error;

      setItems(itemsResult.data || []);
      setLocations(locationsResult.data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

  const updateLocation = async (id: string, updates: Partial<Location>) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setLocations(prev => prev.map(loc => loc.id === id ? data : loc));
    } catch (error) {
      console.error('Error updating location:', error);
      toast({
        title: "Error",
        description: "Failed to update location",
        variant: "destructive",
      });
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLocations(prev => prev.filter(loc => loc.id !== id));
      
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: "Error",
        description: "Failed to delete location",
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
    fetchInventory();
  }, [user]);

  return {
    items,
    locations,
    loading,
    addItem,
    updateItem,
    deleteItem,
    addLocation,
    updateLocation,
    deleteLocation,
    getItemsByLocation,
    getTotalValue,
    getItemsWithQR,
    refetch: fetchInventory
  };
}
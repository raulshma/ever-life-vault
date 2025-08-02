import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface Credential {
  id: string;
  name: string;
  category: string;
  username?: string;
  encrypted_password?: string;
  url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function useCredentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCredentials = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        title: "Error",
        description: "Failed to fetch credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addCredential = async (credentialData: Omit<Credential, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('credentials')
        .insert({
          ...credentialData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      setCredentials(prev => [data, ...prev]);
      
      toast({
        title: "Success",
        description: "Credential added successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error adding credential:', error);
      toast({
        title: "Error",
        description: "Failed to add credential",
        variant: "destructive",
      });
    }
  };

  const updateCredential = async (id: string, updates: Partial<Credential>) => {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setCredentials(prev => prev.map(cred => cred.id === id ? data : cred));
    } catch (error) {
      console.error('Error updating credential:', error);
      toast({
        title: "Error",
        description: "Failed to update credential",
        variant: "destructive",
      });
    }
  };

  const deleteCredential = async (id: string) => {
    try {
      const { error } = await supabase
        .from('credentials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCredentials(prev => prev.filter(cred => cred.id !== id));
      
      toast({
        title: "Success",
        description: "Credential deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast({
        title: "Error",
        description: "Failed to delete credential",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, [user]);

  return {
    credentials,
    loading,
    addCredential,
    updateCredential,
    deleteCredential,
    refetch: fetchCredentials
  };
}
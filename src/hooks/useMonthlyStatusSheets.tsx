import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface MonthlyStatusEntry {
  id?: string;
  user_id: string;
  month_year: string;
  day_number: number;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useMonthlyStatusSheets = () => {
  const [data, setData] = useState<MonthlyStatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchData = async (monthYear: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { data: sheets, error } = await supabase
        .from('monthly_status_sheets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .order('day_number', { ascending: true });

      if (error) throw error;

      setData(sheets || []);
    } catch (error) {
      console.error('Error fetching monthly status sheets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch monthly status data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = async (dayNumber: number, monthYear: string, status?: string, notes?: string) => {
    if (!user) return;

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('monthly_status_sheets')
        .select('id')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .eq('day_number', dayNumber)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('monthly_status_sheets')
          .update({ status, notes })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new entry
        const { error } = await supabase
          .from('monthly_status_sheets')
          .insert({
            user_id: user.id,
            month_year: monthYear,
            day_number: dayNumber,
            status,
            notes
          });

        if (error) throw error;
      }

      // Refresh data
      await fetchData(monthYear);
    } catch (error) {
      console.error('Error updating monthly status entry:', error);
      toast({
        title: "Error",
        description: "Failed to update status entry",
        variant: "destructive",
      });
    }
  };

  return {
    data,
    loading,
    fetchData,
    updateEntry
  };
};
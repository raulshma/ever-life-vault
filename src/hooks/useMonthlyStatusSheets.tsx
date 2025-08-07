import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface MonthlyStatusEntry {
  id?: string;
  user_id: string;
  month_year: string;
  day_number: number;
  status?: string;
  notes?: string;
  custom_data?: Record<string, any>; // day-specific custom values object for this row? (we store per month per day)
  created_at?: string;
  updated_at?: string;
}

export const useMonthlyStatusSheets = () => {
  const [data, setData] = useState<MonthlyStatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const initializeWeekendHolidays = useCallback(
    async (monthYear: string, existingData: MonthlyStatusEntry[]) => {
      if (!user) return;

      try {
        const [year, month] = monthYear.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const weekendEntries: Omit<
          MonthlyStatusEntry,
          "id" | "created_at" | "updated_at"
        >[] = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month - 1, day);
          const dayOfWeek = currentDate.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6

          // Check if this day already has an entry
          const existingEntry = existingData.find(
            (entry) => entry.day_number === day
          );

          // If it's a weekend and no existing entry, add it as a holiday
          if (isWeekend && !existingEntry) {
            weekendEntries.push({
              user_id: user.id,
              month_year: monthYear,
              day_number: day,
              status: "Holiday",
              notes: "",
            });
          }
        }

        // Batch insert weekend holidays
        if (weekendEntries.length > 0) {
          const { error } = await supabase
            .from("monthly_status_sheets")
            .insert(weekendEntries);

          if (error) throw error;

          // Refresh data to include the new weekend entries
          const { data: updatedSheets, error: fetchError } = await supabase
            .from("monthly_status_sheets")
            .select("*")
            .eq("user_id", user.id)
            .eq("month_year", monthYear)
            .order("day_number", { ascending: true });

          if (fetchError) throw fetchError;
          setData((updatedSheets as unknown as MonthlyStatusEntry[]) || []);
        }
      } catch (error) {
        console.error("Error initializing weekend holidays:", error);
        // Don't show toast for this as it's a background operation
      }
    },
    [user]
  );

  const fetchData = useCallback(
    async (monthYear: string) => {
      if (!user) return;

      try {
        setLoading(true);
        const { data: sheets, error } = await supabase
          .from("monthly_status_sheets")
          .select("*")
          .eq("user_id", user.id)
          .eq("month_year", monthYear)
          .order("day_number", { ascending: true });

        if (error) throw error;

        setData((sheets as unknown as MonthlyStatusEntry[]) || []);

        // Auto-initialize weekend days as holidays if not already set
        await initializeWeekendHolidays(monthYear, (sheets as unknown as MonthlyStatusEntry[]) || []);
      } catch (error) {
        console.error("Error fetching monthly status sheets:", error);
        toast({
          title: "Error",
          description: "Failed to fetch monthly status data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [user, initializeWeekendHolidays]
  );

  const updateEntry = useCallback(
    async (
      dayNumber: number,
      monthYear: string,
      status?: string,
      notes?: string,
      customPatch?: Record<string, any>
    ) => {
      if (!user) return;

      try {
        const { data: existing, error: fetchError } = await supabase
          .from("monthly_status_sheets")
          .select("id")
          .eq("user_id", user.id)
          .eq("month_year", monthYear)
          .eq("day_number", dayNumber)
          .maybeSingle();

        if (fetchError) throw fetchError;

        let updatedEntry: MonthlyStatusEntry;

        if (existing) {
          // Update existing entry
          // Prepare update payload merging custom_data if provided
          let payload: any = { status, notes };
          if (customPatch) {
            // merge JSONB: custom_data = custom_data || jsonb_set(...)
            // Since we can't use expression builder easily here, fetch existing row to merge client-side
            const { data: currentRow } = await supabase.from("monthly_status_sheets").select("custom_data").eq("id", existing.id).single();
            const currentCustom = (currentRow?.custom_data ?? {}) as Record<string, any>;
            const nextCustom = { ...currentCustom, ...customPatch };
            payload.custom_data = nextCustom;
          }

          const { data: updated, error } = await supabase
            .from("monthly_status_sheets")
            .update(payload)
            .eq("id", existing.id)
            .select()
            .single();

          if (error) throw error;
          updatedEntry = (updated as unknown as MonthlyStatusEntry);
        } else {
          // Create new entry
          const insertPayload: any = {
            user_id: user.id,
            month_year: monthYear,
            day_number: dayNumber,
            status,
            notes,
          };
          if (customPatch) {
            insertPayload.custom_data = customPatch;
          }

          const { data: created, error } = await supabase
            .from("monthly_status_sheets")
            .insert(insertPayload)
            .select()
            .single();

          if (error) throw error;
          updatedEntry = (created as unknown as MonthlyStatusEntry);
        }

        // Update local state without full refresh
        setData((prevData) => {
          const existingIndex = prevData.findIndex(
            (entry) => entry.day_number === dayNumber
          );
          if (existingIndex >= 0) {
            // Update existing entry
            const newData = [...prevData];
            newData[existingIndex] = updatedEntry;
            return newData;
          } else {
            // Add new entry and sort by day_number
            return [...prevData, updatedEntry].sort(
              (a, b) => a.day_number - b.day_number
            );
          }
        });
      } catch (error) {
        console.error("Error updating monthly status entry:", error);
        toast({
          title: "Error",
          description: "Failed to update status entry",
          variant: "destructive",
        });
      }
    },
    [user]
  );

  // Update a single custom value for a day
  const updateCustomValue = useCallback(
    async (dayNumber: number, monthYear: string, key: string, value: any) => {
      await updateEntry(dayNumber, monthYear, undefined, undefined, { [key]: value });
    },
    [updateEntry]
  );

  return {
    data,
    loading,
    fetchData,
    updateEntry,
    updateCustomValue,
  };
};

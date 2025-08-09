import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type FocusMode =
  | 'pomodoro_25_5'
  | 'pomodoro_30_5'
  | 'pomodoro_45_15'
  | 'pomodoro_50_10'
  | 'pomodoro_60_15'
  | 'fiftytwo_17'
  | 'flow_90'
  | 'flow_120_15'
  | 'ultradian_90_20'
  | 'custom'
  | 'break';

export interface FocusProfile {
  id: string;
  name: string;
  bpm: number;
  accentEvery: number;
  subdivisions: number;
}

export interface FocusSessionRow {
  id: string;
  user_id: string;
  task_id: string | null;
  mode: string;
  profile: string | null;
  bpm: number;
  accent_every: number;
  subdivisions: number;
  is_break: boolean;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export function useFocusSessions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<FocusSessionRow[]>([]);

  const fetchRecent = async (limit = 50) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setSessions(data || []);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (params: {
    taskId?: string | null;
    mode: FocusMode;
    profile?: string | null;
    bpm: number;
    accentEvery: number;
    subdivisions: number;
    isBreak?: boolean;
    startedAt?: string;
    notes?: string | null;
  }) => {
    if (!user) return null;
    const payload = {
      user_id: user.id,
      task_id: params.taskId ?? null,
      mode: params.mode,
      profile: params.profile ?? null,
      bpm: params.bpm,
      accent_every: params.accentEvery,
      subdivisions: params.subdivisions,
      is_break: !!params.isBreak,
      started_at: params.startedAt ?? new Date().toISOString(),
      notes: params.notes ?? null,
    };
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    setSessions(prev => [data as FocusSessionRow, ...prev]);
    return data as FocusSessionRow;
  };

  const endSession = async (id: string, endedAt?: string) => {
    const { data, error } = await supabase
      .from('focus_sessions')
      .update({ ended_at: endedAt ?? new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    setSessions(prev => prev.map(s => (s.id === id ? (data as FocusSessionRow) : s)));
    return data as FocusSessionRow;
  };

  const totalFocusTodayMinutes = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round(
      sessions
        .filter(s => !s.is_break && new Date(s.started_at) >= startOfDay && s.duration_seconds)
        .reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 60
    );
  }, [sessions]);

  useEffect(() => {
    fetchRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { sessions, loading, fetchRecent, startSession, endSession, totalFocusTodayMinutes };
}



-- Focus sessions to track timer work and breaks, linked to tasks
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NULL REFERENCES public.tasks(id) ON DELETE SET NULL,
  mode TEXT NOT NULL, -- e.g., pomodoro, custom, flow90, break
  profile TEXT NULL,  -- e.g., Deep Work, Review
  bpm INTEGER NOT NULL DEFAULT 20,
  accent_every INTEGER NOT NULL DEFAULT 4,
  subdivisions INTEGER NOT NULL DEFAULT 1,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NULL THEN NULL ELSE GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at))::int) END
  ) STORED,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started_at
  ON public.focus_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task
  ON public.focus_sessions(task_id);

-- Enable RLS
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "select_own_focus_sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "insert_own_focus_sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "update_own_focus_sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "delete_own_focus_sessions" ON public.focus_sessions;

CREATE POLICY "select_own_focus_sessions" ON public.focus_sessions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "insert_own_focus_sessions" ON public.focus_sessions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "update_own_focus_sessions" ON public.focus_sessions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "delete_own_focus_sessions" ON public.focus_sessions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.focus_sessions IS 'Per-user focus timer sessions with optional task link and metronome settings';


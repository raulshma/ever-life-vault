-- Harden vault_sessions RLS
-- Ensure users can only see/manage their sessions; block expired rows; enforce future expiry

-- Preconditions
ALTER TABLE public.vault_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing broad policy if present
DROP POLICY IF EXISTS "Users can manage their own vault sessions" ON public.vault_sessions;

-- Create composite index for queries by user and expiry
-- Note: Partial indexes cannot use NOW()/CURRENT_TIMESTAMP predicates (not IMMUTABLE)
-- so we use a regular index instead. The planner can still leverage it with a WHERE expires_at > now().
CREATE INDEX IF NOT EXISTS idx_vault_sessions_user_expires_at
  ON public.vault_sessions(user_id, expires_at);

-- Restrict SELECT to own, unexpired sessions only
CREATE POLICY "select_own_unexpired_vault_sessions" ON public.vault_sessions
  FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id AND expires_at > timezone('UTC'::text, CURRENT_TIMESTAMP)
  );

-- Restrict INSERT to own user_id and require expires_at in the future
CREATE POLICY "insert_own_vault_sessions_future_expiry" ON public.vault_sessions
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id AND expires_at > timezone('UTC'::text, CURRENT_TIMESTAMP)
  );

-- Restrict UPDATE to own rows and maintain future expiry
CREATE POLICY "update_own_vault_sessions_future_expiry" ON public.vault_sessions
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id AND expires_at > timezone('UTC'::text, CURRENT_TIMESTAMP)
  );

-- Restrict DELETE to own rows
CREATE POLICY "delete_own_vault_sessions" ON public.vault_sessions
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
  );

-- Optional: Prevent extensions from bypassing RLS with SECURITY DEFINER fns; keep cleanup function as-is
COMMENT ON TABLE public.vault_sessions IS 'RLS: select/update/insert/delete restricted to owner; expired sessions effectively invisible; future expiry enforced.'; 
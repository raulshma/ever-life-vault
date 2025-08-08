-- Security hardening migration (RLS improvements & cleanup)
-- Date: 2025-08-08
-- Summary:
-- 1. Add WITH CHECK clauses to UPDATE policies to prevent changing user_id to another user's id
-- 2. Drop legacy credentials table (reintroduced earlier but superseded by encrypted_vault_items)
-- 3. Add missing foreign key on monthly_status_sheets.user_id to auth.users for referential integrity
-- 4. Recreate affected policies idempotently

-- =============================================================
-- 1. DROP legacy credentials table if no longer used
--    (IMPORTANT: If you still need this table, comment out the DROP below
--     BEFORE applying. Application code currently uses encrypted_vault_items.)
-- =============================================================
DO $$
BEGIN
  IF to_regclass('public.credentials') IS NOT NULL THEN
    DROP TABLE public.credentials CASCADE;
  END IF;
END;$$;

-- =============================================================
-- 2. Add missing FK on monthly_status_sheets.user_id (if not already present)
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.monthly_status_sheets'::regclass
      AND conname = 'monthly_status_sheets_user_id_fkey'
  ) THEN
    ALTER TABLE public.monthly_status_sheets
      ADD CONSTRAINT monthly_status_sheets_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;$$;

-- =============================================================
-- 3. RLS policy hardening: ensure UPDATE cannot reassign user_id
--    Strategy: drop existing UPDATE policies & recreate with WITH CHECK
-- =============================================================

-- Explicitly drop & recreate UPDATE policies with WITH CHECK (more reliable than dynamic proc)
-- profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- tasks
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notes
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- documents
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- locations
DROP POLICY IF EXISTS "Users can update their own locations" ON public.locations;
CREATE POLICY "Users can update their own locations" ON public.locations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- inventory_items
DROP POLICY IF EXISTS "Users can update their own inventory items" ON public.inventory_items;
CREATE POLICY "Users can update their own inventory items" ON public.inventory_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- vault_config
DROP POLICY IF EXISTS "Users can update their own vault config" ON public.vault_config;
CREATE POLICY "Users can update their own vault config" ON public.vault_config
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- encrypted_vault_items
DROP POLICY IF EXISTS "Users can update their own vault items" ON public.encrypted_vault_items;
CREATE POLICY "Users can update their own vault items" ON public.encrypted_vault_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- monthly_status_sheets
DROP POLICY IF EXISTS "Users can update their own monthly status sheets" ON public.monthly_status_sheets;
CREATE POLICY "Users can update their own monthly status sheets" ON public.monthly_status_sheets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- 4. (Optional future step) Consider adding a domain or check to ensure user_id
--    never changes via application logic, but WITH CHECK already prevents cross-user reassignment.
-- =============================================================

COMMENT ON SCHEMA public IS 'RLS hardened on 2025-08-08: update policies now enforce WITH CHECK user ownership; legacy credentials removed.';

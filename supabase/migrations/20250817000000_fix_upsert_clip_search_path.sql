-- Fix upsert_clip function search path and enable leaked password protection
-- Migration: 20250817000000_fix_upsert_clip_search_path.sql

-- =============================================================
-- 1. Fix upsert_clip function with proper search_path
-- =============================================================

-- Drop the old function signatures first
DROP FUNCTION IF EXISTS public.upsert_clip(text, text, timestamptz, text, text, text);
DROP FUNCTION IF EXISTS public.upsert_clip(text, text, timestamptz, text, text, text, boolean);

-- Create the complete upsert_clip function with proper search_path
-- This function supports both the old 6-parameter and new 7-parameter calls
CREATE OR REPLACE FUNCTION public.upsert_clip(
  _id text,
  _content text,
  _expires_at timestamptz DEFAULT NULL,
  _proof text DEFAULT NULL,
  _set_password_proof text DEFAULT NULL,
  _set_password_salt text DEFAULT NULL,
  _one_time_view boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing record;
BEGIN
  SELECT * INTO existing FROM public.clips WHERE id = _id LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.clips (id, content, created_by, expires_at, password_proof, password_salt, one_time_view)
    VALUES (_id, _content, (SELECT auth.uid()), _expires_at, _set_password_proof, _set_password_salt, _one_time_view);
    RETURN true;
  END IF;

  -- Gate updates when password is set
  IF existing.password_proof IS NOT NULL THEN
    IF _proof IS NULL OR _proof <> existing.password_proof THEN
      RETURN false;
    END IF;
  END IF;

  -- Don't allow changing one_time_view after creation
  UPDATE public.clips
  SET content = _content,
      expires_at = _expires_at,
      password_proof = COALESCE(_set_password_proof, existing.password_proof),
      password_salt = COALESCE(_set_password_salt, existing.password_salt),
      updated_at = NOW()
  WHERE id = _id;
  RETURN true;
END;
$$;

-- Create an overloaded function for backward compatibility (6 parameters)
-- This allows existing code to work without modification
CREATE OR REPLACE FUNCTION public.upsert_clip(
  _id text,
  _content text,
  _expires_at timestamptz DEFAULT NULL,
  _proof text DEFAULT NULL,
  _set_password_proof text DEFAULT NULL,
  _set_password_salt text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the 7-parameter version with default one_time_view = false
  RETURN public.upsert_clip(_id, _content, _expires_at, _proof, _set_password_proof, _set_password_salt, false);
END;
$$;

-- Grant execute permissions on both function signatures
GRANT EXECUTE ON FUNCTION public.upsert_clip(text, text, timestamptz, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_clip(text, text, timestamptz, text, text, text, boolean) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.upsert_clip(text, text, timestamptz, text, text, text) IS 'Create or update clip with explicit search_path for security (backward compatibility)';
COMMENT ON FUNCTION public.upsert_clip(text, text, timestamptz, text, text, text, boolean) IS 'Create or update clip with explicit search_path for security and one-time view support';

-- =============================================================
-- 2. Enable leaked password protection in Supabase Auth
-- =============================================================

-- Note: This requires manual configuration in the Supabase dashboard
-- Go to Authentication > Settings > Password Security
-- Enable "Check against leaked passwords"
-- This will check passwords against HaveIBeenPwned.org

-- Add a comment to remind about manual configuration
COMMENT ON SCHEMA public IS 'Security update 2025-08-17: upsert_clip function now has explicit search_path. Manual action required: Enable leaked password protection in Supabase Auth dashboard.';

-- =============================================================
-- 3. Verify all functions have proper search_path
-- =============================================================

-- Double-check that all security definer functions have search_path set
DO $$
DECLARE
  func_record RECORD;
  missing_search_path TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR func_record IN 
    SELECT 
      p.proname as function_name,
      p.pronargs as arg_count,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- security definer functions
      AND p.proname NOT LIKE 'clips_set_updated_at'  -- exclude trigger functions
  LOOP
    -- Check if function has search_path set
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p2
      JOIN pg_namespace n2 ON p2.pronamespace = n2.oid
      WHERE n2.nspname = 'public'
        AND p2.proname = func_record.function_name
        AND p2.pronargs = func_record.arg_count
        AND p2.proconfig @> ARRAY['search_path=public']
    ) THEN
      missing_search_path := array_append(missing_search_path, 
        func_record.function_name || '(' || func_record.args || ')');
    END IF;
  END LOOP;
  
  IF array_length(missing_search_path, 1) > 0 THEN
    RAISE NOTICE 'Functions missing search_path: %', array_to_string(missing_search_path, ', ');
  ELSE
    RAISE NOTICE 'All security definer functions have proper search_path set';
  END IF;
END $$;

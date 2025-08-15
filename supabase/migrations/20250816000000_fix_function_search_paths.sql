-- Fix function search path mutability warnings
-- Date: 2025-08-16
-- Summary: Add explicit search_path parameters to all functions to prevent security warnings
-- This addresses the Supabase linter warnings about function_search_path_mutable

-- =============================================================
-- 1. Fix infrastructure functions
-- =============================================================

-- Fix store_infrastructure_secret function
CREATE OR REPLACE FUNCTION public.store_infrastructure_secret(
  _key TEXT,
  _encrypted_value TEXT,
  _iv TEXT,
  _auth_tag TEXT,
  _salt TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Insert or update the secret
  INSERT INTO public.infrastructure_secrets (user_id, key, encrypted_value, iv, auth_tag, salt)
  VALUES ((SELECT auth.uid()), _key, _encrypted_value, _iv, _auth_tag, _salt)
  ON CONFLICT (user_id, key) 
  DO UPDATE SET 
    encrypted_value = EXCLUDED.encrypted_value,
    iv = EXCLUDED.iv,
    auth_tag = EXCLUDED.auth_tag,
    salt = EXCLUDED.salt,
    updated_at = NOW()
  RETURNING id INTO secret_id;
  
  RETURN secret_id;
END;
$$;

-- Fix get_infrastructure_secret function
CREATE OR REPLACE FUNCTION public.get_infrastructure_secret(_key TEXT)
RETURNS TABLE (
  id UUID,
  key TEXT,
  encrypted_value TEXT,
  iv TEXT,
  auth_tag TEXT,
  salt TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.key, s.encrypted_value, s.iv, s.auth_tag, s.salt, s.created_at, s.updated_at
  FROM public.infrastructure_secrets s
  WHERE s.user_id = (SELECT auth.uid()) AND s.key = _key
  LIMIT 1;
$$;

-- Fix list_infrastructure_secret_keys function
CREATE OR REPLACE FUNCTION public.list_infrastructure_secret_keys()
RETURNS TABLE (
  id UUID,
  key TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.key, s.created_at, s.updated_at
  FROM public.infrastructure_secrets s
  WHERE s.user_id = (SELECT auth.uid())
  ORDER BY s.key;
$$;

-- Fix delete_infrastructure_secret function
CREATE OR REPLACE FUNCTION public.delete_infrastructure_secret(_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.infrastructure_secrets
  WHERE user_id = (SELECT auth.uid()) AND key = _key;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- Fix store_docker_compose_config function
CREATE OR REPLACE FUNCTION public.store_docker_compose_config(
  _name TEXT,
  _description TEXT,
  _compose_content TEXT,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_id UUID;
BEGIN
  -- Insert or update the configuration
  INSERT INTO public.docker_compose_configs (user_id, name, description, compose_content, metadata)
  VALUES ((SELECT auth.uid()), _name, _description, _compose_content, _metadata)
  ON CONFLICT (user_id, name) 
  DO UPDATE SET 
    description = EXCLUDED.description,
    compose_content = EXCLUDED.compose_content,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO config_id;
  
  RETURN config_id;
END;
$$;

-- Fix get_docker_compose_config function
CREATE OR REPLACE FUNCTION public.get_docker_compose_config(_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  compose_content TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, c.compose_content, c.metadata, c.created_at, c.updated_at
  FROM public.docker_compose_configs c
  WHERE c.user_id = (SELECT auth.uid()) AND c.name = _name
  LIMIT 1;
$$;

-- Fix list_docker_compose_configs function
CREATE OR REPLACE FUNCTION public.list_docker_compose_configs()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, c.metadata, c.created_at, c.updated_at
  FROM public.docker_compose_configs c
  WHERE c.user_id = (SELECT auth.uid())
  ORDER BY c.name;
$$;

-- Fix delete_docker_compose_config function
CREATE OR REPLACE FUNCTION public.delete_docker_compose_config(_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.docker_compose_configs
  WHERE user_id = (SELECT auth.uid()) AND name = _name;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- =============================================================
-- 2. Fix clips functions
-- =============================================================

-- Fix clips_set_updated_at function
CREATE OR REPLACE FUNCTION public.clips_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Fix get_clip function
CREATE OR REPLACE FUNCTION public.get_clip(_id text, _proof text DEFAULT NULL)
RETURNS TABLE (
  id text,
  content text,
  expires_at timestamptz,
  updated_at timestamptz,
  has_password boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.content, c.expires_at, c.updated_at, (c.password_proof IS NOT NULL) AS has_password
  FROM public.clips c
  WHERE c.id = _id
    AND (c.expires_at IS NULL OR NOW() <= c.expires_at)
    AND (c.password_proof IS NULL OR c.password_proof = _proof)
  LIMIT 1;
$$;

-- Fix get_clip_meta function
CREATE OR REPLACE FUNCTION public.get_clip_meta(_id text)
RETURNS TABLE (
  clip_exists boolean,
  has_password boolean,
  expires_at timestamptz,
  updated_at timestamptz,
  password_salt text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.clips WHERE id = _id AND (expires_at IS NULL OR NOW() <= expires_at)) AS clip_exists,
    COALESCE((SELECT password_proof IS NOT NULL FROM public.clips WHERE id = _id LIMIT 1), false) AS has_password,
    (SELECT expires_at FROM public.clips WHERE id = _id LIMIT 1) AS expires_at,
    (SELECT updated_at FROM public.clips WHERE id = _id LIMIT 1) AS updated_at,
    (SELECT password_salt FROM public.clips WHERE id = _id LIMIT 1) AS password_salt;
$$;

-- Fix upsert_clip function
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
DECLARE
  existing record;
BEGIN
  SELECT * INTO existing FROM public.clips WHERE id = _id LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.clips (id, content, created_by, expires_at, password_proof, password_salt)
    VALUES (_id, _content, (SELECT auth.uid()), _expires_at, _set_password_proof, _set_password_salt);
    RETURN true;
  END IF;

  -- Gate updates when password is set
  IF existing.password_proof IS NOT NULL THEN
    IF _proof IS NULL OR _proof <> existing.password_proof THEN
      RETURN false;
    END IF;
  END IF;

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

-- =============================================================
-- 3. Fix live share functions
-- =============================================================

-- Fix set_live_share_created_by function
CREATE OR REPLACE FUNCTION public.set_live_share_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Fix verify_live_share_access function
CREATE OR REPLACE FUNCTION public.verify_live_share_access(_id text, _proof text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (password_proof IS NOT NULL AND password_proof = _proof)
                   FROM public.live_share_rooms
                   WHERE id = _id), false);
$$;

-- =============================================================
-- 4. Fix vault sessions function
-- =============================================================

-- Fix cleanup_expired_vault_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_vault_sessions()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.vault_sessions WHERE expires_at < NOW();
END;
$$;

-- =============================================================
-- 5. Fix custom data function
-- =============================================================

-- Fix enforce_custom_data_object function
CREATE OR REPLACE FUNCTION public.enforce_custom_data_object()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(NEW.custom_data) IS DISTINCT FROM 'object' THEN
    NEW.custom_data := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================
-- 6. Fix one-time clips function
-- =============================================================

-- Fix get_clip_one_time function
CREATE OR REPLACE FUNCTION public.get_clip_one_time(_id text, _proof text DEFAULT NULL)
RETURNS TABLE (
  id text,
  content text,
  expires_at timestamptz,
  updated_at timestamptz,
  has_password boolean,
  one_time_view boolean,
  view_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH clip_data AS (
    SELECT c.*
    FROM public.clips c
    WHERE c.id = _id
      AND (c.expires_at IS NULL OR NOW() <= c.expires_at)
      AND (c.password_proof IS NULL OR c.password_proof = _proof)
    LIMIT 1
  ),
  updated_clip AS (
    UPDATE public.clips 
    SET view_count = view_count + 1
    WHERE id = _id 
      AND one_time_view = true 
      AND view_count = 0
  ),
  deleted_clip AS (
    DELETE FROM public.clips 
    WHERE id = _id 
      AND one_time_view = true 
      AND view_count > 0
  )
  SELECT 
    c.id,
    c.content,
    c.expires_at,
    c.updated_at,
    (c.password_proof IS NOT NULL) AS has_password,
    c.one_time_view,
    c.view_count
  FROM clip_data c;
$$;

-- =============================================================
-- 7. Re-grant permissions to ensure they're still valid
-- =============================================================

-- Re-grant execute permissions on infrastructure functions
GRANT EXECUTE ON FUNCTION public.store_infrastructure_secret(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_infrastructure_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_infrastructure_secret_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_infrastructure_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_docker_compose_config(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_docker_compose_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_docker_compose_configs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_docker_compose_config(TEXT) TO authenticated;

-- Re-grant execute permissions on clips functions
GRANT EXECUTE ON FUNCTION public.get_clip(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_clip_meta(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_clip(text, text, timestamptz, text, text, text) TO anon, authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.store_infrastructure_secret(TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Store encrypted infrastructure secret with explicit search_path for security';
COMMENT ON FUNCTION public.get_infrastructure_secret(TEXT) IS 'Retrieve encrypted infrastructure secret with explicit search_path for security';
COMMENT ON FUNCTION public.list_infrastructure_secret_keys() IS 'List infrastructure secret keys with explicit search_path for security';
COMMENT ON FUNCTION public.delete_infrastructure_secret(TEXT) IS 'Delete infrastructure secret with explicit search_path for security';
COMMENT ON FUNCTION public.store_docker_compose_config(TEXT, TEXT, TEXT, JSONB) IS 'Store Docker Compose config with explicit search_path for security';
COMMENT ON FUNCTION public.get_docker_compose_config(TEXT) IS 'Get Docker Compose config with explicit search_path for security';
COMMENT ON FUNCTION public.list_docker_compose_configs() IS 'List Docker Compose configs with explicit search_path for security';
COMMENT ON FUNCTION public.delete_docker_compose_config(TEXT) IS 'Delete Docker Compose config with explicit search_path for security';
COMMENT ON FUNCTION public.clips_set_updated_at() IS 'Trigger function to update clips timestamp with explicit search_path for security';
COMMENT ON FUNCTION public.get_clip(text, text) IS 'Get clip content with explicit search_path for security';
COMMENT ON FUNCTION public.get_clip_meta(text) IS 'Get clip metadata with explicit search_path for security';
COMMENT ON FUNCTION public.upsert_clip(text, text, timestamptz, text, text, text) IS 'Create or update clip with explicit search_path for security';
COMMENT ON FUNCTION public.cleanup_expired_vault_sessions() IS 'Clean up expired vault sessions with explicit search_path for security';
COMMENT ON FUNCTION public.enforce_custom_data_object() IS 'Enforce custom data object structure with explicit search_path for security';

COMMENT ON SCHEMA public IS 'Function search paths fixed on 2025-08-16: all functions now have explicit search_path parameters for security.';

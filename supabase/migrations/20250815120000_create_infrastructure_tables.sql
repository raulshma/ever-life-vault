-- Homelab Infrastructure Manager Database Schema
-- Creates tables for Docker Compose configurations and encrypted secrets management

-- Create docker_compose_configs table for storing Docker Compose configurations
CREATE TABLE public.docker_compose_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  compose_content TEXT NOT NULL, -- The actual docker-compose.yml content
  metadata JSONB DEFAULT '{}', -- Structured metadata about services, volumes, networks
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure unique names per user
  CONSTRAINT unique_config_name_per_user UNIQUE (user_id, name)
);

-- Create infrastructure_secrets table for encrypted secrets management
CREATE TABLE public.infrastructure_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  key TEXT NOT NULL, -- The secret key/name (unencrypted for reference)
  encrypted_value TEXT NOT NULL, -- Base64 encoded AES-256-GCM encrypted secret value
  iv TEXT NOT NULL, -- Base64 encoded initialization vector (12 bytes)
  auth_tag TEXT NOT NULL, -- Base64 encoded authentication tag (16 bytes)
  salt TEXT NOT NULL, -- Base64 encoded salt for key derivation (32 bytes)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure unique secret keys per user
  CONSTRAINT unique_secret_key_per_user UNIQUE (user_id, key)
);

-- Enable Row Level Security
ALTER TABLE public.docker_compose_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructure_secrets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for docker_compose_configs
CREATE POLICY "Users can view their own Docker Compose configurations" ON public.docker_compose_configs
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own Docker Compose configurations" ON public.docker_compose_configs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own Docker Compose configurations" ON public.docker_compose_configs
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own Docker Compose configurations" ON public.docker_compose_configs
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Create RLS policies for infrastructure_secrets
CREATE POLICY "Users can view their own infrastructure secrets" ON public.infrastructure_secrets
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own infrastructure secrets" ON public.infrastructure_secrets
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own infrastructure secrets" ON public.infrastructure_secrets
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own infrastructure secrets" ON public.infrastructure_secrets
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_docker_compose_configs_updated_at
  BEFORE UPDATE ON public.docker_compose_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_infrastructure_secrets_updated_at
  BEFORE UPDATE ON public.infrastructure_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_docker_compose_configs_user_id ON public.docker_compose_configs(user_id);
CREATE INDEX idx_docker_compose_configs_name ON public.docker_compose_configs(name);
CREATE INDEX idx_infrastructure_secrets_user_id ON public.infrastructure_secrets(user_id);
CREATE INDEX idx_infrastructure_secrets_key ON public.infrastructure_secrets(key);

-- Database functions for secret encryption/decryption operations
-- Note: These functions handle the database operations, actual encryption/decryption 
-- is performed in the application layer for security reasons

-- Function to store an encrypted secret
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

-- Function to retrieve an encrypted secret
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
AS $$
  SELECT s.id, s.key, s.encrypted_value, s.iv, s.auth_tag, s.salt, s.created_at, s.updated_at
  FROM public.infrastructure_secrets s
  WHERE s.user_id = (SELECT auth.uid()) AND s.key = _key
  LIMIT 1;
$$;

-- Function to list all secret keys for a user (without values)
CREATE OR REPLACE FUNCTION public.list_infrastructure_secret_keys()
RETURNS TABLE (
  id UUID,
  key TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT s.id, s.key, s.created_at, s.updated_at
  FROM public.infrastructure_secrets s
  WHERE s.user_id = (SELECT auth.uid())
  ORDER BY s.key;
$$;

-- Function to delete a secret
CREATE OR REPLACE FUNCTION public.delete_infrastructure_secret(_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to store or update a Docker Compose configuration
CREATE OR REPLACE FUNCTION public.store_docker_compose_config(
  _name TEXT,
  _description TEXT,
  _compose_content TEXT,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get a Docker Compose configuration
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
AS $$
  SELECT c.id, c.name, c.description, c.compose_content, c.metadata, c.created_at, c.updated_at
  FROM public.docker_compose_configs c
  WHERE c.user_id = (SELECT auth.uid()) AND c.name = _name
  LIMIT 1;
$$;

-- Function to list all Docker Compose configurations for a user
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
AS $$
  SELECT c.id, c.name, c.description, c.metadata, c.created_at, c.updated_at
  FROM public.docker_compose_configs c
  WHERE c.user_id = (SELECT auth.uid())
  ORDER BY c.name;
$$;

-- Function to delete a Docker Compose configuration
CREATE OR REPLACE FUNCTION public.delete_docker_compose_config(_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.store_infrastructure_secret(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_infrastructure_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_infrastructure_secret_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_infrastructure_secret(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_docker_compose_config(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_docker_compose_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_docker_compose_configs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_docker_compose_config(TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.docker_compose_configs IS 'Stores Docker Compose configurations for homelab infrastructure management';
COMMENT ON TABLE public.infrastructure_secrets IS 'Stores encrypted secrets for Docker Compose configurations using AES-256-GCM';

COMMENT ON COLUMN public.docker_compose_configs.compose_content IS 'The actual docker-compose.yml file content with secret placeholders';
COMMENT ON COLUMN public.docker_compose_configs.metadata IS 'Structured metadata about services, volumes, networks extracted from compose file';

COMMENT ON COLUMN public.infrastructure_secrets.key IS 'The secret key/name (unencrypted for reference and searching)';
COMMENT ON COLUMN public.infrastructure_secrets.encrypted_value IS 'Base64 encoded AES-256-GCM encrypted secret value';
COMMENT ON COLUMN public.infrastructure_secrets.iv IS 'Base64 encoded initialization vector (12 bytes for GCM)';
COMMENT ON COLUMN public.infrastructure_secrets.auth_tag IS 'Base64 encoded authentication tag (16 bytes for GCM)';
COMMENT ON COLUMN public.infrastructure_secrets.salt IS 'Base64 encoded salt for key derivation (32 bytes)';
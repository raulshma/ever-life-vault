-- Replace old credentials system with new encrypted vault
-- This migration removes the old credentials table and replaces it with the encrypted vault system

-- Drop the old credentials table and related objects
DROP TABLE IF EXISTS public.credentials CASCADE;

-- Create vault_config table for storing user vault configuration
CREATE TABLE public.vault_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  salt TEXT NOT NULL, -- Base64 encoded salt for PBKDF2 key derivation
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create encrypted_vault_items table for storing encrypted vault data
CREATE TABLE public.encrypted_vault_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL, -- Base64 encoded AES-256-GCM encrypted JSON data
  iv TEXT NOT NULL, -- Base64 encoded initialization vector (12 bytes)
  auth_tag TEXT NOT NULL, -- Base64 encoded authentication tag (16 bytes)
  item_type TEXT NOT NULL CHECK (item_type IN ('login', 'note', 'api', 'document')),
  name TEXT NOT NULL, -- Unencrypted name for search/display purposes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.vault_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_vault_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vault_config
CREATE POLICY "Users can view their own vault config" ON public.vault_config
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own vault config" ON public.vault_config
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own vault config" ON public.vault_config
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own vault config" ON public.vault_config
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Create RLS policies for encrypted_vault_items
CREATE POLICY "Users can view their own vault items" ON public.encrypted_vault_items
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own vault items" ON public.encrypted_vault_items
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own vault items" ON public.encrypted_vault_items
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own vault items" ON public.encrypted_vault_items
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_vault_config_updated_at
  BEFORE UPDATE ON public.vault_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_encrypted_vault_items_updated_at
  BEFORE UPDATE ON public.encrypted_vault_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_vault_config_user_id ON public.vault_config(user_id);
CREATE INDEX idx_encrypted_vault_items_user_id ON public.encrypted_vault_items(user_id);
CREATE INDEX idx_encrypted_vault_items_type ON public.encrypted_vault_items(item_type);
CREATE INDEX idx_encrypted_vault_items_name ON public.encrypted_vault_items(name);

-- Add comments for documentation
COMMENT ON TABLE public.vault_config IS 'Stores vault configuration including salt for PBKDF2 key derivation';
COMMENT ON TABLE public.encrypted_vault_items IS 'Stores end-to-end encrypted vault items using AES-256-GCM';
COMMENT ON COLUMN public.vault_config.salt IS 'Base64 encoded salt for PBKDF2 key derivation (32 bytes)';
COMMENT ON COLUMN public.encrypted_vault_items.encrypted_data IS 'Base64 encoded AES-256-GCM encrypted JSON data';
COMMENT ON COLUMN public.encrypted_vault_items.iv IS 'Base64 encoded initialization vector (12 bytes for GCM)';
COMMENT ON COLUMN public.encrypted_vault_items.auth_tag IS 'Base64 encoded authentication tag (16 bytes for GCM)';
COMMENT ON COLUMN public.encrypted_vault_items.name IS 'Unencrypted item name for search and display purposes';
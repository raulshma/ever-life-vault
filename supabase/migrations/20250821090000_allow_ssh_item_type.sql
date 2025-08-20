-- Migration: Allow 'ssh' as an item_type for encrypted_vault_items
-- Adds 'ssh' to the check constraint that limits allowed values for item_type

BEGIN;

-- Drop the old constraint if it exists
ALTER TABLE IF EXISTS public.encrypted_vault_items
  DROP CONSTRAINT IF EXISTS encrypted_vault_items_item_type_check;

-- Add new constraint that includes 'ssh'
ALTER TABLE IF EXISTS public.encrypted_vault_items
  ADD CONSTRAINT encrypted_vault_items_item_type_check CHECK ((item_type = ANY (ARRAY['login'::text, 'note'::text, 'api'::text, 'document'::text, 'ssh'::text])));

COMMIT;

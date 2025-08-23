-- Migration: Create system settings table for dynamic application configuration
-- This table stores user-configurable application settings organized by feature

-- Drop existing constraints and table if they exist
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- Create the main system settings table
CREATE TABLE public.system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature_category TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique settings per user per feature/key combination
  UNIQUE(user_id, feature_category, setting_key)
);

-- Add table and column comments for documentation
COMMENT ON TABLE public.system_settings IS 'Stores user-configurable application settings organized by feature category';
COMMENT ON COLUMN public.system_settings.id IS 'Unique identifier for the setting record';
COMMENT ON COLUMN public.system_settings.user_id IS 'User who owns this setting';
COMMENT ON COLUMN public.system_settings.feature_category IS 'Feature category (e.g., "receipt_ai", "dashboard", "notifications")';
COMMENT ON COLUMN public.system_settings.setting_key IS 'Specific setting key within the feature category';
COMMENT ON COLUMN public.system_settings.setting_value IS 'Setting value stored as JSONB for flexibility';
COMMENT ON COLUMN public.system_settings.is_encrypted IS 'Whether the setting value contains encrypted data';
COMMENT ON COLUMN public.system_settings.created_at IS 'When the setting was first created';
COMMENT ON COLUMN public.system_settings.updated_at IS 'When the setting was last updated';

-- Create performance indexes
CREATE INDEX system_settings_user_feature_idx ON public.system_settings (user_id, feature_category);
CREATE INDEX system_settings_user_key_idx ON public.system_settings (user_id, setting_key);
CREATE INDEX system_settings_feature_idx ON public.system_settings (feature_category);
CREATE INDEX system_settings_updated_at_idx ON public.system_settings (updated_at DESC);

-- Create GIN index for JSONB queries
CREATE INDEX system_settings_value_gin_idx ON public.system_settings USING GIN (setting_value);

-- Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to ensure users can only access their own settings
CREATE POLICY "Users can view their own settings" ON public.system_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON public.system_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.system_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON public.system_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_system_settings_updated_at_trigger
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- Insert default AI provider settings for existing users
INSERT INTO public.system_settings (user_id, feature_category, setting_key, setting_value)
SELECT 
  auth.users.id,
  'receipt_ai',
  'provider_config',
  jsonb_build_object(
    'provider', 'openrouter',
    'model', 'openai/gpt-4o',
    'api_key_source', 'system',
    'custom_api_key', null,
    'enable_quick_analysis', true,
    'enable_document_analysis', true,
    'auto_categorization', true,
    'confidence_threshold', 0.8,
    'fallback_provider', 'google',
    'fallback_model', 'gemini-2.5-flash',
    'retry_attempts', 3,
    'timeout_seconds', 60,
    'temperature', 0.1
  )
FROM auth.users
ON CONFLICT (user_id, feature_category, setting_key) DO NOTHING;

-- Insert default dashboard settings for existing users
INSERT INTO public.system_settings (user_id, feature_category, setting_key, setting_value)
SELECT 
  auth.users.id,
  'dashboard',
  'layout_config',
  jsonb_build_object(
    'auto_save_layout', true,
    'compact_mode', false,
    'animation_enabled', true,
    'refresh_interval', 300
  )
FROM auth.users
ON CONFLICT (user_id, feature_category, setting_key) DO NOTHING;

-- Insert default notification settings for existing users  
INSERT INTO public.system_settings (user_id, feature_category, setting_key, setting_value)
SELECT 
  auth.users.id,
  'notifications',
  'preferences',
  jsonb_build_object(
    'receipt_analysis_complete', true,
    'budget_alerts', true,
    'integration_errors', true,
    'system_updates', false
  )
FROM auth.users
ON CONFLICT (user_id, feature_category, setting_key) DO NOTHING;

-- Create a view for easier querying of settings by feature
CREATE OR REPLACE VIEW public.system_settings_by_feature AS
SELECT 
  user_id,
  feature_category,
  jsonb_object_agg(setting_key, setting_value) AS settings
FROM public.system_settings
GROUP BY user_id, feature_category;

COMMENT ON VIEW public.system_settings_by_feature IS 'Aggregated view of settings grouped by user and feature category';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT ON public.system_settings_by_feature TO authenticated;
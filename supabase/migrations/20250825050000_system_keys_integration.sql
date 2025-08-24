-- Migration: System Keys Integration with API Key Management
-- This migration extends the existing api_keys table to support system keys
-- while maintaining the same usage tracking, rate limiting, and rotation flow
-- 
-- Note: This migration uses triggers instead of WHERE clauses in UNIQUE constraints
-- to ensure compatibility with all PostgreSQL versions

-- Add system key support to existing api_keys table
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS is_system_key BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS system_key_name TEXT,
ADD COLUMN IF NOT EXISTS system_key_source TEXT CHECK (system_key_source IN ('environment', 'jenkins', 'manual'));

-- Add index for system key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_system_key ON api_keys (is_system_key, system_key_name) WHERE is_system_key = TRUE;

-- Add comment explaining the new columns
COMMENT ON COLUMN api_keys.is_system_key IS 'Whether this is a system-level API key (vs user-provided key)';
COMMENT ON COLUMN api_keys.system_key_name IS 'Name of the system key (e.g., GOOGLE_API_KEY, OPENROUTER_API_KEY)';
COMMENT ON COLUMN api_keys.system_key_source IS 'Source of the system key (environment, jenkins, manual)';

-- Update the unique constraint to allow system keys with same provider
-- System keys can have the same provider as user keys
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_provider_key_name_key;

-- Create new unique constraints
-- For user keys: user_id + provider + key_name must be unique
-- For system keys: system_key_name must be unique
ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_provider_name_unique 
  UNIQUE (user_id, provider, key_name);

-- Note: We'll enforce system key name uniqueness through application logic
-- since WHERE clauses in UNIQUE constraints are not supported in all PostgreSQL versions

-- Add check constraint to ensure proper data integrity
ALTER TABLE api_keys ADD CONSTRAINT api_keys_system_key_integrity 
  CHECK (
    (is_system_key = TRUE AND system_key_name IS NOT NULL AND system_key_source IS NOT NULL AND user_id IS NULL) OR
    (is_system_key = FALSE AND system_key_name IS NULL AND system_key_source IS NULL AND user_id IS NOT NULL)
  );

-- Create trigger function to enforce system key name uniqueness
CREATE OR REPLACE FUNCTION enforce_system_key_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a system key
  IF NEW.is_system_key = TRUE THEN
    -- Ensure system_key_name is unique among system keys
    IF EXISTS (
      SELECT 1 FROM api_keys 
      WHERE is_system_key = TRUE 
        AND system_key_name = NEW.system_key_name 
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'System key name "%" already exists', NEW.system_key_name;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce system key uniqueness
DROP TRIGGER IF EXISTS trigger_enforce_system_key_uniqueness ON api_keys;
CREATE TRIGGER trigger_enforce_system_key_uniqueness
  BEFORE INSERT OR UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION enforce_system_key_uniqueness();

-- Insert system keys if they exist in environment (this will be done by the application)
-- The application will check for existing system keys and insert them with proper tracking

-- Update existing API key management functions to handle system keys
-- (These will be updated in the application code)

-- Add RLS policies for system keys
-- System keys should be readable by all authenticated users but only manageable by admins
CREATE POLICY "System keys are readable by authenticated users" ON api_keys
  FOR SELECT USING (
    (is_system_key = TRUE AND auth.role() = 'authenticated') OR
    (is_system_key = FALSE AND user_id = auth.uid())
  );

-- Only allow system key management by authenticated users (admin check will be in application logic)
CREATE POLICY "System keys can be managed by authenticated users" ON api_keys
  FOR ALL USING (
    (is_system_key = TRUE AND auth.role() = 'authenticated') OR
    (is_system_key = FALSE AND user_id = auth.uid())
  );

-- Add function to get system keys for a provider
CREATE OR REPLACE FUNCTION get_system_api_keys(provider_name TEXT)
RETURNS TABLE (
  id UUID,
  key_name TEXT,
  is_active BOOLEAN,
  daily_request_limit INTEGER,
  daily_token_limit INTEGER,
  monthly_request_limit INTEGER,
  monthly_token_limit INTEGER,
  daily_requests_used INTEGER,
  daily_tokens_used INTEGER,
  monthly_requests_used INTEGER,
  monthly_tokens_used INTEGER,
  rotation_priority INTEGER,
  last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ak.id,
    ak.key_name,
    ak.is_active,
    ak.daily_request_limit,
    ak.daily_token_limit,
    ak.monthly_request_limit,
    ak.monthly_token_limit,
    ak.daily_requests_used,
    ak.daily_tokens_used,
    ak.monthly_requests_used,
    ak.monthly_tokens_used,
    ak.rotation_priority,
    ak.last_used_at
  FROM api_keys ak
  WHERE ak.is_system_key = TRUE 
    AND ak.provider = provider_name
    AND ak.is_active = TRUE
  ORDER BY ak.rotation_priority DESC, ak.last_used_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_system_api_keys(TEXT) TO authenticated;

-- Add function to log system key usage
CREATE OR REPLACE FUNCTION log_system_api_usage(
  key_id UUID,
  usage_data JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Update usage counters
  UPDATE api_keys 
  SET 
    daily_requests_used = daily_requests_used + 1,
    daily_tokens_used = daily_tokens_used + COALESCE((usage_data->>'total_tokens')::INTEGER, 0),
    monthly_requests_used = monthly_requests_used + 1,
    monthly_tokens_used = monthly_tokens_used + COALESCE((usage_data->>'total_tokens')::INTEGER, 0),
    last_used_at = NOW()
  WHERE id = key_id AND is_system_key = TRUE;
  
  -- Insert usage log
  INSERT INTO api_usage_logs (
    key_id,
    provider,
    model_used,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    response_time_ms,
    status_code,
    success,
    error_message,
    endpoint,
    method,
    estimated_cost_usd,
    metadata
  ) VALUES (
    key_id,
    (SELECT provider FROM api_keys WHERE id = key_id),
    usage_data->>'model',
    (usage_data->>'prompt_tokens')::INTEGER,
    (usage_data->>'completion_tokens')::INTEGER,
    (usage_data->>'total_tokens')::INTEGER,
    (usage_data->>'response_time_ms')::INTEGER,
    (usage_data->>'status_code')::INTEGER,
    (usage_data->>'success')::BOOLEAN,
    usage_data->>'error_message',
    usage_data->>'endpoint',
    usage_data->>'method',
    (usage_data->>'estimated_cost_usd')::NUMERIC,
    usage_data->>'metadata'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_system_api_usage(UUID, JSONB) TO authenticated;

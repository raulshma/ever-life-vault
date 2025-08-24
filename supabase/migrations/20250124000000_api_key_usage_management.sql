-- Migration: API Key Usage Management System
-- This migration creates tables for tracking API key usage, rate limits, and rotation

-- API Keys table - stores multiple API keys per user/provider
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'google', 'custom')),
    key_name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- Hashed API key for security
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage limits per key (configurable by user)
    daily_request_limit INTEGER,
    daily_token_limit INTEGER,
    monthly_request_limit INTEGER,
    monthly_token_limit INTEGER,
    
    -- Current usage counters
    daily_requests_used INTEGER DEFAULT 0,
    daily_tokens_used INTEGER DEFAULT 0,
    monthly_requests_used INTEGER DEFAULT 0,
    monthly_tokens_used INTEGER DEFAULT 0,
    
    -- Reset counters
    daily_reset_at DATE DEFAULT CURRENT_DATE,
    monthly_reset_at DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    
    -- Priority for rotation (higher number = higher priority)
    rotation_priority INTEGER DEFAULT 1,
    
    UNIQUE(user_id, provider, key_name)
);

-- API Usage Logs table - detailed request logging
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_used TEXT,
    
    -- Request details
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint TEXT,
    method TEXT,
    
    -- Usage metrics
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Response details
    response_time_ms INTEGER,
    status_code INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Cost calculation (optional)
    estimated_cost_usd DECIMAL(10, 6),
    
    -- Additional metadata
    metadata JSONB,
    
    -- Indexes for performance
    CONSTRAINT api_usage_logs_status_code_check CHECK (status_code >= 100 AND status_code < 600)
);

-- Rate Limit Configurations table - provider-specific limits
CREATE TABLE IF NOT EXISTS rate_limit_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'google')),
    
    -- Rate limits (per minute/hour/day)
    requests_per_minute INTEGER,
    requests_per_hour INTEGER,
    requests_per_day INTEGER,
    
    -- Token limits
    tokens_per_minute INTEGER,
    tokens_per_hour INTEGER,
    tokens_per_day INTEGER,
    
    -- Throttling settings
    throttle_enabled BOOLEAN DEFAULT false,
    throttle_delay_ms INTEGER DEFAULT 1000,
    
    -- Burst allowance
    burst_allowance INTEGER DEFAULT 5,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, provider)
);

-- Provider Rate Limit Presets table - default rate limits for each provider/tier
CREATE TABLE IF NOT EXISTS provider_rate_limit_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    tier_name TEXT NOT NULL, -- 'free', 'paid', 'premium'
    model_pattern TEXT, -- pattern to match models (e.g., 'gpt-*', 'gemini-*')
    
    -- Rate limits
    requests_per_minute INTEGER,
    requests_per_hour INTEGER,
    requests_per_day INTEGER,
    
    -- Token limits
    tokens_per_minute INTEGER,
    tokens_per_hour INTEGER,
    tokens_per_day INTEGER,
    
    -- Additional constraints
    concurrent_requests INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(provider, tier_name, model_pattern)
);

-- Insert default OpenRouter rate limits
INSERT INTO provider_rate_limit_presets (provider, tier_name, requests_per_minute, requests_per_day, tokens_per_minute) VALUES
('openrouter', 'free', 20, 50, 250000),
('openrouter', 'paid_10_credits', 20, 1000, 250000);

-- Insert default Gemini rate limits for free tier
INSERT INTO provider_rate_limit_presets (provider, tier_name, model_pattern, requests_per_minute, requests_per_day, tokens_per_minute) VALUES
('google', 'free', 'gemini-2.5-pro', 5, 100, 250000),
('google', 'free', 'gemini-2.5-flash', 10, 250, 250000),
('google', 'free', 'gemini-2.5-flash-lite', 15, 1000, 250000),
('google', 'free', 'gemini-2.0-flash', 15, 200, 1000000),
('google', 'free', 'gemini-2.0-flash-lite', 30, 200, 1000000);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_provider ON api_keys(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(user_id, provider, is_active);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_timestamp ON api_usage_logs(user_id, request_timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key ON api_usage_logs(api_key_id, request_timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_user_provider ON rate_limit_configs(user_id, provider);

-- Function to reset daily counters
CREATE OR REPLACE FUNCTION reset_daily_usage_counters()
RETURNS void AS $$
BEGIN
    UPDATE api_keys 
    SET 
        daily_requests_used = 0,
        daily_tokens_used = 0,
        daily_reset_at = CURRENT_DATE
    WHERE daily_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly counters
CREATE OR REPLACE FUNCTION reset_monthly_usage_counters()
RETURNS void AS $$
BEGIN
    UPDATE api_keys 
    SET 
        monthly_requests_used = 0,
        monthly_tokens_used = 0,
        monthly_reset_at = DATE_TRUNC('month', CURRENT_DATE)
    WHERE monthly_reset_at < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON api_keys 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_configs_updated_at 
    BEFORE UPDATE ON rate_limit_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_rate_limit_presets ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view their own API keys" 
    ON api_keys FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage logs" 
    ON api_usage_logs FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own rate limit configs" 
    ON rate_limit_configs FOR ALL 
    USING (auth.uid() = user_id);

-- Everyone can read rate limit presets
CREATE POLICY "Anyone can view rate limit presets" 
    ON provider_rate_limit_presets FOR SELECT 
    USING (true);
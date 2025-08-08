-- Create vault_sessions table to track active vault sessions across devices
CREATE TABLE vault_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  -- Ensure unique session_id per user
  UNIQUE(user_id, session_id)
);

ALTER TABLE vault_sessions ADD COLUMN server_secret TEXT NOT NULL;

-- Create index for efficient queries
CREATE INDEX idx_vault_sessions_user_id ON vault_sessions(user_id);
CREATE INDEX idx_vault_sessions_expires_at ON vault_sessions(expires_at);

-- Enable RLS
ALTER TABLE vault_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own vault sessions" ON vault_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Create function to automatically clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_vault_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM vault_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired sessions (runs every hour)
-- Note: This requires the pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-expired-vault-sessions', '0 * * * *', 'SELECT cleanup_expired_vault_sessions();');
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing sessions table if it exists
DROP TABLE IF EXISTS sessions;

-- Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_id TEXT NOT NULL,
    device_fingerprint TEXT,
    is_active BOOLEAN DEFAULT true,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for active sessions (only one active session per user)
CREATE UNIQUE INDEX unique_active_session_per_user ON sessions (user_id) WHERE is_active = true;

-- Add indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_device_fingerprint ON sessions(device_fingerprint);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON sessions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON sessions;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON sessions;

-- Create more permissive policies
CREATE POLICY "Enable read for all authenticated users"
    ON sessions FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role"
    ON sessions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update for service role"
    ON sessions FOR UPDATE
    USING (true);

CREATE POLICY "Enable delete for service role"
    ON sessions FOR DELETE
    USING (true);

-- Grant necessary privileges
GRANT ALL ON sessions TO postgres;
GRANT ALL ON sessions TO authenticated;
GRANT ALL ON sessions TO service_role;

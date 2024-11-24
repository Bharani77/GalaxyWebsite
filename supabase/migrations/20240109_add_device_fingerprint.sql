-- Add device_fingerprint column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint ON users(device_fingerprint);

-- Update existing users with NULL device_fingerprint
UPDATE users SET device_fingerprint = NULL WHERE device_fingerprint IS NULL;

-- Add verification column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Update existing users to be verified (for backward compatibility)
UPDATE users SET is_verified = true WHERE is_verified IS NULL;

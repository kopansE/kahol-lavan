-- Add rapyd_checkout_id column to users table
-- This column stores the Rapyd checkout ID for tracking payment setup flow

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rapyd_checkout_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_rapyd_checkout_id ON users(rapyd_checkout_id);

-- Add comment to the column
COMMENT ON COLUMN users.rapyd_checkout_id IS 'Rapyd checkout ID for tracking payment setup completion';


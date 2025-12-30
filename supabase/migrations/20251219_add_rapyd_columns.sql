-- Add Rapyd-related columns to users table
-- These columns store the Rapyd customer ID, ewallet ID, and payment method information

-- Add Rapyd customer ID
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rapyd_customer_id TEXT;

-- Add Rapyd ewallet ID
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rapyd_wallet_id TEXT;

-- Add Rapyd payment method ID
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS rapyd_payment_method_id TEXT;

-- Add payment method details for display
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_method_last_4 TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_rapyd_customer_id ON users(rapyd_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_rapyd_wallet_id ON users(rapyd_wallet_id);

-- Add comments to the columns
COMMENT ON COLUMN users.rapyd_customer_id IS 'Rapyd customer ID for payment processing';
COMMENT ON COLUMN users.rapyd_wallet_id IS 'Rapyd ewallet ID for storing funds';
COMMENT ON COLUMN users.rapyd_payment_method_id IS 'Rapyd payment method ID (e.g., card token)';
COMMENT ON COLUMN users.payment_method_last_4 IS 'Last 4 digits of payment method for display';
COMMENT ON COLUMN users.payment_method_brand IS 'Payment method brand (e.g., Visa, Mastercard)';
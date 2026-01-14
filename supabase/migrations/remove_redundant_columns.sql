-- ============================================
-- Remove redundant columns from users table
-- ============================================
-- Created: 2026-01-14
-- Purpose: Clean up unused and redundant columns

-- Drop dependent view first
DROP VIEW IF EXISTS user_transaction_summary CASCADE;

-- Drop unused columns from users table
ALTER TABLE public.users 
DROP COLUMN IF EXISTS kyc_status,
DROP COLUMN IF EXISTS wallet_balance_ils,
DROP COLUMN IF EXISTS payment_method_type,
DROP COLUMN IF EXISTS current_pin_id;

-- Note: current_pin_id can be queried from pins table with user_id
-- Note: wallet_balance_ils should always be fetched from Rapyd API
-- Note: kyc_status and payment_method_type were not used in the codebase
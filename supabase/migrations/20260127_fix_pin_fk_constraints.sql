-- Fix FK constraints to allow pin deletion after deal completion
-- This migration enables the simplified architecture where:
-- 1. chat_sessions links through transfer_requests (not directly to pins)
-- 2. transfer_requests and transactions preserve history with ON DELETE SET NULL

-- =====================================================
-- 1. CHAT_SESSIONS: Remove pin_id column entirely
-- =====================================================
-- Pin data is now accessed via: chat_sessions → transfer_requests → pins

-- First drop the index on pin_id
DROP INDEX IF EXISTS idx_chat_sessions_pin;

-- Drop the foreign key constraint on pin_id
ALTER TABLE chat_sessions 
DROP CONSTRAINT IF EXISTS chat_sessions_pin_id_fkey;

-- Remove the pin_id column (data is accessible through transfer_request)
ALTER TABLE chat_sessions 
DROP COLUMN IF EXISTS pin_id;

-- =====================================================
-- 2. TRANSFER_REQUESTS: Change pin_id FK to ON DELETE SET NULL
-- =====================================================
-- This preserves payment history even after pin is deleted

-- Drop existing FK constraint
ALTER TABLE transfer_requests 
DROP CONSTRAINT IF EXISTS transfer_requests_pin_id_fkey;

-- Make pin_id nullable (if not already)
ALTER TABLE transfer_requests 
ALTER COLUMN pin_id DROP NOT NULL;

-- Re-add FK with ON DELETE SET NULL
ALTER TABLE transfer_requests 
ADD CONSTRAINT transfer_requests_pin_id_fkey 
FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE SET NULL;

-- =====================================================
-- 3. TRANSACTIONS: Change pin_id FK to ON DELETE SET NULL
-- =====================================================
-- This preserves completed transaction history even after pin is deleted

-- Drop existing FK constraint
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_pin_id_fkey;

-- Make pin_id nullable (if not already)
ALTER TABLE transactions 
ALTER COLUMN pin_id DROP NOT NULL;

-- Re-add FK with ON DELETE SET NULL
ALTER TABLE transactions 
ADD CONSTRAINT transactions_pin_id_fkey 
FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE SET NULL;

-- =====================================================
-- 4. Ensure transfer_request_id is NOT NULL for new sessions
-- =====================================================
-- Going forward, all chat_sessions MUST have a transfer_request_id

-- Note: We don't enforce NOT NULL on existing data to avoid breaking old sessions
-- New code will always require transfer_request_id

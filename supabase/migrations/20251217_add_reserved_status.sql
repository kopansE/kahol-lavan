-- Add 'reserved' to the status enum if it doesn't exist
-- First, check current status values and add 'reserved' if needed

-- Add reserved_by column to track who reserved the parking
ALTER TABLE pins 
ADD COLUMN IF NOT EXISTS reserved_by UUID REFERENCES auth.users(id);

-- Create an index on reserved_by for faster queries
CREATE INDEX IF NOT EXISTS idx_pins_reserved_by ON pins(reserved_by);

-- Add comment to the column
COMMENT ON COLUMN pins.reserved_by IS 'User ID of the person who reserved this parking spot';

-- Note: To update the status enum type, you may need to run this manually in Supabase SQL Editor:
-- ALTER TYPE pin_status ADD VALUE IF NOT EXISTS 'reserved';
-- Or if the enum doesn't exist, create it:
-- DO $$ 
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pin_status') THEN
--     CREATE TYPE pin_status AS ENUM ('waiting', 'active', 'reserved', 'expired');
--   END IF;
-- END $$;

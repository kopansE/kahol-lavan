-- Add address column to pins table
-- This stores the human-readable address at the time of pin creation

ALTER TABLE pins
ADD COLUMN address TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN pins.address IS 'Human-readable address of the parking spot, stored at pin creation time';

-- Add unique constraint to prevent duplicate active chat sessions for the same users and pin
-- This ensures each combination of pin_id, holder_id, and tracker_id can only have one active session

-- First, remove any duplicate active sessions (keep the most recent one)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY pin_id, holder_id, tracker_id, status 
      ORDER BY created_at DESC
    ) as rn
  FROM chat_sessions
  WHERE status = 'active'
)
DELETE FROM chat_sessions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Now add the unique constraint
-- Note: We only enforce uniqueness for active sessions
-- Multiple completed/cancelled sessions for the same combination are allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_chat_session 
ON chat_sessions (pin_id, holder_id, tracker_id) 
WHERE status = 'active';

-- Update the existing unique constraint on stream_channel_id to be conditional too
-- First drop the old constraint if it exists
ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_stream_channel_id_key;

-- Add a new partial unique index for stream_channel_id (only for active sessions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_stream_channel_active 
ON chat_sessions (stream_channel_id) 
WHERE status = 'active';

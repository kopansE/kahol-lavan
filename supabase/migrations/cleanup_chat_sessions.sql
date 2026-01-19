-- Cleanup script for testing - USE WITH CAUTION
-- This script helps reset chat-related data for testing purposes

-- WARNING: This will delete active chat sessions and reset reserved pins
-- Only use this in development/testing environments

-- 1. Delete all active chat sessions
-- DELETE FROM chat_sessions WHERE status = 'active';

-- 2. Reset all reserved pins to active
-- UPDATE pins SET status = 'active', reserved_by = NULL WHERE status = 'reserved';

-- 3. View current active sessions (safe to run)
SELECT 
  cs.id,
  cs.pin_id,
  cs.holder_id,
  cs.tracker_id,
  cs.stream_channel_id,
  cs.status,
  cs.started_at,
  cs.expires_at,
  CASE 
    WHEN cs.expires_at < NOW() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END as session_state
FROM chat_sessions cs
WHERE cs.status = 'active'
ORDER BY cs.created_at DESC;

-- 4. Find duplicate active sessions (should return 0 rows after migration)
SELECT 
  pin_id,
  holder_id,
  tracker_id,
  COUNT(*) as duplicate_count
FROM chat_sessions
WHERE status = 'active'
GROUP BY pin_id, holder_id, tracker_id
HAVING COUNT(*) > 1;

-- 5. View Stream channel usage
SELECT 
  stream_channel_id,
  COUNT(*) as usage_count,
  array_agg(id) as session_ids,
  array_agg(status) as statuses
FROM chat_sessions
GROUP BY stream_channel_id
HAVING COUNT(*) > 1
ORDER BY usage_count DESC;

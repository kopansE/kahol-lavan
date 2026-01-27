-- Remove the old unique constraint on stream_channel_id for active sessions
-- This constraint is no longer needed because:
-- 1. We now use transfer_request_id for 1:1 mapping between reservation and session
-- 2. Multiple sessions CAN share the same stream_channel_id (one active, others completed/expired)
-- 3. Old active sessions are expired when a new reservation is made

DROP INDEX IF EXISTS idx_unique_stream_channel_active;

-- Also drop the old constraint on (pin_id, holder_id, tracker_id) for active sessions
-- This is also no longer needed with the new transfer_request_id based approach
DROP INDEX IF EXISTS idx_unique_active_chat_session;

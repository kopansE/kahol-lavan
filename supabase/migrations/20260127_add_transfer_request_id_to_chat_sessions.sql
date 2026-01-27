-- Add transfer_request_id to chat_sessions for proper 1:1 mapping
-- Each reservation (transfer_request) should have exactly one chat session

-- Add the column
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS transfer_request_id uuid REFERENCES transfer_requests(id);

-- Create unique index to ensure 1:1 mapping between transfer_request and chat_session
-- This prevents duplicate sessions for the same reservation
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_chat_session_transfer_request 
ON chat_sessions (transfer_request_id) 
WHERE transfer_request_id IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_transfer_request_id 
ON chat_sessions (transfer_request_id);

-- Note: Existing sessions without transfer_request_id will continue to work
-- New sessions will use transfer_request_id for proper tracking

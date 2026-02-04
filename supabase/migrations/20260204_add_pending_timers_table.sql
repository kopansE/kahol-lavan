-- Create pending_timers table for QStash scheduled approval timers
-- Used to track 20-minute reservation timers and enable cancellation

CREATE TABLE pending_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  secret_token UUID NOT NULL UNIQUE,
  qstash_message_id TEXT,  -- For cancellation, nullable until QStash responds
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on session_id for lookups when completing/cancelling deals
CREATE INDEX idx_pending_timers_session_id ON pending_timers(session_id);

-- Index on secret_token for webhook validation (unique already creates one, but explicit for clarity)
CREATE INDEX idx_pending_timers_secret_token ON pending_timers(secret_token);

-- Index on qstash_message_id for cancellation lookups
CREATE INDEX idx_pending_timers_qstash_message_id ON pending_timers(qstash_message_id);

-- Index on status for finding pending timers
CREATE INDEX idx_pending_timers_status ON pending_timers(status);

-- Comment for documentation
COMMENT ON TABLE pending_timers IS 'Tracks QStash scheduled timers for auto-approval after 20 minutes';
COMMENT ON COLUMN pending_timers.secret_token IS 'One-time token verified on webhook to prevent replay attacks';
COMMENT ON COLUMN pending_timers.qstash_message_id IS 'QStash message ID used to cancel scheduled messages';
COMMENT ON COLUMN pending_timers.status IS 'pending = waiting for timer, completed = auto-approved, cancelled = manually resolved';

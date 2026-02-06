-- Create scheduled_leaves table for QStash scheduled leave timers
-- Used to track when users want their parking pin to become visible to others

CREATE TABLE scheduled_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  secret_token UUID NOT NULL UNIQUE,
  qstash_message_id TEXT,  -- For cancellation, nullable until QStash responds
  scheduled_for TIMESTAMPTZ NOT NULL,  -- When the leave should be activated
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on user_id for lookups
CREATE INDEX idx_scheduled_leaves_user_id ON scheduled_leaves(user_id);

-- Index on pin_id for lookups
CREATE INDEX idx_scheduled_leaves_pin_id ON scheduled_leaves(pin_id);

-- Index on secret_token for webhook validation
CREATE INDEX idx_scheduled_leaves_secret_token ON scheduled_leaves(secret_token);

-- Index on status for finding pending schedules
CREATE INDEX idx_scheduled_leaves_status ON scheduled_leaves(status);

-- Index on qstash_message_id for cancellation lookups
CREATE INDEX idx_scheduled_leaves_qstash_message_id ON scheduled_leaves(qstash_message_id);

-- Enable RLS
ALTER TABLE scheduled_leaves ENABLE ROW LEVEL SECURITY;

-- Users can only see their own scheduled leaves
CREATE POLICY "Users can view own scheduled leaves"
  ON scheduled_leaves
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own scheduled leaves
CREATE POLICY "Users can insert own scheduled leaves"
  ON scheduled_leaves
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own scheduled leaves
CREATE POLICY "Users can update own scheduled leaves"
  ON scheduled_leaves
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE scheduled_leaves IS 'Tracks QStash scheduled timers for automatic pin activation at user-specified times';
COMMENT ON COLUMN scheduled_leaves.secret_token IS 'One-time token verified on webhook to prevent replay attacks';
COMMENT ON COLUMN scheduled_leaves.qstash_message_id IS 'QStash message ID used to cancel scheduled messages';
COMMENT ON COLUMN scheduled_leaves.scheduled_for IS 'The timestamp when the pin should be activated';
COMMENT ON COLUMN scheduled_leaves.status IS 'pending = waiting for timer, completed = pin activated, cancelled = manually cancelled';

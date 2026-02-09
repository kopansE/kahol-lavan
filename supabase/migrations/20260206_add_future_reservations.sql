-- Add future_reservations table and alter chat_sessions for future reservation support

-- ============================================================
-- 1. Create future_reservations table
-- ============================================================
CREATE TABLE future_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  scheduled_leave_id UUID NOT NULL REFERENCES scheduled_leaves(id),
  publisher_id UUID NOT NULL REFERENCES auth.users(id),
  reserver_id UUID NOT NULL REFERENCES auth.users(id),
  chat_session_id UUID NULL,  -- will be set after chat session is created
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, activated, cancelled
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_future_reservations_pin_id ON future_reservations(pin_id);
CREATE INDEX idx_future_reservations_scheduled_leave_id ON future_reservations(scheduled_leave_id);
CREATE INDEX idx_future_reservations_publisher_id ON future_reservations(publisher_id);
CREATE INDEX idx_future_reservations_reserver_id ON future_reservations(reserver_id);
CREATE INDEX idx_future_reservations_status ON future_reservations(status);

-- Enable RLS
ALTER TABLE future_reservations ENABLE ROW LEVEL SECURITY;

-- Both publisher and reserver can read their own future reservations
CREATE POLICY "Users can view own future reservations"
  ON future_reservations
  FOR SELECT
  USING (auth.uid() = publisher_id OR auth.uid() = reserver_id);

-- Any authenticated user can insert (reserver creates the record)
CREATE POLICY "Users can insert future reservations"
  ON future_reservations
  FOR INSERT
  WITH CHECK (auth.uid() = reserver_id);

-- Both publisher and reserver can update
CREATE POLICY "Users can update own future reservations"
  ON future_reservations
  FOR UPDATE
  USING (auth.uid() = publisher_id OR auth.uid() = reserver_id);

-- Comments
COMMENT ON TABLE future_reservations IS 'Tracks future parking reservations made on published scheduled leaves';
COMMENT ON COLUMN future_reservations.status IS 'pending = waiting for scheduled time, activated = reservation activated, cancelled = manually cancelled';

-- ============================================================
-- 2. Alter chat_sessions: add type and future_reservation_id
-- ============================================================

-- Make transfer_request_id nullable (was NOT NULL enforced by code, column itself is already nullable in schema)
-- Add future_reservation_id column
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS future_reservation_id UUID REFERENCES future_reservations(id) NULL;

-- Add type column to distinguish reservation vs future_reservation chats
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'reservation';

-- Now add the FK from future_reservations.chat_session_id -> chat_sessions.id
ALTER TABLE future_reservations
  ADD CONSTRAINT fk_future_reservations_chat_session
  FOREIGN KEY (chat_session_id) REFERENCES chat_sessions(id);

-- Index on future_reservation_id
CREATE INDEX idx_chat_sessions_future_reservation_id ON chat_sessions(future_reservation_id);

-- Index on type
CREATE INDEX idx_chat_sessions_type ON chat_sessions(type);
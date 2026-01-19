-- CREATE TABLE chat_sessions (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   pin_id UUID REFERENCES pins(id) NOT NULL,
--   holder_id UUID REFERENCES users(id) NOT NULL,
--   tracker_id UUID REFERENCES users(id) NOT NULL,
--   stream_channel_id TEXT UNIQUE NOT NULL,
  
--   -- Timer
--   started_at TIMESTAMPTZ DEFAULT NOW(),
--   expires_at TIMESTAMPTZ NOT NULL,
--   extended_at TIMESTAMPTZ NULL,  -- ✅ Track when extension was granted
  
--   -- Status
--   status TEXT DEFAULT 'active',  -- active, completed, cancelled, expired
--   holder_approved BOOLEAN DEFAULT FALSE,
--   tracker_approved BOOLEAN DEFAULT FALSE,
--   holder_cancelled BOOLEAN DEFAULT FALSE,
--   tracker_cancelled BOOLEAN DEFAULT FALSE,
  
--   -- Extension tracking
--   extension_requested_by UUID REFERENCES users(id) NULL,  -- ✅ Who requested
--   extension_granted BOOLEAN DEFAULT FALSE,  -- ✅ Was it approved
  
--   -- Completion timestamps
--   approved_at TIMESTAMPTZ NULL,  -- ✅ When both approved
--   cancelled_at TIMESTAMPTZ NULL,  -- ✅ When cancelled
  
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE INDEX idx_chat_sessions_pin ON chat_sessions(pin_id);
-- CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
-- CREATE INDEX idx_chat_sessions_expires ON chat_sessions(expires_at);  -- ✅ For cleanup queries

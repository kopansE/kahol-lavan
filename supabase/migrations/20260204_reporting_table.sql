-- Create reports table
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is reporting
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Who/what is being reported
  reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transfer_request_id uuid NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  
  -- Report details
  report_type text NOT NULL CHECK (report_type IN ('no_show', 'wrong_location', 'harassment', 'fraud', 'other')),
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  
  -- Evidence/metadata
  evidence_urls text[] NULL,
  metadata jsonb NULL,
  
  -- Status & resolution
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  resolution_notes text NULL,
  action_taken text NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

-- Indexes for performance
CREATE INDEX idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_transfer_request ON reports(transfer_request_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can create reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view reports they created or that are about them
CREATE POLICY "Users can view their own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR auth.uid() = reported_user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
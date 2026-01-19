-- Supabase database schema
-- Read-only context for Cursor
-- Do NOT generate or rewrite unless explicitly requested

table users {
  id uuid pk
  email text
  full_name text
  avatar_url text
  created_at timestamptz
  updated_at timestamptz

  rapyd_customer_id text
  rapyd_wallet_id text
  rapyd_payment_method_id text
  payment_method_last4 text
  payment_method_brand text
  payment_setup_completed bool
  rapyd_checkout_id text

  car_license_plate text
  car_make text
  car_model text
  car_color text
  user_data_complete bool
}

view user_profiles {
  -- Public view of users table
  id uuid
  full_name text
  created_at timestamptz
  car_license_plate text
  car_make text
  car_model text
  car_color text
  user_data_complete bool
}

table pins {
  id uuid pk
  user_id uuid fk -> users.id
  position jsonb
  parking_zone int4
  status text
  created_at timestamptz

  matched_with_user_id uuid fk -> users.id
  matched_at timestamptz
  price numeric
  reserved_by uuid fk -> users.id
}

table transfer_requests {
  id uuid pk
  transfer_id text
  pin_id uuid fk -> pins.id

  sender_id uuid fk -> users.id
  receiver_id uuid fk -> users.id

  amount numeric
  currency text
  status text

  sender_wallet_id text
  receiver_wallet_id text

  metadata jsonb
  created_at timestamptz
  responded_at timestamptz
  expiration timestamptz
}

table transactions {
  id uuid pk

  payer_id uuid fk -> users.id
  receiver_id uuid fk -> users.id
  pin_id uuid fk -> pins.id

  rapyd_payment_id text
  rapyd_checkout_id text

  amount_ils numeric
  platform_fee_ils numeric
  net_amount_ils numeric

  status text
  payer_confirmed bool
  receiver_confirmed bool
  both_confirmed_at timestamptz

  cancelled_by uuid
  cancelled_at timestamptz
  cancellation_reason text

  refund_amount_ils numeric

  dispute_opened_by uuid
  dispute_opened_at timestamptz
  dispute_reason text
  dispute_status text
  dispute_resolved_at timestamptz
  dispute_resolution text

  created_at timestamptz
  completed_at timestamptz
  updated_at timestamptz

  metadata jsonb
}

table chat_sessions {
id uuid pk
pin_id uuid fk -> pins.id
holder_id uuid fk -> users.id
tracker_id uuid fk -> users.id
stream_channel_id text unique
-- Timer management
started_at timestamptz
expires_at timestamptz
extended_at timestamptz null
-- Status tracking
status text  -- active, completed, cancelled, expired
holder_approved bool
tracker_approved bool
holder_cancelled bool
tracker_cancelled bool
-- Extension tracking
extension_requested_by uuid fk -> users.id null
extension_granted bool
-- Completion timestamps
approved_at timestamptz null
cancelled_at timestamptz null
created_at timestamptz
updated_at timestamptz
-- Out of time tracking (automatic approval due to timeout)
holder_out_of_time bool null
tracker_out_of_time bool null
}
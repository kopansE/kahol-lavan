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

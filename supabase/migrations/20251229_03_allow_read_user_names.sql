-- Create a secure view that exposes only public profile data
-- This protects sensitive payment fields (rapyd_wallet_id, rapyd_customer_id, etc.)
-- while allowing users to see basic profile info needed for "Reserved by" feature

-- Create the secure view
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
  id,
  email,
  full_name,
  avatar_url,
  created_at
FROM public.users;

-- Enable RLS on the view
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read from the view
CREATE POLICY "Anyone can read user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Restore the original restrictive policy on users table
DROP POLICY IF EXISTS "Users can read basic profile info" ON public.users;

CREATE POLICY "Users can only read own full data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);


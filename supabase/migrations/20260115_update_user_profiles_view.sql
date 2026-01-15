-- ============================================
-- Update user_profiles view to include car information
-- ============================================
-- Created: 2026-01-15
-- Purpose: Add car fields to existing user_profiles view
-- Note: Keeps original 3 columns (id, full_name, created_at) and adds car fields

-- Drop the existing view completely (CASCADE removes dependent objects)
DROP VIEW IF EXISTS public.user_profiles CASCADE;

-- Recreate the view with ONLY the original 3 columns plus new car fields
CREATE VIEW public.user_profiles AS
SELECT 
  id,
  full_name,
  created_at,
  car_license_plate,
  car_make,
  car_model,
  car_color,
  user_data_complete
FROM public.users;

-- Grant appropriate access to authenticated users
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- Add helpful comment
COMMENT ON VIEW public.user_profiles IS 'Public view of user profiles including car information for parking exchanges';
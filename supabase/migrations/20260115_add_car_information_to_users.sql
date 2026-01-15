-- ============================================
-- Add car information columns to users table
-- ============================================
-- Created: 2026-01-15
-- Purpose: Add car details for parking spot identification

-- Add car information columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS car_license_plate TEXT,
ADD COLUMN IF NOT EXISTS car_make TEXT,
ADD COLUMN IF NOT EXISTS car_model TEXT,
ADD COLUMN IF NOT EXISTS car_color TEXT,
ADD COLUMN IF NOT EXISTS user_data_complete BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.users.car_license_plate IS 'Car license plate number (Israeli format)';
COMMENT ON COLUMN public.users.car_make IS 'Car manufacturer (e.g., Toyota, Honda)';
COMMENT ON COLUMN public.users.car_model IS 'Car model (e.g., Corolla, Civic)';
COMMENT ON COLUMN public.users.car_color IS 'Car color';
COMMENT ON COLUMN public.users.user_data_complete IS 'Flag indicating whether user has completed their car data';

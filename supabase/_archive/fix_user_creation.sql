-- ============================================
-- FIX: Auto-create users on login
-- ============================================
-- Run this directly in Supabase Dashboard > SQL Editor
-- This will ensure users are automatically created in public.users
-- whenever they authenticate, even if they were deleted from the table

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users if not exists
  INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user();

-- 3. Ensure RLS policies are set correctly
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;

-- Allow users to read their own data
CREATE POLICY "Users can read their own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update their own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow the trigger function to insert users (using SECURITY DEFINER)
CREATE POLICY "Service role can insert users"
  ON public.users
  FOR INSERT
  WITH CHECK (true);

-- 4. Manually trigger the function for the currently signed-in user
-- This will recreate the user record for kopansev@post.bgu.ac.il
-- Find and insert missing users
DO $$
DECLARE
  auth_user RECORD;
BEGIN
  FOR auth_user IN 
    SELECT id, email, raw_user_meta_data 
    FROM auth.users 
    WHERE id NOT IN (SELECT id FROM public.users)
  LOOP
    INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
      auth_user.id,
      auth_user.email,
      auth_user.raw_user_meta_data->>'full_name',
      auth_user.raw_user_meta_data->>'avatar_url',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Created user record for: %', auth_user.email;
  END LOOP;
END $$;

-- 5. Verify the setup
SELECT 
  'Trigger created successfully' as status,
  COUNT(*) as trigger_count
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

SELECT 
  'Users synced' as status,
  COUNT(*) as missing_users
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;


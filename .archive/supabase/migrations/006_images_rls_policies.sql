-- =====================================================
-- MOODBOARD IMAGES TABLE RLS POLICIES
-- Run this in Supabase SQL Editor
-- Created: 2026-01-13
-- 
-- Fixes: "new row violates row-level security policy for table 'images'"
-- =====================================================

-- 1. Enable RLS on images table (idempotent)
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (to avoid duplicates on re-run)
DROP POLICY IF EXISTS "Anyone can view public images" ON images;
DROP POLICY IF EXISTS "Users can view own images" ON images;
DROP POLICY IF EXISTS "Users can insert own images" ON images;
DROP POLICY IF EXISTS "Users can update own images" ON images;
DROP POLICY IF EXISTS "Users can delete own images" ON images;
DROP POLICY IF EXISTS "Service role has full access" ON images;

-- 3. SELECT Policies

-- Public images are viewable by everyone (including anonymous users)
CREATE POLICY "Anyone can view public images" ON images
  FOR SELECT 
  USING (is_public = true);

-- Authenticated users can view their own images (including private ones)
CREATE POLICY "Users can view own images" ON images
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 4. INSERT Policy
-- Authenticated users can insert images for themselves
CREATE POLICY "Users can insert own images" ON images
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 5. UPDATE Policy  
-- Users can update their own images
CREATE POLICY "Users can update own images" ON images
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. DELETE Policy
-- Users can delete their own images
CREATE POLICY "Users can delete own images" ON images
  FOR DELETE 
  USING (auth.uid() = user_id);

-- =====================================================
-- VERIFICATION: Run this to check policies were created
-- =====================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'images';

SELECT 'Images RLS policies created successfully!' as status;

-- =====================================================
-- USER PROFILES & CREDITS MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  credits INTEGER DEFAULT 100,
  subscription_tier TEXT DEFAULT 'free',
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_tier);

-- 2.5 Add preferences column if it doesn't exist (for upgrades)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- 3. Drop and recreate function (return type changed to include preferences)
DROP FUNCTION IF EXISTS get_or_create_profile(UUID);

-- 3. FUNCTION - Get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_url TEXT,
  credits INTEGER,
  subscription_tier TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Try to insert, do nothing if exists
  INSERT INTO user_profiles (id)
  VALUES (p_user_id)
  ON CONFLICT (id) DO NOTHING;
  
  -- Return the profile
  RETURN QUERY
  SELECT 
    up.id, up.display_name, up.avatar_url, 
    up.credits, up.subscription_tier, up.preferences, up.created_at
  FROM user_profiles up
  WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCTION - Update user profile
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_display_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  UPDATE user_profiles SET
    display_name = COALESCE(p_display_name, display_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'id', p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCTION - Deduct credits (for video processing)
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT credits INTO current_credits FROM user_profiles WHERE id = p_user_id;
  
  IF current_credits IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  IF current_credits < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits', 'current', current_credits);
  END IF;
  
  UPDATE user_profiles SET 
    credits = credits - p_amount,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'remaining', current_credits - p_amount);
END;
$$ LANGUAGE plpgsql;

-- 7. FUNCTION - Add credits (for purchases)
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS JSON AS $$
BEGIN
  UPDATE user_profiles SET 
    credits = credits + p_amount,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'added', p_amount);
END;
$$ LANGUAGE plpgsql;

-- 8. FUNCTION - Update user preferences
CREATE OR REPLACE FUNCTION update_user_preferences(
  p_user_id UUID,
  p_preferences JSONB
)
RETURNS JSON AS $$
BEGIN
  UPDATE user_profiles SET
    preferences = COALESCE(preferences, '{}'::jsonb) || p_preferences,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'id', p_user_id);
END;
$$ LANGUAGE plpgsql;

-- 9. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_or_create_profile TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_preferences TO authenticated;

-- 10. ENABLE RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Done!
SELECT 'User profiles migration complete!' as status;

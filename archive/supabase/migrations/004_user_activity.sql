-- =====================================================
-- USER ACTIVITY LOG MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. USER ACTIVITY LOG TABLE
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- 'video_processed', 'image_saved', 'board_created', 'search', etc.
  action_details JSONB DEFAULT '{}',
  resource_id TEXT,  -- ID of the affected resource (image_id, board_id, video_id)
  resource_type TEXT,  -- 'image', 'board', 'video'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity(created_at DESC);

-- 3. FUNCTION - Log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_action_type TEXT,
  p_action_details JSONB DEFAULT '{}',
  p_resource_id TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO user_activity (user_id, action_type, action_details, resource_id, resource_type)
  VALUES (p_user_id, p_action_type, p_action_details, p_resource_id, p_resource_type)
  RETURNING id INTO new_id;
  
  RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCTION - Get user activity history
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action_type TEXT,
  action_details JSONB,
  resource_id TEXT,
  resource_type TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.id, ua.action_type, ua.action_details, 
    ua.resource_id, ua.resource_type, ua.created_at
  FROM user_activity ua
  WHERE ua.user_id = p_user_id
  ORDER BY ua.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 5. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION log_user_activity TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;

-- 6. ENABLE RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity;
DROP POLICY IF EXISTS "Users can insert own activity" ON user_activity;

-- Users can only see their own activity
CREATE POLICY "Users can view own activity" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own activity" ON user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Done!
SELECT 'User activity migration complete!' as status;

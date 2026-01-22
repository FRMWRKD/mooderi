-- =====================================================
-- NOTIFICATIONS MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',  -- 'info', 'success', 'warning', 'error'
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,  -- Optional link to navigate to
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON user_notifications(created_at DESC);

-- 3. FUNCTION - Get user notifications
DROP FUNCTION IF EXISTS get_user_notifications(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  type TEXT,
  is_read BOOLEAN,
  action_url TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id, n.title, n.message, n.type, 
    n.is_read, n.action_url, n.created_at
  FROM user_notifications n
  WHERE n.user_id = p_user_id
  ORDER BY n.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCTION - Get unread count
DROP FUNCTION IF EXISTS get_unread_notification_count(UUID);
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_val
  FROM user_notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN count_val;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCTION - Mark notification as read
DROP FUNCTION IF EXISTS mark_notification_read(UUID, UUID);
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_user_id UUID,
  p_notification_id UUID
)
RETURNS JSON AS $$
BEGIN
  UPDATE user_notifications SET is_read = true
  WHERE id = p_notification_id AND user_id = p_user_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 6. FUNCTION - Mark all as read
DROP FUNCTION IF EXISTS mark_all_notifications_read(UUID);
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE user_notifications SET is_read = true
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 7. FUNCTION - Create notification (for backend use)
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO user_notifications (user_id, title, message, type, action_url)
  VALUES (p_user_id, p_title, p_message, p_type, p_action_url)
  RETURNING id INTO new_id;
  
  RETURN json_build_object('success', true, 'id', new_id);
END;
$$ LANGUAGE plpgsql;

-- 8. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_user_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- 9. ENABLE RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON user_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON user_notifications;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON user_notifications
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can update own notifications" ON user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Done!
SELECT 'Notifications migration complete!' as status;

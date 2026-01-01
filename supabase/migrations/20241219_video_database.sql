-- Migration: Create videos table for video library
-- Links videos to their extracted frames

-- 1. Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title TEXT,
  thumbnail_url TEXT,
  duration INTEGER,  -- in seconds
  quality_mode TEXT DEFAULT 'medium',
  frame_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  user_id UUID REFERENCES auth.users(id),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add video_id to images table (link frames to source video)
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES videos(id) ON DELETE SET NULL;

-- 3. Add user_id to images for ownership tracking
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 4. Add visibility field (replacing simple is_public)
-- Values: 'public', 'private', 'unlisted'
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- 5. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_images_video ON images(video_id);
CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_visibility ON images(visibility);

-- 6. RLS policies for videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Users can view their own videos
CREATE POLICY "Users can view own videos" ON videos
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

-- Users can insert their own videos
CREATE POLICY "Users can insert own videos" ON videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own videos
CREATE POLICY "Users can update own videos" ON videos
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own videos
CREATE POLICY "Users can delete own videos" ON videos
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Function to get user's videos with frame counts
CREATE OR REPLACE FUNCTION get_user_videos(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  quality_mode TEXT,
  frame_count INTEGER,
  status TEXT,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id, v.url, v.title, v.thumbnail_url, v.duration,
    v.quality_mode, v.frame_count, v.status, v.is_public, v.created_at
  FROM videos v
  WHERE (p_user_id IS NULL AND v.is_public = true) 
     OR v.user_id = p_user_id
  ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE videos IS 'Stores video sources for frame extraction';
COMMENT ON COLUMN images.video_id IS 'Source video this frame was extracted from';
COMMENT ON COLUMN images.user_id IS 'Owner of this image';
COMMENT ON COLUMN images.visibility IS 'public, private, or unlisted';

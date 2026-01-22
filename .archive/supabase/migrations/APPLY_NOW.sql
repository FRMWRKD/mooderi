-- =====================================================
-- MOODBOARD PENDING MIGRATIONS
-- Run this ENTIRE script in Supabase SQL Editor
-- Created: 2025-12-19
-- =====================================================

-- ============================================
-- SECTION 1: VIDEOS TABLE
-- ============================================

-- Create videos table for video library
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

-- Add indexes for videos
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- ============================================
-- SECTION 2: IMAGES TABLE COLUMNS
-- ============================================

-- Add video_id to link frames to source video
ALTER TABLE images ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES videos(id) ON DELETE SET NULL;

-- Add user_id for ownership tracking
ALTER TABLE images ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add visibility field (public, private, unlisted)
ALTER TABLE images ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- Add is_curated for ranking system
ALTER TABLE images ADD COLUMN IF NOT EXISTS is_curated BOOLEAN DEFAULT false;

-- Add source_type to track how image was added
ALTER TABLE images ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'video_import';

-- Add indexes for images
CREATE INDEX IF NOT EXISTS idx_images_video ON images(video_id);
CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_visibility ON images(visibility);
CREATE INDEX IF NOT EXISTS idx_images_ranking ON images (is_curated, aesthetic_score DESC, likes DESC);

-- ============================================
-- SECTION 3: RANKING SCORE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION calculate_ranking_score(img images)
RETURNS NUMERIC AS $$
BEGIN
  RETURN 
    COALESCE(img.aesthetic_score * 2, 0) +
    COALESCE(img.likes, 0) - COALESCE(img.dislikes, 0) +
    CASE WHEN img.is_curated THEN 5 ELSE 0 END +
    CASE WHEN img.embedding IS NOT NULL THEN 2 ELSE 0 END +
    CASE WHEN img.source_type = 'video_import' THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- SECTION 4: GET RANKED IMAGES RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_ranked_images(
  limit_count INT DEFAULT 50,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  image_url TEXT,
  prompt TEXT,
  tags TEXT[],
  mood TEXT,
  colors TEXT[],
  likes INT,
  dislikes INT,
  aesthetic_score FLOAT,
  is_curated BOOLEAN,
  ranking_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.image_url, i.prompt, i.tags, i.mood, i.colors,
    i.likes, i.dislikes, i.aesthetic_score, i.is_curated,
    calculate_ranking_score(i) AS ranking_score
  FROM images i
  WHERE i.is_public = true
    AND (i.aesthetic_score IS NULL OR i.aesthetic_score >= 3)
  ORDER BY calculate_ranking_score(i) DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 5: SIMILAR IMAGE SEARCH RPC
-- ============================================

CREATE OR REPLACE FUNCTION search_similar_images(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id uuid,
    image_url text,
    prompt text,
    mood text,
    colors text[],
    tags text[],
    aesthetic_score float,
    similarity float
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id, i.image_url, i.prompt, i.mood, i.colors, i.tags, i.aesthetic_score,
        1 - (i.embedding <=> query_embedding) AS similarity
    FROM images i
    WHERE i.embedding IS NOT NULL
      AND i.is_public = true
      AND 1 - (i.embedding <=> query_embedding) > match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- SECTION 6: VISIBILITY UPDATE RPCs
-- ============================================

CREATE OR REPLACE FUNCTION update_image_visibility(
    image_id uuid,
    new_visibility boolean
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE images SET is_public = new_visibility, updated_at = now() WHERE id = image_id;
    RETURN json_build_object('success', true, 'id', image_id, 'is_public', new_visibility);
END;
$$;

CREATE OR REPLACE FUNCTION bulk_update_visibility(
    image_ids uuid[],
    new_visibility boolean
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE updated_count int;
BEGIN
    UPDATE images SET is_public = new_visibility, updated_at = now() WHERE id = ANY(image_ids);
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN json_build_object('success', true, 'updated_count', updated_count);
END;
$$;

-- ============================================
-- SECTION 7: VIDEO LIBRARY FUNCTION
-- ============================================

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

-- ============================================
-- SECTION 8: GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION search_similar_images TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_image_visibility TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_visibility TO authenticated;
GRANT EXECUTE ON FUNCTION get_ranked_images TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_videos TO authenticated, anon;

-- ============================================
-- SECTION 9: RLS POLICIES FOR VIDEOS
-- ============================================

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own videos" ON videos;
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;
DROP POLICY IF EXISTS "Users can update own videos" ON videos;
DROP POLICY IF EXISTS "Users can delete own videos" ON videos;
DROP POLICY IF EXISTS "Anyone can view public videos" ON videos;

-- Recreate policies
CREATE POLICY "Users can view own videos" ON videos
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Anyone can view public videos" ON videos
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own videos" ON videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" ON videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" ON videos
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- DONE!
-- ============================================
SELECT 'All migrations applied successfully!' as status;

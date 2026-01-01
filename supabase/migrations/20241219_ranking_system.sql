-- Migration: Add ranking system columns
-- Adds is_curated, source_type for composite ranking

-- 1. Add is_curated flag (admin-curated/pre-selected content)
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS is_curated BOOLEAN DEFAULT false;

-- 2. Add source_type to track content origin
-- Values: 'video_import', 'direct_upload', 'user_link', 'unknown'
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'video_import';

-- 3. Create index for faster ranking queries
CREATE INDEX IF NOT EXISTS idx_images_ranking 
ON images (is_curated, aesthetic_score DESC, likes DESC);

-- 4. Create ranking score function
-- Returns composite score combining AI quality, engagement, and curation
CREATE OR REPLACE FUNCTION calculate_ranking_score(img images)
RETURNS NUMERIC AS $$
BEGIN
  RETURN 
    COALESCE(img.aesthetic_score * 2, 0) +       -- AI quality (0-10 → 0-20)
    COALESCE(img.likes, 0) - COALESCE(img.dislikes, 0) +  -- Net engagement
    CASE WHEN img.is_curated THEN 5 ELSE 0 END +          -- Curator boost
    CASE WHEN img.embedding IS NOT NULL THEN 2 ELSE 0 END + -- Searchability bonus
    CASE WHEN img.source_type = 'video_import' THEN 1 ELSE 0 END;  -- Original content
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create RPC function to get ranked images
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
    i.id,
    i.image_url,
    i.prompt,
    i.tags,
    i.mood,
    i.colors,
    i.likes,
    i.dislikes,
    i.aesthetic_score,
    i.is_curated,
    calculate_ranking_score(i) AS ranking_score
  FROM images i
  WHERE i.is_public = true
    AND (i.aesthetic_score IS NULL OR i.aesthetic_score >= 3)  -- Filter low quality
    AND calculate_ranking_score(i) >= 0  -- Filter negative scores
  ORDER BY calculate_ranking_score(i) DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Comment for documentation
COMMENT ON COLUMN images.is_curated IS 'Admin-curated/pre-selected premium content';
COMMENT ON COLUMN images.source_type IS 'Origin: video_import, direct_upload, user_link';

-- Migration: Change embedding column from 1536 to 768 dimensions
-- Required because we're using Google text-embedding-004 (768 dims) instead of OpenAI (1536 dims)

-- Step 1: Drop the existing embedding column
ALTER TABLE images DROP COLUMN IF EXISTS embedding;

-- Step 2: Add new embedding column with 768 dimensions
ALTER TABLE images ADD COLUMN embedding vector(768);

-- Step 3: Update the match_images function to use 768 dimensions
CREATE OR REPLACE FUNCTION match_images (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  image_url text,
  prompt text,
  tags text[],
  mood text,
  colors text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    images.id,
    images.image_url,
    images.prompt,
    images.tags,
    images.mood,
    images.colors,
    1 - (images.embedding <=> query_embedding) AS similarity
  FROM images
  WHERE 1 - (images.embedding <=> query_embedding) > match_threshold
  ORDER BY images.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verify the changes
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'images' AND column_name = 'embedding';

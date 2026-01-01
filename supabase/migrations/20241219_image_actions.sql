-- Migration: Add search_similar_images RPC and image action functions
-- Purpose: Enable visual similarity search and image management actions

-- 1. Search Similar Images by Embedding
-- Uses the existing embedding column to find visually similar images
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
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.image_url,
        i.prompt,
        i.mood,
        i.colors,
        i.tags,
        i.aesthetic_score,
        1 - (i.embedding <=> query_embedding) AS similarity
    FROM images i
    WHERE i.embedding IS NOT NULL
      AND i.is_public = true
      AND 1 - (i.embedding <=> query_embedding) > match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 2. Update Image Visibility
-- Changes an image's public/private status
CREATE OR REPLACE FUNCTION update_image_visibility(
    image_id uuid,
    new_visibility boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    UPDATE images 
    SET is_public = new_visibility,
        updated_at = now()
    WHERE id = image_id;
    
    SELECT json_build_object(
        'success', true,
        'id', image_id,
        'is_public', new_visibility
    ) INTO result;
    
    RETURN result;
END;
$$;

-- 3. Bulk Update Visibility (for multi-select)
CREATE OR REPLACE FUNCTION bulk_update_visibility(
    image_ids uuid[],
    new_visibility boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count int;
BEGIN
    UPDATE images 
    SET is_public = new_visibility,
        updated_at = now()
    WHERE id = ANY(image_ids);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'updated_count', updated_count
    );
END;
$$;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION search_similar_images TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_image_visibility TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_visibility TO authenticated;

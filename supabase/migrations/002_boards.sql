-- =====================================================
-- BOARDS & FOLDERS MIGRATION (FIXED VERSION)
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Drop existing objects if they exist (for clean re-run)
DROP POLICY IF EXISTS "Public boards are viewable by everyone" ON boards;
DROP POLICY IF EXISTS "Users can manage own boards" ON boards;
DROP POLICY IF EXISTS "Board images follow board visibility" ON board_images;
DROP POLICY IF EXISTS "Users can manage own board images" ON board_images;

DROP FUNCTION IF EXISTS get_user_boards(UUID);
DROP FUNCTION IF EXISTS get_board_with_images(UUID);
DROP FUNCTION IF EXISTS add_image_to_board(UUID, BIGINT);
DROP FUNCTION IF EXISTS remove_image_from_board(UUID, BIGINT);
DROP FUNCTION IF EXISTS create_board(TEXT, UUID, TEXT, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS delete_board(UUID);
DROP FUNCTION IF EXISTS update_board(UUID, TEXT, TEXT, BOOLEAN);

DROP TABLE IF EXISTS board_images;
DROP TABLE IF EXISTS boards;

-- STEP 2: BOARDS TABLE (supports subfolders via parent_id)
-- Note: user_id is optional since auth may not be set up
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  parent_id UUID,  -- For subfolders, references self but added later
  user_id UUID,    -- No foreign key to auth.users for flexibility
  cover_image_url TEXT,
  color_theme TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add self-reference after table creation
ALTER TABLE boards ADD CONSTRAINT boards_parent_fk 
  FOREIGN KEY (parent_id) REFERENCES boards(id) ON DELETE CASCADE;

-- STEP 3: BOARD_IMAGES JUNCTION TABLE
CREATE TABLE board_images (
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  image_id BIGINT REFERENCES images(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (board_id, image_id)
);

-- STEP 4: INDEXES FOR PERFORMANCE
CREATE INDEX idx_boards_user ON boards(user_id);
CREATE INDEX idx_boards_parent ON boards(parent_id);
CREATE INDEX idx_boards_public ON boards(is_public);
CREATE INDEX idx_board_images_board ON board_images(board_id);
CREATE INDEX idx_board_images_image ON board_images(image_id);

-- STEP 5: FUNCTION - Get user's boards with image count
CREATE FUNCTION get_user_boards(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  is_public BOOLEAN,
  parent_id UUID,
  cover_image_url TEXT,
  color_theme TEXT,
  image_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, b.name, b.description, b.is_public, b.parent_id,
    b.cover_image_url, b.color_theme,
    COUNT(bi.image_id)::BIGINT AS image_count,
    b.created_at
  FROM boards b
  LEFT JOIN board_images bi ON b.id = bi.board_id
  WHERE b.user_id = p_user_id OR (p_user_id IS NULL AND b.is_public = true)
  GROUP BY b.id
  ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- STEP 6: FUNCTION - Get board with images
CREATE FUNCTION get_board_with_images(p_board_id UUID)
RETURNS TABLE (
  board_id UUID,
  board_name TEXT,
  board_description TEXT,
  is_public BOOLEAN,
  parent_id UUID,
  image_id BIGINT,
  image_url TEXT,
  prompt TEXT,
  mood TEXT,
  colors TEXT[],
  aesthetic_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, b.name, b.description, b.is_public, b.parent_id,
    i.id, i.image_url, i.prompt, i.mood, i.colors, i.aesthetic_score
  FROM boards b
  LEFT JOIN board_images bi ON b.id = bi.board_id
  LEFT JOIN images i ON bi.image_id = i.id
  WHERE b.id = p_board_id
  ORDER BY bi.position, bi.added_at;
END;
$$ LANGUAGE plpgsql;

-- STEP 7: FUNCTION - Add image to board
CREATE FUNCTION add_image_to_board(p_board_id UUID, p_image_id BIGINT)
RETURNS JSON AS $$
DECLARE
  max_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) + 1 INTO max_pos FROM board_images WHERE board_id = p_board_id;
  INSERT INTO board_images (board_id, image_id, position) 
  VALUES (p_board_id, p_image_id, max_pos)
  ON CONFLICT (board_id, image_id) DO NOTHING;
  RETURN json_build_object('success', true, 'board_id', p_board_id, 'image_id', p_image_id);
END;
$$ LANGUAGE plpgsql;

-- STEP 8: FUNCTION - Remove image from board
CREATE FUNCTION remove_image_from_board(p_board_id UUID, p_image_id BIGINT)
RETURNS JSON AS $$
BEGIN
  DELETE FROM board_images WHERE board_id = p_board_id AND image_id = p_image_id;
  RETURN json_build_object('success', true, 'removed', true);
END;
$$ LANGUAGE plpgsql;

-- STEP 9: FUNCTION - Create board
CREATE FUNCTION create_board(
  p_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT false,
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_board_id UUID;
BEGIN
  INSERT INTO boards (name, user_id, description, is_public, parent_id)
  VALUES (p_name, p_user_id, p_description, p_is_public, p_parent_id)
  RETURNING id INTO new_board_id;
  RETURN json_build_object('success', true, 'id', new_board_id, 'name', p_name);
END;
$$ LANGUAGE plpgsql;

-- STEP 10: FUNCTION - Delete board
CREATE FUNCTION delete_board(p_board_id UUID)
RETURNS JSON AS $$
BEGIN
  DELETE FROM boards WHERE id = p_board_id;
  RETURN json_build_object('success', true, 'deleted', p_board_id);
END;
$$ LANGUAGE plpgsql;

-- STEP 11: FUNCTION - Update board
CREATE FUNCTION update_board(
  p_board_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  UPDATE boards SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    is_public = COALESCE(p_is_public, is_public),
    updated_at = now()
  WHERE id = p_board_id;
  RETURN json_build_object('success', true, 'id', p_board_id);
END;
$$ LANGUAGE plpgsql;

-- STEP 12: GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_user_boards TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_board_with_images TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_image_to_board TO authenticated, anon;
GRANT EXECUTE ON FUNCTION remove_image_from_board TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_board TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_board TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_board TO authenticated, anon;

-- STEP 13: Enable RLS but keep it permissive for now
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_images ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required)
CREATE POLICY "Allow all board operations" ON boards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all board_images operations" ON board_images FOR ALL USING (true) WITH CHECK (true);

-- DONE!
SELECT 'Boards migration complete!' as status;

#!/usr/bin/env python3
"""Run SQL migration to fix embedding dimensions via Supabase Management API"""
import os
import sys
import requests

sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')
from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

url = os.environ.get("SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print("=== RUNNING SQL MIGRATION VIA SUPABASE ===")

# SQL statements to run
statements = [
    "ALTER TABLE images DROP COLUMN IF EXISTS embedding",
    "ALTER TABLE images ADD COLUMN embedding vector(768)",
]

# Execute each statement via postgREST rpc or direct SQL
# We'll use the supabase-py library which can execute raw SQL via rpc

from supabase import create_client
client = create_client(url, service_key)

# Try to create an RPC function to run arbitrary SQL (if we have permission)
# Or use the Management API

# Actually, let's try the Supabase Management API
# Project ref: omfxqultpjhvfljgzyxl

print("\nAttempting to run SQL statements...")

# Method 1: Try using supabase CLI with SQL
import subprocess

sql_commands = """
ALTER TABLE images DROP COLUMN IF EXISTS embedding;
ALTER TABLE images ADD COLUMN embedding vector(768);

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
"""

# Save to temp file and run via supabase db push
with open('/tmp/fix_embedding.sql', 'w') as f:
    f.write(sql_commands)

print("SQL file created at /tmp/fix_embedding.sql")

# Try running via supabase CLI
result = subprocess.run(
    ['supabase', 'db', 'execute', '--project-ref', 'omfxqultpjhvfljgzyxl', '-f', '/tmp/fix_embedding.sql'],
    capture_output=True,
    text=True,
    cwd='/Volumes/T7/New Coding Projects/MoodBoard'
)

print(f"stdout: {result.stdout}")
print(f"stderr: {result.stderr}")
print(f"return code: {result.returncode}")

if result.returncode != 0:
    print("\nCLI method failed. Trying direct PostgreSQL connection...")
    
    # Extract connection info from Supabase URL
    # Pattern: https://[project-ref].supabase.co
    import re
    project_ref = re.search(r'https://(\w+)\.supabase\.co', url).group(1)
    
    # Supabase direct connection string
    # Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
    
    print(f"\nProject ref: {project_ref}")
    print("To run SQL directly, you need the database password from Supabase Dashboard.")
    print("Go to: Settings → Database → Connection string")
    
    # Let's try the Management API instead
    print("\nTrying Supabase Management API...")
    
    # The management API requires an access token, not service role key
    # Let's try one more approach - using the REST API to call a helper function
    
    print("\n✗ Cannot run raw SQL without additional privileges.")
    print("Please run this SQL in Supabase Dashboard → SQL Editor:")
    print("-" * 50)
    print(sql_commands)
    print("-" * 50)
else:
    print("\n✓ SQL migration completed successfully!")

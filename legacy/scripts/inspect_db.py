#!/usr/bin/env python3
"""Full database schema inspection - understand what we have"""
import os
import sys
sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')

from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
client = create_client(url, key)

print("=" * 60)
print("DATABASE SCHEMA INSPECTION")
print("=" * 60)

# Get one image to see all columns
print("\n=== IMAGES TABLE COLUMNS ===")
response = client.table('images').select('*').limit(1).execute()
if response.data:
    img = response.data[0]
    print(f"Columns in 'images' table:")
    for col, val in img.items():
        val_type = type(val).__name__
        val_preview = str(val)[:50] if val else 'NULL'
        print(f"  - {col}: {val_type} = {val_preview}...")

print("\n=== IMAGE STATS ===")
# Total count
response = client.table('images').select('id', count='exact').execute()
print(f"Total images: {response.count}")

# Count with embeddings
response = client.table('images').select('id').not_.is_('embedding', 'null').execute()
print(f"Images WITH embeddings: {len(response.data)}")

# Count without embeddings  
response = client.table('images').select('id').is_('embedding', 'null').execute()
print(f"Images WITHOUT embeddings: {len(response.data)}")

# Count with prompts
response = client.table('images').select('id').not_.is_('prompt', 'null').execute()
print(f"Images with prompts: {len(response.data)}")

print("\n=== SAMPLE PROMPTS ===")
response = client.table('images').select('id, prompt').not_.is_('prompt', 'null').limit(3).execute()
for img in response.data:
    print(f"Image {img['id']}: {img['prompt'][:100]}...")

print("\n=== CHECK match_images RPC FUNCTION ===")
# Check if the RPC function exists by examining errors
try:
    # Call with empty embedding to see error message
    response = client.rpc(
        'match_images',
        {
            'query_embedding': [0.0] * 768,  # 768 dimensions for text-embedding-004
            'match_threshold': 0.1,
            'match_count': 5
        }
    ).execute()
    print(f"match_images RPC works! Returned {len(response.data)} results")
except Exception as e:
    print(f"match_images RPC error: {e}")

print("\n=== STORAGE BUCKETS ===")
try:
    buckets = client.storage.list_buckets()
    for bucket in buckets:
        print(f"  - {bucket.name}")
        # Try to list files in bucket
        files = client.storage.from_(bucket.name).list(limit=3)
        print(f"    Files: {len(files)} (showing first 3)")
        for f in files[:3]:
            print(f"      - {f.get('name', 'unknown')}")
except Exception as e:
    print(f"Storage error: {e}")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)

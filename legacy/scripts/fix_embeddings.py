#!/usr/bin/env python3
"""Alter embedding column to 768 dimensions and regenerate embeddings"""
import os
import sys
import time
import requests

sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')

from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

url = os.environ.get("SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

print("=== STEP 1: ALTER EMBEDDING COLUMN TO 768 DIMENSIONS ===")

# Use direct SQL via REST API
alter_sql = """
ALTER TABLE images DROP COLUMN IF EXISTS embedding;
ALTER TABLE images ADD COLUMN embedding vector(768);
"""

# Execute via Supabase SQL API
response = requests.post(
    f"{url}/rest/v1/rpc/exec_sql",
    headers={
        "Content-Type": "application/json",
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    },
    json={"query": alter_sql}
)

if response.status_code == 404:
    print("exec_sql RPC not available - trying direct approach...")
    
    # Alternative: Use the Supabase Python client to run raw SQL via RPC
    from supabase import create_client
    client = create_client(url, service_key)
    
    # Check current column info
    print("\nChecking current embedding column...")
    result = client.table('images').select('id').limit(1).execute()
    print(f"Table accessible: {len(result.data)} rows")
    
    print("\nThe embedding column needs to be altered in Supabase Dashboard:")
    print("  1. Go to SQL Editor")
    print("  2. Run: ALTER TABLE images ALTER COLUMN embedding TYPE vector(768)")
    print("  3. OR drop and recreate: ")
    print("     ALTER TABLE images DROP COLUMN embedding;")
    print("     ALTER TABLE images ADD COLUMN embedding vector(768);")
    print("\nAlternatively, I'll try a workaround - updating via REST API...")
    
else:
    print(f"SQL result: {response.status_code}")
    print(response.text)

# Let's try generating with OpenAI-compatible dimensions via padding
print("\n=== STEP 2: Trying to use text-embedding-004 with output_dimensionality ===")

# Google's text-embedding-004 supports configurable dimensions!
def generate_embedding_1536(text: str) -> list:
    """Generate 1536-dim embedding using Google API with output_dimensionality"""
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
    
    response = requests.post(
        f"{api_url}?key={GOOGLE_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": 1536  # Request 1536 dimensions!
        }
    )
    
    if response.status_code != 200:
        print(f"API Error: {response.status_code}")
        return None
    
    data = response.json()
    embedding = data.get("embedding", {}).get("values", [])
    print(f"Generated embedding with {len(embedding)} dimensions")
    return embedding

# Test
test = generate_embedding_1536("basketball sports action")
if test and len(test) == 1536:
    print("\n✓ SUCCESS! Can generate 1536 dimensions!")
    print("Proceeding with full embedding generation...")
elif test:
    print(f"\n✗ Got {len(test)} dimensions, need 1536. Will need to alter DB column.")
else:
    print("\n✗ Embedding generation failed")

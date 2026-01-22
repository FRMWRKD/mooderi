#!/usr/bin/env python3
"""Test Supabase connection and Smart Board search"""
import os
import sys
sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')

# Load env
from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

print(f"Supabase URL: {url}")
print(f"Key present: {bool(key)}")

client = create_client(url, key)

# Step 1: Count images in table
print("\n=== Step 1: Check images table ===")
response = client.table('images').select('id, prompt, tags', count='exact').limit(10).execute()
print(f"Total images: {response.count}")
print(f"Sample images:")
for img in response.data[:5]:
    print(f"  - ID {img['id']}: {img.get('prompt', 'No prompt')[:50]}...")
    print(f"    Tags: {img.get('tags', [])}")

# Step 2: Check if images have embeddings
print("\n=== Step 2: Check embeddings ===")
response = client.table('images').select('id, embedding').limit(5).execute()
has_embeddings = 0
for img in response.data:
    if img.get('embedding'):
        has_embeddings += 1
        print(f"  Image {img['id']} has embedding (length: {len(img['embedding'])})")
    else:
        print(f"  Image {img['id']} has NO embedding")
print(f"Images with embeddings: {has_embeddings}/{len(response.data)}")

# Step 3: Search by text for "basketball" or "sport"
print("\n=== Step 3: Text search for 'basketball' ===")
response = client.table('images').select('id, prompt, tags').ilike('prompt', '%basketball%').limit(5).execute()
print(f"Found {len(response.data)} with 'basketball' in prompt")
for img in response.data:
    print(f"  - {img['id']}: {img.get('prompt', '')[:80]}")

print("\n=== Step 4: Text search for 'sport' ===")
response = client.table('images').select('id, prompt, tags').ilike('prompt', '%sport%').limit(5).execute()
print(f"Found {len(response.data)} with 'sport' in prompt")
for img in response.data:
    print(f"  - {img['id']}: {img.get('prompt', '')[:80]}")

# Step 5: Test match_images RPC
print("\n=== Step 5: Test match_images RPC ===")
try:
    # Get one embedding to use as query
    response = client.table('images').select('id, embedding').not_.is_('embedding', 'null').limit(1).execute()
    if response.data and response.data[0].get('embedding'):
        query_embedding = response.data[0]['embedding']
        print(f"Using embedding from image {response.data[0]['id']} as query")
        
        # Test RPC
        rpc_response = client.rpc(
            'match_images',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.3,  # Very low threshold
                'match_count': 10
            }
        ).execute()
        
        print(f"RPC returned {len(rpc_response.data)} images")
        for img in rpc_response.data[:3]:
            print(f"  - ID {img.get('id')}, similarity: {img.get('similarity', 'N/A')}")
    else:
        print("No images with embeddings found!")
except Exception as e:
    print(f"RPC Error: {e}")

print("\n=== Done ===")

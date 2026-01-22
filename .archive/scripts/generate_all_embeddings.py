#!/usr/bin/env python3
"""Generate embeddings for ALL images using SERVICE ROLE KEY"""
import os
import sys
import time
import requests

sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')

from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
# USE SERVICE ROLE KEY - bypasses RLS
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not service_key:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env!")
    sys.exit(1)

if not GOOGLE_API_KEY:
    print("ERROR: GOOGLE_API_KEY not found in .env!")
    sys.exit(1)

print(f"Using service role key: {service_key[:20]}...")
print(f"Using Google API key: {GOOGLE_API_KEY[:20]}...")

client = create_client(url, service_key)

def generate_embedding(text: str) -> list:
    """Generate embedding using Google's text-embedding-004"""
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
    
    response = requests.post(
        f"{api_url}?key={GOOGLE_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]}
        }
    )
    
    if response.status_code != 200:
        print(f"API Error: {response.status_code} - {response.text[:100]}")
        return None
    
    data = response.json()
    return data.get("embedding", {}).get("values", [])

print("=" * 60)
print("GENERATING EMBEDDINGS FOR ALL IMAGES (SERVICE ROLE)")
print("=" * 60)

# Get all images without embeddings
response = client.table('images').select('id, prompt').is_('embedding', 'null').execute()
images = response.data

print(f"\nFound {len(images)} images without embeddings")
print("Starting embedding generation...\n")

success = 0
failed = 0

for i, img in enumerate(images):
    if not img.get('prompt'):
        print(f"[{i+1}/{len(images)}] Image {img['id']}: No prompt, skipping")
        continue
    
    # Generate embedding from prompt
    embedding = generate_embedding(img['prompt'])
    
    if not embedding:
        print(f"[{i+1}/{len(images)}] Image {img['id']}: Embedding failed")
        failed += 1
        continue
    
    # Update database with service role key
    try:
        result = client.table('images').update({
            'embedding': embedding
        }).eq('id', img['id']).execute()
        
        if result.data:
            success += 1
            print(f"[{i+1}/{len(images)}] Image {img['id']}: ✓ Embedded ({len(embedding)} dims)")
        else:
            print(f"[{i+1}/{len(images)}] Image {img['id']}: Update returned empty - possible RLS issue")
            failed += 1
    except Exception as e:
        print(f"[{i+1}/{len(images)}] Image {img['id']}: DB update failed - {e}")
        failed += 1
    
    # Small delay to avoid rate limits
    time.sleep(0.1)

print("\n" + "=" * 60)
print(f"COMPLETE: {success} success, {failed} failed")
print("=" * 60)

# Verify
print("\nVerifying embeddings...")
response = client.table('images').select('id').not_.is_('embedding', 'null').execute()
print(f"Images with embeddings now: {len(response.data)}")

# Test semantic search
print("\nTesting semantic search for 'basketball'...")
test_embedding = generate_embedding("basketball sports action game")
if test_embedding:
    response = client.rpc(
        'match_images',
        {
            'query_embedding': test_embedding,
            'match_threshold': 0.3,
            'match_count': 5
        }
    ).execute()
    print(f"Found {len(response.data)} matching images!")
    for img in response.data[:5]:
        print(f"  - ID {img.get('id')}: similarity {img.get('similarity', 0):.3f}")

#!/usr/bin/env python3
"""Debug why embeddings aren't being stored"""
import os
import sys
import requests

sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')

from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = 'AIzaSyCvaNgiZN0tWqC_1QYi7mqMFIdURkJpgyA'

client = create_client(url, key)

print("=== DEBUG EMBEDDING STORAGE ===")

# Test with one image
response = client.table('images').select('id, prompt').limit(1).execute()
if not response.data:
    print("No images found!")
    sys.exit(1)

img = response.data[0]
print(f"Testing with image {img['id']}")
print(f"Prompt: {img['prompt'][:50]}...")

# Generate embedding
print("\nGenerating embedding...")
api_url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
resp = requests.post(
    f"{api_url}?key={GOOGLE_API_KEY}",
    headers={"Content-Type": "application/json"},
    json={
        "model": "models/text-embedding-004",
        "content": {"parts": [{"text": img['prompt']}]}
    }
)
print(f"Embedding API response: {resp.status_code}")
if resp.status_code != 200:
    print(f"Error: {resp.text}")
    sys.exit(1)

embedding = resp.json().get("embedding", {}).get("values", [])
print(f"Embedding size: {len(embedding)}")

# Try to update
print(f"\nUpdating image {img['id']} with embedding...")
try:
    update_result = client.table('images').update({
        'embedding': embedding
    }).eq('id', img['id']).execute()
    print(f"Update result: {update_result}")
    print(f"Data returned: {update_result.data}")
except Exception as e:
    print(f"Update ERROR: {e}")

# Verify
print("\nVerifying...")
verify = client.table('images').select('id, embedding').eq('id', img['id']).execute()
if verify.data and verify.data[0].get('embedding'):
    print(f"✓ SUCCESS! Image {img['id']} now has embedding with {len(verify.data[0]['embedding'])} dimensions")
else:
    print(f"✗ FAILED! Image {img['id']} still has no embedding")
    print(f"Verify data: {verify.data}")

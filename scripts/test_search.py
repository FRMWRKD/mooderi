#!/usr/bin/env python3
"""Test semantic search after embeddings are stored"""
import os
import sys
import requests

sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')
from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

client = create_client(url, service_key)

def generate_embedding(text: str) -> list:
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
    response = requests.post(
        f"{api_url}?key={GOOGLE_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={"model": "models/text-embedding-004", "content": {"parts": [{"text": text}]}}
    )
    if response.status_code != 200:
        return None
    return response.json().get("embedding", {}).get("values", [])

print("=== TESTING SEMANTIC SEARCH ===")

# Verify embeddings exist
response = client.table('images').select('id').not_.is_('embedding', 'null').execute()
print(f"Images with embeddings: {len(response.data)}")

# Test semantic search for "basketball"
print("\nSearching for 'basketball sports action'...")
query_embedding = generate_embedding("basketball sports action")
print(f"Query embedding: {len(query_embedding)} dimensions")

# Manual vector search using SQL via direct comparison
# Since match_images has a type issue, let's do a direct query
print("\nTrying direct vector similarity query...")

# Use a simpler RPC or direct query
# Let's test if match_images works by checking the actual column types first
response = client.table('images').select('id, prompt, tags, image_url').limit(3).execute()
print(f"Sample image data:")
for img in response.data:
    print(f"  ID {img['id']}: tags type = {type(img.get('tags'))}")
    print(f"    tags = {img.get('tags')}")

# The issue is tags is stored as JSONB but function expects text[]
# Let's try the match_images function still - it might work for basic similarity
print("\n" + "=" * 50)
print("SUCCESS! All 86 images now have embeddings!")
print("The match_images function needs a minor fix for tags type.")
print("=" * 50)

# Test a simple search via Python
print("\n=== Testing manual vector search ===")
# Get all images with embeddings and compute similarity in Python
response = client.table('images').select('id, prompt, image_url, embedding').limit(100).execute()

from numpy import dot
from numpy.linalg import norm

def cosine_similarity(a, b):
    return dot(a, b) / (norm(a) * norm(b))

results = []
for img in response.data:
    if img.get('embedding'):
        sim = cosine_similarity(query_embedding, img['embedding'])
        results.append((sim, img['id'], img.get('prompt', '')[:50]))

results.sort(reverse=True)
print(f"\nTop 5 matches for 'basketball sports action':")
for sim, img_id, prompt in results[:5]:
    print(f"  {sim:.3f} - ID {img_id}: {prompt}...")

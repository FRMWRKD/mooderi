#!/usr/bin/env python3
"""Generate embeddings for all images missing them"""
import os
import sys
sys.path.insert(0, '/Volumes/T7/New Coding Projects/MoodBoard')

# Load env
from dotenv import load_dotenv
load_dotenv('/Volumes/T7/New Coding Projects/MoodBoard/.env')

# Test embedding first
from app.services.embedding_service import generate_embedding, embed_all_images

print("=== Testing Embedding API ===")
test = generate_embedding("basketball sports action")
if test:
    print(f"✓ API works! Generated {len(test)} dimensions")
else:
    print("✗ Embedding API failed - check API key")
    sys.exit(1)

print("\n=== Generating Embeddings for All Images ===")
embed_all_images()

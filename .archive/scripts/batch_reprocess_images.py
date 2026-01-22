#!/usr/bin/env python3
"""
Batch reprocess images that are missing Straico prompts.
This script calls the analyze-image edge function for each broken image.
"""

import os
import sys
import httpx
import time
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')  # anon key
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

def get_broken_images():
    """Get all images that need reprocessing."""
    print("Fetching images that need reprocessing...")
    
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            f"{SUPABASE_URL}/rest/v1/images",
            params={
                "select": "id,image_url",
                "generated_prompts": "is.null",
                "image_url": "not.is.null",
                "order": "id.desc"
            },
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            }
        )
        
        if response.status_code == 200:
            images = response.json()
            print(f"Found {len(images)} images to reprocess")
            return images
        else:
            print(f"Error fetching images: {response.status_code}")
            print(response.text)
            return []

def reprocess_image(image_id: int, image_url: str):
    """Call analyze-image edge function to reprocess a single image."""
    print(f"  Processing image {image_id}...", end=" ", flush=True)
    
    try:
        with httpx.Client(timeout=180.0) as client:  # 3 min timeout for full pipeline
            response = client.post(
                f"{SUPABASE_URL}/functions/v1/analyze-image",
                json={
                    "image_id": image_id,
                    "image_url": image_url
                },
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    prompt_preview = result.get('prompt', '')[:80]
                    print(f"✓ Done - '{prompt_preview}...'")
                    return True
                else:
                    print(f"✗ Failed: {result.get('error', 'Unknown error')}")
                    return False
            else:
                print(f"✗ HTTP {response.status_code}")
                return False
                
    except httpx.TimeoutException:
        print("✗ Timeout")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("MoodBoard - Batch Image Reprocessing")
    print("=" * 60)
    print()
    
    images = get_broken_images()
    
    if not images:
        print("No images to reprocess!")
        return
    
    # Limit to first N images for testing
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    images_to_process = images[:batch_size]
    
    print(f"\nProcessing {len(images_to_process)} images (of {len(images)} total)")
    print("Each image takes ~60-90 seconds (Visionati + Straico)")
    print("-" * 60)
    
    success_count = 0
    fail_count = 0
    
    for i, img in enumerate(images_to_process, 1):
        print(f"\n[{i}/{len(images_to_process)}]", end="")
        if reprocess_image(img['id'], img['image_url']):
            success_count += 1
        else:
            fail_count += 1
        
        # Small delay between requests to avoid rate limiting
        if i < len(images_to_process):
            time.sleep(2)
    
    print()
    print("=" * 60)
    print(f"Complete! ✓ {success_count} succeeded, ✗ {fail_count} failed")
    print("=" * 60)

if __name__ == "__main__":
    main()

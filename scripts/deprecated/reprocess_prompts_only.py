
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.supabase_service import supabase_service
from app.services.straico_service import generate_prompts

# Thread-safe counter
counter_lock = threading.Lock()
success_count = 0
failed_count = 0

def process_single_image(img, index):
    global success_count, failed_count
    
    try:
        # Construct analysis object
        analysis = img.get('metadata') or {}
        if not analysis.get('short_description'):
            analysis['short_description'] = img.get('prompt') or "Cinematic shot"
            
        print(f"[{index}] Triggering generation for ID {img['id']}...")
        
        # Call Edge Function (proxied via straico_service)
        result = generate_prompts(analysis, image_url=img.get('image_url'), image_id=img['id'])
        
        if result and not result.get('error'):
            with counter_lock:
                success_count += 1
            return True
        else:
            with counter_lock:
                failed_count += 1
            print(f"  [Error] ID {img['id']}: {result.get('error')}")
            return False
            
    except Exception as e:
        with counter_lock:
            failed_count += 1
        print(f"  [Exception] ID {img['id']}: {e}")
        return False

def reprocess_prompts_concurrent():
    print("Starting PARALLEL AI Prompts generation...")
    
    try:
        response = supabase_service.client.table('images').select('*').execute()
        images = response.data
        print(f"Found {len(images)} images to process.")
    except Exception as e:
        print(f"Error fetching images: {e}")
        return

    # Use 20 workers for speed
    max_workers = 20
    print(f"Launching with {max_workers} workers...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = []
        for i, img in enumerate(images):
            futures.append(executor.submit(process_single_image, img, i+1))
            
        # Wait for all
        for future in as_completed(futures):
            future.result()

    print(f"\n\nBatch processing complete!")
    print(f"Success: {success_count}")
    print(f"Failed: {failed_count}")

if __name__ == "__main__":
    reprocess_prompts_concurrent()

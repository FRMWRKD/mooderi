#!/usr/bin/env python3
"""
BATCH Reprocess - 10 images at a time, wait, then next 10.
"""
import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()
sys.path.append('.')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
BATCH_SIZE = 10
WAIT_BETWEEN_BATCHES = 5  # seconds

from app.services.supabase_service import supabase_service

def process_image(image_id: int) -> dict:
    """Process single image."""
    try:
        headers = {'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'}
        img = supabase_service.get_image(image_id)
        if not img or not img.get('image_url'):
            return {'id': image_id, 'status': 'skip'}
        
        # Visionati
        resp1 = requests.post(f'{SUPABASE_URL}/functions/v1/analyze-image', 
            json={'image_url': img['image_url']}, headers=headers, timeout=180)
        if resp1.status_code != 200:
            return {'id': image_id, 'status': 'error', 'step': 'V'}
        
        prompt = resp1.json().get('prompt', '')
        if len(prompt) < 100:
            return {'id': image_id, 'status': 'error', 'step': 'V-empty'}
        
        # Straico
        resp2 = requests.post(f'{SUPABASE_URL}/functions/v1/generate-prompts',
            json={'image_id': image_id, 'image_url': img['image_url'], 
                  'analysis': {'detailed_description': prompt[:6000], 'colors': [], 'tags': []}},
            headers=headers, timeout=180)
        if resp2.status_code != 200:
            return {'id': image_id, 'status': 'error', 'step': 'S'}
        
        r = resp2.json()
        return {'id': image_id, 'status': 'ok', 
                't2i': len(r.get('text_to_image', '')),
                'i2i': len(r.get('image_to_image', '')),
                't2v': len(r.get('text_to_video', ''))}
    except Exception as e:
        return {'id': image_id, 'status': 'err', 'e': str(e)[:30]}


def process_batch(batch):
    """Process a batch of images in parallel."""
    results = []
    with ThreadPoolExecutor(max_workers=len(batch)) as executor:
        futures = {executor.submit(process_image, img_id): img_id for img_id in batch}
        for future in as_completed(futures):
            results.append(future.result())
    return results


def main():
    images = supabase_service.client.table('images').select('id').not_.is_('image_url', 'null').order('id').execute()
    if not images.data:
        print('No images'); return
    
    image_ids = [img['id'] for img in images.data]
    total = len(image_ids)
    batches = [image_ids[i:i+BATCH_SIZE] for i in range(0, len(image_ids), BATCH_SIZE)]
    
    print(f'=== BATCH Processing: {total} images in {len(batches)} batches of {BATCH_SIZE} ===\n')
    
    success, errors = 0, 0
    start = time.time()
    
    for batch_num, batch in enumerate(batches, 1):
        print(f'--- Batch {batch_num}/{len(batches)} (images {batch[0]}-{batch[-1]}) ---')
        
        results = process_batch(batch)
        
        for r in results:
            if r['status'] == 'ok':
                print(f"  #{r['id']}: ✓ {r['t2i']}/{r['i2i']}/{r['t2v']}")
                success += 1
            elif r['status'] == 'skip':
                print(f"  #{r['id']}: ⊘")
            else:
                print(f"  #{r['id']}: ✗ {r.get('step', r.get('e', '?'))}")
                errors += 1
        
        if batch_num < len(batches):
            print(f'  Waiting {WAIT_BETWEEN_BATCHES}s...\n')
            time.sleep(WAIT_BETWEEN_BATCHES)
    
    elapsed = (time.time() - start) / 60
    print(f'\n=== Done in {elapsed:.1f}m | Success: {success} | Errors: {errors} ===')


if __name__ == '__main__':
    main()

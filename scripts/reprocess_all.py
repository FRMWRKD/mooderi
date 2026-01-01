
import os
import sys
import requests
import tempfile
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.supabase_service import supabase_service
from app.services.straico_service import generate_prompts
from app.engine import extract_colors_local

def download_temp_image(url):
    """Download image to a temporary file for processing."""
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            fd, path = tempfile.mkstemp(suffix='.jpg')
            with os.fdopen(fd, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return path
    except Exception as e:
        print(f"Error downloading {url}: {e}")
    return None

def reprocess_all_images():
    print("Starting batch reprocessing...")
    
    # 1. Fetch all images
    try:
        # Fetching in chunks would be better for huge DBs, but for now fetch all
        response = supabase_service.client.table('images').select('*').execute()
        images = response.data
        print(f"Found {len(images)} images to process.")
        
    except Exception as e:
        print(f"Error fetching images: {e}")
        return

    success_count = 0
    
    for i, img in enumerate(images):
        print(f"\n[{i+1}/{len(images)}] Processing ID {img['id']}...")
        
        updates = {}
        
        # 2. Enhanced Color Extraction
        # Only if not already processed or if we want to force update
        # For now, let's force update since we just added the feature
        img_url = img.get('image_url')
        temp_path = None
        
        if img_url:
            temp_path = download_temp_image(img_url)
            if temp_path:
                print("  - Extracting colors...")
                new_colors = extract_colors_local(temp_path)
                if new_colors:
                    updates['colors'] = new_colors
                    print(f"    Found: {new_colors}")
                
        # 3. AI Prompt Generation
        # Check if already has generated prompts
        if not img.get('generated_prompts'):
            print("  - Generating AI prompts...")
            
            # Construct analysis object from existing metadata
            # If we have 'metadata' (Visionati JSON), use it
            # Otherwise construct from DB fields
            
            analysis = img.get('metadata') or {}
            
            # Ensure basic fields exist if metadata is empty/partial
            if not analysis.get('short_description'):
                analysis['short_description'] = img.get('prompt') or "Cinematic shot"
            
            if not analysis.get('tags') and img.get('tags'):
                # Convert list of tags to expected format if needed, 
                # but generate_prompts handles basic dicts too.
                 pass

            # Generate
            prompts = generate_prompts(analysis, image_url=img_url)
            
            if prompts:
                updates['generated_prompts'] = prompts
                print("    Prompts generated successfully.")
            else:
                print("    Failed to generate prompts.")
        else:
            print("  - AI prompts already exist. Skipping.")

        # 4. Update Database
        if updates:
            # Try updating everything first
            try:
                supabase_service.client.table('images')\
                    .update(updates)\
                    .eq('id', img['id'])\
                    .execute()
                print("  - Database updated successfully.")
                success_count += 1
            except Exception as e:
                # If that fails, try updating ONLY colors (if available)
                # This handles the case where 'generated_prompts' column is missing
                print(f"  - Full update failed: {e}")
                
                if 'colors' in updates and 'generated_prompts' in updates:
                    print("  - Retrying with ONLY colors...")
                    try:
                        supabase_service.client.table('images')\
                            .update({'colors': updates['colors']})\
                            .eq('id', img['id'])\
                            .execute()
                        print("  - Colors updated successfully (Prompts skipped due to missing column).")
                        success_count += 1
                    except Exception as e2:
                        print(f"  - Colors update also failed: {e2}")
        else:
            print("  - No updates needed.")

        # Clean up temp file if exists
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    print(f"\n\nBatch processing complete! Updated {success_count} images.")

if __name__ == "__main__":
    reprocess_all_images()

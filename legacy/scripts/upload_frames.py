
import os
import mimetypes
from app.services.supabase_service import supabase_service

def upload_and_update():
    frames_dir = 'app/static/processed/frames'
    bucket_name = 'images'
    
    if not os.path.exists(frames_dir):
        print(f"Directory {frames_dir} not found.")
        return

    files = [f for f in os.listdir(frames_dir) if f.endswith('.jpg') and not f.startswith('._') and 'video_20251217_124406' in f]
    print(f"Found {len(files)} frames to sync...")

    updated_count = 0
    
    for filename in files:
        file_path = os.path.join(frames_dir, filename)
        
        # Extract video ID from filename (video_YYYYMMDD_HHMMSS)
        # Format: video_20251217_124406_frame_0000.jpg
        parts = filename.split('_frame_')
        if len(parts) != 2:
            continue
            
        video_id = parts[0]
        storage_path = f"processed/{video_id}/{filename}"
        
        print(f"Processing {filename}...")
        
        try:
            # 1. Upload to Storage
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            content_type = mimetypes.guess_type(file_path)[0] or 'image/jpeg'
            
            try:
                supabase_service.client.storage.from_(bucket_name).upload(
                    file=file_data,
                    path=storage_path,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
                print(f"  - Uploaded to Storage")
            except Exception as e:
                # Ignore if already exists (or handle update)
                if "Duplicate" not in str(e):
                    print(f"  ! Upload failed: {e}")
            
            # 2. Get Public URL
            public_url = supabase_service.client.storage.from_(bucket_name).get_public_url(storage_path)
            
            # 3. Update Database
            # We look for the record with the OLD local URL
            local_url_part = f"/static/processed/frames/{filename}"
            
            response = supabase_service.client.table("images")\
                .update({"image_url": public_url})\
                .eq("image_url", local_url_part)\
                .execute()
                
            if response.data:
                print(f"  - Database updated -> {public_url}")
                updated_count += 1
            else:
                print(f"  ! No matching DB record found for local path")

        except Exception as e:
            print(f"  ! Error processing {filename}: {e}")

    print(f"\nSync complete. Updated {updated_count} records.")

if __name__ == "__main__":
    upload_and_update()

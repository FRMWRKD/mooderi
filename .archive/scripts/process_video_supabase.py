
import os
import sys
import mimetypes
from pathlib import Path
from app.engine import process_video
from app.services.supabase_service import supabase_service
from supabase import Client

def upload_frame_to_storage(frame_path: str, video_id: str) -> str:
    """Uploads a local frame file to Supabase Storage and returns the public URL."""
    try:
        bucket_name = "images"
        file_name = os.path.basename(frame_path)
        # Organize by video ID or date to avoid clutter
        storage_path = f"processed/{video_id}/{file_name}"
        
        with open(frame_path, 'rb') as f:
            file_data = f.read()
            
        content_type = mimetypes.guess_type(frame_path)[0] or 'image/jpeg'
        
        # Upload using the Supabase client from service
        # Accessing the underlying client
        res = supabase_service.client.storage.from_(bucket_name).upload(
            file=file_data,
            path=storage_path,
            file_options={"content-type": content_type}
        )
        
        # Get public URL
        public_url = supabase_service.client.storage.from_(bucket_name).get_public_url(storage_path)
        return public_url
        
    except Exception as e:
        print(f"Error uploading {frame_path}: {e}")
        return None

def process_and_upload(video_url: str):
    print(f"🎬 Processing video: {video_url}")
    
    # 1. Run local processing (Download -> Detect -> Extract -> Analyze)
    result = process_video(video_url)
    
    if not result['success']:
        print(f"❌ Video processing failed: {result.get('error')}")
        return
    
    video_title = result['video_info'].get('title', 'Unknown Video')
    video_id = Path(result['video_info']['video_path']).stem
    
    print(f"✅ Processing complete. Found {len(result['frames'])} frames.")
    print(f"☁️ Uploading results to Supabase for video: {video_title}...")
    
    uploaded_count = 0
    
    # 2. Upload each frame and insert into DB
    for frame in result['frames']:
        local_path = frame['path']
        
        # Skip if analysis failed for this frame (optional)
        if not frame.get('prompt'):
            print(f"⚠️ Skipping frame {frame['scene_index']} (no prompt generated)")
            continue
            
        # Upload message
        print(f"   Uploading frame {frame['scene_index']}...")
        
        public_url = upload_frame_to_storage(local_path, video_id)
        
        if not public_url:
            continue
            
        # Prepare DB record
        image_data = {
            "image_url": public_url,
            "prompt": frame['prompt'],
            "mood": frame['tags'][0].capitalize() if frame['tags'] else "Cinematic",
            "lighting": "Cinematic", # Default, or extract from tags if possible
            "tags": frame['tags'],
            "colors": frame['colors'],
            "width": 1280, # Assuming 720p/1080p source, framed to 16:9 usually
            "height": 720,
            "aspect_ratio": "16:9",
            "source_video_url": video_url,
            "is_public": True # Default to public for now
        }
        
        # Insert into DB
        # Note: We need to use a Supabase client capable of insert.
        # supabase_service.supabase is initialized with ANON key, but we had RLS issues.
        # We might need to use SERVICE_ROLE key if we want to bypass RLS, 
        # OR ensure the RLS policy allows 'anon' inserts (which we tried to fix earlier).
        
        try:
            # Try inserting with current client (anon)
            response = supabase_service.client.table("images").insert(image_data).execute()
            if response.data:
                uploaded_count += 1
                print(f"   ✅ Saved to DB: {frame.get('prompt')[:30]}...")
        except Exception as e:
            print(f"   ❌ DB Insert failed: {e}")
            # Fallback: Print SQL for manual insert if needed?
    
    print(f"\n✨ Job Complete! Uploaded {uploaded_count}/{len(result['frames'])} frames to Supabase.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_video_supabase.py <video_url>")
        sys.exit(1)
        
    url = sys.argv[1]
    process_and_upload(url)

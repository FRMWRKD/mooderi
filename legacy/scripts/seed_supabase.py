
import os
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_KEY not found in environment.")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed():
    print("🌱 Starting Supabase Seed...")

    # 1. Upload a Test Image to Storage
    image_url = "https://picsum.photos/800/600"
    print(f"Downloading sample image from {image_url}...")
    
    try:
        response = requests.get(image_url)
        if response.status_code == 200:
            file_data = response.content
            file_name = "sample_neon_rain.jpg"
            bucket_name = "images"
            
            print(f"Uploading {file_name} to bucket '{bucket_name}'...")
            storage_response = supabase.storage.from_(bucket_name).upload(
                path=file_name,
                file=file_data,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
            
            # Get Public URL
            public_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
            print(f"✅ Image uploaded: {public_url}")
            
            # 2. Insert Metadata into 'images' table
            print("Inserting record into 'images' table...")
            
            prompt = "Cinematic still, neon-lit Tokyo alley at night, rain-soaked pavement reflecting pink and blue signs, lone figure with umbrella, anamorphic lens flare, shallow depth of field, Blade Runner aesthetic --ar 16:9"
            
            data = {
                "image_url": public_url,
                "prompt": prompt,
                "mood": "Melancholic",
                "lighting": "Neon",
                "tags": ["cyberpunk", "rain", "night", "neon"],
                "colors": ["#ff2d55", "#00f0ff", "#1a1a2e"],
                "width": 800,
                "height": 600,
                "aspect_ratio": "4:3",
                "is_public": True,
                "copy_count": 0
            }
            
            insert_response = supabase.table("images").insert(data).execute()
            print(f"✅ Database record created: ID {insert_response.data[0]['id']}")
            
        else:
            print("❌ Failed to download sample image.")
    
    except Exception as e:
        print(f"❌ Error during seeding: {e}")

if __name__ == "__main__":
    seed()

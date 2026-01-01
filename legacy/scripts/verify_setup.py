
from app.services.supabase_service import supabase_service
import sys

def verify():
    print("🔍 Verifying App-Supabase Connection...")
    
    try:
        # Check Images
        images = supabase_service.get_public_images()
        print(f"✅ Connection successful. Found {len(images)} images in public library.")
        
        if images:
            print(f"   Sample: {images[0]['prompt'][:50]}...")
            
        return True
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

if __name__ == "__main__":
    success = verify()
    sys.exit(0 if success else 1)


import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.supabase_service import supabase_service
import time

def check_progress():
    print("Checking database for aesthetic scores...")
    
    # Check updated count > 0
    res = supabase_service.client.table('images').select('id, aesthetic_score').gt('aesthetic_score', 0).execute()
    print(f"Images with score > 0: {len(res.data)}")
    
    if len(res.data) > 0:
        print("Sample scores:", [x['aesthetic_score'] for x in res.data[:5]])
        
if __name__ == "__main__":
    check_progress()

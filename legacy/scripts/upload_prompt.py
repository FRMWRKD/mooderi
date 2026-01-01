
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add parent dir to path to import app modules if needed
sys.path.append(str(Path(__file__).parent.parent))

from app.services.supabase_service import supabase_service

PROMPT_FILE = Path('app/prompts/visionati_json_v2.txt')

def upload_system_prompt():
    print(f"Reading prompt from {PROMPT_FILE}...")
    try:
        with open(PROMPT_FILE, 'r') as f:
            content = f.read()
            
        print("Prompt content loaded. Length:", len(content))
        
        # Upsert into system_prompts
        data = {
            "id": "straico_v1", # Keeping ID same to avoid code changes
            "content": content,
            "description": "Version 2: Detailed JSON output with aesthetic scoring"
        }
        
        response = supabase_service.client.table("system_prompts").upsert(data).execute()
        print("Successfully uploaded prompt to DB:", response.data)
        
    except Exception as e:
        print(f"Error uploading prompt: {e}")

if __name__ == "__main__":
    upload_system_prompt()

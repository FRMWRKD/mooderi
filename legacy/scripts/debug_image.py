
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.supabase_service import supabase_service
import json

def inspect_image(image_id):
    print(f"Inspecting Image {image_id}...")
    try:
        data = supabase_service.get_image(image_id)
        print(f"ID: {data['id']}")
        print(f"Aesthetic Score: {data.get('aesthetic_score')}")
        prompts = data.get('generated_prompts')
        print("Generated Prompts Type:", type(prompts))
        if prompts:
            print("Generated Prompts Keys:", prompts.keys())
            if 'error' in prompts:
                print("ERROR in JSON:", prompts['error'])
                print("RAW response:", prompts.get('raw'))
            else:
                print("Partial content:", json.dumps(prompts, indent=2)[:500])
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Check ID 2 (which supposedly succeeded) and ID 4 (failed)
    inspect_image(2) 
    inspect_image(4)

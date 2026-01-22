
import os
import sys
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.supabase_service import supabase_service

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

def test_pipeline(image_id):
    print(f"Testing Pipeline for Image {image_id}...")
    
    # 1. Fetch Image
    img = supabase_service.get_image(image_id)
    if not img:
        print("Image not found")
        return

    print(f"Original URL: {img['image_url']}")
    
    # 2. Call Analyze-Image (Visionati)
    print("\n--- Step 1: Visionati Analysis (Edge Function) ---")
    analyze_url = f"{SUPABASE_URL}/functions/v1/analyze-image"
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # We pass image_url. The function handles fetching.
        payload = {"image_url": img['image_url']}
        print("Calling analyze-image...")
        response = requests.post(analyze_url, json=payload, headers=headers, timeout=120) # Long timeout for polling
        
        if response.status_code != 200:
            print(f"Analysis Failed: {response.text}")
            return
            
        analysis_result = response.json()
        print("Analysis Success!")
        print(f"Detailed Prompt: {analysis_result.get('prompt')[:200]}...")
        
        # 3. Call Generate-Prompts (Straico)
        print("\n--- Step 2: Straico Generation (Edge Function) ---")
        generate_url = f"{SUPABASE_URL}/functions/v1/generate-prompts"
        
        # Validate Visionati response before proceeding
        description_to_use = analysis_result.get('prompt')
        if not description_to_use or len(description_to_use) < 10:
            print("❌ Visionati returned empty or invalid prompt. Cannot proceed.")
            print("Raw response:", json.dumps(analysis_result.get('raw'), indent=2)[:500])
            return

        straico_payload = {
            "image_id": image_id, 
            "image_url": img['image_url'],
            "analysis": {
                "detailed_description": description_to_use,
                "colors": analysis_result.get('colors'),
                "tags": analysis_result.get('tags')
            }
        }
        
        print("Calling generate-prompts...")
        gen_response = requests.post(generate_url, json=straico_payload, headers=headers, timeout=60)
        
        if gen_response.status_code != 200:
            print(f"Generation Failed: {gen_response.text}")
            return
            
        gen_result = gen_response.json()
        print("\n--- Step 3: Result ---")
        print("FULL JSON:", json.dumps(gen_result, indent=2))
        
        if gen_result.get('error'):
             print(f"Error: {gen_result['error']}")
             print("Raw:", gen_result.get('raw'))
        else:
             print("Success!")
             score = gen_result.get('aesthetics', {}).get('aesthetic_score', 'N/A')
             print(f"Aesthetic Score: {score}")
             
             # Verify Mapped Fields
             print(f"I2I Prompt (Mapped): {gen_result.get('image_to_image')}")
             print(f"T2V Prompt (Mapped): {gen_result.get('text_to_video')}")
             
             # Verify DB persistence of Main Prompt
             print("\n--- Step 4: Verify DB Update ---")
             updated_img = supabase_service.get_image(image_id)
             print(f"DB Main Prompt: {updated_img.get('prompt')}")
             
             if updated_img.get('prompt') == gen_result.get('stable_diffusion_prompt'):
                 print("✅ Main Prompt updated correctly in DB!")
             else:
                 print("❌ Main Prompt mismtach in DB!")
             
    except Exception as e:
        print(f"Pipeline Error: {e}")

if __name__ == "__main__":
    # Test on Image 4 (or 2)
    test_pipeline(4)

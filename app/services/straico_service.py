"""
Straico API Service for AI Prompt Generation
Proxies requests to Supabase Edge Function 'generate-prompts'.
"""
import os
import json
import requests

def generate_prompts(image_analysis: dict, image_url: str = None, image_id: int = None) -> dict:
    """
    Generate AI prompts by calling the 'generate-prompts' Supabase Edge Function.
    
    Args:
        image_analysis: Detailed image analysis JSON
        image_url: Optional URL of the image
        image_id: Optional ID to update directly in DB (handled by Edge Function too)
    
    Returns:
        dict with keys: text_to_image, image_to_image, text_to_video
    """
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY') # Service role key usually
    
    if not supabase_url or not supabase_key:
        return {'error': 'Supabase credentials missing'}

    edge_function_url = f"{supabase_url}/functions/v1/generate-prompts"
    
    payload = {
        "analysis": image_analysis,
        "image_url": image_url,
        "image_id": image_id
    }
    
    headers = {
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(edge_function_url, json=payload, headers=headers, timeout=60)
        
        if not response.ok:
            return {'error': f"Edge Function failed: {response.text}"}
            
        return response.json()
        
    except Exception as e:
        return {'error': str(e)}

def get_cached_prompts(image_id: int) -> dict:
    from app.services.supabase_service import supabase_service
    try:
        response = supabase_service.client.table('images')\
            .select('generated_prompts')\
            .eq('id', image_id)\
            .single()\
            .execute()
        
        if response.data and response.data.get('generated_prompts'):
            return response.data['generated_prompts']
        return None
    except Exception:
        return None

def cache_prompts(image_id: int, prompts: dict) -> bool:
    # Deprecated: Edge Function handles caching now, but kept for compatibility
    return True

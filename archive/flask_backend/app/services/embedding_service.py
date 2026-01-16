"""
Embedding service using Google Vertex AI for vector generation.
Uses text-embedding-004 model (768 dimensions).
"""

import os
import requests
from app.services.supabase_service import supabase_service

GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', 'AIzaSyCvaNgiZN0tWqC_1QYi7mqMFIdURkJpgyA')
EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIMENSION = 768

def generate_embedding(text: str) -> list:
    """Generate embedding vector using Google's Generative AI API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent"
    
    headers = {
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {
            "parts": [{"text": text}]
        }
    }
    
    response = requests.post(
        f"{url}?key={GOOGLE_API_KEY}",
        headers=headers,
        json=payload
    )
    
    if response.status_code != 200:
        print(f"Embedding API error: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    return data.get("embedding", {}).get("values", [])

def embed_all_images():
    """Generate embeddings for all images that don't have one."""
    try:
        # Fetch images without embeddings  
        response = supabase_service.client.table('images')\
            .select('id, prompt')\
            .is_('embedding', 'null')\
            .execute()
        
        images = response.data
        print(f"Found {len(images)} images without embeddings")
        
        updated = 0
        
        for image in images:
            if not image.get('prompt'):
                continue
            
            # Generate embedding
            embedding = generate_embedding(image['prompt'])
            
            if not embedding:
                print(f"Failed to embed image {image['id']}")
                continue
            
            # Update database
            supabase_service.client.table('images').update({
                'embedding': embedding
            }).eq('id', image['id']).execute()
            
            updated += 1
            print(f"Embedded image {image['id']} ({updated}/{len(images)})")
        
        print(f"Done! Embedded {updated} images.")
        return updated
    except Exception as e:
        print(f"Error in batch embedding: {e}")
        return 0

def get_similar_images(image_id: int, limit: int = 4):
    """
    Find similar images using vector similarity.
    Falls back to tag-based matching if embeddings not available.
    """
    try:
        # Get the source image
        source = supabase_service.get_image(image_id)
        if not source:
            return []
        
        # Check if source has embedding - use vector search
        if source.get('embedding'):
            try:
                response = supabase_service.client.rpc(
                    'match_images',
                    {
                        'query_embedding': source['embedding'],
                        'match_threshold': 0.5,
                        'match_count': limit + 1  # +1 because we filter out self
                    }
                ).execute()
                
                # Filter out the source image
                results = [img for img in response.data if img['id'] != image_id]
                if results:
                    return results[:limit]
            except Exception as e:
                print(f"Vector search failed, falling back to tags: {e}")
        
        # Fallback: tag/mood-based similarity
        source_tags = set(source.get('tags', []) or [])
        source_mood = source.get('mood', '')
        
        response = supabase_service.client.table('images')\
            .select('id, image_url, prompt, mood, colors, tags')\
            .eq('is_public', True)\
            .neq('id', image_id)\
            .limit(50)\
            .execute()
        
        candidates = response.data
        scored = []
        
        for img in candidates:
            img_tags = set(img.get('tags', []) or [])
            tag_overlap = len(source_tags & img_tags)
            mood_match = 1 if img.get('mood') == source_mood else 0
            score = tag_overlap * 2 + mood_match * 3
            
            if score > 0:
                scored.append((score, img))
        
        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            return [img for _, img in scored[:limit]]
        
        # Final Fallback: If no tags/mood data (e.g. new image), show recent images
        print("No similar images found, falling back to recent.")
        return supabase_service.get_public_images(limit=limit)
    
    except Exception as e:
        print(f"Error finding similar images: {e}")
        # Always return something to keep UI populated
        return supabase_service.get_public_images(limit=limit)

if __name__ == "__main__":
    # Test embedding generation
    test = generate_embedding("A beautiful sunset over the ocean")
    if test:
        print(f"✓ Embedding works! Generated {len(test)} dimensions")
    else:
        print("✗ Embedding failed")

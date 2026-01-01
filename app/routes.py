from flask import Blueprint, render_template

main = Blueprint('main', __name__)


# ============================================
# AUTH HELPER
# ============================================

def get_user_from_token():
    """
    Extract user_id from Authorization header JWT token.
    Returns (user_id, None) if authenticated, (None, None) if guest.
    For required auth, check if user_id is None in the caller.
    """
    from flask import request
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, None  # Guest user - no auth provided
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user.id, None
    except Exception as e:
        print(f"Auth token validation error: {e}")
    
    return None, None  # Invalid token treated as guest


@main.route('/')
def index():
    from flask import request
    from app.services.supabase_service import supabase_service
    
    # Get sorting option - default to ranked (composite AI + engagement)
    sort = request.args.get('sort', 'ranked')
    video_id = request.args.get('video_id')  # Filter by source video
    
    try:
        if video_id:
            # Filter by specific video source
            response = supabase_service.client.table('images')\
                .select('*')\
                .eq('video_id', video_id)\
                .eq('is_public', True)\
                .order('created_at', desc=True)\
                .limit(50)\
                .execute()
            images = response.data if response.data else []
        else:
            # Fetch images with sorting using the service
            images = supabase_service.get_public_images(limit=50, sort_by=sort)
    except Exception as e:
        print(f"Error fetching images: {e}")
        images = []
        
    return render_template('index.html', images=images, current_sort=sort)


@main.route('/settings')
def settings():
    return render_template('settings.html')


@main.route('/videos')
def videos():
    from app.services.video_service import video_library_service
    # TODO: Get actual user_id from auth when ready
    user_videos = video_library_service.get_user_videos(limit=100)
    return render_template('videos.html', videos=user_videos)


@main.route('/video/<video_id>')
def video_detail(video_id):
    from app.services.video_service import video_library_service
    video = video_library_service.get_video_details(video_id)
    if not video:
        return "Video not found", 404
    return render_template('video_detail.html', video=video)


@main.route('/folder/<folder_id>')
def folder_detail(folder_id):
    # Mock data for folder view until backend is ready
    from app.services.supabase_service import supabase_service
    # Just fetch some random images to populate the view
    images = supabase_service.get_public_images(limit=12)
    
    # Mock folder names based on ID
    folder_name = "Inspiration"
    if folder_id == "scifi": folder_name = "Sci-Fi Concepts"
    if folder_id == "cyberpunk": folder_name = "Cyberpunk v2"
    if folder_id == "arch": folder_name = "Architecture"
    
    return render_template('folder.html', folder_name=folder_name, images=images)


@main.route('/upload')
def upload():
    return render_template('upload.html')


@main.route('/my-images')
def my_images():
    from app.services.supabase_service import supabase_service
    # TODO: Filter by user_id when auth is implemented
    # For now, show all public images as a placeholder
    images = supabase_service.get_public_images(limit=50)
    return render_template('my_images.html', images=images)


@main.route('/search')
def search():
    from flask import request
    from app.services.supabase_service import supabase_service
    
    tag = request.args.get('tag')
    color = request.args.get('color')
    query_text = request.args.get('q')
    similar_to = request.args.get('similar_to')  # Image ID for similarity search
    
    try:
        # Similar search - find images with similar embeddings
        if similar_to:
            try:
                # Get source image embedding
                source = supabase_service.client.table('images').select('embedding, prompt').eq('id', similar_to).single().execute()
                if source.data and source.data.get('embedding'):
                    # Use RPC for vector similarity search
                    response = supabase_service.client.rpc(
                        'search_similar_images',
                        {
                            'query_embedding': source.data['embedding'],
                            'match_threshold': 0.7,
                            'match_count': 20
                        }
                    ).execute()
                    images = response.data if response.data else []
                    filter_label = f"Similar to: {source.data.get('prompt', 'Unknown')[:30]}..."
                else:
                    images = []
                    filter_label = "Similar search unavailable"
            except Exception as e:
                print(f"Similar search error: {e}")
                # Fallback: just show recent images
                images = supabase_service.get_public_images(limit=20)
                filter_label = "Similar items"
            
            return render_template('search.html', images=images, filter_label=filter_label, query='')
        
        query = supabase_service.client.table('images')\
            .select('*')\
            .eq('is_public', True)
        
        # Filter by tag
        if tag:
            query = query.contains('tags', [tag])
        
        # Filter by color - use text search
        if color:
            query = query.ilike('colors', f'%{color}%')
        
        # Filter by text search in prompt
        if query_text:
            query = query.ilike('prompt', f'%{query_text}%')
        
        response = query.order('created_at', desc=True).limit(50).execute()
        images = response.data
        
        filter_label = tag or color or query_text or "All"
        
    except Exception as e:
        print(f"Error in search: {e}")
        images = []
        filter_label = "Error"
        
    return render_template('search.html', images=images, filter_label=filter_label, query=query_text or '')


@main.route('/api/search')
def api_search():
    """AJAX search endpoint with text and semantic modes."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    query = request.args.get('q', '').strip()
    search_type = request.args.get('type', 'text')  # 'text' or 'semantic'
    limit = min(int(request.args.get('limit', 50)), 100)
    
    if not query:
        return jsonify({'images': [], 'count': 0})
    
    try:
        if search_type == 'semantic':
            # Semantic search: generate embedding from query text, then vector search
            from app.services.embedding_service import generate_embedding
            
            query_embedding = generate_embedding(query)
            
            if query_embedding:
                # Use vector search RPC
                response = supabase_service.client.rpc(
                    'match_images',
                    {
                        'query_embedding': query_embedding,
                        'match_threshold': 0.5,
                        'match_count': limit
                    }
                ).execute()
                
                images = response.data if response.data else []
                return jsonify({'images': images, 'count': len(images), 'type': 'semantic'})
            else:
                # Fallback to text search if embedding fails
                search_type = 'text'
        
        # Text search: use existing ILIKE approach
        response = supabase_service.client.table('images')\
            .select('id, image_url, prompt, mood, colors, tags')\
            .eq('is_public', True)\
            .ilike('prompt', f'%{query}%')\
            .order('created_at', desc=True)\
            .limit(limit)\
            .execute()
        
        images = response.data if response.data else []
        return jsonify({'images': images, 'count': len(images), 'type': 'text'})
        
    except Exception as e:
        print(f"API search error: {e}")
        return jsonify({'error': str(e), 'images': []}), 500


@main.route('/api/smart-board/parse', methods=['POST'])
def parse_smart_board_prompt():
    """Parse natural language prompt and extract concepts using AI."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    from app.services.embedding_service import generate_embedding
    import requests
    import json
    import os
    
    data = request.json
    prompt = data.get('prompt', '').strip()
    
    if not prompt:
        return jsonify({'error': 'Prompt required'}), 400
    
    try:
        # Try AI-powered concept extraction first
        concepts = extract_concepts_with_ai(prompt)
        
        # Fallback to keyword matching if AI fails
        if not concepts or not any(concepts.values()):
            concepts = extract_concepts(prompt)
        
        # Get preview images using semantic search
        preview = []
        query_embedding = generate_embedding(prompt)
        
        if query_embedding:
            response = supabase_service.client.rpc(
                'match_images',
                {
                    'query_embedding': query_embedding,
                    'match_threshold': 0.4,
                    'match_count': 3
                }
            ).execute()
            preview = response.data if response.data else []
        
        # Generate suggested name from prompt
        suggested_name = generate_board_name(prompt)
        
        return jsonify({
            'concepts': concepts,
            'preview': preview,
            'suggested_name': suggested_name
        })
        
    except Exception as e:
        print(f"Smart board parse error: {e}")
        return jsonify({'error': str(e)}), 500


def extract_concepts_with_ai(prompt: str) -> dict:
    """Use Straico AI (existing project provider) to extract and expand concepts."""
    import requests
    import json
    import os
    import re
    
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing Supabase credentials for AI concept extraction")
        return None
    
    # Use the analyze-concepts Edge Function (or call Straico directly if available)
    # For now, let's call the Straico API directly like the generate-prompts Edge Function
    STRAICO_KEY = os.environ.get('STRAICO_API_KEY')
    
    if not STRAICO_KEY:
        print("Missing STRAICO_API_KEY for AI concept extraction")
        return None
    
    # System prompt for concept extraction
    system_prompt = """You are a Creative Director AI that breaks down creative briefs into searchable visual concepts.

Given this user request: "{user_prompt}"

Return a JSON object with concepts organized into these categories. Include BOTH explicit and implied/suggested concepts:

- moods: Emotional qualities (dark, moody, energetic, dramatic, elegant, etc.)
- styles: Visual styles (cinematic, commercial, vintage, minimalist, editorial, etc.)
- lighting: Lighting qualities (neon, natural, golden hour, dramatic, soft, etc.)
- colors: Color descriptions (warm, cool, vibrant, muted, specific colors)
- subjects: Subject matter (portrait, landscape, sports, fashion, product, etc.)
- references: Film/Director references if applicable
- ingredients: For commercial projects - key visual elements (textures, materials, props)
- suggestions: 3-5 additional related concepts the user might want to explore

IMPORTANT: 
- Generate 3-8 concepts per relevant category
- Include concepts that are IMPLIED but not explicitly mentioned
- The "suggestions" category should contain NEW ideas to inspire the user
- Return ONLY valid JSON, no explanation"""

    try:
        print(f"Calling Straico API for concept extraction: {prompt[:50]}...")
        response = requests.post(
            'https://api.straico.com/v1/prompt/completion',
            headers={
                'Authorization': f'Bearer {STRAICO_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'models': ['minimax/minimax-m2'],
                'message': system_prompt.format(user_prompt=prompt)
            },
            timeout=30
        )
        
        if response.status_code not in [200, 201]:
            print(f"Straico API error: {response.status_code}")
            return None
        
        result = response.json()
        
        # Parse response (same structure as generate-prompts Edge Function)
        choices = []
        if result.get('data', {}).get('completion', {}).get('choices'):
            choices = result['data']['completion']['choices']
        elif result.get('data', {}).get('completions'):
            model_keys = list(result['data']['completions'].keys())
            if model_keys:
                choices = result['data']['completions'][model_keys[0]].get('completion', {}).get('choices', [])
        
        if not choices or not choices[0].get('message', {}).get('content'):
            print("No completion choices in Straico response")
            return None
        
        content = choices[0]['message']['content']
        print(f"Straico response: {content[:100]}...")
        
        # Clean markdown code blocks
        content = re.sub(r'^```json\s*', '', content)
        content = re.sub(r'\s*```$', '', content)
        content = content.strip()
        
        # Extract JSON
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            concepts = json.loads(json_match.group())
            print(f"AI extracted concepts: {list(concepts.keys())}")
            return concepts
        
        return None
        
    except Exception as e:
        print(f"Straico concept extraction failed: {e}")
        return None


@main.route('/api/smart-board/generate', methods=['POST'])
def generate_smart_board():
    """Generate a smart moodboard with semantically matched images."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    from app.services.embedding_service import generate_embedding
    import time
    
    data = request.json
    prompt = data.get('prompt', '').strip()
    count = min(int(data.get('count', 20)), 100)
    strictness = float(data.get('strictness', 0.55))
    name = data.get('name', 'Smart Board')
    
    if not prompt:
        return jsonify({'error': 'Prompt required'}), 400
    
    try:
        # Generate embedding for prompt
        query_embedding = generate_embedding(prompt)
        
        if not query_embedding:
            return jsonify({'error': 'Failed to analyze prompt'}), 500
        
        # Semantic search with user's strictness threshold
        response = supabase_service.client.rpc(
            'match_images',
            {
                'query_embedding': query_embedding,
                'match_threshold': strictness,
                'match_count': count
            }
        ).execute()
        
        images = response.data if response.data else []
        
        # Create board response
        board = {
            'id': f'smart-{int(time.time())}',
            'name': name,
            'images': [img['id'] for img in images],
            'prompt': prompt,
            'isSmartBoard': True
        }
        
        return jsonify({
            'board': board,
            'images': images,
            'count': len(images)
        })
        
    except Exception as e:
        print(f"Smart board generate error: {e}")
        return jsonify({'error': str(e)}), 500


def extract_concepts(prompt: str) -> dict:
    """Extract mood, style, lighting, color, subjects, and ingredients from natural language."""
    prompt_lower = prompt.lower()
    
    concepts = {
        'moods': [],
        'styles': [],
        'lighting': [],
        'colors': [],
        'subjects': [],
        'references': [],
        'ingredients': []
    }
    
    # Keyword dictionaries
    MOOD_KEYWORDS = ['dark', 'moody', 'bright', 'energetic', 'calm', 'mysterious', 
                     'dramatic', 'romantic', 'melancholic', 'intense', 'serene',
                     'gritty', 'dreamy', 'ethereal', 'raw', 'intimate', 'nostalgic',
                     'hopeful', 'tense', 'peaceful', 'chaotic', 'elegant', 'luxurious',
                     'minimal', 'bold', 'subtle', 'sensual', 'powerful']
    
    STYLE_KEYWORDS = ['cinematic', 'documentary', 'commercial', 'noir', 'vintage',
                      'modern', 'retro', 'minimalist', 'abstract', 'realistic',
                      'cyberpunk', 'sci-fi', 'fantasy', 'urban', 'natural', 'editorial',
                      'fashion', 'lifestyle', 'portrait', 'landscape', 'product',
                      'architectural', 'street', 'fine art', 'high fashion', 'beauty']
    
    LIGHTING_KEYWORDS = ['neon', 'natural', 'golden hour', 'blue hour', 'harsh',
                         'soft', 'backlit', 'silhouette', 'low-key', 'high-key',
                         'practical', 'ambient', 'dramatic', 'rim light', 'volumetric',
                         'foggy', 'hazy', 'studio', 'window light', 'candlelight',
                         'fluorescent', 'mixed lighting', 'spotlight']
    
    COLOR_KEYWORDS = ['blue', 'red', 'green', 'orange', 'purple', 'yellow',
                      'teal', 'warm', 'cool', 'muted', 'vibrant', 'desaturated',
                      'monochrome', 'black and white', 'pastel', 'neon', 'earth tones',
                      'jewel tones', 'neutral', 'high contrast', 'low contrast',
                      'saturated', 'faded', 'golden', 'silver', 'rose gold']
    
    SUBJECT_KEYWORDS = ['portrait', 'landscape', 'product', 'food', 'architecture',
                        'fashion', 'sports', 'nature', 'wildlife', 'street', 'abstract',
                        'still life', 'macro', 'aerial', 'underwater', 'action',
                        'documentary', 'event', 'wedding', 'commercial', 'editorial',
                        'woman', 'man', 'model', 'athlete', 'dancer', 'hands', 'face',
                        'body', 'silhouette', 'crowd', 'couple', 'family',
                        # Sports
                        'basketball', 'football', 'soccer', 'tennis', 'baseball',
                        'golf', 'swimming', 'running', 'cycling', 'boxing', 'mma',
                        'gym', 'fitness', 'yoga', 'crossfit', 'training', 'game',
                        'player', 'team', 'court', 'field', 'stadium', 'ball']
    
    INGREDIENT_KEYWORDS = ['perfume', 'luxury', 'bottle', 'glass', 'liquid', 'mist',
                           'flowers', 'rose', 'jasmine', 'oud', 'amber', 'vanilla',
                           'sandalwood', 'citrus', 'bergamot', 'lavender', 'smoke',
                           'fabric', 'silk', 'leather', 'velvet', 'metal', 'gold',
                           'wood', 'stone', 'marble', 'water', 'fire', 'ice',
                           'crystal', 'diamond', 'pearl', 'texture', 'ingredient',
                           'raw material', 'essence', 'droplet', 'reflection']
    
    # Well-known references (movies, directors)
    REFERENCES = {
        'blade runner': 'Blade Runner',
        'wes anderson': 'Wes Anderson',
        'david fincher': 'David Fincher',
        'roger deakins': 'Roger Deakins',
        'terrence malick': 'Terrence Malick',
        'wong kar wai': 'Wong Kar-wai',
        'kubrick': 'Stanley Kubrick',
        'spielberg': 'Spielberg',
        'nolan': 'Christopher Nolan',
        'tarkovsky': 'Tarkovsky',
        'drive': 'Drive (2011)',
        'mad max': 'Mad Max',
        'matrix': 'The Matrix',
        'inception': 'Inception',
        'interstellar': 'Interstellar',
        'euphoria': 'Euphoria',
        'mr robot': 'Mr. Robot',
        'dune': 'Dune'
    }
    
    # Extract keywords
    for word in MOOD_KEYWORDS:
        if word in prompt_lower:
            concepts['moods'].append(word.capitalize())
    
    for word in STYLE_KEYWORDS:
        if word in prompt_lower:
            concepts['styles'].append(word.capitalize())
    
    for word in LIGHTING_KEYWORDS:
        if word in prompt_lower:
            concepts['lighting'].append(word.capitalize())
    
    for word in COLOR_KEYWORDS:
        if word in prompt_lower:
            concepts['colors'].append(word.capitalize())
    
    for word in SUBJECT_KEYWORDS:
        if word in prompt_lower:
            concepts['subjects'].append(word.capitalize())
    
    for word in INGREDIENT_KEYWORDS:
        if word in prompt_lower:
            concepts['ingredients'].append(word.capitalize())
    
    for key, value in REFERENCES.items():
        if key in prompt_lower:
            concepts['references'].append(value)
    
    return concepts


def generate_board_name(prompt: str) -> str:
    """Generate a suggested board name from the prompt."""
    # Take first few meaningful words
    words = prompt.split()[:4]
    name = ' '.join(words)
    
    # Capitalize and clean up
    if len(name) > 30:
        name = name[:27] + '...'
    
    return name.title() if name else 'Smart Board'


@main.route('/image/<int:image_id>')
def image_detail(image_id):
    from app.services.supabase_service import supabase_service
    from flask import abort
    
    try:
        image = supabase_service.get_image(image_id)
        if not image:
            abort(404)
            
        # Fetch more similar images (20 initially) and dedupe
        from app.services.embedding_service import get_similar_images
        raw_similar = get_similar_images(image_id, limit=20)
        
        # Deduplicate: Filter out images with the same URL or very high similarity (likely duplicates)
        seen_urls = set()
        similar_images = []
        for img in raw_similar:
            if img.get('image_url') not in seen_urls:
                seen_urls.add(img.get('image_url'))
                similar_images.append(img)
        
        return render_template('image_detail.html', image=image, similar_images=similar_images)
    except Exception as e:
        print(f"Error fetching image detail: {e}")
        abort(404)


@main.route('/api/image/<int:image_id>')
def get_image_api(image_id):
    """Get a single image by ID."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        result = supabase_service.client.table('images').select('*').eq('id', image_id).single().execute()
        
        if result.data:
            return jsonify({
                'success': True,
                'image': result.data
            })
        else:
            return jsonify({'error': 'Image not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@main.route('/api/image/<int:image_id>/similar')
def get_similar_images_api(image_id):
    from flask import request, jsonify
    from app.services.embedding_service import get_similar_images
    
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 12))
        
        # Calculate offset is tricky with vector search as it usually returns top N
        # But we can ask for page * limit and slice the result
        # Or simplistic approach: fetch more and slice
        # Since vector search is expensive, maybe we caching? 
        # For now, let's just fetch (page * limit) and return the slice [-(limit):]
        # This is inefficient for deep pagination but fine for "load more" a few times
        
        total_fetch = page * limit
        all_similar = get_similar_images(image_id, limit=total_fetch + 1)  # Fetch one extra to check if more exist
        
        # Slice the results for the current page
        start_idx = (page - 1) * limit
        page_results = all_similar[start_idx:start_idx + limit]
        
        # has_more is true if we got more than total_fetch results
        has_more = len(all_similar) > total_fetch
        
        return jsonify({
            'images': page_results,
            'has_more': has_more
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@main.route('/api/vote/<int:image_id>', methods=['POST'])
def vote(image_id):
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    data = request.json
    vote_type = data.get('type')  # 'like' or 'dislike'
    
    if vote_type not in ['like', 'dislike']:
        return jsonify({'error': 'Invalid vote type'}), 400
    
    try:
        # Get current counts
        image = supabase_service.get_image(image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        # Increment the appropriate counter
        if vote_type == 'like':
            new_likes = (image.get('likes') or 0) + 1
            supabase_service.client.table('images').update({
                'likes': new_likes
            }).eq('id', image_id).execute()
            return jsonify({'likes': new_likes, 'dislikes': image.get('dislikes') or 0})
        else:
            new_dislikes = (image.get('dislikes') or 0) + 1
            supabase_service.client.table('images').update({
                'dislikes': new_dislikes
            }).eq('id', image_id).execute()
            return jsonify({'likes': image.get('likes') or 0, 'dislikes': new_dislikes})
            
    except Exception as e:
        print(f"Error voting: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/login')
def login():
    return render_template('login.html')


@main.route('/api/process-video', methods=['POST'])
def process_video_endpoint():
    from flask import request, jsonify
    from app.services.video_service import start_video_processing
    from app.services.supabase_service import supabase_service
    
    data = request.json
    video_url = data.get('url')
    quality_mode = data.get('quality_mode', 'medium')  # NEW: strict, medium, high
    
    if not video_url:
        return jsonify({'error': 'URL is required'}), 400
    
    # Validate quality mode
    if quality_mode not in ['strict', 'medium', 'high']:
        quality_mode = 'medium'
    
    # Check if video URL already processed (has existing images)
    try:
        existing = supabase_service.client.table('images')\
            .select('id, source_video_url')\
            .eq('source_video_url', video_url)\
            .limit(1)\
            .execute()
        
        if existing.data and len(existing.data) > 0:
            # Video already processed - return info about existing content
            count_resp = supabase_service.client.table('images')\
                .select('id', count='exact')\
                .eq('source_video_url', video_url)\
                .execute()
            
            return jsonify({
                'already_processed': True,
                'message': f'This video has already been processed with {count_resp.count} frames.',
                'redirect_url': f'/search?video_url={video_url}',
                'frame_count': count_resp.count
            })
    except Exception as e:
        print(f"Duplicate check error: {e}")
        # Continue with processing if check fails
        
    # Get user_id from JWT token if authenticated
    user_id, _ = get_user_from_token()
    
    job_id = start_video_processing(video_url, quality_mode, user_id=user_id)
    return jsonify({'job_id': job_id, 'status': 'queued', 'quality_mode': quality_mode})


@main.route('/api/process-video/status/<job_id>')
def job_status(job_id):
    from flask import jsonify
    from app.services.video_service import get_job_status
    
    job = get_job_status(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
        
    return jsonify(job)


@main.route('/api/process-video/frames/<job_id>')
def get_pending_frames(job_id):
    """Get pending frames for approval (both selected and rejected)."""
    from flask import jsonify
    from app.services.video_service import get_job_status
    
    job = get_job_status(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    if job.get('status') != 'pending_approval':
        return jsonify({
            'error': 'Job not ready for approval',
            'status': job.get('status')
        }), 400
    
    return jsonify({
        'selected_frames': job.get('selected_frames', []),
        'rejected_frames': job.get('rejected_frames', []),
        'quality_mode': job.get('quality_mode', 'medium'),
        'video_url': job.get('video_url')
    })


@main.route('/api/process-video/approve', methods=['POST'])
def approve_frames():
    """Approve selected frames - saves them to database and triggers analysis."""
    from flask import request, jsonify
    from app.services.video_service import approve_job_frames, upload_approved_frames_to_db
    from app.services.supabase_service import supabase_service
    import threading
    import httpx
    import os
    
    data = request.json
    job_id = data.get('job_id')
    approved_urls = data.get('approved_urls', [])  # URLs user wants to keep
    video_url = data.get('video_url')
    
    if not job_id or not approved_urls:
        return jsonify({'error': 'job_id and approved_urls required'}), 400
    
    try:
        # Use the improved upload function that sets video_id and source_type
        upload_result = upload_approved_frames_to_db(job_id, approved_urls, video_url or "")
        
        if upload_result.get('error'):
            return jsonify({'error': upload_result['error']}), 500
        
        inserted_count = upload_result.get('count', 0)
        video_id = upload_result.get('video_id')
        
        # Get inserted image IDs for analysis
        inserted_ids = []
        if inserted_count > 0:
            # Fetch recently inserted images by URL to get IDs
            try:
                result = supabase_service.client.table('images')\
                    .select('id')\
                    .in_('image_url', approved_urls[:10])\
                    .execute()
                inserted_ids = [row['id'] for row in result.data] if result.data else []
            except Exception as e:
                print(f"Could not fetch inserted IDs: {e}")
        
        # Mark job as completed
        approve_job_frames(job_id, len(approved_urls))
        
        # Trigger background analysis for all inserted images
        if inserted_ids:
            thread = threading.Thread(
                target=_analyze_images_background,
                args=(inserted_ids, approved_urls)
            )
            thread.daemon = True
            thread.start()
        
        return jsonify({
            'success': True,
            'approved_count': inserted_count,
            'video_id': video_id,
            'message': f'Added {inserted_count} frames to your library (analyzing...)'
        })
        
    except Exception as e:
        print(f"Frame approval error: {e}")
        return jsonify({'error': str(e)}), 500


def _analyze_images_background(image_ids: list, image_urls: list):
    """Background task to analyze images via Supabase edge function."""
    import httpx
    import os
    
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("[analyze] Missing Supabase credentials")
        return
    
    edge_function_url = f"{supabase_url}/functions/v1/analyze-image"
    
    for image_id, image_url in zip(image_ids, image_urls):
        try:
            print(f"[analyze] Starting analysis for image {image_id}")
            with httpx.Client(timeout=120.0) as client:
                response = client.post(
                    edge_function_url,
                    json={"image_url": image_url, "image_id": image_id},
                    headers={
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Extract short_description from structured_analysis if available
                    structured = result.get('structured_analysis', {})
                    if structured and isinstance(structured, dict):
                        prompt = structured.get('short_description', '')
                    else:
                        # Fallback to raw prompt (first 500 chars)
                        prompt = result.get('prompt', '')[:500]
                    
                    colors = result.get('colors', [])
                    tags = result.get('tags', [])
                    embedding = result.get('embedding')  # 768-dimensional vector for semantic search
                    
                    print(f"[analyze] Image {image_id}: prompt={prompt[:100]}... colors={colors} embedding={'present' if embedding else 'none'}")
                    
                    # Update the database record using admin client (bypasses RLS)
                    from app.services.supabase_service import supabase_service
                    int_id = int(image_id)
                    
                    update_data = {
                        'prompt': prompt,
                        'colors': colors,
                        'tags': tags
                    }
                    
                    # Add embedding if available (768 dimensions for pgvector)
                    if embedding and isinstance(embedding, list) and len(embedding) == 768:
                        update_data['embedding'] = embedding
                        print(f"[analyze] Including embedding ({len(embedding)} dims) for image {int_id}")
                    elif prompt:
                        # Fallback: generate embedding directly via Google API
                        google_key = os.environ.get('GOOGLE_API_KEY')
                        if google_key:
                            try:
                                print(f"[analyze] Generating embedding for image {int_id} via Google API...")
                                embed_resp = client.post(
                                    f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={google_key}",
                                    json={
                                        "model": "models/text-embedding-004",
                                        "content": {"parts": [{"text": prompt[:2000]}]}  # Limit text
                                    },
                                    headers={"Content-Type": "application/json"},
                                    timeout=30.0
                                )
                                if embed_resp.status_code == 200:
                                    embed_data = embed_resp.json()
                                    embedding = embed_data.get('embedding', {}).get('values')
                                    if embedding and len(embedding) == 768:
                                        update_data['embedding'] = embedding
                                        print(f"[analyze] Generated embedding ({len(embedding)} dims) for image {int_id}")
                                    else:
                                        print(f"[analyze] Unexpected embedding size: {len(embedding) if embedding else 0}")
                            except Exception as emb_err:
                                print(f"[analyze] Embedding generation failed: {emb_err}")
                    
                    update_result = supabase_service.admin_client.table('images').update(update_data).eq('id', int_id).execute()
                    
                    print(f"[analyze] Image {image_id} DB update: {len(update_result.data) if update_result.data else 0} rows")
                else:
                    print(f"[analyze] Image {image_id} failed: {response.status_code} - {response.text[:200]}")
                    
        except Exception as e:
            print(f"[analyze] Error analyzing image {image_id}: {e}")


@main.route('/api/process-video/reject', methods=['POST'])
def reject_frames():
    """Delete rejected frames from storage."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    from app.services.video_service import complete_job
    
    data = request.json
    job_id = data.get('job_id')
    rejected_urls = data.get('rejected_urls', [])
    
    if not job_id:
        return jsonify({'error': 'job_id required'}), 400
    
    deleted_count = 0
    errors = []
    
    try:
        for url in rejected_urls:
            try:
                # Extract path from URL
                # URL format: {SUPABASE_URL}/storage/v1/object/public/images/video_frames/{hash}/{folder}/{uuid}.jpg
                if '/storage/v1/object/public/images/' in url:
                    path = url.split('/storage/v1/object/public/images/')[-1]
                    supabase_service.client.storage.from_('images').remove([path])
                    deleted_count += 1
            except Exception as e:
                errors.append(str(e))
        
        # Mark job as completed after cleanup
        complete_job(job_id)
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'errors': errors if errors else None
        })
        
    except Exception as e:
        print(f"Frame rejection error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/image/<int:image_id>/generate-prompts', methods=['POST'])
def generate_prompts_endpoint(image_id):
    """Generate AI prompt variations from image analysis."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    from app.services.straico_service import generate_prompts, get_cached_prompts, cache_prompts
    
    try:
        # Check for cached prompts first
        cached = get_cached_prompts(image_id)
        if cached:
            return jsonify({
                'success': True,
                'cached': True,
                **cached
            })
        
        # Get image data
        image = supabase_service.get_image(image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        # Build analysis from metadata
        analysis = image.get('metadata', {})
        if not analysis:
            # Fallback: create basic analysis from available fields
            analysis = {
                'short_description': image.get('prompt', ''),
                'background_setting': f"Mood: {image.get('mood', 'unknown')}, Lighting: {image.get('lighting', 'unknown')}",
                'aesthetics': {
                    'color_scheme': ', '.join(image.get('colors', [])),
                    'mood_atmosphere': image.get('mood', '')
                }
            }
        
        # Generate prompts via Straico
        result = generate_prompts(analysis, image.get('image_url'))
        
        if result.get('success'):
            # Cache the result
            cache_prompts(image_id, result)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# CREDIT SYSTEM ENDPOINTS
# ============================================

@main.route('/api/copy-prompt', methods=['POST'])
def copy_prompt():
    """
    Handle prompt copy with credit deduction.
    Requires authentication. Deducts 1 credit per copy.
    """
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    # Get user from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({
            'success': False,
            'error': 'Authentication required to copy prompts',
            'require_login': True
        }), 401
    
    try:
        # Verify the token and get user
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({
                'success': False,
                'error': 'Invalid session. Please log in again.',
                'require_login': True
            }), 401
        
        user_id = user_response.user.id
        
        # Get request data
        data = request.json or {}
        image_id = data.get('image_id')
        prompt_type = data.get('prompt_type', 'text_to_image')  # text_to_image, image_to_image, text_to_video
        
        if not image_id:
            return jsonify({'success': False, 'error': 'image_id is required'}), 400
        
        # Deduct 1 credit using RPC function
        credit_result = supabase_service.client.rpc(
            'deduct_credits',
            {'p_user_id': user_id, 'p_amount': 1}
        ).execute()
        
        result_data = credit_result.data
        
        # Handle RPC response (it returns JSON object)
        if isinstance(result_data, dict):
            if not result_data.get('success'):
                error_msg = result_data.get('error', 'Credit deduction failed')
                if 'Insufficient' in error_msg:
                    return jsonify({
                        'success': False,
                        'error': 'Insufficient credits. Please upgrade to continue.',
                        'remaining_credits': result_data.get('current', 0),
                        'require_upgrade': True
                    }), 402  # Payment Required
                return jsonify({'success': False, 'error': error_msg}), 400
            
            remaining = result_data.get('remaining', 0)
        else:
            # Fallback: get current credits
            profile_result = supabase_service.client.rpc(
                'get_or_create_profile',
                {'p_user_id': user_id}
            ).execute()
            remaining = profile_result.data[0].get('credits', 0) if profile_result.data else 0
        
        # Log the copy action for activity tracking
        try:
            supabase_service.client.table('user_activity').insert({
                'user_id': user_id,
                'action_type': 'prompt_copied',
                'action_details': {
                    'image_id': image_id,
                    'prompt_type': prompt_type
                },
                'resource_id': str(image_id),
                'resource_type': 'image'
            }).execute()
        except Exception as log_err:
            print(f"Activity logging failed: {log_err}")
        
        return jsonify({
            'success': True,
            'remaining_credits': remaining,
            'message': f'Copied! {remaining} credits remaining'
        })
        
    except Exception as e:
        print(f"Copy prompt error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# IMAGE ACTION ENDPOINTS
# ============================================

@main.route('/api/images/<image_id>/visibility', methods=['POST'])
def update_image_visibility(image_id):
    """Update an image's public/private status."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    data = request.json
    is_public = data.get('is_public', True)
    
    try:
        # Use RPC for secure update
        response = supabase_service.client.rpc(
            'update_image_visibility',
            {
                'image_id': image_id,
                'new_visibility': is_public
            }
        ).execute()
        
        return jsonify(response.data) if response.data else jsonify({'success': True})
        
    except Exception as e:
        print(f"Visibility update error: {e}")
        # Fallback to direct update
        try:
            supabase_service.client.table('images').update({
                'is_public': is_public
            }).eq('id', image_id).execute()
            return jsonify({'success': True, 'is_public': is_public})
        except Exception as e2:
            return jsonify({'error': str(e2)}), 500


@main.route('/api/images/<image_id>/share', methods=['POST'])
def share_image_to_community(image_id):
    """Make a private image public (share with community)."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        supabase_service.client.table('images').update({
            'is_public': True
        }).eq('id', image_id).execute()
        
        return jsonify({'success': True, 'message': 'Image shared with community'})
        
    except Exception as e:
        print(f"Share error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/images/bulk-visibility', methods=['POST'])
def bulk_update_visibility():
    """Update visibility for multiple images at once."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    data = request.json
    image_ids = data.get('image_ids', [])
    is_public = data.get('is_public', True)
    
    if not image_ids:
        return jsonify({'error': 'No image IDs provided'}), 400
    
    try:
        # Use RPC for bulk update
        response = supabase_service.client.rpc(
            'bulk_update_visibility',
            {
                'image_ids': image_ids,
                'new_visibility': is_public
            }
        ).execute()
        
        return jsonify(response.data) if response.data else jsonify({'success': True, 'count': len(image_ids)})
        
    except Exception as e:
        print(f"Bulk visibility error: {e}")
        return jsonify({'error': str(e)}), 500


# NOTE: get_boards is defined in the BOARDS API ENDPOINTS section below
# NOTE: add_image_to_board is defined in the BOARDS API ENDPOINTS section below


@main.route('/api/videos')
def get_videos_api():
    """API endpoint to get all user videos as JSON."""
    from flask import jsonify
    from app.services.video_service import video_library_service
    
    try:
        # Get all user videos
        videos = video_library_service.get_user_videos(limit=100)
        return jsonify(videos)
    except Exception as e:
        print(f"Error fetching videos: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/videos/<video_id>', methods=['DELETE'])
def delete_video(video_id):
    """Delete a video and optionally its frames."""
    from flask import request, jsonify
    from app.services.video_service import video_library_service
    
    delete_frames = request.args.get('delete_frames', 'false').lower() == 'true'
    
    try:
        # Delete associated frames if requested
        if delete_frames:
            from app.services.supabase_service import supabase_service
            supabase_service.client.table('images').delete().eq('video_id', video_id).execute()
        
        # Delete the video record
        success = video_library_service.delete_video(video_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Video deleted'})
        else:
            return jsonify({'error': 'Failed to delete video'}), 500
            
    except Exception as e:
        print(f"Delete video error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/images/by-video/<video_id>')
def get_images_by_video(video_id):
    """Get all images/frames from a specific video source."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        response = supabase_service.client.table('images')\
            .select('*')\
            .eq('video_id', video_id)\
            .order('created_at', desc=True)\
            .execute()
        
        return jsonify({
            'images': response.data if response.data else [],
            'count': len(response.data) if response.data else 0
        })
        
    except Exception as e:
        print(f"Get images by video error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/images')
def get_paginated_images():
    """Get paginated images with optional sort."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    sort = request.args.get('sort', 'ranked')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = max(int(request.args.get('offset', 0)), 0)
    
    try:
        # Use the service's get_public_images with offset
        query = supabase_service.client.table('images')\
            .select('id, image_url, prompt, mood, colors, tags, aesthetic_score, is_public')\
            .eq('is_public', True)
        
        if sort == 'ranked':
            query = query.order('aesthetic_score', desc=True)
        elif sort == 'newest':
            query = query.order('created_at', desc=True)
        elif sort == 'rating':
            query = query.order('aesthetic_score', desc=True)
        elif sort == 'popular':
            query = query.order('likes', desc=True)
        else:
            query = query.order('created_at', desc=True)
        
        response = query.range(offset, offset + limit - 1).execute()
        images = response.data if response.data else []
        
        return jsonify({
            'images': images,
            'count': len(images),
            'offset': offset,
            'has_more': len(images) == limit
        })
        
    except Exception as e:
        print(f"Pagination error: {e}")
        return jsonify({'error': str(e), 'images': []}), 500


# ============================================
# BOARDS API ENDPOINTS
# ============================================

@main.route('/api/boards', methods=['GET'])
def get_boards():
    """Get all boards for the current user."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    # Get user_id from JWT token if authenticated
    user_id, _ = get_user_from_token()
    
    try:
        # Use RPC if available, otherwise direct query
        try:
            response = supabase_service.client.rpc('get_user_boards', {'p_user_id': user_id}).execute()
            boards = response.data if response.data else []
        except Exception:
            # Fallback to direct query
            query = supabase_service.client.table('boards').select('*, board_images(count)')
            if user_id:
                query = query.eq('user_id', user_id)
            else:
                query = query.eq('is_public', True)
            response = query.order('created_at', desc=True).execute()
            boards = response.data if response.data else []
        
        return jsonify({'boards': boards, 'count': len(boards)})
        
    except Exception as e:
        print(f"Get boards error: {e}")
        return jsonify({'error': str(e), 'boards': []}), 500


@main.route('/api/boards', methods=['POST'])
def create_board():
    """Create a new board (folder)."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    # Require authentication to create boards
    user_id, _ = get_user_from_token()
    if not user_id:
        return jsonify({'error': 'Authentication required to create boards'}), 401
    
    data = request.json
    name = data.get('name', '').strip()
    description = data.get('description', '')
    is_public = data.get('is_public', False)
    parent_id = data.get('parent_id')  # For subfolders
    
    if not name:
        return jsonify({'error': 'Board name is required'}), 400
    
    try:
        # Try RPC first
        try:
            response = supabase_service.client.rpc('create_board', {
                'p_name': name,
                'p_user_id': user_id,
                'p_description': description,
                'p_is_public': is_public,
                'p_parent_id': parent_id
            }).execute()
            result = response.data
            return jsonify(result)
        except Exception:
            # Fallback to direct insert
            response = supabase_service.client.table('boards').insert({
                'name': name,
                'description': description,
                'is_public': is_public,
                'parent_id': parent_id,
                'user_id': user_id
            }).execute()
            
            if response.data:
                return jsonify({'success': True, 'id': response.data[0]['id'], 'name': name})
            return jsonify({'error': 'Failed to create board'}), 500
            
    except Exception as e:
        print(f"Create board error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/boards/<board_id>', methods=['GET'])
def get_board(board_id):
    """Get a single board with its images."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        # Get board details
        board_response = supabase_service.client.table('boards')\
            .select('*')\
            .eq('id', board_id)\
            .single()\
            .execute()
        
        if not board_response.data:
            return jsonify({'error': 'Board not found'}), 404
        
        board = board_response.data
        
        # Get board images
        images_response = supabase_service.client.table('board_images')\
            .select('image_id, position, images(*)')\
            .eq('board_id', board_id)\
            .order('position')\
            .execute()
        
        images = []
        if images_response.data:
            images = [bi['images'] for bi in images_response.data if bi.get('images')]
        
        # Get subfolders
        subfolders_response = supabase_service.client.table('boards')\
            .select('id, name, is_public')\
            .eq('parent_id', board_id)\
            .execute()
        
        return jsonify({
            'board': board,
            'images': images,
            'subfolders': subfolders_response.data or [],
            'image_count': len(images)
        })
        
    except Exception as e:
        print(f"Get board error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/boards/<board_id>', methods=['PUT', 'PATCH'])
def update_board(board_id):
    """Update a board's name, description, or visibility."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    data = request.json
    updates = {}
    
    if 'name' in data:
        updates['name'] = data['name']
    if 'description' in data:
        updates['description'] = data['description']
    if 'is_public' in data:
        updates['is_public'] = data['is_public']
    
    if not updates:
        return jsonify({'error': 'No updates provided'}), 400
    
    try:
        response = supabase_service.client.table('boards')\
            .update(updates)\
            .eq('id', board_id)\
            .execute()
        
        return jsonify({'success': True, 'id': board_id})
        
    except Exception as e:
        print(f"Update board error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/boards/<board_id>', methods=['DELETE'])
def delete_board(board_id):
    """Delete a board and remove all image associations."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        # Delete board (cascade handles board_images)
        response = supabase_service.client.table('boards')\
            .delete()\
            .eq('id', board_id)\
            .execute()
        
        return jsonify({'success': True, 'deleted': board_id})
        
    except Exception as e:
        print(f"Delete board error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/boards/<board_id>/images', methods=['POST'])
def add_image_to_board(board_id):
    """Add an image to a board."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    data = request.json
    image_id = data.get('image_id')
    
    if not image_id:
        return jsonify({'error': 'image_id is required'}), 400
    
    try:
        # Get current max position
        pos_response = supabase_service.client.table('board_images')\
            .select('position')\
            .eq('board_id', board_id)\
            .order('position', desc=True)\
            .limit(1)\
            .execute()
        
        max_pos = pos_response.data[0]['position'] if pos_response.data else 0
        
        # Insert new association
        response = supabase_service.client.table('board_images').upsert({
            'board_id': board_id,
            'image_id': image_id,
            'position': max_pos + 1
        }).execute()
        
        return jsonify({'success': True, 'board_id': board_id, 'image_id': image_id})
        
    except Exception as e:
        print(f"Add image to board error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/boards/<board_id>/images/<int:image_id>', methods=['DELETE'])
def remove_image_from_board(board_id, image_id):
    """Remove an image from a board."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        response = supabase_service.client.table('board_images')\
            .delete()\
            .eq('board_id', board_id)\
            .eq('image_id', image_id)\
            .execute()
        
        return jsonify({'success': True, 'removed': True})
        
    except Exception as e:
        print(f"Remove image from board error: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================
# DYNAMIC FILTER OPTIONS ENDPOINT
# ============================================

@main.route('/api/filter-options')
def get_filter_options():
    """Get unique filter options (moods, colors, lighting, camera, tags) from the database."""
    from flask import jsonify
    from app.services.supabase_service import supabase_service
    
    try:
        # Blocklist of words that are NOT moods (these are object/category labels, not feelings/atmospheres)
        MOOD_BLOCKLIST = {
            'blur', 'animal', 'architecture', 'art', 'baby bed', 'balloon', 'baseball', 
            'bed', 'body part', 'boy', 'girl', 'man', 'woman', 'child', 'adult', 'adolescent',
            'face', 'head', 'hand', 'foot', 'leg', 'arm', 'eye', 'mouth', 'nose', 'ear',
            'car', 'vehicle', 'building', 'house', 'tree', 'plant', 'flower', 'sky', 'water',
            'food', 'drink', 'table', 'chair', 'window', 'door', 'wall', 'floor', 'ceiling',
            'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'sheep', 'pig', 'chicken',
            'shirt', 'pants', 'dress', 'shoe', 'hat', 'jacket', 'coat', 'suit',
            'computer', 'phone', 'screen', 'keyboard', 'mouse', 'laptop', 'tablet',
            'ball', 'bat', 'racket', 'goal', 'net', 'field', 'court', 'stadium', 'arena',
            'graphic display', 'advertisement', 'logo', 'text', 'sign', 'poster', 'banner',
        }
        
        # Get unique moods from the database (top-level mood field only - these are short labels)
        mood_response = supabase_service.client.table('images')\
            .select('mood')\
            .eq('is_public', True)\
            .not_.is_('mood', 'null')\
            .limit(500)\
            .execute()
        
        # Extract unique top-level moods (these are short 1-2 word labels like "Cinematic", "Inspiring")
        moods = set()
        if mood_response.data:
            for img in mood_response.data:
                if img.get('mood'):
                    mood_val = img['mood'].strip()
                    mood_lower = mood_val.lower()
                    # Only include short labels (less than 30 chars) that are NOT in blocklist
                    if len(mood_val) < 30 and mood_lower not in MOOD_BLOCKLIST:
                        moods.add(mood_val)

        
        # Get unique lighting types from the database
        lighting_response = supabase_service.client.table('images')\
            .select('lighting')\
            .eq('is_public', True)\
            .not_.is_('lighting', 'null')\
            .limit(500)\
            .execute()
        
        lighting_types = set()
        if lighting_response.data:
            for img in lighting_response.data:
                if img.get('lighting'):
                    light_val = img['lighting'].strip()
                    if len(light_val) < 50:
                        lighting_types.add(light_val)
        
        # Get unique tags from the database (count frequency)
        tags_response = supabase_service.client.table('images')\
            .select('tags')\
            .eq('is_public', True)\
            .not_.is_('tags', 'null')\
            .limit(500)\
            .execute()
        
        tag_counts = {}
        if tags_response.data:
            for img in tags_response.data:
                tags = img.get('tags', [])
                if tags and isinstance(tags, list):
                    for tag in tags:
                        if isinstance(tag, str) and len(tag) < 30:
                            tag_lower = tag.lower().strip()
                            if tag_lower:
                                tag_counts[tag_lower] = tag_counts.get(tag_lower, 0) + 1
        
        # Sort tags by frequency and take top 30
        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
        top_tags = [t[0] for t in sorted_tags[:30]]
        
        # Get camera shots from structured_analysis (JSONB query)
        camera_response = supabase_service.client.table('images')\
            .select('generated_prompts')\
            .eq('is_public', True)\
            .not_.is_('generated_prompts', 'null')\
            .limit(300)\
            .execute()
        
        camera_shots = set()
        if camera_response.data:
            for img in camera_response.data:
                gp = img.get('generated_prompts', {})
                if gp and isinstance(gp, dict):
                    sa = gp.get('structured_analysis', {})
                    if sa and isinstance(sa, dict):
                        camera = sa.get('camera', {})
                        if camera and isinstance(camera, dict):
                            shot_type = camera.get('shot_type')
                            if shot_type and isinstance(shot_type, str) and len(shot_type) < 40:
                                camera_shots.add(shot_type.strip())
        
        # Get unique colors from the database
        color_response = supabase_service.client.table('images')\
            .select('colors')\
            .eq('is_public', True)\
            .not_.is_('colors', 'null')\
            .limit(200)\
            .execute()
        
        # Count color frequency to get most common
        color_counts = {}
        if color_response.data:
            for img in color_response.data:
                colors = img.get('colors', [])
                if colors and isinstance(colors, list):
                    for c in colors[:3]:  # Only top 3 dominant colors per image
                        if isinstance(c, str) and c.startswith('#') and len(c) == 7:
                            c_lower = c.lower()
                            color_counts[c_lower] = color_counts.get(c_lower, 0) + 1
        
        # Sort by frequency and take top 20
        sorted_colors = sorted(color_counts.items(), key=lambda x: x[1], reverse=True)
        color_list = [c[0] for c in sorted_colors[:20]]
        
        return jsonify({
            'moods': sorted(list(moods)),
            'colors': color_list,
            'lighting': sorted(list(lighting_types)),
            'camera_shots': sorted(list(camera_shots)),
            'tags': top_tags,
            'total_images': len(mood_response.data) if mood_response.data else 0
        })
        
    except Exception as e:
        print(f"Filter options error: {e}")
        return jsonify({
            'error': str(e),
            'moods': [],
            'colors': [],
            'lighting': [],
            'camera_shots': [],
            'tags': []
        }), 500



# ============================================
# FILTERED IMAGES ENDPOINT (Fixed Filters)
# ============================================

@main.route('/api/images/filter')
def get_filtered_images():
    """Get images with filters: mood, colors, lighting, camera_shot, tags, min_score, source_type."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    # Filter params - now support multiple values for multi-select
    moods = request.args.getlist('mood')  # Changed to list for multi-select
    colors = request.args.getlist('colors')  # Can be multiple
    lighting = request.args.getlist('lighting')  # Changed to list for multi-select
    camera_shot = request.args.getlist('camera_shot')  # Changed to list for multi-select
    tags = request.args.getlist('tags')  # Tags filter (can be multiple)
    min_score = request.args.get('min_score', type=float)
    source_type = request.args.get('source_type')  # 'video_import', etc.
    sort = request.args.get('sort', 'ranked')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = int(request.args.get('offset', 0))
    
    try:
        query = supabase_service.client.table('images')\
            .select('id, image_url, prompt, mood, lighting, colors, tags, aesthetic_score, likes, dislikes, generated_prompts')\
            .eq('is_public', True)
        
        # We'll do mood/lighting filtering client-side since we now support multi-select
        # and Supabase doesn't easily support OR queries with ilike
        
        # Apply color filters (any match) - we'll post-filter for hex colors
        filter_colors = colors if colors else []
        
        # Apply minimum score filter
        if min_score is not None:
            query = query.gte('aesthetic_score', min_score)
        
        # Apply source type filter
        if source_type:
            query = query.eq('source_type', source_type)


        
        # Apply sorting
        if sort == 'ranked':
            query = query.order('aesthetic_score', desc=True)
        elif sort == 'newest':
            query = query.order('created_at', desc=True)
        elif sort == 'popular':
            query = query.order('likes', desc=True)
        else:
            query = query.order('created_at', desc=True)
        
        response = query.range(offset, offset + limit - 1).execute()
        images = response.data if response.data else []
        
        # Color distance matching with tolerance
        if filter_colors:
            def hex_to_rgb(hex_color):
                """Convert hex color to RGB tuple."""
                hex_color = hex_color.lstrip('#')
                if len(hex_color) != 6:
                    return None
                try:
                    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                except ValueError:
                    return None
            
            def color_distance(rgb1, rgb2):
                """Calculate Euclidean distance between two RGB colors."""
                if rgb1 is None or rgb2 is None:
                    return float('inf')
                return ((rgb1[0] - rgb2[0])**2 + (rgb1[1] - rgb2[1])**2 + (rgb1[2] - rgb2[2])**2) ** 0.5
            
            # Convert filter colors to RGB
            filter_rgbs = []
            for fc in filter_colors:
                rgb = hex_to_rgb(fc)
                if rgb:
                    filter_rgbs.append((fc, rgb))
            
            # Tolerance from query param (default 100 for "Similar")
            # Range: 30 (Exact) to 200 (Loose)
            color_tolerance = request.args.get('color_tolerance', type=int, default=100)
            # Clamp to valid range
            color_tolerance = max(30, min(200, color_tolerance))

            
            def get_color_score(img):
                """Calculate how well image colors match filter colors. Lower = better match."""
                img_colors = img.get('colors', [])
                if not img_colors or not filter_rgbs:
                    return float('inf')
                
                best_match_score = float('inf')
                
                # For each filter color, find if there's a close match in image
                for _, filter_rgb in filter_rgbs:
                    for ic in img_colors:
                        if isinstance(ic, str):
                            img_rgb = hex_to_rgb(ic)
                            if img_rgb:
                                dist = color_distance(filter_rgb, img_rgb)
                                if dist < best_match_score:
                                    best_match_score = dist
                
                # Return infinity if no match within tolerance
                if best_match_score > color_tolerance:
                    return float('inf')
                    
                return best_match_score
            
            # Filter and sort by color proximity
            scored_images = [(img, get_color_score(img)) for img in images]
            scored_images = [(img, score) for img, score in scored_images if score < float('inf')]
            scored_images.sort(key=lambda x: x[1])  # Sort by color score (closer = better)
            images = [img for img, _ in scored_images]

        
        # Post-filter for moods (multi-select - ANY match)
        if moods:
            def has_matching_mood(img):
                img_mood = img.get('mood', '')
                if not img_mood:
                    return False
                img_mood_lower = img_mood.lower()
                for filter_mood in moods:
                    if filter_mood.lower() in img_mood_lower:
                        return True
                return False
            images = [img for img in images if has_matching_mood(img)]
        
        # Post-filter for lighting (multi-select - ANY match)
        if lighting:
            def has_matching_lighting(img):
                img_lighting = img.get('lighting', '')
                if not img_lighting:
                    return False
                img_lighting_lower = img_lighting.lower()
                for filter_light in lighting:
                    if filter_light.lower() in img_lighting_lower:
                        return True
                return False
            images = [img for img in images if has_matching_lighting(img)]
        
        # Post-filter for tags (since tags is an array field)
        if tags:
            def has_matching_tags(img):
                img_tags = img.get('tags', [])
                if not img_tags:
                    return False
                img_tags_lower = [t.lower() for t in img_tags if isinstance(t, str)]
                for filter_tag in tags:
                    if filter_tag.lower() in img_tags_lower:
                        return True
                return False
            images = [img for img in images if has_matching_tags(img)]
        
        # Post-filter for camera_shot (from structured_analysis JSONB, multi-select)
        if camera_shot:
            def has_matching_camera(img):
                gp = img.get('generated_prompts', {})
                if not gp or not isinstance(gp, dict):
                    return False
                sa = gp.get('structured_analysis', {})
                if not sa or not isinstance(sa, dict):
                    return False
                cam = sa.get('camera', {})
                if not cam or not isinstance(cam, dict):
                    return False
                shot_type = cam.get('shot_type', '')
                if not shot_type:
                    return False
                shot_type_lower = shot_type.lower()
                for filter_shot in camera_shot:
                    if filter_shot.lower() in shot_type_lower:
                        return True
                return False
            images = [img for img in images if has_matching_camera(img)]
        
        return jsonify({
            'images': images,
            'count': len(images),
            'has_more': len(images) == limit,
            'filters': {
                'moods': moods,

                'colors': colors,
                'lighting': lighting,
                'camera_shot': camera_shot,
                'tags': tags,
                'min_score': min_score,
                'source_type': source_type
            }
        })
        
    except Exception as e:
        print(f"Filter images error: {e}")
        return jsonify({'error': str(e), 'images': []}), 500



# ============================================
# USER PROFILE & CREDITS ENDPOINTS
# ============================================

@main.route('/api/me')
def get_current_user_profile():
    """Get current user's profile with credits."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    # Get user from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Verify the token and get user
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        
        # Get or create profile using RPC
        profile_result = supabase_service.client.rpc(
            'get_or_create_profile',
            {'p_user_id': user_id}
        ).execute()
        
        profile = profile_result.data[0] if profile_result.data else None
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'email': user_response.user.email,
                'display_name': profile.get('display_name') if profile else None,
                'credits': profile.get('credits', 100) if profile else 100,
                'subscription_tier': profile.get('subscription_tier', 'free') if profile else 'free',
            }
        })
        
    except Exception as e:
        print(f"Get profile error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/me', methods=['PUT', 'PATCH'])
def update_current_user_profile():
    """Update current user's profile."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        data = request.json or {}
        
        # Update profile using RPC
        result = supabase_service.client.rpc(
            'update_user_profile',
            {
                'p_user_id': user_id,
                'p_display_name': data.get('display_name'),
                'p_avatar_url': data.get('avatar_url')
            }
        ).execute()
        
        return jsonify({
            'success': True,
            'message': 'Profile updated'
        })
        
    except Exception as e:
        print(f"Update profile error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/credits')
def get_user_credits():
    """Get current user's credit balance."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        # Return default credits for unauthenticated users
        return jsonify({'credits': 100, 'subscription_tier': 'free'})
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'credits': 100, 'subscription_tier': 'free'})
        
        user_id = user_response.user.id
        
        # Get profile with credits
        profile_result = supabase_service.client.rpc(
            'get_or_create_profile',
            {'p_user_id': user_id}
        ).execute()
        
        profile = profile_result.data[0] if profile_result.data else None
        
        return jsonify({
            'credits': profile.get('credits', 100) if profile else 100,
            'subscription_tier': profile.get('subscription_tier', 'free') if profile else 'free',
            'preferences': profile.get('preferences', {}) if profile else {}
        })
        
    except Exception as e:
        print(f"Get credits error: {e}")
        return jsonify({'credits': 100, 'subscription_tier': 'free', 'preferences': {}})


@main.route('/api/preferences', methods=['PUT', 'PATCH'])
def update_user_preferences():
    """Update current user's preferences."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        data = request.json or {}
        
        # Update preferences using RPC
        result = supabase_service.client.rpc(
            'update_user_preferences',
            {
                'p_user_id': user_id,
                'p_preferences': data
            }
        ).execute()
        
        return jsonify({
            'success': True,
            'message': 'Preferences updated'
        })
        
    except Exception as e:
        print(f"Update preferences error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/credits/share-progress')
def get_share_credits_progress():
    """Get user's shared images count and free credits earned from sharing."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        
        # Count how many public images this user has shared
        count_response = supabase_service.client.table('images')\
            .select('id', count='exact')\
            .eq('user_id', user_id)\
            .eq('is_public', True)\
            .execute()
        
        shared_count = count_response.count if count_response.count else 0
        
        # Calculate free credits earned: 1 credit per 10 shared images
        free_credits_earned = shared_count // 10
        
        # Calculate how many more images needed for next free credit
        next_reward_at = ((shared_count // 10) + 1) * 10
        
        return jsonify({
            'shared_count': shared_count,
            'free_credits_earned': free_credits_earned,
            'next_reward_at': next_reward_at,
            'images_until_next': next_reward_at - shared_count
        })
        
    except Exception as e:
        print(f"Get share credits progress error: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================
# USER ACTIVITY & HISTORY ENDPOINTS
# ============================================

@main.route('/api/activity')
def get_user_activity():
    """Get current user's activity history."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        
        # Get activity using RPC
        result = supabase_service.client.rpc(
            'get_user_activity',
            {
                'p_user_id': user_id,
                'p_limit': limit,
                'p_offset': offset
            }
        ).execute()
        
        activities = result.data if result.data else []
        
        return jsonify({
            'activities': activities,
            'count': len(activities)
        })
        
    except Exception as e:
        print(f"Get activity error: {e}")
        return jsonify({'error': str(e), 'activities': []}), 500


@main.route('/api/activity', methods=['POST'])
def log_activity():
    """Log a user activity event."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        data = request.json or {}
        
        if not data.get('action_type'):
            return jsonify({'error': 'action_type required'}), 400
        
        # Log activity using RPC
        result = supabase_service.client.rpc(
            'log_user_activity',
            {
                'p_user_id': user_id,
                'p_action_type': data.get('action_type'),
                'p_action_details': data.get('details', {}),
                'p_resource_id': data.get('resource_id'),
                'p_resource_type': data.get('resource_type')
            }
        ).execute()
        
        return jsonify({
            'success': True,
            'message': 'Activity logged'
        })
        
    except Exception as e:
        print(f"Log activity error: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================
# NOTIFICATIONS ENDPOINTS
# ============================================

@main.route('/api/notifications')
def get_notifications():
    """Get current user's notifications."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'notifications': [], 'unread_count': 0})
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'notifications': [], 'unread_count': 0})
        
        user_id = user_response.user.id
        limit = min(int(request.args.get('limit', 20)), 50)
        
        # Get notifications
        result = supabase_service.client.rpc(
            'get_user_notifications',
            {'p_user_id': user_id, 'p_limit': limit, 'p_offset': 0}
        ).execute()
        
        # Get unread count
        count_result = supabase_service.client.rpc(
            'get_unread_notification_count',
            {'p_user_id': user_id}
        ).execute()
        
        notifications = result.data if result.data else []
        unread_count = count_result.data if count_result.data else 0
        
        return jsonify({
            'notifications': notifications,
            'unread_count': unread_count
        })
        
    except Exception as e:
        print(f"Get notifications error: {e}")
        return jsonify({'notifications': [], 'unread_count': 0})


@main.route('/api/notifications/read', methods=['POST'])
def mark_notifications_read():
    """Mark notifications as read."""
    from flask import request, jsonify
    from app.services.supabase_service import supabase_service
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        token = auth_header.split(' ')[1]
        user_response = supabase_service.client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            return jsonify({'error': 'Invalid token'}), 401
        
        user_id = user_response.user.id
        data = request.json or {}
        notification_id = data.get('notification_id')
        
        if notification_id:
            # Mark single notification as read
            result = supabase_service.client.rpc(
                'mark_notification_read',
                {'p_user_id': user_id, 'p_notification_id': notification_id}
            ).execute()
        else:
            # Mark all as read
            result = supabase_service.client.rpc(
                'mark_all_notifications_read',
                {'p_user_id': user_id}
            ).execute()
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Mark read error: {e}")
        return jsonify({'error': str(e)}), 500

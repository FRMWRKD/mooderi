
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabaseService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SupabaseService, cls).__new__(cls)
            cls._instance._init_client()
        return cls._instance

    def _init_client(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment")
            
        # Regular client with anon key (for reads, respects RLS)
        self.client: Client = create_client(url, key)
        
        # Service role client (for admin operations, bypasses RLS)
        if service_key:
            self.admin_client: Client = create_client(url, service_key)
        else:
            self.admin_client = self.client  # Fallback to regular client
            print("[SupabaseService] Warning: SUPABASE_SERVICE_ROLE_KEY not set, using anon key")

    def get_client(self) -> Client:
        return self.client
    
    def get_admin_client(self) -> Client:
        """Get admin client for operations that need to bypass RLS (updates, deletes)."""
        return self.admin_client


    def get_public_images(self, limit=50, sort_by='newest'):
        """
        Fetch latest public images with their prompts and metadata.
        sort_by: 'newest', 'popular', 'rating', 'unpopular', 'ranked'
        """
        # Use RPC for ranked sort (composite AI + engagement score)
        if sort_by == 'ranked':
            try:
                response = self.client.rpc(
                    'get_ranked_images',
                    {'limit_count': limit, 'offset_count': 0}
                ).execute()
                return response.data if response.data else []
            except Exception as e:
                print(f"[SupabaseService] Ranked query failed, falling back: {e}")
                sort_by = 'rating'  # Fallback
        
        query = self.client.table('images').select('*').eq('is_public', True)
        
        if sort_by == 'newest':
            query = query.order('created_at', desc=True)
        elif sort_by == 'popular':
            query = query.order('likes', desc=True)
        elif sort_by == 'unpopular':
            query = query.order('dislikes', desc=True)
        elif sort_by == 'rating':
            # Sort by aesthetic_score DESC
            query = query.order('aesthetic_score', desc=True)
            
        response = query.limit(limit).execute()
        return response.data

    def get_image(self, image_id):
        """Fetch a single image by ID."""
        response = self.client.table('images')\
            .select('*')\
            .eq('id', image_id)\
            .single()\
            .execute()
        return response.data

    def search_images(self, query=None, mood=None, lighting=None, limit=50):
        """Search images by text search or filters."""
        query_builder = self.client.table('images').select('*').eq('is_public', True)
        
        if query:
            query_builder = query_builder.ilike('prompt', f'%{query}%')

        if mood:
            query_builder = query_builder.eq('mood', mood)
        
        if lighting:
            query_builder = query_builder.eq('lighting', lighting)
            
        response = query_builder.limit(limit).execute()
        return response.data
    
    def get_similar_images(self, image_id, threshold=0.7, limit=10):
        """
        Find visually similar images using vector embeddings.
        """
        source = self.get_image(image_id)
        if not source or not source.get('embedding'):
            return []
            
        embedding = source['embedding']
        
        try:
            response = self.client.rpc(
                'match_images',
                {
                    'query_embedding': embedding,
                    'similarity_threshold': threshold,
                    'match_count': limit
                }
            ).execute()
            
            results = [img for img in response.data if img['id'] != image_id]
            return results
        except Exception as e:
            print(f"Vector search failed: {e}")
            return []

supabase_service = SupabaseService()

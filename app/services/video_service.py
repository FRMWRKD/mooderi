"""
Video Processing Service - CLOUD ONLY (Modal)

IMPORTANT: All video processing happens in the cloud via Modal.
No local processing is used. This ensures:
- Consistent environment
- No local dependencies required
- Scalable processing
"""

import os
import threading
import uuid
import time
import httpx
from app.services.supabase_service import supabase_service

# Simple in-memory job store (replace with Redis/DB in production)
jobs = {}

# Modal endpoint - MUST be set for video processing to work
MODAL_VIDEO_ENDPOINT = os.environ.get('MODAL_VIDEO_ENDPOINT')


def start_video_processing(video_url: str, quality_mode: str = "medium", user_id: str = None) -> str:
    """
    Start video processing via Modal cloud.
    
    CLOUD ONLY - No local fallback.
    Creates a video record in the database before processing.
    """
    job_id = str(uuid.uuid4())
    video_id = None
    
    # Try to create video record in database (requires migration)
    try:
        video_data = {
            'url': video_url,
            'quality_mode': quality_mode,
            'status': 'processing',
            'is_public': True
        }
        if user_id:
            video_data['user_id'] = user_id
            
        result = supabase_service.admin_client.table('videos').insert(video_data).execute()
        if result.data:
            video_id = result.data[0]['id']
            print(f"[Video] Created video record: {video_id}")
    except Exception as e:
        print(f"[Video] Could not create video record (migration pending?): {e}")
    
    jobs[job_id] = {
        'status': 'queued',
        'progress': 0,
        'message': 'Queued for cloud processing...',
        'video_url': video_url,
        'quality_mode': quality_mode,
        'video_id': video_id,  # Store video_id for frame linking
        'user_id': user_id,
        'selected_frames': [],
        'rejected_frames': [],
        'result': None
    }
    
    # Start background thread for Modal processing
    thread = threading.Thread(target=_process_with_modal, args=(job_id, video_url, quality_mode))
    thread.daemon = True
    thread.start()
    
    return job_id


def get_job_status(job_id: str) -> dict:
    """Get current job status."""
    return jobs.get(job_id)


def approve_job_frames(job_id: str, count: int):
    """Mark job as approved with frame count."""
    if job_id in jobs:
        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['message'] = f'Approved {count} frames'
        jobs[job_id]['approved_count'] = count


def complete_job(job_id: str):
    """Mark job as completed after cleanup."""
    if job_id in jobs:
        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['message'] = 'Processing complete'


def _process_with_modal(job_id: str, video_url: str, quality_mode: str):
    """
    Process video using Modal cloud ONLY.
    No local fallback - if Modal fails, the job fails.
    """
    try:
        jobs[job_id]['status'] = 'processing'
        jobs[job_id]['progress'] = 10
        jobs[job_id]['message'] = f'Starting cloud processing (quality: {quality_mode})...'
        
        # Get Modal endpoint
        modal_endpoint = MODAL_VIDEO_ENDPOINT
        
        if not modal_endpoint:
            # Try to construct from Modal credentials
            modal_endpoint = "https://theoaintern--moodboard-video-processor-process-video-api.modal.run"
            print(f"[job {job_id}] Using default Modal endpoint: {modal_endpoint}")
        
        jobs[job_id]['message'] = 'Sending to Modal cloud...'
        jobs[job_id]['progress'] = 20
        
        # Call Modal endpoint
        with httpx.Client(timeout=600.0) as client:
            print(f"[job {job_id}] Calling Modal: {modal_endpoint}")
            response = client.post(
                modal_endpoint,
                json={
                    'video_url': video_url,
                    'quality_mode': quality_mode,
                    'max_frames': 50
                }
            )
            
            if response.status_code != 200:
                raise Exception(f"Modal returned {response.status_code}: {response.text[:200]}")
            
            result = response.json()
            print(f"[job {job_id}] Modal response status: {result.get('status')}")
            
            if result.get('status') == 'failed':
                errors = result.get('errors', ['Unknown error'])
                raise Exception(f"Modal processing failed: {errors[0] if errors else 'Unknown'}")
            
            if result.get('status') == 'pending_approval':
                # Success! Ready for user approval
                jobs[job_id]['status'] = 'pending_approval'
                jobs[job_id]['progress'] = 100
                jobs[job_id]['message'] = f"Ready for approval ({len(result.get('selected_frames', []))} frames selected)"
                jobs[job_id]['selected_frames'] = result.get('selected_frames', [])
                jobs[job_id]['rejected_frames'] = result.get('rejected_frames', [])
                return
            
            # If somehow completed without approval step
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['progress'] = 100
            jobs[job_id]['message'] = 'Processing complete'
            jobs[job_id]['result'] = result
            
    except Exception as e:
        error_msg = str(e)
        print(f"[job {job_id}] Modal processing failed: {error_msg}")
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['message'] = error_msg[:200]


# NOTE: Upload functions are only used when Modal returns URLs
# All frame extraction and upload happens in Modal cloud

def upload_approved_frames_to_db(job_id: str, approved_urls: list, video_url: str) -> dict:
    """
    Insert approved frames into database.
    Called AFTER user approves frames from Modal cloud.
    
    Sets video_id and source_type if available from job.
    """
    try:
        # Get job context for video_id and user_id
        job = jobs.get(job_id, {})
        video_id = job.get('video_id')
        user_id = job.get('user_id')
        
        db_rows = []
        for url in approved_urls:
            row = {
                "image_url": url,
                "prompt": "",  # Will be filled by Visionati edge function
                "source_video_url": video_url,
                "is_public": True,
                "mood": "Cinematic",
                "lighting": "Cinematic",
                "tags": [],
                "colors": [],
                "source_type": "video_import"  # Track source for ranking
            }
            # Add video_id if we have it (requires migration)
            if video_id:
                row['video_id'] = video_id
            # Add user_id if provided
            if user_id:
                row['user_id'] = user_id
            db_rows.append(row)
        
        if db_rows:
            result = supabase_service.admin_client.table('images').insert(db_rows).execute()
            
            # Update video record with frame count
            if video_id and result.data:
                try:
                    supabase_service.admin_client.table('videos').update({
                        'frame_count': len(result.data),
                        'status': 'completed'
                    }).eq('id', video_id).execute()
                except Exception as e:
                    print(f"[Video] Could not update frame count: {e}")
            
            return {"success": True, "count": len(result.data) if result.data else 0, "video_id": video_id}
        return {"success": True, "count": 0}
        
    except Exception as e:
        return {"error": str(e)}

class VideoService:
    def __init__(self):
        self.client = supabase_service.client

    def get_user_videos(self, user_id=None, limit=50):
        """
        Fetch videos. If user_id is provided, fetch specific user's videos.
        Otherwise fetch public videos or all if admin.
        """
        try:
            # Fallback to direct query for now until migration runs
            query = self.client.table('videos').select('*')
            
            if user_id:
                query = query.eq('user_id', user_id)
            
            query = query.order('created_at', desc=True).limit(limit)
            response = query.execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"[VideoService] Error fetching user videos: {e}")
            return []

    def get_video_details(self, video_id):
        """
        Get video metadata and its extracted frames
        """
        try:
            # Get video
            video_response = self.client.table('videos').select('*').eq('id', video_id).single().execute()
            video = video_response.data
            
            if not video:
                return None
            
            # Get associated frames (images)
            frames_response = self.client.table('images')\
                .select('*')\
                .eq('video_id', video_id)\
                .order('created_at', desc=True)\
                .execute()
            
            video['frames'] = frames_response.data
            return video
        except Exception as e:
            print(f"[VideoService] Error fetching video details: {e}")
            return None

    def create_video(self, video_data):
        """
        Create a new video record
        video_data: dict with url, title, etc.
        """
        try:
            response = self.client.table('videos').insert(video_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"[VideoService] Error creating video: {e}")
            return None

    def delete_video(self, video_id):
        """
        Delete a video and (optionally) its frames.
        """
        try:
            # For now just delete the video record
            response = self.client.table('videos').delete().eq('id', video_id).execute()
            return True
        except Exception as e:
            print(f"[VideoService] Error deleting video: {e}")
            return False

# Singleton instance
video_library_service = VideoService()

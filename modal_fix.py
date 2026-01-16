"""
Modal Video Processor - CONVEX VERSION
Updated to send webhooks to Convex instead of Supabase DB

Changes from original:
- Keeps Supabase Storage for frame uploads (images stay there)
- Calls Convex HTTP endpoints instead of Supabase DB
- Sends status updates via /modal/webhook
- Sends frame data via /modal/frame
"""
import modal
import os
import subprocess
import json
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

app = modal.App("moodboard-video-processor-convex-v2")
video_volume = modal.Volume.from_name("moodboard-videos", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "curl", "unzip", "libgl1-mesa-glx", "libglib2.0-0")
    .run_commands(
        "curl -fsSL https://deno.land/install.sh | sh",
        "ln -s /root/.deno/bin/deno /usr/local/bin/deno"
    )
    .pip_install(
        "yt-dlp", "httpx", "pillow", "fastapi==0.109.0",
        "scenedetect[opencv]", "opencv-python-headless", "numpy",
        "imagehash"
    )
)

# Using both Supabase (for storage) and Convex secrets
supabase_secret = modal.Secret.from_name("supabase-creds")
convex_secret = modal.Secret.from_name("convex-creds")  # NEW: Add this in Modal dashboard
youtube_secret = modal.Secret.from_name("youtube-cookies")
VOLUME_PATH = "/mnt/videos"

# Convex HTTP endpoint base URL
CONVEX_HTTP_URL = "https://hidden-falcon-801.convex.cloud"


# ============================================================
# QUALITY MODE PRESETS (unchanged from original)
# ============================================================

QUALITY_PRESETS = {
    "strict": {
        "blur_threshold": 50,
        "black_threshold": 0.75,
        "variance_threshold": 200,
        "edge_threshold": 0.02,
        "contrast_threshold": 50,
        "phash_threshold": 6,
        "description": "Highest quality only - saves credits"
    },
    "medium": {
        "blur_threshold": 25,
        "black_threshold": 0.85,
        "variance_threshold": 100,
        "edge_threshold": 0.01,
        "contrast_threshold": 30,
        "phash_threshold": 8,
        "description": "Balanced quality - recommended"
    },
    "high": {
        "blur_threshold": 10,
        "black_threshold": 0.92,
        "variance_threshold": 50,
        "edge_threshold": 0.005,
        "contrast_threshold": 20,
        "phash_threshold": 10,
        "description": "Minimal cuts - only removes completely black/blurry"
    }
}


# ============================================================
# CONVEX WEBHOOK HELPERS
# ============================================================

def send_convex_webhook(endpoint: str, data: dict) -> dict:
    """Send webhook to Convex HTTP endpoint."""
    import httpx
    try:
        url = f"{CONVEX_HTTP_URL}{endpoint}"
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=data)
            if resp.status_code in [200, 201]:
                return {"success": True, "data": resp.json()}
            else:
                return {"error": f"Convex returned {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"error": f"Convex webhook error: {str(e)[:200]}"}


def notify_convex_status(video_id: str, job_id: str, status: str, 
                         progress: int = 0, frame_count: int = 0,
                         error: str = None, thumbnail_url: str = None):
    """Send status update to Convex."""
    data = {
        "video_id": video_id,
        "job_id": job_id,
        "status": status,
        "progress": progress,
        "frame_count": frame_count,
    }
    if error:
        data["error"] = error
    if thumbnail_url:
        data["thumbnail_url"] = thumbnail_url
    
    result = send_convex_webhook("/modal/webhook", data)
    if result.get("error"):
        print(f"[Convex] Status update failed: {result['error']}")
    return result


def add_frame_to_convex(video_id: str, frame_number: int, image_url: str, user_id: str = None):
    """Add a frame to Convex database."""
    data = {
        "video_id": video_id,
        "frame_number": frame_number,
        "image_url": image_url,
    }
    if user_id:
        data["user_id"] = user_id
    
    return send_convex_webhook("/modal/frame", data)


# ============================================================
# SMART FRAME QUALITY FILTERS (unchanged from original)
# ============================================================

def measure_sharpness(image_path: str) -> float:
    """Measure image sharpness using Laplacian variance. Higher = sharper."""
    import cv2
    try:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return 0
        return cv2.Laplacian(img, cv2.CV_64F).var()
    except:
        return 0


def is_bad_frame(image_path: str, quality_mode: str = "medium") -> tuple:
    """Check if frame should be rejected based on quality mode."""
    import cv2
    import numpy as np
    
    preset = QUALITY_PRESETS.get(quality_mode, QUALITY_PRESETS["medium"])
    
    try:
        img = cv2.imread(image_path)
        if img is None:
            return True, "unreadable"
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        
        black_ratio = np.sum(gray < 30) / gray.size
        if black_ratio > preset["black_threshold"]:
            return True, "black"
        
        variance = np.var(gray)
        if variance < preset["variance_threshold"]:
            return True, "solid_color"
        
        edges = cv2.Canny(gray, 50, 150)
        edge_ratio = np.sum(edges > 0) / gray.size
        if edge_ratio < preset["edge_threshold"] and variance < 500:
            return True, "text_only"
        
        sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
        if sharpness < preset["blur_threshold"]:
            return True, "blurry"
        
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        hist = hist.flatten() / hist.sum()
        non_zero = np.sum(hist > 0.001)
        if non_zero < preset["contrast_threshold"]:
            return True, "low_contrast"
        
        return False, "OK"
        
    except Exception as e:
        return False, f"check_error: {e}"


def compute_phash(image_path: str):
    """Compute perceptual hash for duplicate detection."""
    import imagehash
    from PIL import Image
    try:
        return imagehash.phash(Image.open(image_path))
    except:
        return None


def is_duplicate(current_hash, seen_hashes: list, threshold: int = 8) -> bool:
    """Check if current frame is too similar to any seen frame."""
    if current_hash is None:
        return False
    for h in seen_hashes:
        if h is not None and current_hash - h < threshold:
            return True
    return False


# ============================================================
# SCENE DETECTION & FRAME EXTRACTION (unchanged)
# ============================================================

def detect_scenes(video_path: str, threshold: float = 27.0) -> list:
    from scenedetect import detect, ContentDetector
    try:
        return [{'start': s[0].get_seconds(), 'end': s[1].get_seconds()} 
                for s in detect(video_path, ContentDetector(threshold=threshold))]
    except Exception as e:
        print(f"[scenes] Error: {e}")
        return []


def extract_smart_keyframes(video_path: str, scenes: list, frames_dir: Path, 
                            max_frames: int = 50, samples_per_scene: int = 3,
                            min_scene_duration: float = 0.3, 
                            quality_mode: str = "medium") -> dict:
    """SMART extraction with quality mode."""
    import cv2
    
    preset = QUALITY_PRESETS.get(quality_mode, QUALITY_PRESETS["medium"])
    phash_threshold = preset["phash_threshold"]
    
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    valid_scenes = [s for s in scenes if s['end'] - s['start'] >= min_scene_duration]
    print(f"[frames] {len(valid_scenes)} scenes after filtering (quality_mode={quality_mode})")
    
    if len(valid_scenes) > max_frames * 2:
        step = len(valid_scenes) // max_frames
        valid_scenes = valid_scenes[::step]
    
    selected_frames = []
    rejected_frames = []
    seen_hashes = []
    stats = {"total_scenes": len(valid_scenes), "rejected": {}}
    
    for scene_idx, scene in enumerate(valid_scenes):
        scene_duration = scene['end'] - scene['start']
        scene_frame_count = int(scene_duration * fps)
        
        if scene_frame_count < 3:
            continue
        
        sample_points = []
        for i in range(samples_per_scene):
            offset = scene_duration * (0.2 + 0.3 * i)
            sample_time = scene['start'] + offset
            if sample_time < scene['end']:
                sample_points.append(sample_time)
        
        best_frame = None
        best_sharpness = 0
        best_path = None
        rejected_in_scene = []
        
        for sample_time in sample_points:
            frame_num = int(sample_time * fps)
            if frame_num >= total_frames_count:
                continue
                
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            
            if not ret:
                continue
            
            temp_path = frames_dir / f"temp_{scene_idx}_{frame_num}.jpg"
            cv2.imwrite(str(temp_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            is_bad, reason = is_bad_frame(str(temp_path), quality_mode)
            if is_bad:
                stats["rejected"][reason] = stats["rejected"].get(reason, 0) + 1
                rejected_in_scene.append({
                    'path': str(temp_path),
                    'reason': reason,
                    'scene_start': scene['start'],
                    'scene_end': scene['end'],
                    'timestamp': sample_time
                })
                continue
            
            sharpness = measure_sharpness(str(temp_path))
            
            if sharpness > best_sharpness:
                if best_path and os.path.exists(best_path):
                    rejected_in_scene.append({
                        'path': best_path,
                        'reason': 'not_sharpest',
                        'scene_start': scene['start'],
                        'scene_end': scene['end']
                    })
                best_sharpness = sharpness
                best_frame = frame
                best_path = str(temp_path)
            else:
                rejected_in_scene.append({
                    'path': str(temp_path),
                    'reason': 'not_sharpest',
                    'scene_start': scene['start'],
                    'scene_end': scene['end']
                })
        
        if best_path and best_sharpness > 0:
            current_hash = compute_phash(best_path)
            
            if is_duplicate(current_hash, seen_hashes, phash_threshold):
                stats["rejected"]["duplicate"] = stats["rejected"].get("duplicate", 0) + 1
                rejected_in_scene.append({
                    'path': best_path,
                    'reason': 'duplicate',
                    'scene_start': scene['start'],
                    'scene_end': scene['end']
                })
            else:
                final_path = frames_dir / f"selected_{len(selected_frames):04d}.jpg"
                os.rename(best_path, str(final_path))
                
                seen_hashes.append(current_hash)
                selected_frames.append({
                    'path': str(final_path),
                    'scene_start': scene['start'],
                    'scene_end': scene['end'],
                    'sharpness': best_sharpness,
                    'selected': True
                })
        
        for rej in rejected_in_scene:
            if os.path.exists(rej['path']):
                new_path = frames_dir / f"rejected_{len(rejected_frames):04d}.jpg"
                os.rename(rej['path'], str(new_path))
                rej['path'] = str(new_path)
                rej['selected'] = False
                rejected_frames.append(rej)
        
        if len(selected_frames) >= max_frames:
            break
    
    cap.release()
    
    print(f"[frames] Selected {len(selected_frames)} frames, rejected {len(rejected_frames)}")
    print(f"[frames] Rejection stats: {stats['rejected']}")
    
    return {
        'selected': selected_frames,
        'rejected': rejected_frames,
        'stats': stats,
        'quality_mode': quality_mode
    }


# ============================================================
# UPLOAD TO SUPABASE STORAGE (unchanged - keep images there)
# ============================================================

def upload_to_storage(args):
    import httpx
    import uuid
    
    frame_path, video_hash, supabase_url, supabase_key, is_selected = args
    
    try:
        with open(frame_path, 'rb') as f:
            image_bytes = f.read()
        
        frame_uuid = str(uuid.uuid4())
        folder = "selected" if is_selected else "rejected"
        filename = f"video_frames/{video_hash}/{folder}/{frame_uuid}.jpg"
        
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{supabase_url}/storage/v1/object/images/{filename}",
                headers={"Authorization": f"Bearer {supabase_key}", 
                        "Content-Type": "image/jpeg", "x-upsert": "true"},
                content=image_bytes
            )
            if resp.status_code in [200, 201]:
                return {"url": f"{supabase_url}/storage/v1/object/public/images/{filename}"}
            return {"error": f"storage {resp.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# DOWNLOAD HELPERS (unchanged)
# ============================================================

def is_youtube_url(url: str) -> bool:
    return any(x in urlparse(url).netloc.lower() for x in ['youtube.com', 'youtu.be'])

def is_instagram_url(url: str) -> bool:
    return 'instagram.com' in urlparse(url).netloc.lower()

def is_tiktok_url(url: str) -> bool:
    return any(x in urlparse(url).netloc.lower() for x in ['tiktok.com', 'vm.tiktok.com'])

def is_vimeo_url(url: str) -> bool:
    return 'vimeo.com' in urlparse(url).netloc.lower()

def is_supported_platform(url: str) -> bool:
    return is_youtube_url(url) or is_instagram_url(url) or is_tiktok_url(url) or is_vimeo_url(url)

def download_with_ytdlp(url: str, output_path: Path, cookies_path: Path = None) -> dict:
    cmd = [
        "yt-dlp", 
        "-f", "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "-o", str(output_path), 
        "--no-playlist", 
        "--merge-output-format", "mp4",
        "--geo-bypass",
    ]
    
    if is_youtube_url(url):
        cmd.extend(["--extractor-args", "youtube:player_client=android,web"])
        if cookies_path and cookies_path.exists():
            cmd.extend(["--cookies", str(cookies_path)])
    
    cmd.append(url)
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            return {"success": True}
        else:
            return {"error": f"yt-dlp failed: {result.stderr[:500]}"}
    except subprocess.TimeoutExpired:
        return {"error": "Download timeout (>5 min)"}
    except Exception as e:
        return {"error": str(e)}

def extract_youtube_id(url: str) -> str:
    import re
    patterns = [
        r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:embed/)([a-zA-Z0-9_-]{11})',
        r'(?:shorts/)([a-zA-Z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def download_youtube_rapidapi(video_id: str, output_path: Path, api_key: str) -> dict:
    import httpx
    import time
    
    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": "youtube-mp4-mp3-downloader.p.rapidapi.com"
    }
    
    try:
        with httpx.Client(timeout=120.0) as client:
            print(f"[download] Requesting download for {video_id}...")
            resp = client.get(
                f"https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download",
                params={"format": "720", "id": video_id, "audioQuality": "128", "addInfo": "false"},
                headers=headers
            )
            
            if resp.status_code != 200:
                return {"error": f"RapidAPI returned {resp.status_code}: {resp.text[:200]}"}
            
            data = resp.json()
            if not data.get("success"):
                return {"error": f"RapidAPI failed: {data}"}
            
            progress_id = data.get("progressId")
            print(f"[download] Got progressId: {progress_id}")
            
            for i in range(60):
                time.sleep(2)
                progress_resp = client.get(
                    f"https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/progress",
                    params={"id": progress_id},
                    headers=headers
                )
                
                if progress_resp.status_code != 200:
                    continue
                
                progress = progress_resp.json()
                print(f"[download] Progress: {progress.get('progress', 0)}/1000")
                
                if progress.get("finished"):
                    download_url = progress.get("downloadUrl")
                    if download_url:
                        print(f"[download] Downloading from: {download_url[:50]}...")
                        video_resp = client.get(download_url, follow_redirects=True, timeout=180.0)
                        if video_resp.status_code == 200:
                            output_path.write_bytes(video_resp.content)
                            print(f"[download] Saved {len(video_resp.content) / 1024 / 1024:.1f}MB")
                            return {"success": True}
                        else:
                            return {"error": f"Download failed: {video_resp.status_code}"}
                    return {"error": "No download URL"}
            
            return {"error": "Timeout waiting for video processing"}
            
    except Exception as e:
        return {"error": f"RapidAPI error: {str(e)[:200]}"}

def download_youtube(url: str, output_path: Path, cookies_path: Path) -> dict:
    RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "b0d761203emsh314fe800664fb02p18e114jsn29a1fdd9976f")
    
    video_id = extract_youtube_id(url)
    if video_id:
        print(f"[download] Using RapidAPI for video ID: {video_id}")
        result = download_youtube_rapidapi(video_id, output_path, RAPIDAPI_KEY)
        if result.get("success"):
            return result
        print(f"[download] RapidAPI failed: {result.get('error')}, trying yt-dlp...")
    
    cmd = [
        "yt-dlp", 
        "-f", "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "-o", str(output_path), 
        "--no-playlist", 
        "--merge-output-format", "mp4",
        "--geo-bypass",
        "--extractor-args", "youtube:player_client=android,web",
    ]
    if cookies_path.exists():
        cmd.extend(["--cookies", str(cookies_path)])
    cmd.append(url)
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return {"success": True} if result.returncode == 0 else {"error": result.stderr[:500]}


# ============================================================
# MAIN PROCESSOR - CONVEX VERSION
# ============================================================

# NOTE: Switched to modal.web_endpoint to avoid FastAPI recursion/dependency issues
@app.function(image=image, timeout=600, secrets=[supabase_secret, youtube_secret], 
              volumes={VOLUME_PATH: video_volume},
              cpu=8.0, memory=8192)
@modal.web_endpoint(method="POST")
def process_video(item: dict):
    """
    Direct web endpoint for video processing.
    Modal handles JSON parsing automatically when argument is a dict.
    """
    return run_video_processing(item)

def run_video_processing(item: dict) -> dict:
    """
    CONVEX VERSION - Smart video processing.
    """
    # Extract args from JSON body
    video_url = item.get("video_url")
    video_id = item.get("video_id")
    job_id = item.get("job_id")
    quality_mode = item.get("quality_mode", "medium")
    scene_threshold = item.get("scene_threshold", 27.0)
    max_frames = item.get("max_frames", 50)
    max_workers = item.get("max_workers", 30)
    """
    CONVEX VERSION - Smart video processing.
    
    Key differences from Supabase version:
    - Sends progress updates to Convex via webhooks
    - Sends frames to Convex instead of Supabase DB
    - Still uses Supabase Storage for images
    
    Args:
        video_url: URL of video to process
        video_id: Convex video document ID (for updates)
        job_id: Modal job ID (for tracking)
        quality_mode: "strict", "medium", or "high"
    """
    import hashlib
    import time
    
    start_time = time.time()
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    video_hash = hashlib.md5(video_url.encode()).hexdigest()[:12]
    work_dir = Path(VOLUME_PATH) / video_hash
    work_dir.mkdir(parents=True, exist_ok=True)
    video_path = work_dir / "video.mp4"
    frames_dir = work_dir / "frames"
    if frames_dir.exists():
        for f in frames_dir.glob("*.jpg"):
            f.unlink()
    frames_dir.mkdir(exist_ok=True)
    
    results = {
        "status": "processing", 
        "video_url": video_url, 
        "video_hash": video_hash,
        "video_id": video_id,
        "quality_mode": quality_mode,
        "scenes": 0, 
        "selected_frames": [],
        "rejected_frames": [],
        "errors": [], 
        "time": 0
    }
    
    if quality_mode not in QUALITY_PRESETS:
        quality_mode = "medium"
        results["quality_mode"] = quality_mode
    
    # Notify Convex: downloading
    notify_convex_status(video_id, job_id, "downloading", 5)
    
    # 1. Download
    t = time.time()
    print(f"[1/5] Downloading... (quality_mode={quality_mode})")
    cookies_path = work_dir / "cookies.txt"
    
    if is_youtube_url(video_url):
        cookies = os.environ.get("YOUTUBE_COOKIES", "")
        if cookies:
            cookies_path.write_text(cookies)
        dl = download_youtube(video_url, video_path, cookies_path)
    elif is_supported_platform(video_url):
        platform = "Instagram" if is_instagram_url(video_url) else \
                   "TikTok" if is_tiktok_url(video_url) else \
                   "Vimeo" if is_vimeo_url(video_url) else "video platform"
        print(f"[1/5] Detected {platform}, using yt-dlp...")
        dl = download_with_ytdlp(video_url, video_path, cookies_path)
    else:
        import httpx
        print(f"[1/5] Direct URL download...")
        with httpx.Client(timeout=120, follow_redirects=True) as c:
            r = c.get(video_url)
            video_path.write_bytes(r.content) if r.status_code == 200 else None
            dl = {"success": True} if r.status_code == 200 else {"error": f"HTTP {r.status_code}"}
    
    if dl.get("error"):
        results["errors"].append(dl["error"])
        results["status"] = "failed"
        notify_convex_status(video_id, job_id, "failed", 0, error=dl["error"])
        return results
    
    video_volume.commit()
    print(f"[1/5] Downloaded in {time.time()-t:.1f}s")
    
    # Notify Convex: processing
    notify_convex_status(video_id, job_id, "processing", 20)
    
    # 2. Scene Detection
    t = time.time()
    print(f"[2/5] Detecting scenes...")
    scenes = detect_scenes(str(video_path), scene_threshold)
    results["scenes"] = len(scenes)
    print(f"[2/5] Found {len(scenes)} scenes in {time.time()-t:.1f}s")
    
    if not scenes:
        results["errors"].append("No scenes")
        results["status"] = "failed"
        notify_convex_status(video_id, job_id, "failed", 0, error="No scenes detected")
        return results
    
    # Notify Convex: extracting
    notify_convex_status(video_id, job_id, "extracting", 35)
    
    # 3. SMART Frame Extraction
    t = time.time()
    print(f"[3/5] Smart frame extraction (quality_mode={quality_mode})...")
    frame_result = extract_smart_keyframes(
        str(video_path), scenes, frames_dir, max_frames, 
        quality_mode=quality_mode
    )
    
    selected_frames = frame_result['selected']
    rejected_frames = frame_result['rejected']
    
    video_volume.commit()
    print(f"[3/5] Extracted {len(selected_frames)} selected, {len(rejected_frames)} rejected in {time.time()-t:.1f}s")
    
    if not selected_frames and not rejected_frames:
        results["errors"].append("No frames extracted")
        results["status"] = "failed"
        notify_convex_status(video_id, job_id, "failed", 0, error="No frames extracted")
        return results
    
    # Notify Convex: uploading
    notify_convex_status(video_id, job_id, "processing", 50, frame_count=len(selected_frames))
    
    # 4. Upload frames to Supabase Storage
    t = time.time()
    total_frames = len(selected_frames) + len(rejected_frames)
    print(f"[4/5] Uploading {total_frames} frames to Supabase Storage...")
    
    upload_args = []
    for f in selected_frames:
        upload_args.append((f['path'], video_hash, SUPABASE_URL, SUPABASE_KEY, True))
    for f in rejected_frames:
        upload_args.append((f['path'], video_hash, SUPABASE_URL, SUPABASE_KEY, False))
    
    uploaded_selected = []
    uploaded_rejected = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(upload_to_storage, arg): (i, arg[4]) for i, arg in enumerate(upload_args)}
        for future in as_completed(futures):
            idx, is_selected = futures[future]
            result = future.result()
            
            if result.get("url"):
                if is_selected:
                    frame_data = selected_frames[idx] if idx < len(selected_frames) else None
                    if frame_data:
                        uploaded_selected.append({
                            "url": result["url"],
                            "scene_start": frame_data.get('scene_start'),
                            "scene_end": frame_data.get('scene_end'),
                            "sharpness": frame_data.get('sharpness'),
                            "selected": True
                        })
                else:
                    rej_idx = idx - len(selected_frames)
                    frame_data = rejected_frames[rej_idx] if rej_idx < len(rejected_frames) else None
                    if frame_data:
                        uploaded_rejected.append({
                            "url": result["url"],
                            "scene_start": frame_data.get('scene_start'),
                            "scene_end": frame_data.get('scene_end'),
                            "reason": frame_data.get('reason'),
                            "selected": False
                        })
    
    print(f"[4/5] Uploaded in {time.time()-t:.1f}s")
    
    # Get thumbnail from first selected frame
    thumbnail_url = uploaded_selected[0]["url"] if uploaded_selected else None
    
    # Notify Convex: pending approval with frame count
    notify_convex_status(
        video_id, job_id, "pending_approval", 100, 
        frame_count=len(uploaded_selected),
        thumbnail_url=thumbnail_url
    )
    
    # 5. Return frames for user approval
    results["selected_frames"] = uploaded_selected
    results["rejected_frames"] = uploaded_rejected
    results["status"] = "pending_approval"
    results["time"] = round(time.time() - start_time, 1)
    
    print(f"[5/5] Ready for approval: {len(uploaded_selected)} selected, {len(uploaded_rejected)} rejected")
    print(f"[DONE] Total time: {results['time']}s")
    
    return results


@app.function(image=image, timeout=60, secrets=[supabase_secret])
def approve_frames_convex(video_id: str, frame_urls: list, user_id: str = None) -> dict:
    """
    User approved these frames - add them to Convex database.
    Called after user reviews and confirms their selection.
    """
    results = {"success": 0, "errors": []}
    
    for i, url in enumerate(frame_urls):
        result = add_frame_to_convex(video_id, i, url, user_id)
        if result.get("success"):
            results["success"] += 1
        else:
            results["errors"].append(result.get("error", "Unknown error"))
    
    return {"approved": results["success"], "errors": results["errors"]}


@app.function(image=image, timeout=60, secrets=[supabase_secret])
def delete_rejected_frames(video_hash: str, frame_urls: list) -> dict:
    """Delete rejected frames from Supabase storage."""
    import httpx
    import os
    
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    deleted = 0
    errors = []
    
    for url in frame_urls:
        try:
            path = url.split("/storage/v1/object/public/images/")[-1]
            
            with httpx.Client(timeout=10.0) as client:
                resp = client.delete(
                    f"{SUPABASE_URL}/storage/v1/object/images/{path}",
                    headers={"Authorization": f"Bearer {SUPABASE_KEY}"}
                )
                if resp.status_code in [200, 204]:
                    deleted += 1
                else:
                    errors.append(f"Failed to delete {path}: {resp.status_code}")
        except Exception as e:
            errors.append(str(e))
    
    return {"deleted": deleted, "errors": errors}

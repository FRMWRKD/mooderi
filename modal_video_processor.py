"""
Modal Video Processor - SMART FRAME SELECTION with QUALITY PRESETS
- Quality modes: strict (fewer frames), medium (balanced), high (more frames)
- Picks sharpest frame from each scene (not just frame 3)
- Dedupes similar frames using perceptual hash
- Filters black, blurry, low-contrast frames
- Returns BOTH selected and rejected frames for user approval
"""
import modal
import os
import subprocess
import json
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

app = modal.App("moodboard-video-processor")
video_volume = modal.Volume.from_name("moodboard-videos", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "curl", "unzip", "libgl1-mesa-glx", "libglib2.0-0")
    .run_commands(
        "curl -fsSL https://deno.land/install.sh | sh",
        "ln -s /root/.deno/bin/deno /usr/local/bin/deno"
    )
    .pip_install(
        "yt-dlp", "httpx", "pillow", "fastapi",
        "scenedetect[opencv]", "opencv-python-headless", "numpy",
        "imagehash"  # For perceptual hashing
    )
)

supabase_secret = modal.Secret.from_name("supabase-creds")
youtube_secret = modal.Secret.from_name("youtube-cookies")
VOLUME_PATH = "/mnt/videos"


# ============================================================
# QUALITY MODE PRESETS
# ============================================================

QUALITY_PRESETS = {
    "strict": {
        "blur_threshold": 50,      # Higher = fewer frames pass
        "black_threshold": 0.75,   # Lower = stricter (fewer dark frames pass)
        "variance_threshold": 200, # Higher = stricter
        "edge_threshold": 0.02,    # Higher = stricter
        "contrast_threshold": 50,  # Higher = stricter
        "phash_threshold": 6,      # Lower = stricter (fewer similar frames pass)
        "description": "Highest quality only - saves credits"
    },
    "medium": {
        "blur_threshold": 25,      # Balanced
        "black_threshold": 0.85,   
        "variance_threshold": 100,
        "edge_threshold": 0.01,
        "contrast_threshold": 30,
        "phash_threshold": 8,
        "description": "Balanced quality - recommended"
    },
    "high": {
        "blur_threshold": 10,      # Lower = more frames pass
        "black_threshold": 0.92,   # Higher = more dark frames pass
        "variance_threshold": 50,  # Lower = more frames pass
        "edge_threshold": 0.005,   # Lower = more frames pass
        "contrast_threshold": 20,  # Lower = more frames pass
        "phash_threshold": 10,     # Higher = more similar frames pass
        "description": "Minimal cuts - only removes completely black/blurry"
    }
}


# ============================================================
# SMART FRAME QUALITY FILTERS
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
    """
    Check if frame should be rejected based on quality mode.
    
    Quality modes:
    - "strict": Fewer frames, highest quality (saves credits)
    - "medium": Balanced (recommended)
    - "high": More frames, minimal cuts (only removes black/severely blurry)
    
    Returns (is_bad: bool, reason: str)
    """
    import cv2
    import numpy as np
    
    preset = QUALITY_PRESETS.get(quality_mode, QUALITY_PRESETS["medium"])
    
    try:
        img = cv2.imread(image_path)
        if img is None:
            return True, "unreadable"
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        
        # 1. Black frame
        black_ratio = np.sum(gray < 30) / gray.size
        if black_ratio > preset["black_threshold"]:
            return True, "black"
        
        # 2. Low variance (solid color)
        variance = np.var(gray)
        if variance < preset["variance_threshold"]:
            return True, "solid_color"
        
        # 3. Text/logo only (low edges)
        edges = cv2.Canny(gray, 50, 150)
        edge_ratio = np.sum(edges > 0) / gray.size
        if edge_ratio < preset["edge_threshold"] and variance < 500:
            return True, "text_only"
        
        # 4. Blurry (Laplacian variance)
        sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
        if sharpness < preset["blur_threshold"]:
            return True, "blurry"
        
        # 5. Low contrast (histogram spread)
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
# SMART FRAME EXTRACTION
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
    """
    SMART extraction with quality mode.
    
    Returns dict with:
    - selected: frames that passed quality checks
    - rejected: frames that failed (with reasons)
    
    Process:
    1. Sample multiple frames per scene
    2. Pick the sharpest one
    3. Filter bad frames based on quality_mode
    4. Dedupe similar frames across scenes
    """
    import cv2
    
    preset = QUALITY_PRESETS.get(quality_mode, QUALITY_PRESETS["medium"])
    phash_threshold = preset["phash_threshold"]
    
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Filter very short scenes
    valid_scenes = [s for s in scenes if s['end'] - s['start'] >= min_scene_duration]
    print(f"[frames] {len(valid_scenes)} scenes after filtering short ones (quality_mode={quality_mode})")
    
    # Limit scenes if too many
    if len(valid_scenes) > max_frames * 2:
        step = len(valid_scenes) // max_frames
        valid_scenes = valid_scenes[::step]
    
    selected_frames = []
    rejected_frames = []
    seen_hashes = []
    stats = {"total_scenes": len(valid_scenes), "rejected": {"black": 0, "blurry": 0, 
             "duplicate": 0, "text_only": 0, "solid_color": 0, "low_contrast": 0, "other": 0}}
    
    for scene_idx, scene in enumerate(valid_scenes):
        scene_duration = scene['end'] - scene['start']
        scene_frame_count = int(scene_duration * fps)
        
        if scene_frame_count < 3:
            continue
        
        # Sample points within scene (avoid first/last frames for transitions)
        sample_points = []
        for i in range(samples_per_scene):
            # Sample at 20%, 50%, 80% of scene
            offset = scene_duration * (0.2 + 0.3 * i)
            sample_time = scene['start'] + offset
            if sample_time < scene['end']:
                sample_points.append(sample_time)
        
        # Extract and measure sharpness of each sample
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
            
            # Save temp frame
            temp_path = frames_dir / f"temp_{scene_idx}_{frame_num}.jpg"
            cv2.imwrite(str(temp_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            # Check if bad frame
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
            
            # Measure sharpness
            sharpness = measure_sharpness(str(temp_path))
            
            if sharpness > best_sharpness:
                # Clean up previous best (move to rejected)
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
        
        # If we found a good frame, check for duplicates
        if best_path and best_sharpness > 0:
            current_hash = compute_phash(best_path)
            
            if is_duplicate(current_hash, seen_hashes, phash_threshold):
                stats["rejected"]["duplicate"] += 1
                rejected_in_scene.append({
                    'path': best_path,
                    'reason': 'duplicate',
                    'scene_start': scene['start'],
                    'scene_end': scene['end']
                })
            else:
                # Keep this frame as selected
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
        
        # Rename rejected frames for this scene
        for rej in rejected_in_scene:
            if os.path.exists(rej['path']):
                new_path = frames_dir / f"rejected_{len(rejected_frames):04d}.jpg"
                os.rename(rej['path'], str(new_path))
                rej['path'] = str(new_path)
                rej['selected'] = False
                rejected_frames.append(rej)
        
        # Limit total selected frames
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
# UPLOAD (uploads ALL frames - both selected and rejected)
# ============================================================

def upload_to_storage(args):
    import httpx
    import uuid
    
    frame_path, video_hash, supabase_url, supabase_key, is_selected = args
    
    try:
        with open(frame_path, 'rb') as f:
            image_bytes = f.read()
        
        frame_uuid = str(uuid.uuid4())
        # Use different folders for selected vs rejected
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


def batch_insert_to_db(rows: list, supabase_url: str, supabase_key: str) -> dict:
    import httpx
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{supabase_url}/rest/v1/images",
                headers={"Authorization": f"Bearer {supabase_key}", "apikey": supabase_key,
                        "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=rows
            )
            return {"success": True, "count": len(rows)} if resp.status_code in [200, 201] else {"error": f"db {resp.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# DOWNLOAD
# ============================================================

def is_youtube_url(url: str) -> bool:
    return any(x in urlparse(url).netloc.lower() for x in ['youtube.com', 'youtu.be'])


def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from URL."""
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
    """Download YouTube video via RapidAPI youtube-mp4-mp3-downloader."""
    import httpx
    import time
    
    headers = {
        "x-rapidapi-key": api_key,
        "x-rapidapi-host": "youtube-mp4-mp3-downloader.p.rapidapi.com"
    }
    
    try:
        with httpx.Client(timeout=120.0) as client:
            # 1. Start download
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
            print(f"[download] Got progressId: {progress_id}, title: {data.get('title', 'unknown')}")
            
            # 2. Poll for completion
            for i in range(60):  # Max 60 polls (2 mins)
                time.sleep(2)
                progress_resp = client.get(
                    f"https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/progress",
                    params={"id": progress_id},
                    headers=headers
                )
                
                if progress_resp.status_code != 200:
                    continue
                
                progress = progress_resp.json()
                print(f"[download] Progress: {progress.get('progress', 0)}/1000 - {progress.get('status', 'unknown')}")
                
                if progress.get("finished"):
                    download_url = progress.get("downloadUrl")
                    if download_url:
                        # 3. Download the video
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
    """Download YouTube video - tries RapidAPI first, falls back to yt-dlp."""
    
    RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "b0d761203emsh314fe800664fb02p18e114jsn29a1fdd9976f")
    
    video_id = extract_youtube_id(url)
    if video_id:
        print(f"[download] Using RapidAPI for video ID: {video_id}")
        result = download_youtube_rapidapi(video_id, output_path, RAPIDAPI_KEY)
        if result.get("success"):
            return result
        print(f"[download] RapidAPI failed: {result.get('error')}, trying yt-dlp...")
    
    # Fallback to yt-dlp
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
# MAIN - Returns both selected and rejected frames
# ============================================================

@app.function(image=image, timeout=600, secrets=[supabase_secret, youtube_secret], 
              volumes={VOLUME_PATH: video_volume})
def process_video(video_url: str, quality_mode: str = "medium",
                  scene_threshold: float = 27.0, 
                  max_frames: int = 50, max_workers: int = 30) -> dict:
    """
    SMART video processing with quality presets.
    
    quality_mode options:
    - "strict": Fewer frames, highest quality (saves credits)
    - "medium": Balanced (recommended)
    - "high": More frames, minimal cuts
    
    Returns both selected AND rejected frames for user approval.
    Credits are charged AFTER user approves frames.
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
        "quality_mode": quality_mode,
        "scenes": 0, 
        "selected_frames": [],
        "rejected_frames": [],
        "errors": [], 
        "time": 0
    }
    
    # Validate quality mode
    if quality_mode not in QUALITY_PRESETS:
        quality_mode = "medium"
        results["quality_mode"] = quality_mode
    
    # 1. Download
    t = time.time()
    print(f"[1/5] Downloading... (quality_mode={quality_mode})")
    cookies_path = work_dir / "cookies.txt"
    if is_youtube_url(video_url):
        cookies = os.environ.get("YOUTUBE_COOKIES", "")
        if cookies:
            cookies_path.write_text(cookies)
        dl = download_youtube(video_url, video_path, cookies_path)
    else:
        import httpx
        with httpx.Client(timeout=120, follow_redirects=True) as c:
            r = c.get(video_url)
            video_path.write_bytes(r.content) if r.status_code == 200 else None
            dl = {"success": True} if r.status_code == 200 else {"error": f"HTTP {r.status_code}"}
    
    if dl.get("error"):
        results["errors"].append(dl["error"])
        results["status"] = "failed"
        return results
    
    video_volume.commit()
    print(f"[1/5] Downloaded in {time.time()-t:.1f}s")
    
    # 2. Scene Detection
    t = time.time()
    print(f"[2/5] Detecting scenes...")
    scenes = detect_scenes(str(video_path), scene_threshold)
    results["scenes"] = len(scenes)
    print(f"[2/5] Found {len(scenes)} scenes in {time.time()-t:.1f}s")
    
    if not scenes:
        results["errors"].append("No scenes")
        results["status"] = "failed"
        return results
    
    # 3. SMART Frame Extraction with Quality Mode
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
        return results
    
    # 4. Upload ALL frames to storage (both selected and rejected)
    t = time.time()
    total_frames = len(selected_frames) + len(rejected_frames)
    print(f"[4/5] Uploading {total_frames} frames ({len(selected_frames)} selected, {len(rejected_frames)} rejected)...")
    
    # Build upload args for all frames
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
                    # Find corresponding frame data
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
                    # Find corresponding rejected frame data
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
    
    # 5. Return frames for user approval (DON'T insert to DB yet!)
    results["selected_frames"] = uploaded_selected
    results["rejected_frames"] = uploaded_rejected
    results["status"] = "pending_approval"
    results["time"] = round(time.time() - start_time, 1)
    
    print(f"[5/5] Ready for approval: {len(uploaded_selected)} selected, {len(uploaded_rejected)} rejected")
    print(f"[DONE] Total time: {results['time']}s")
    
    return results


@app.function(image=image, timeout=60, secrets=[supabase_secret])
def approve_frames(video_hash: str, frame_urls: list) -> dict:
    """
    User approved these frames - insert them into the database.
    Called after user reviews and confirms their selection.
    """
    import os
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    db_rows = [{
        "image_url": url,
        "prompt": "",  # Will be filled by Visionati later
        "source_video_url": f"video_hash:{video_hash}",
        "is_public": True
    } for url in frame_urls]
    
    result = batch_insert_to_db(db_rows, SUPABASE_URL, SUPABASE_KEY)
    return result


@app.function(image=image, timeout=60, secrets=[supabase_secret])
def delete_rejected_frames(video_hash: str, frame_urls: list) -> dict:
    """
    Delete rejected frames from storage.
    Called when user confirms they don't want certain frames.
    """
    import httpx
    import os
    
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    deleted = 0
    errors = []
    
    for url in frame_urls:
        try:
            # Extract path from URL
            # URL format: {SUPABASE_URL}/storage/v1/object/public/images/video_frames/{hash}/{folder}/{uuid}.jpg
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


@app.function(image=image, timeout=60, secrets=[youtube_secret])
def health_check() -> dict:
    return {
        "status": "healthy", 
        "features": ["sharpness", "dedupe", "quality_filter", "approval_workflow"],
        "quality_modes": list(QUALITY_PRESETS.keys())
    }


@app.local_entrypoint()
def main(url: str = "https://www.youtube.com/watch?v=u2FLSmVsFs0", 
         quality: str = "medium"):
    import time
    start = time.time()
    result = process_video.remote(url, quality_mode=quality, max_workers=30)
    print(f"\nTotal: {time.time()-start:.1f}s")
    print(json.dumps(result, indent=2))


@app.function(image=image, timeout=600, secrets=[supabase_secret, youtube_secret], volumes={VOLUME_PATH: video_volume})
@modal.fastapi_endpoint(method="POST")
def process_video_api(item: dict) -> dict:
    """API endpoint for video processing with quality mode."""
    url = item.get("video_url") or item.get("youtube_url")
    quality_mode = item.get("quality_mode", "medium")
    
    if not url:
        return {"error": "video_url required"}
    
    return process_video.local(
        url, 
        quality_mode=quality_mode,
        scene_threshold=item.get("scene_threshold", 27.0), 
        max_frames=item.get("max_frames", 50), 
        max_workers=item.get("max_workers", 30)
    )

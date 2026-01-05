# MoodBoard Database Schema Reference

> **Last Updated:** 2026-01-05

## Images Table

The `images` table is the core table storing all image data.

### Prompt Fields

| Field | Type | Used For |
|-------|------|----------|
| `prompt` | text | Simple text description (legacy, often empty for newer images) |
| `generated_prompts` | jsonb | **PRIMARY - Rich structured prompts** |
| `positive_prompt` | text | AI positive prompt (rarely used) |
| `negative_prompt` | text | AI negative prompt (rarely used) |

### generated_prompts JSONB Structure

```json
{
  "text_to_image": "Detailed prompt for text-to-image AI...",
  "text_to_video": "Prompt for video generation...",
  "image_to_image": "Prompt for img2img...",
  "structured_analysis": {
    "short_description": "Brief description",
    "subjects": [{ "type": "person", "description": "..." }],
    "environment": { "setting": "...", "background": "...", "atmosphere": "..." },
    "lighting": { "type": "...", "direction": "...", "quality": "..." },
    "camera": { "shot_type": "...", "angle": "...", "depth_of_field": "..." },
    "mood": { "emotion": "...", "energy": "...", "style": "..." },
    "technical": { "quality": "...", "sharpness": "...", "post_processing": "..." }
  }
}
```

### Display Priority for Prompts

When displaying prompts in the UI, use this fallback chain:

```javascript
const displayPrompt = 
  image.prompt ||                                              // Legacy simple prompt
  image.generated_prompts?.text_to_image ||                   // Rich text-to-image prompt
  image.generated_prompts?.structured_analysis?.short_description || // Short description
  "No prompt available.";
```

### All Fields

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | bigint | NO | - | Primary key |
| image_url | text | NO | - | Supabase storage URL |
| prompt | text | NO | - | Simple text prompt |
| positive_prompt | text | YES | null | Positive AI prompt |
| negative_prompt | text | YES | null | Negative AI prompt |
| tags | jsonb | YES | [] | Array of tag strings |
| mood | text | YES | null | Mood label |
| lighting | text | YES | null | Lighting type |
| colors | jsonb | YES | [] | Array of hex colors |
| width | integer | YES | null | Image width |
| height | integer | YES | null | Image height |
| aspect_ratio | text | YES | null | Aspect ratio string |
| source_video_url | text | YES | null | Source video URL |
| created_by | uuid | YES | null | User who created |
| is_public | boolean | YES | true | Public visibility |
| copy_count | integer | YES | 0 | Times copied |
| created_at | timestamptz | YES | now() | Creation timestamp |
| metadata | jsonb | YES | null | Additional metadata |
| likes | integer | YES | 0 | Like count |
| dislikes | integer | YES | 0 | Dislike count |
| scene_start_time | float | YES | null | Video timestamp start |
| scene_end_time | float | YES | null | Video timestamp end |
| gif_url | text | YES | null | GIF preview URL |
| generated_prompts | jsonb | YES | null | Rich prompt data |
| aesthetic_score | float | YES | 0 | Quality score 0-10 |
| embedding | vector | YES | null | Semantic search vector |
| video_id | uuid | YES | null | Related video FK |
| user_id | uuid | YES | null | Owner user ID |
| visibility | text | YES | 'public' | Visibility status |
| is_curated | boolean | YES | false | Curated flag |
| source_type | text | YES | 'video_import' | Import source |
| board_id | uuid | YES | null | Board FK |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/images` | GET | List public images (filters for images with prompts) |
| `/api/images/:id` | GET | Get single image |
| `/api/search` | GET | Search images by text or semantic |
| `/api/filter-options` | GET | Get available filter values |

## Deployment URLs

| Service | URL |
|---------|-----|
| Frontend | https://frontend-seven-ecru-44.vercel.app |
| Backend | https://mooderi-u26413.vm.elestio.app |
| Supabase | https://omfxqultpjhvfljgzyxl.supabase.co |

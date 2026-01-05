# MoodBoard System Architecture

> **Last Updated:** 2026-01-05 - CORRECTED

## AI Pipeline Flow

```
Image Upload
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: VISIONATI ANALYSIS                                 │
│  Edge Function: analyze-image                               │
│  - Sends image to Visionati API                             │
│  - Gets: tags, colors, structured_analysis (JSON)           │
│  - Generates Google embedding for semantic search           │
│                                                             │
│  Output:                                                    │
│   - structured_analysis: {subjects, environment, lighting,  │
│     camera, colors, mood, technical}                        │
│   - colors: ["#hex1", "#hex2", ...]                         │
│   - tags: ["tag1", "tag2", ...]                             │
│   - embedding: [768 dimensions vector]                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: STRAICO PROMPT GENERATION                          │
│  Edge Function: generate-prompts                            │
│  - Takes Visionati analysis as INPUT                        │
│  - Calls Straico API (minimax model)                        │
│  - Uses system_prompts table (straico_v1) for prompt        │
│  - GENERATES the actual image/video prompts                 │
│                                                             │
│  Output:                                                    │
│   - text_to_image: "Full detailed prompt..."                │
│   - image_to_image: "..."                                   │
│   - text_to_video: "..."                                    │
│   - visionati_analysis: (saved for display)                 │
│   - structured_analysis: (saved for display)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: DATABASE UPDATE                                    │
│  - prompt = text_to_image (for simple display)              │
│  - generated_prompts = full JSONB with all prompts          │
│  - embedding = 768-dim vector for semantic search           │
└─────────────────────────────────────────────────────────────┘
```

## Database: `images` Table

### Prompt-Related Fields

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `prompt` | text | Straico | **Simple text prompt** - copy of `text_to_image` |
| `generated_prompts` | jsonb | Straico | Full structured prompts (see below) |
| `embedding` | vector(768) | Google | Semantic search embedding |

### `generated_prompts` JSONB Structure (from Straico)

```json
{
  "text_to_image": "Full detailed prompt for text-to-image AI...",
  "image_to_image": "Prompt for img2img workflows...",
  "text_to_video": "Prompt for video generation...",
  "visionati_analysis": "Original Visionati detailed description",
  "structured_analysis": {
    "subjects": [...],
    "environment": {...},
    "lighting": {...},
    "camera": {...},
    "mood": {...}
  }
}
```

### Other Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `mood` | text | Simple mood label |
| `lighting` | text | Lighting type |
| `colors` | jsonb | Array of hex colors (from Visionati) |
| `tags` | jsonb | Array of tags (from Visionati) |

## Edge Functions Location

```
/supabase/functions/
├── analyze-image/index.ts    # Visionati API
├── generate-prompts/index.ts # Straico API
└── generate-embedding/index.ts
```

## Deployment URLs

| Service | URL |
|---------|-----|
| Frontend | https://frontend-seven-ecru-44.vercel.app |
| Backend | https://mooderi-u26413.vm.elestio.app |
| Supabase | https://omfxqultpjhvfljgzyxl.supabase.co |

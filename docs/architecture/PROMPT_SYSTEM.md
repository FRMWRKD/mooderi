# Dynamic Prompt Generation System

A comprehensive guide to the AI-powered prompt generation system with **automatic category detection**, RAG enhancement, and community feedback.

## Overview

The system generates high-quality image generation prompts by:
1. **Analyzing input** (text or image via Visionati)
2. **Auto-detecting category** from Visionati tags and descriptions
3. **Finding similar examples** (vector search in RAG)
4. **Using category-specific templates** (YouTube, Anime, Realistic, etc.)
5. **Learning from rated examples** (top-rated prompts as context)
6. **Improving over time** (community feedback → AI improvement)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                  │
│                 (Text description or Image upload)                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VISIONATI ANALYSIS                              │
│   Tags extraction │ Colors │ Structured JSON │ Mood │ Lighting     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 AUTO-DETECT CATEGORY                                │
│   detectCategoryFromAnalysis(tags, structuredAnalysis)              │
│                                                                     │
│   Keywords → Category Mapping:                                      │
│   - "thumbnail", "youtube" → youtube_thumbnail                     │
│   - "anime", "manga", "chibi" → anime                              │
│   - "photo", "portrait" → realistic                                │
│   - "cinematic", "movie" → cinematic                               │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────────────┐
│   CATEGORY SYSTEM PROMPT  │   │      EMBEDDING GENERATION         │
│  (category_{key}_v1)      │   │   (Google text-embedding-004)     │
│  - Style-specific rules   │   │   - 768 dimensions                │
│  - Output format          │   │   - Semantic understanding        │
└───────────────┬───────────┘   └───────────────┬───────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RAG PIPELINE                                     │
│  1. Vector search → Find similar images in database                 │
│  2. Filter by category → Only matching category examples            │
│  3. Weight by rating → Highest-rated examples first                 │
│  4. Top 3 examples → Inject as context for AI                       │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STRAICO AI GENERATION                            │
│                                                                     │
│  System Prompt: "You are generating {category} style prompts..."   │
│  +                                                                  │
│  Top Examples: "Example 1 (Rating 95): ..."                         │
│  +                                                                  │
│  Input Analysis: "{mood: dramatic, lighting: golden hour..."        │
│                            │                                        │
│                            ▼                                        │
│                   GENERATED PROMPT                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Auto-Detection Flow

When an image is analyzed (from video frame or upload), the category is **automatically detected**:

```
VISIONATI ANALYSIS
        │
        ▼
┌───────────────────────────────────────────────────┐
│  detectCategoryFromAnalysis(tags, analysis)       │
│                                                   │
│  Keywords → Category Mapping:                     │
│  - "thumbnail", "youtube" → youtube_thumbnail    │
│  - "anime", "manga", "chibi" → anime             │
│  - "logo", "icon", "brand" → logo                │
│  - "cinematic", "movie", "film" → cinematic      │
│  - "illustration", "artwork" → illustration      │
│  - "product", "commercial" → product             │
│  - "abstract", "surreal" → abstract              │
│  - "photo", "portrait" → realistic (default)     │
└───────────────────────────────────────────────────┘
        │
        ▼
Load category_<detected>_v1 system prompt
        │
        ▼
Fetch top 3 rated examples for category
        │
        ▼
Generate prompt with category-specific context
        │
        ▼
Store detectedCategory on image record
```

---

## User Selection (Optional Override)

The user **can** manually override in the PromptGenerator UI if they want a specific style, but for:
- **Video frame analysis** → Auto-detected (no user input)
- **Image uploads** → Auto-detected (no user input)
- **Landing page generator** → Optional user selection via dropdown

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `images.detectedCategory` | Stores auto-detected category per image |
| `promptCategories` | 8 predefined style definitions |
| `promptExamples` | Rated example prompts per category |
| `promptFeedback` | User ratings and suggestions |
| `promptVersions` | System prompt version history |
| `systemPrompts` | Category-specific AI instructions |

---

## Categories

| Key | Name | Detection Keywords | Description |
|-----|------|-------------------|-------------|
| `youtube_thumbnail` | YouTube Thumbnail | thumbnail, youtube, clickbait, reaction | Vibrant, eye-catching, click-optimized |
| `realistic` | Realistic | photo, portrait, landscape, nature | Photorealistic with camera terminology |
| `anime` | Anime/Manga | anime, manga, chibi, kawaii, cel-shaded | Japanese animation style |
| `illustration` | Illustration | illustration, artwork, concept art, fantasy | Artistic, stylized artwork |
| `cinematic` | Cinematic | cinematic, movie, film, dramatic, epic | Film-like with dramatic lighting |
| `logo` | Logo/Icon | logo, icon, brand, emblem, minimalist | Clean, minimalist brand elements |
| `product` | Product Photography | product, commercial, packshot, advertisement | Commercial e-commerce style |
| `abstract` | Abstract Art | abstract, surreal, conceptual, geometric | Creative, conceptual imagery |

---

## How Rating Works

1. **Initial rating**: Curated examples start at 80/100, community at 50/100
2. **User feedback**: 1-5 stars converted to 0-100 scale
3. **Running average**: New rating = (old_rating × count + new_rating) / (count + 1)
4. **RAG selection**: Top 3 examples by rating are used as context
5. **Weight formula**: `weight = similarity_score × (1 + rating/100)`

---

## Convex Functions

### Queries
- `promptCategories.listActive` - Get all active categories
- `promptExamples.getBestByCategory` - Top N rated examples

### Mutations
- `promptFeedback.submit` - Submit user feedback
- `promptFeedback.ratePrompt` - Rate a generated prompt

### Actions
- `ai.analyzeImage` - Full pipeline with auto-detection
- `promptGenerator.generatePrompt` - Main generation with category support
- `promptImproverActions.analyzeCategory` - AI suggests improvements
- `promptExamplesActions.generateEmbedding` - Create vector for example

---

## Seeding the Database

Run these in order via Convex Dashboard or CLI:

```bash
# Seed all at once
npx convex run seed:runAll

# Or individually
npx convex run seed:runCategories        # Create 8 categories
npx convex run seed:runSystemPrompts     # Create category prompts
npx convex run seed:runExamples          # Create initial examples
```

---

## Community Feedback Loop

```
User rates prompt (1-5 stars)
        │
        ▼
Saved to promptFeedback table (status: "approved" for ratings)
        │
        ▼
Updates promptExamples ratings (running average)
        │
        ▼
High-rated prompts become examples in RAG context
        │
        ▼
Future generations learn from best examples
```

---

## AI Improvement Flow

```
User submits suggestion (status: "pending")
        │
        ▼
Admin reviews and approves (status: "approved")
        │
        ▼
promptImproverActions.analyzeCategory() analyzes all approved suggestions
        │
        ▼
AI proposes changes to system prompt with confidence score
        │
        ▼
Admin applies improvement via promptImproverActions.applyImprovement()
        │
        ▼
Old version saved to promptVersions (rollback available)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `convex/ai.ts` | Main analysis pipeline with `detectCategoryFromAnalysis()` |
| `convex/promptCategories.ts` | Category CRUD + seed functions |
| `convex/promptExamples.ts` | Rated examples management |
| `convex/promptFeedback.ts` | Community feedback system |
| `convex/promptImprover.ts` | Version tracking |
| `convex/promptImproverActions.ts` | AI-powered improvement |
| `convex/promptGenerator.ts` | Landing page prompt generation |
| `convex/schema.ts` | Database schema with `detectedCategory` |
| `frontend/.../PromptGenerator.tsx` | UI with optional category selector |

# Mooderi Architecture Overview

> Last Updated: 2025-01-22

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 14)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │ Components  │  │     Contexts        │  │
│  │  /app/*     │  │  /features  │  │  Auth, VideoJob     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         └────────────────┼────────────────────┘             │
│                          │                                   │
│              useQuery / useMutation / useAction              │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      CONVEX BACKEND                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Queries   │  │  Mutations  │  │      Actions        │  │
│  │  Real-time  │  │   Writes    │  │   External APIs     │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
│                                                │             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Convex Database                     │    │
│  │  images, boards, users, videos, prompts, feedback   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Visionati │  │ Straico  │  │  Modal   │  │ Supabase │    │
│  │ Analysis │  │Generation│  │  Video   │  │ Storage  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Image Upload Flow
1. User uploads image → Supabase Storage (CDN)
2. Convex mutation creates image record
3. Convex action calls Visionati for analysis
4. Analysis stored, triggers prompt generation
5. Straico generates prompts via RAG context
6. Embeddings generated for similarity search

### Prompt Generation Flow
1. User selects image + category
2. Frontend calls `api.promptGenerator.generatePrompt`
3. Convex action:
   - Fetches image analysis (or triggers new)
   - Retrieves RAG context (similar prompts)
   - Calls Straico with system prompt + context
   - Stores generated prompt
4. Real-time update to frontend

### Video Processing Flow
1. User uploads video URL
2. Convex creates video record (status: pending)
3. Modal webhook triggered for processing
4. Modal extracts frames, analyzes each
5. HTTP callback updates Convex with results
6. Real-time progress updates to frontend

## Key Convex Files

| File | Purpose | Lines |
|------|---------|-------|
| `schema.ts` | Database schema definitions | 482 |
| `ai.ts` | Visionati + Straico integration | 720 |
| `promptGenerator.ts` | Main prompt generation | 779 |
| `promptCategories.ts` | 8 style categories | 379 |
| `rag.ts` | Vector search for context | 319 |
| `images.ts` | Image CRUD operations | 675 |
| `videos.ts` | Video processing queue | 353 |
| `users.ts` | User management + credits | 347 |
| `simpleBuilder.ts` | Simple prompt builder | 378 |

## Database Schema

### Core Tables
- **images** - Main content with prompts, embeddings, metadata
- **boards** - User collections/folders
- **users** - User profiles, credits, settings
- **videos** - Video processing records
- **videoFrames** - Extracted video frames

### Prompt Tables
- **promptCategories** - 8 style categories
- **promptExamples** - Example prompts for RAG
- **promptFeedback** - User ratings on prompts
- **promptRequests** - User prompt requests

### System Tables
- **authAccounts**, **authSessions**, etc. - Convex Auth

## Technology Choices

### Why Convex (not Supabase)?
- **Real-time by default** - No WebSocket setup needed
- **Type-safe queries** - Full TypeScript integration
- **Built-in vector search** - No external service
- **Simpler auth** - Convex Auth handles everything
- **No separate backend** - Functions run in Convex

### Why Modal for Video?
- **Serverless GPU** - Pay per use, no idle costs
- **Python ecosystem** - FFmpeg, OpenCV, ML libraries
- **Long-running jobs** - No timeout limits
- **Webhook callbacks** - Async progress updates

### Why Supabase Storage?
- **CDN delivery** - Fast global image serving
- **Existing infrastructure** - Already had images there
- **Cost effective** - Good pricing for static assets

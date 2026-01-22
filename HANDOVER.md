# MoodBoard Developer Handover Guide

**Last Updated:** January 22, 2026
**Project Status:** Active Development (Deployment in Progress)

---

## 1. PROJECT OVERVIEW

### What is Mooderi?

Mooderi is an AI-powered prompt library for visual creatives. The core value proposition is simple:

> **Users browse by IMAGE. They take away the PROMPT.**

Users search for visual inspiration (moody neon rain, cinematic lighting, etc.), find matching film stills or reference images, and copy ready-to-use prompts optimized for AI image generation tools like Midjourney, Flux, or Runway.

### Example User Flow

1. User searches "moody neon rain"
2. User sees grid of matching cinematic stills
3. User clicks an image they like
4. They see the image + a prompt like: "Cinematic still, neon-lit Tokyo alley at night, rain-soaked pavement reflecting pink and blue signs, lone figure with umbrella, anamorphic lens flare, shallow depth of field, Blade Runner aesthetic --ar 16:9"
5. User clicks "Copy Prompt" (costs 1 credit) and pastes into their AI tool

### Business Model

- **Guest Users:** Browse free, can generate prompts from own uploads (unlimited, free)
- **Registered Users:** Get 100 free credits on signup
- **Monetization:** 1 credit per prompt copy = $0.05 per credit after free tier is used
- **Additional Actions:** Video analysis, premium features

---

## 2. REPOSITORY STRUCTURE

```
/Volumes/SSD/New Coding Projects/MoodBoard Convex/
├── convex/                          # SOURCE OF TRUTH - Backend (37 TypeScript files)
│   ├── schema.ts                    # Database schema definition
│   ├── ai.ts                        # AI pipeline (Visionati + Straico + embeddings)
│   ├── promptGenerator.ts           # Main prompt generation logic with RAG
│   ├── promptImprover.ts            # Prompt refinement service
│   ├── promptAgent.ts               # Agentic prompt creation
│   ├── simpleBuilder.ts             # Simple prompt builder for users
│   ├── images.ts                    # Image CRUD and storage operations
│   ├── videos.ts                    # Video processing coordination
│   ├── boards.ts                    # Board/collection management
│   ├── users.ts                     # User profiles and preferences
│   ├── auth.ts                      # Authentication flows
│   ├── payments.ts                  # Payment/credit system
│   ├── rag.ts                       # Retrieval-Augmented Generation for semantic search
│   ├── rateLimits.ts                # Rate limiting for API protection
│   ├── retrier.ts                   # Automatic retry logic for external APIs
│   ├── email.ts                     # Email notifications
│   ├── notifications.ts             # User notifications
│   ├── logger.ts                    # Logging utilities
│   ├── promptCategories.ts          # Category management
│   ├── promptExamples.ts            # Example prompts for RAG
│   ├── promptFeedback.ts            # Feedback collection
│   ├── systemPrompts.ts             # AI system prompts
│   ├── userApiKeys.ts               # Third-party API key management
│   ├── http.ts                      # HTTP endpoints for webhooks
│   ├── imageGeneration.ts           # Image generation coordination
│   ├── seed.ts                      # Database seeding utilities
│   ├── progressStore.ts             # Processing progress tracking
│   ├── convex.config.ts             # Convex component configuration
│   └── _generated/                  # Auto-generated types (DO NOT EDIT)
│
├── frontend/                        # Next.js App Router Frontend
│   ├── src/
│   │   ├── app/                     # Next.js App Router pages
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── layout.tsx           # Root layout with providers
│   │   │   ├── image/[id]/page.tsx  # Image detail view
│   │   │   ├── my-images/page.tsx   # User's uploads
│   │   │   ├── videos/page.tsx      # Video processing UI
│   │   │   ├── chat/page.tsx        # Chat interface
│   │   │   ├── pricing/page.tsx     # Pricing page
│   │   │   ├── search/page.tsx      # Search results
│   │   │   ├── login/page.tsx       # Auth page
│   │   │   └── tools/               # Tool pages (prompt builder)
│   │   ├── components/
│   │   │   ├── ui/                  # Base UI components (Button, Input, Modal, etc.)
│   │   │   ├── layout/              # Layout components (Sidebar, TopBar, AppShell)
│   │   │   └── features/            # Feature components (PromptGenerator, ImageCard, etc.)
│   │   ├── lib/
│   │   │   └── utils.ts             # TypeScript utilities
│   │   ├── app/
│   │   └── ConvexClientProvider.tsx # Convex client configuration
│   ├── convex/                      # Copy of /convex/ for Vercel type generation
│   ├── public/                      # Static assets
│   ├── package.json                 # Frontend dependencies
│   ├── tsconfig.json                # TypeScript config with path aliases
│   ├── tailwind.config.ts           # TailwindCSS configuration
│   ├── next.config.js               # Next.js configuration
│   ├── vercel.json                  # Vercel deployment config
│   └── .vercelignore                # Files to exclude from Vercel
│
├── docs/                            # Documentation
│   ├── HANDOVER.md                  # This file
│   ├── DEPLOYMENT_STATUS.md         # Deployment troubleshooting
│   └── PROMPT_SYSTEM.md             # Prompt generation architecture
│
├── scripts/                         # Utility scripts
│   ├── seed.ts                      # Database seeding
│   └── test-*.js                    # Testing scripts for APIs
│
├── .env                             # Environment variables (source of truth)
├── .env.local                       # Local overrides
├── .gitignore                       # Git ignore rules (includes Mac resource forks)
└── package.json                     # Root package.json

```

### Key Path Alias

- `@convex/*` → Points to `/frontend/convex/*` (see `frontend/tsconfig.json`)
- This allows frontend components to import Convex types: `import { api } from "@convex/api"`

---

## 3. TECH STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Backend Runtime** | Convex | 1.31.4+ | Real-time backend, database, auth |
| **Frontend Framework** | Next.js | 14.2.0 | React 18 App Router |
| **Frontend UI** | TailwindCSS | 3.4.1 | Utility-first CSS |
| **UI Components** | Radix UI | Latest | Accessible components |
| **Image Analysis** | Visionati API | HTTP | Tag extraction, color detection, mood analysis |
| **LLM API** | Straico | HTTP | Multi-model LLM aggregator (Claude, GPT-4, etc.) |
| **Video Processing** | Modal | HTTP | Serverless GPU-based video frame extraction |
| **File Storage** | Supabase Storage | HTTP | Image/video CDN (via S3-compatible API) |
| **Authentication** | Convex Auth | @convex-dev/auth | Google OAuth, session management |
| **Payments** | Polar | @convex-dev/polar | Credit system, subscription billing |
| **Email** | Resend | @convex-dev/resend | Transactional emails |
| **Vector Search** | Convex RAG | @convex-dev/rag | Semantic search over embeddings |
| **Deployment** | Vercel | - | Next.js hosting |

### Why This Stack?

- **Convex over Supabase:** Convex provides real-time updates, type-safe API generation, and simpler serverless function management
- **Modal for videos:** Serverless GPU access without managing infrastructure; videos are expensive to process
- **Polar for payments:** Built-in Convex integration; handles subscriptions and one-time purchases
- **Visionati for image analysis:** Fast, accurate image understanding (colors, mood, composition)
- **Straico for LLM:** Aggregates multiple models (Claude, GPT-4, Llama) so we're not locked to one provider

---

## 4. DEVELOPMENT SETUP

### Prerequisites

```bash
Node.js 20.x (required by project)
npm 10.x or higher
Convex CLI (installed via npm)
Git
```

### Install Dependencies

```bash
# Root dependencies (if any)
npm install

# Frontend dependencies
cd frontend
npm install
```

### Environment Variables

Copy the `.env` file to set up credentials. Required variables:

```env
# Convex (auto-configured after login)
NEXT_PUBLIC_CONVEX_URL=https://amiable-raccoon-559.convex.cloud

# Supabase (storage only)
NEXT_PUBLIC_SUPABASE_URL=https://omfxqultpjhvfljgzyxl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# AI/ML APIs
VISIONATI_API_KEY=f14b36a8-...
STRAICO_API_KEY=Iy-IwLzXyd...
GOOGLE_API_KEY=AIzaSyCvaN...

# Video Processing
MODAL_TOKEN_ID=wk-boZkdnPRQ...
MODAL_TOKEN_SECRET=ws-uEaa791...
MODAL_VIDEO_ENDPOINT=https://frmwrkd-media--.modal.run

# Auth (Google OAuth)
AUTH_GOOGLE_ID=648793060118-...
AUTH_GOOGLE_SECRET=GOCSPX-Rir372...

# Payments
POLAR_ACCESS_TOKEN=polar_oat_...

# Email
RESEND_API_KEY=re_JXkcXb...
```

### Run Locally

```bash
# Terminal 1: Start Convex dev server
npx convex dev

# Terminal 2: Start Next.js frontend (runs on port 3005)
cd frontend
npm run dev

# Open http://localhost:3005
```

The `npx convex dev` command:
- Watches `/convex/` files for changes
- Auto-generates types in `/convex/_generated/`
- Syncs to Convex cloud for real-time dev database

### Login to Convex

```bash
# First time setup
npx convex auth

# This opens browser for OAuth, links to your Convex account
```

---

## 5. KEY FILES EXPLAINED

### `convex/schema.ts`

Defines the database structure using Convex's schema API. Key tables:

- **images:** Main content table with prompts, embeddings, user uploads
- **boards:** Collections/folders users create
- **boardImages:** Junction table linking images to boards
- **videos:** Video processing jobs (tracks Modal workflow)
- **users:** User profiles synced from auth
- **notifications:** Alerts and activity feed
- **systemPrompts:** AI prompt templates used by Straico
- **userActions:** Likes, dislikes, feedback tracking

```typescript
export default defineSchema({
  ...authTables,  // Built-in auth tables from Convex
  images: defineTable({ ... }),
  boards: defineTable({ ... }),
  // etc.
});
```

### `convex/ai.ts`

The core AI pipeline. Orchestrates three services:

1. **Visionati** → Analyzes image (colors, mood, lighting, tags, composition)
2. **Straico** → Generates prompts (text_to_image, image_to_image, text_to_video)
3. **Google Embeddings** → Creates 768-dim vectors for semantic search (RAG)

Features:
- **Rate limiting:** Prevents abuse of expensive APIs
- **Automatic retries:** Exponential backoff for failed requests
- **Error handling:** Graceful degradation if an API fails

```typescript
// Example usage
const result = await ctx.runAction(api.ai.analyzeImage, {
  imageUrl: "https://...",
  userId: user._id
});
```

### `convex/promptGenerator.ts`

Main public action for generating prompts. Flow:

1. Check rate limits (landing page users: 3/hour, app users: 20/hour)
2. Call Visionati to analyze image
3. Fetch RAG results (semantic search for similar high-ranked images)
4. Call Straico with examples from RAG
5. Detect category from visual analysis
6. Return prompt + recommendations + analysis metadata

```typescript
// From frontend
const { generatedPrompt, recommendations } =
  await generatePrompt({ imageUrl });
```

### `convex/images.ts`

Image CRUD operations:

- `getById` → Fetch single image with full metadata
- `list` → Browse images with filters (category, mood, tags)
- `search` → Full-text search on prompts and tags
- `create` → Store new image (from upload or URL import)
- `update` → Patch image fields
- `delete` → Remove image (soft delete)

### `convex/videos.ts`

Video processing coordination:

- `startProcessing` → Trigger Modal webhook
- `getProgress` → Poll processing status
- `extractFrames` → Call Modal to extract frames
- `handleFrameCallback` → Receive extracted frames from Modal, create images

Uses Modal's serverless GPU for frame extraction (expensive operation).

### `convex/users.ts`

User profile management:

- `me` → Get current user profile
- `getPublicProfile` → Get user's public info
- `updateProfile` → Update name, bio, avatar
- `getCredits` → Check remaining credits
- `addCredits` → Admin function to add credits

Synced from Convex Auth, extended with custom fields.

### `convex/rag.ts`

Retrieval-Augmented Generation module:

- `searchPrompts` → Vector search over image embeddings
- Used by `promptGenerator` to find high-quality examples
- Returns top-k similar images (weighted by aesthetic score + curation)

```typescript
// Example: Find images similar to uploaded photo
const similar = await ctx.runQuery(api.rag.searchPrompts, {
  embedding: userImageEmbedding,
  limit: 5
});
```

### `convex/rateLimits.ts`

Protects APIs from abuse using token bucket algorithm:

- Landing page users: 3 prompts/hour
- Authenticated users: 20 prompts/hour
- Rate limiter returns `minuteRemaining` and `hourRemaining` to frontend

```typescript
const rateLimitInfo = await rateLimiter.limitAction(
  ctx,
  userId,
  "generatePrompt",
  { perMinute: 1, perHour: 20 }
);
```

---

## 6. ARCHITECTURE DECISIONS

### Why Convex?

Previously the project used Supabase with Edge Functions. Migration to Convex because:

1. **Real-time subscriptions:** Native WebSocket support for live updates
2. **Type-safe API generation:** No manual API route definitions; auto-generated from `export const functionName = query/mutation/action(...)`
3. **Simpler authentication:** Built-in Convex Auth eliminates Supabase JWT validation boilerplate
4. **Faster iteration:** Dev mode syncs backend instantly, no deploy required
5. **Better error handling:** Stack traces directly in logs, easier debugging
6. **Component system:** Reusable backend components (rate-limiter, payment, RAG)

### Why Modal for Video Processing?

Video frame extraction is GPU-intensive. Options considered:

- **AWS Lambda/Google Cloud Functions:** Cold starts (10-30s), expensive GPU
- **Self-hosted:** Requires managing GPU instances, uptime monitoring
- **Modal:** Serverless GPU, warm functions, $0.30-0.50 per invocation

Modal is cheapest for bursty workloads (users upload videos infrequently).

### Path Alias Architecture

The `/frontend/convex/` folder is a **copy** of `/convex/`:

- **Why?** Vercel build needs types during `next build`
- **/convex/ is source of truth** — any changes must be made here
- **Sync strategy:** `cp -r convex frontend/convex` before deployment (automated in CI)

This is a known limitation of Convex + Next.js on Vercel. See `DEPLOYMENT_STATUS.md` for details.

---

## 7. COMMON TASKS

### Add a New Convex Function

1. Create/edit function in `/convex/myModule.ts`:

```typescript
import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const myQuery = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("images")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
  }
});

export const myMutation = mutation({
  args: { imageId: v.id("images"), mood: v.string() },
  handler: async (ctx, { imageId, mood }) => {
    return await ctx.db.patch(imageId, { mood });
  }
});
```

2. Run `npx convex dev` (auto-generates types)

3. Import and use in frontend:

```typescript
import { api } from "@convex/api";
import { useQuery, useMutation } from "convex/react";

export function MyComponent() {
  const images = useQuery(api.myModule.myQuery, { userId });
  const updateImage = useMutation(api.myModule.myMutation);

  return (
    <button onClick={() => updateImage({ imageId, mood: "sad" })}>
      Update
    </button>
  );
}
```

### Deploy to Production

```bash
# 1. Deploy backend
npx convex deploy

# 2. Update NEXT_PUBLIC_CONVEX_URL if needed (check convex dashboard)

# 3. Copy convex folder for Vercel
cp -r convex frontend/convex

# 4. Deploy frontend
cd frontend
vercel --prod

# 5. Monitor
# - Convex: https://dashboard.convex.dev/
# - Vercel: https://vercel.com/theo-vas-projects/frontend
```

### Seed Database with Example Data

```bash
# Run seed function
npx convex run seed:runAll

# Or seed specific tables
npx convex run seed:seedCategories
npx convex run seed:seedBuilderPresets
```

### Test an AI Pipeline Locally

The repo includes test scripts:

```bash
node test-rag.js          # Test vector search
node test-user-video.js   # Test video processing
node test-video-flow.js   # End-to-end video flow
```

### View Logs

```bash
# Stream logs
npx convex logs

# Filter by function
npx convex logs --filter "promptGenerator"
```

### Generate Types from Schema

Already automated when running `npx convex dev`, but manual generation:

```bash
npx convex types
```

Output: `/convex/_generated/api.d.ts` (includes all query/mutation/action signatures)

---

## 8. KNOWN ISSUES & GOTCHAS

### Mac Resource Fork Files (`._*`)

**Problem:** macOS creates `._*` files when saving files. These corrupt Vercel builds.

**Solution:**
```bash
# Clean before deployment
find . -name "._*" -delete
dot_clean .
```

Already added to `.gitignore` and `.vercelignore`.

### Root `/convex/` is Source of Truth

**Mistake:** Editing `/frontend/convex/` directly

**Correct:** Always edit `/convex/`, then sync:
```bash
cp -r convex frontend/convex
```

**Why:** `/frontend/convex/` is for Vercel build only; Convex CLI watches `/convex/`.

### Vercel Build Needs Convex Copy

**Why?** Next.js build requires all types during `npm run build`. Without `/frontend/convex/`, TypeScript fails.

**Solution:** Pre-build script syncs:
```json
// package.json
"scripts": {
  "prebuild": "cp -r ../convex ./convex",
  "build": "next build"
}
```

### Environment Variables

**Issue:** `NEXT_PUBLIC_*` variables must be in `vercel.json` or Vercel UI.

**Why?** Vercel needs them at **build time**, not runtime.

**Check:**
```bash
vercel env ls  # List current vars
vercel pull .env.production.local  # Download for local testing
```

### Rate Limiting on Landing Page

**Limit:** 3 prompts/hour for anonymous users.

**Reason:** Prevent free-tier abuse of expensive Visionati + Straico APIs.

**How users bypass:** Sign up for free account (100 credits included).

### Embedding Dimension Mismatch

**Issue:** If you change embedding model, dimension must match schema.

**Current:** 768 dimensions (Google Embeddings 384d model)

**If changing:** Update `/convex/schema.ts` + migrate existing embeddings.

---

## 9. EXTERNAL SERVICES & DASHBOARDS

| Service | Dashboard | Credentials in `.env` | Cost Model |
|---------|-----------|----------------------|------------|
| **Convex** | https://dashboard.convex.dev/ | Auto (after `npx convex auth`) | Free tier: 1M function calls/month; $0.50 per 1M after |
| **Vercel** | https://vercel.com/theo-vas-projects/frontend | `VERCEL_TOKEN` (for CI/CD) | Free: 3 deployments/day; Pro: $20/month |
| **Supabase** | https://supabase.com | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Free: 500MB storage; Pro: $25/month |
| **Visionati** | https://dashboard.visionati.ai | `VISIONATI_API_KEY` | $0.01-0.03 per image analysis |
| **Straico** | https://admin.straico.com | `STRAICO_API_KEY` | $0.01-0.10 per prompt (model dependent) |
| **Google Cloud** | https://console.cloud.google.com | `GOOGLE_API_KEY` | Free: 1M requests/month; $0.50 per 1M after |
| **Modal** | https://modal.com | `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` | Pay-as-you-go: $0.30-0.50 per video |
| **Polar** | https://app.polar.sh | `POLAR_ACCESS_TOKEN` | Revenue share: 3% + $0.30 per transaction |
| **Resend** | https://resend.com | `RESEND_API_KEY` | Free: 100/day; Paid: $20/month |

**Recommended checks:**
- **Weekly:** Monitor costs on Visionati/Straico/Modal dashboards
- **Monthly:** Review Polar revenue; ensure Convex quota not exceeded
- **Per deployment:** Test email sends via Resend logs

---

## 10. TROUBLESHOOTING

### Local Dev Issues

**Problem:** `Could not find specified database 'convex'`

**Solution:**
```bash
npx convex auth  # Re-authenticate with Convex
npx convex dev   # Start dev environment
```

**Problem:** Port 3005 already in use

**Solution:**
```bash
# Run on different port
cd frontend
npm run dev -- -p 3006
```

**Problem:** `NEXT_PUBLIC_CONVEX_URL is not set`

**Solution:** Check `/frontend/.env.local`:
```env
NEXT_PUBLIC_CONVEX_URL=https://amiable-raccoon-559.convex.cloud
```

### Deployment Issues

**Problem:** Vercel build fails with JSON parsing error

**Solution:** Mac resource fork files. Clean and redeploy:
```bash
find . -name "._*" -delete
cd frontend && vercel --prod
```

**Problem:** `api.myFunction is undefined`

**Solution:** Types out of sync. Regenerate:
```bash
npx convex types
cp -r convex frontend/convex
```

**Problem:** Rate limit errors in prod

**Solution:** Check `/convex/rateLimits.ts` limits. Options:
- Increase limits for authenticated users
- Add user to allowlist
- Check for bot traffic (implement CAPTCHA)

### API Issues

**Problem:** Visionati returns 401 (Unauthorized)

**Solution:** Check `VISIONATI_API_KEY` in `.env`. Regenerate in dashboard if expired.

**Problem:** Straico timeout (>30s)

**Solution:** Convex actions have 30s timeout. Split into two actions or use background jobs.

---

## 11. MONITORING & OBSERVABILITY

### Logs

```bash
# Stream real-time
npx convex logs

# Filter by function
npx convex logs --filter "ai.*"

# Filter by error
npx convex logs --filter "ERROR"
```

### Metrics to Watch

1. **Function execution time:** Target <5s for most queries/mutations
2. **Database size:** Keep below 100MB for free tier
3. **API calls:** Visionati + Straico + Google should be <1000/day on free tier
4. **Error rate:** Aim for <1% failures
5. **User engagement:** Track daily active users, average prompts generated

### Dashboard Links

- **Convex Functions:** https://dashboard.convex.dev/deployment/functions
- **Vercel Deployments:** https://vercel.com/theo-vas-projects/frontend/deployments
- **Error tracking:** Check function logs for `ERROR` level

---

## 12. QUICK REFERENCE

### Common Commands

```bash
# Backend
npx convex auth              # Login to Convex
npx convex dev               # Start dev server
npx convex deploy            # Deploy to production
npx convex types             # Regenerate types
npx convex logs              # Stream logs
npx convex run seed:runAll   # Seed database

# Frontend
cd frontend && npm run dev    # Start Next.js (port 3005)
cd frontend && npm run build  # Build for production
cd frontend && vercel --prod  # Deploy to Vercel

# Testing
node test-rag.js             # Test vector search
node test-user-video.js      # Test video processing

# Cleanup
find . -name "._*" -delete   # Remove Mac resource forks
dot_clean .                  # Deep clean on macOS
```

### Directory Quick Lookup

| Need... | Look in... |
|---------|-----------|
| Database schema | `/convex/schema.ts` |
| AI pipeline | `/convex/ai.ts` |
| Prompt generation | `/convex/promptGenerator.ts` |
| UI components | `/frontend/src/components/` |
| Pages | `/frontend/src/app/` |
| Types | `/convex/_generated/api.d.ts` |
| Deployment config | `/frontend/vercel.json` |
| Environment vars | `/.env` |
| Docs | `/docs/` |

### Key URLs in Development

- **Frontend:** http://localhost:3005
- **Convex Dev Dashboard:** http://localhost:8000
- **Convex Cloud:** https://dashboard.convex.dev/
- **Vercel:** https://vercel.com/theo-vas-projects/frontend

---

## 13. NEXT STEPS FOR HANDOFF

### Critical Tasks Before Handing Off

1. **Test deployment flow:** Deploy to prod, verify OAuth works
2. **Document API keys:** Ensure all secrets are in Vercel + `.env`
3. **Set up monitoring:** Configure alerts for Convex/Vercel errors
4. **Write runbooks:** For common issues (deployment, rate limiting, API failures)
5. **Backup database:** Export Supabase data, keep backup of schema

### Recommended Reading Order

1. This document (HANDOVER.md)
2. `/docs/DEPLOYMENT_STATUS.md` (if deploying)
3. `/docs/PROMPT_SYSTEM.md` (if modifying AI pipeline)
4. Overview.md (high-level feature list)
5. Individual source files as needed

### Getting Help

- **Convex docs:** https://docs.convex.dev/
- **Next.js docs:** https://nextjs.org/docs
- **Convex Discord:** https://discord.gg/convex (active community)
- **Modal docs:** https://modal.com/docs
- **Vercel support:** https://vercel.com/support

---

**Created:** January 22, 2026
**Author:** Claude Code (AI Assistant)
**Status:** Ready for Handoff

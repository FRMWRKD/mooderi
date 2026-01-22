# Mooderi: AI-Powered Prompt Library for Visual Creatives

> **Browse by IMAGE → Take away the PROMPT**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOW MOODERI WORKS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────────┐   │
│   │  BROWSE  │ ───► │  SELECT  │ ───► │   COPY   │ ───► │  USE PROMPT  │   │
│   │  Images  │      │  Style   │      │  Prompt  │      │  in AI Tool  │   │
│   └──────────┘      └──────────┘      └──────────┘      └──────────────┘   │
│        │                 │                                     │           │
│        │           Categories:                           Works with:       │
│        │           • Cinematic                           • Midjourney      │
│        ▼           • Editorial                           • Flux            │
│   ┌──────────┐     • Fashion                             • SDXL            │
│   │  UPLOAD  │     • Portrait                            • Runway          │
│   │  Your    │     • Product                             • Leonardo        │
│   │  Images  │     • Lifestyle                                             │
│   └──────────┘     • Food                                                  │
│                    • Architecture                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            TECHNICAL STACK                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FRONTEND              BACKEND                 AI SERVICES                 │
│   ┌──────────┐          ┌──────────┐            ┌──────────┐               │
│   │ Next.js  │◄────────►│  Convex  │◄──────────►│ Visionati│ Image Analysis│
│   │   14     │ WebSocket│ Real-time│            └──────────┘               │
│   │ React 18 │          │ Database │            ┌──────────┐               │
│   │ Tailwind │          │ + Auth   │◄──────────►│ Straico  │ Prompt Gen    │
│   └──────────┘          └──────────┘            └──────────┘               │
│                                                 ┌──────────┐               │
│                                    ◄───────────►│  Modal   │ Video Process │
│                                                 └──────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

### What is Mooderi?

Mooderi serves as a bridge between visual inspiration and generative AI. Users:

1. **Browse** a curated library of cinematic images organized by mood, lighting, color, and genre
2. **Discover** AI-analyzed prompts that capture the visual essence of each image
3. **Copy** production-ready prompts optimized for text-to-image and text-to-video models
4. **Create** moodboards of reference imagery for client presentations or personal projects
5. **Generate** prompts from their own uploaded images or extracted video frames

### User Tiers

| Feature | Guest | Free User | Pro User |
|---------|-------|-----------|----------|
| Browse library | ✓ | ✓ | ✓ |
| View prompts (preview) | ✓ | ✓ | ✓ |
| Copy full prompt | ✗ | 1 credit | Unlimited |
| Save to boards | ✗ | ✓ | ✓ |
| Generate from image | Free* | 1 credit | Unlimited |
| Video analysis | ✗ | 1 credit/frame | Unlimited |

*Guests can generate prompts; they're added to community library*

### Monetization

- **100 free credits** on signup
- **1 credit = 1 prompt copy** (core monetization)
- **$0.05 per additional credit** after free tier exhausted
- Future revenue: affiliate links to AI generation services

---

## Tech Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **React 18** - UI component library
- **TailwindCSS 3.4** - Utility-first CSS
- **Radix UI** - Headless component primitives
- **Framer Motion** - Animation library
- **React Plock** - Masonry grid layout
- **Convex React SDK** - Real-time database integration

**Node.js:** 20.x
**Port:** 3005 (dev), 3000 (prod)

### Backend

- **Convex** - Real-time database + serverless functions
  - Replaces previous Flask backend
  - Handles auth, data persistence, API endpoints
  - Built-in integration with Polar (payments), Resend (email)
  - Components: Rate Limiter, Action Retrier, RAG, Agent

### AI & ML

- **Visionati** - Image analysis and feature extraction
- **Straico** - Multi-model LLM aggregator for prompt generation
- **Convex RAG** - Retrieval-Augmented Generation for semantic search
- **Convex Agent** - AI agents for intelligent prompt improvement

### Storage & CDN

- **Supabase Storage** - Image hosting (CDN delivery)
- **Convex Files** - Document storage for backups

### Video Processing

- **Modal Cloud** - Serverless compute for video frame extraction

### Authentication

- **Convex Auth** - Built-in authentication with OAuth support
- **Auth0 integration** - Social login (Google, GitHub, etc.)

---

## Quick Start

### Prerequisites

- Node.js 20.x
- npm 10.x or higher
- Convex account (free tier available)
- Supabase account (for storage)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd moodboard-convex

# Install dependencies
npm install
cd frontend && npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Services
VISIONATI_API_KEY=your-visionati-key
STRAICO_API_KEY=your-straico-key

# Modal (Video Processing)
MODAL_TOKEN_ID=your-modal-token
MODAL_TOKEN_SECRET=your-modal-secret

# Payments
POLAR_API_KEY=your-polar-key

# Email
RESEND_API_KEY=your-resend-key
```

### Running Locally

```bash
# Terminal 1: Start Convex dev server
npx convex dev

# Terminal 2: Start Next.js dev server
cd frontend
npm run dev
```

Visit `http://localhost:3005` in your browser.

### Build & Deploy

```bash
# Build frontend
cd frontend && npm run build

# Deploy to Convex (backend)
npx convex deploy

# Deploy to Vercel (frontend)
npm run build && vercel deploy
```

---

## Project Structure

```
mooderi/
├── convex/                    # BACKEND - Source of truth
│   ├── schema.ts              # Database schema (single source)
│   ├── ai.ts                  # AI pipeline (Visionati + Straico)
│   ├── promptGenerator.ts     # Main prompt generation
│   ├── rag.ts                 # Semantic search (vector embeddings)
│   ├── images.ts              # Image queries & mutations
│   ├── boards.ts              # Moodboard management
│   ├── users.ts               # User management
│   ├── videos.ts              # Video processing (Modal)
│   ├── payments.ts            # Credit system (Polar)
│   ├── auth.ts                # Authentication (OAuth)
│   └── _generated/            # Auto-generated types
│
├── frontend/                  # FRONTEND - Next.js 14
│   ├── src/
│   │   ├── app/               # Pages (App Router)
│   │   │   ├── page.tsx       # Home / browse library
│   │   │   ├── image/[id]/    # Image detail + prompt copy
│   │   │   ├── my-images/     # User uploads
│   │   │   ├── videos/        # Video processing
│   │   │   ├── search/        # Search results
│   │   │   ├── folder/[id]/   # Moodboard view
│   │   │   ├── tools/         # Prompt builder
│   │   │   └── pricing/       # Credits & pricing
│   │   └── components/
│   │       ├── features/      # Feature components
│   │       ├── ui/            # Base UI (shadcn-style)
│   │       └── layout/        # Layout components
│   ├── next.config.js         # Build config (handles Convex copy)
│   └── package.json
│
├── scripts/                   # UTILITIES - Active scripts only
│   ├── convex/                # Convex-related scripts
│   ├── tests/                 # Test scripts
│   └── utilities/             # Helper scripts
│
├── docs/                      # DOCUMENTATION
│   ├── architecture/          # System design docs
│   ├── guides/                # How-to guides
│   └── reference/             # API & package docs
│
├── .archive/                  # HIDDEN - Legacy code backup
│   ├── backend/               # Old Express.js (not used)
│   ├── flask_backend/         # Old Flask app (not used)
│   ├── supabase/              # Old Supabase SQL (not used)
│   └── scripts/               # Old Python scripts (not used)
│
├── README.md                  # START HERE
├── HANDOVER.md                # Developer testing guide
└── package.json               # Root dependencies
```

**Important:** The `.archive/` folder contains old code from previous iterations (Flask, Express, Supabase). It's hidden by default and not needed for development. The current production stack is **Convex + Next.js**.

---

## Key Features

### 1. **Image Library & Search**

- Browse curated collection of cinematic references
- Full-text search across image metadata
- Filter by mood, lighting, color palette, genre
- Visual similarity search using vector embeddings

### 2. **Prompt Generation & Copying**

- AI-generated prompts optimized for Midjourney, Flux, Runway
- One-click copy to clipboard
- Prompt quality rated and improved by RAG system
- Community-contributed prompts visible to all users

### 3. **Moodboards**

- Create personal boards for organizing images
- Drag-and-drop interface
- Share boards via public link
- Export as PDF or image grid

### 4. **Video-to-Prompts**

- Upload or paste YouTube/Vimeo URLs
- Automatic keyframe extraction
- Generate prompt for each scene
- Batch save to moodboard

### 5. **Image Upload & Analysis**

- Upload personal images
- Auto-generate prompts via Visionati + Straico
- Contribute to community library
- Track usage credits

### 6. **AI Chat Interface**

- Ask questions about images and styles
- Get prompt variations
- Refine prompts iteratively
- Multi-turn conversation history

### 7. **Credit System**

- Free credits on signup
- Usage tracking and analytics
- Payment processing via Polar
- Automatic billing for additional credits

### 8. **Prompt Style Categories**

Eight core prompt styles for consistency:

- **Cinematic** - Film-like production quality
- **Editorial** - Magazine / photography style
- **Fashion** - High fashion photography
- **Commercial** - Advertising / branded content
- **Conceptual** - Artistic / surreal
- **Documentary** - Realistic / journalistic
- **Experimental** - Abstract / cutting-edge
- ** 3D/VFX** - Digital / CGI aesthetics

---

## Architecture

### Data Flow

```
User Action
    ↓
Next.js Frontend (React)
    ↓
Convex Serverless Function
    ↓
External Services (Visionati, Straico, Modal)
    ↓
Convex Database (Real-time sync)
    ↓
Supabase Storage (Images)
    ↓
Frontend Re-renders (Real-time updates)
```

### Key Integrations

#### Visionati (Image Analysis)

```typescript
// Extract features from image
POST https://api.visionati.com/api/fetch
{
  "image": "url",
  "analysis": ["colors", "objects", "lighting", "mood"]
}
```

#### Straico (Prompt Generation)

```typescript
// Generate prompt from image analysis
POST https://api.straico.com/v1/prompt/generate
{
  "model": "claude-3-sonnet",
  "imageFeatures": { /* from Visionati */ },
  "styleCategory": "cinematic"
}
```

#### Modal (Video Processing)

```python
# Extract frames from video
@app.function()
def extract_frames(video_url: str):
    # Download video
    # Scene detection (keyframes)
    # Return frame URLs for analysis
```

#### Polar (Payments)

Integrated via Convex Polar component for credit purchases and subscriptions.

#### Resend (Email)

Transactional emails via Convex Resend component:
- Welcome emails
- Credit purchase receipts
- Weekly digests
- Notifications

### Database Schema

See `SCHEMA.md` for complete database design.

**Core tables:**
- `users` - User accounts & profile
- `images` - Library images
- `prompts` - Generated prompts
- `boards` - User moodboards
- `uploads` - User-uploaded images
- `credits` - User credits & usage
- `videos` - Video processing jobs

---

## Documentation

### Internal Docs

- **`HANDOVER.md`** - Developer handover guide (start here for testing)
- **`docs/architecture/OVERVIEW.md`** - System architecture
- **`docs/architecture/PROMPT_SYSTEM.md`** - AI prompt generation system
- **`docs/guides/DEPLOYMENT.md`** - Deployment checklist & troubleshooting
- **`docs/reference/PACKAGE_UPDATES.md`** - Package version history

### External Resources

- [Convex Documentation](https://docs.convex.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Visionati API Docs](https://docs.visionati.com)
- [Straico API Docs](https://docs.straico.com)

---

## Contributing

### Code Style

- **TypeScript** for type safety
- **ESLint** for consistency
- **Prettier** for formatting
- Components use TailwindCSS utility classes
- Test coverage required for backend functions

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -am "Description"`
3. Push to remote: `git push origin feature/your-feature`
4. Create a pull request with detailed description
5. Get code review before merging

### Running Tests

```bash
# Backend tests
npx convex test

# Frontend tests (if applicable)
cd frontend && npm test
```

### Reporting Issues

Use GitHub Issues with:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Environment info (OS, Node version, etc.)

---

## Troubleshooting

### Convex Connection Issues

```bash
# Check Convex status
npx convex status

# Re-authenticate
npx convex login

# Restart dev server
npx convex dev
```

### Build Errors

```bash
# Clear build cache
rm -rf .next/
cd frontend && npm run build
```

### Database Sync Issues

```bash
# Clear local state and re-sync
npx convex import
npx convex export > backup.zip
```

See `docs/DEPLOYMENT_STATUS.md` for detailed troubleshooting.

---

## License

[Add license information here]

---

## Support

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Email:** support@mooderi.com

---

## Roadmap

### Q1 2025

- [ ] Advanced prompt fine-tuning UI
- [ ] API endpoint for prompt generation
- [ ] Bulk export to CSV/JSON
- [ ] Integrations with Runway, Descript

### Q2 2025

- [ ] Mobile app (React Native)
- [ ] Community marketplace for prompts
- [ ] Prompt versioning & collaboration
- [ ] Advanced analytics dashboard

### Q3 2025

- [ ] Custom model training
- [ ] Multi-language support
- [ ] Team collaboration features
- [ ] Enterprise SLA options

---

## Contributors

- Project initiated: Jan 2025
- Architecture migration to Convex: Jan 2025

---

## Changelog

### Latest (Jan 22, 2025)

- Migrated from Flask to Convex backend
- Added Convex RAG for semantic search
- Integrated Convex Agent for prompt improvement
- Updated Next.js to 14.2
- Added Simple Prompt Builder feature

See git log for complete history.

---

**Made with ❤️ for visual creatives**

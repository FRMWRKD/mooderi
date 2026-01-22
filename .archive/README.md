# Archived Code

This directory contains **legacy code** that is no longer used in the current Convex-based architecture.

## Why Is This Here?

During development, Mooderi went through several iterations:
1. **Flask Backend** (Python) - Original prototype
2. **Express Backend** (Node.js) - Second iteration with Supabase
3. **Convex Backend** (TypeScript) - **Current production version**

This archived code is preserved for:
- Historical reference
- Potential code reuse
- Understanding previous architectural decisions

## Contents

| Directory | Description | Size |
|-----------|-------------|------|
| `backend/` | Express.js server with Supabase integration | ~1.3GB (includes node_modules) |
| `flask_backend/` | Original Python Flask application | ~4MB |
| `supabase/` | Supabase SQL functions and migrations | ~4MB |
| `scripts/` | Old Python processing scripts | ~1MB |

## Do Not Use

**These files are NOT compatible with the current Convex architecture.**

For the current codebase, see:
- `/convex/` - Backend functions (source of truth)
- `/frontend/` - Next.js application
- `/README.md` - Project overview

## Can I Delete This?

Yes, if you need to save space. The code is also backed up at:
- `~/mooderi-archive-backup/` (local backup)
- Git history (can be recovered from commits)

To delete: `rm -rf .archive/`

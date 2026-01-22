# Package Update Guide

## Current Status (2026-01-17)

Safe minor/patch updates available:

### High Priority (Patch Updates - Safe)
```bash
cd frontend
npm update convex@1.31.5              # 1.31.4 → 1.31.5 (patch fix)
npm update @supabase/supabase-js@2.90.1  # 2.89.0 → 2.90.1 (minor)
npm update @auth/core@0.37.4           # 0.37.0 → 0.37.4 (patch)
npm update @types/node@20.19.30        # 20.19.27 → 20.19.30 (patch)
```

### Medium Priority (May require testing)
- **lucide-react**: 0.358.0 → 0.562.0 (many new icons, breaking changes unlikely)
- **tailwind-merge**: 2.6.0 → 3.4.0 (major, TEST BEFORE UPDATING - may break utility merging)

### Low Priority (Major versions - extensive testing needed)
- **Next.js**: 14.2.0 → 16.1.3 (MAJOR - extensive breaking changes, skip for now)
- **React** & **react-dom**: 18.3.1 → 19.2.3 (MAJOR - requires careful migration)
- **framer-motion**: 11.18.2 → 12.26.2 (MAJOR - may break animations)
- **tailwindcss**: 3.4.19 → 4.1.18 (MAJOR - complete rewrite, DO NOT UPDATE yet)
- **@types/react**: 18.3.27 → 19.2.8 (depends on React upgrade)
- **@types/react-dom**: 18.3.7 → 19.2.3 (depends on React upgrade)

## Recommended Action

Run safe updates now:
```bash
cd frontend
npm update convex @supabase/supabase-js @auth/core @types/node lucide-react
```

## Notes
- **Tailwind v4**: Complete rewrite with breaking changes - wait for ecosystem stability
- **React 19**: Major changes to hooks, concurrent rendering - requires migration guide
- **Next.js 16**: Skip multiple major versions - upgrade incrementally (14 → 15 → 16)

Current package versions are stable and production-ready. No urgent updates required.

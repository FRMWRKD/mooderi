---
name: Convex Setup & Configuration
description: Initialize Convex projects, configure environments, and understand the project structure
---

# Convex Setup & Configuration

## Prerequisites

- Node.js 18+ (`node --version`)
- Git (`git -v`)
- npm or yarn

## Initialize New Project

### Option 1: Create New Project with Framework

```bash
# With Next.js
npm create convex@latest -- -t nextjs my-app

# With Vite + React
npm create convex@latest -- -t vite my-app

# With React Native
npm create convex@latest -- -t react-native my-app
```

### Option 2: Add to Existing Project

```bash
# Install Convex
npm install convex

# Initialize and link to Convex cloud
npx convex dev
```

During setup:
1. Sign in with GitHub
2. Create or select a project
3. Convex creates the `convex/` folder

## Project Configuration

### convex.json

```json
{
  "functions": "convex/"
}
```

### Environment Variables

```bash
# Create .env.local for development
CONVEX_DEPLOYMENT=dev:<your-deployment-name>

# For production (set in hosting platform)
CONVEX_URL=https://<your-deployment>.convex.cloud
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "npm-run-all --parallel dev:frontend dev:backend",
    "dev:frontend": "vite",
    "dev:backend": "convex dev",
    "build": "convex deploy && vite build"
  }
}
```

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `npx convex dev` | Start dev server, sync functions |
| `npx convex deploy` | Deploy to production |
| `npx convex deploy --prod` | Deploy with production flag |
| `npx convex dashboard` | Open web dashboard |
| `npx convex logs` | View server logs |
| `npx convex logs --success` | View successful function calls |
| `npx convex codegen` | Regenerate types |
| `npx convex import` | Import data from file |
| `npx convex export` | Export database to file |
| `npx convex env set KEY value` | Set environment variable |
| `npx convex env list` | List environment variables |

## Folder Structure Explained

```
convex/
├── _generated/           # AUTO-GENERATED - Don't edit!
│   ├── api.d.ts         # Type-safe API references
│   ├── api.js           # API module
│   ├── dataModel.d.ts   # Database types from schema
│   └── server.d.ts      # Server function types
├── schema.ts            # Database schema definition
├── auth.config.ts       # Authentication config (optional)
└── [your-functions].ts  # Your queries, mutations, actions
```

### File Naming Conventions

- **snake_case or camelCase** for function files: `tasks.ts`, `userProfiles.ts`
- **Exported function names** become the API: `export const list = query({...})`
- **API path**: `api.[filename].[functionName]` → `api.tasks.list`

## Setting Up the Client (React)

### 1. Create ConvexClientProvider

```tsx
// src/ConvexClientProvider.tsx
"use client"; // For Next.js App Router

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

### 2. Wrap Your App

```tsx
// Next.js: app/layout.tsx
import { ConvexClientProvider } from "./ConvexClientProvider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

```tsx
// Vite: src/main.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>
);
```

## Environment-Specific Deployments

### Development
```bash
npx convex dev  # Uses dev deployment
```

### Production
```bash
npx convex deploy --prod  # Deploys to production
```

### Multiple Environments

```bash
# Create separate deployments
npx convex deploy --project my-app-staging
npx convex deploy --project my-app-production --prod
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `convex dev` not syncing | Check terminal for errors, restart the command |
| Type errors after schema change | Run `npx convex codegen` |
| Functions not found | Ensure function is exported, file is in `convex/` |
| Auth not working | Verify JWT issuer URL matches dashboard config |

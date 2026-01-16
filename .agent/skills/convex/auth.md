---
name: Convex Authentication
description: Implement authentication with Clerk, Auth0, or the built-in Convex Auth library
---

# Convex Authentication

Convex supports multiple authentication options for securing your backend functions.

## Authentication Options

| Provider | Best For | Difficulty |
|----------|----------|------------|
| **Clerk** | Next.js, React Native, full-featured | Easy |
| **Auth0** | Enterprise, advanced features | Medium |
| **WorkOS** | B2B apps, free up to 1M users | Medium |
| **Convex Auth** | Quick setup, no external service | Easy (Beta) |

## Clerk Integration (Recommended)

### 1. Install Dependencies

```bash
npm install @clerk/clerk-react
```

### 2. Configure Clerk in Convex

Create `convex/auth.config.ts`:

```typescript
export default {
  providers: [
    {
      domain: "https://your-domain.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
```

### 3. Set Environment Variable

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-domain.clerk.accounts.dev
```

### 4. Wrap App with Providers

```tsx
// src/main.tsx or app/layout.tsx
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function App() {
  return (
    <ClerkProvider publishableKey="pk_test_...">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <YourApp />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### 5. Use Auth in Functions

```typescript
// convex/tasks.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    return await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => 
        q.eq("userId", identity.subject)
      )
      .collect();
  },
});
```

## Convex Auth (Beta - No External Service)

### 1. Install

```bash
npm install @convex-dev/auth
```

### 2. Setup Auth Tables

```typescript
// convex/schema.ts
import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // Your other tables
});
```

### 3. Configure Auth

```typescript
// convex/auth.ts
import { convexAuth } from "@convex-dev/auth/server";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [GitHub, Google],
});
```

### 4. Create Auth API

```typescript
// convex/auth.ts (continued)
import { query } from "./_generated/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
```

### 5. Frontend Usage

```tsx
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

function AuthButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  if (isLoading) return <div>Loading...</div>;
  
  if (isAuthenticated) {
    return <button onClick={() => signOut()}>Sign Out</button>;
  }
  
  return <button onClick={() => signIn("github")}>Sign In with GitHub</button>;
}
```

## Accessing User Identity

In any authenticated function:

```typescript
handler: async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  
  if (!identity) {
    // Not authenticated
    return null;
  }
  
  // Available fields depend on provider
  identity.subject       // Unique user ID (stable)
  identity.tokenIdentifier // Full token identifier
  identity.email         // Email (if provided)
  identity.name          // Name (if provided)
  identity.pictureUrl    // Avatar URL (if provided)
}
```

## Storing Users in Database

```typescript
// convex/users.ts
import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Check if user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
    
    if (user) return user._id;
    
    // Create new user
    return await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous",
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
  },
});
```

## Protected Routes (React)

```tsx
import { useConvexAuth } from "convex/react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <>{children}</>;
}
```

## Authorization Patterns

### Role-Based Access

```typescript
// convex/schema.ts
defineTable({
  tokenIdentifier: v.string(),
  role: v.union(v.literal("user"), v.literal("admin")),
})

// convex/admin.ts
export const adminOnly = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
    
    if (user?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }
    
    // Admin-only logic here
  },
});
```

### Resource-Based Access

```typescript
export const update = mutation({
  args: { taskId: v.id("tasks"), text: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    
    // Check ownership
    if (task.userId !== identity.subject) {
      throw new Error("Unauthorized: Not your task");
    }
    
    await ctx.db.patch(args.taskId, { text: args.text });
  },
});
```

## Best Practices

1. **Always validate authentication** in sensitive functions
2. **Store users in database** to add custom fields
3. **Use `tokenIdentifier`** for stable user lookup
4. **Implement authorization** at the function level
5. **Handle loading states** in frontend components

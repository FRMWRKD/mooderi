---
name: Convex Functions (Queries, Mutations, Actions)
description: Write backend functions for reading data, writing data, and calling external APIs
---

# Convex Functions

Convex has three types of functions, each with specific capabilities and use cases.

## Function Types Overview

| Type | Purpose | Database Access | External APIs | Transactional |
|------|---------|-----------------|---------------|---------------|
| **Query** | Read data | Read-only | ❌ No | ❌ No |
| **Mutation** | Write data | Read + Write | ❌ No | ✅ Yes |
| **Action** | External calls | Via mutations | ✅ Yes | ❌ No |

## Queries

Queries read data from the database. They are:
- **Cached** - Results are cached until underlying data changes
- **Subscribable** - Clients automatically get updates via WebSocket
- **Deterministic** - Must return same result for same inputs

### Basic Query

```typescript
// convex/tasks.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

### Query with Filtering

```typescript
export const getCompleted = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("completed"), true))
      .collect();
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
```

### Query with Ordering & Pagination

```typescript
export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .order("desc") // By _creationTime
      .take(args.limit ?? 10);
  },
});

// Cursor-based pagination
export const paginated = query({
  args: { 
    paginationOpts: v.object({
      cursor: v.optional(v.string()),
      numItems: v.number(),
    })
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .paginate(args.paginationOpts);
  },
});
```

## Mutations

Mutations write data to the database. They:
- Run as **transactions** (all-or-nothing)
- Can read AND write data
- Are NOT cached or subscribable

### Basic Mutation

```typescript
// convex/tasks.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { 
    text: v.string(),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ))
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      priority: args.priority ?? "medium",
      completed: false,
    });
    return taskId;
  },
});
```

### Update Operations

```typescript
// Patch - update specific fields
export const update = mutation({
  args: { 
    id: v.id("tasks"),
    text: v.optional(v.string()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Replace - overwrite entire document
export const replace = mutation({
  args: { 
    id: v.id("tasks"),
    text: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    await ctx.db.replace(id, data);
  },
});
```

### Delete Operations

```typescript
export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const removeCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const completed = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("completed"), true))
      .collect();
    
    for (const task of completed) {
      await ctx.db.delete(task._id);
    }
    
    return completed.length;
  },
});
```

## Actions

Actions can call external APIs and services. They:
- Can make HTTP requests
- Can call mutations/queries indirectly
- Are NOT transactional
- Run in Convex runtime or Node.js

### Basic Action

```typescript
// convex/ai.ts
import { action } from "./_generated/server";
import { v } from "convex/values";

export const generateSummary = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: `Summarize: ${args.text}` }],
      }),
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  },
});
```

### Action Calling Mutations

```typescript
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const processAndSave = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    // Call external API
    const processed = await externalProcess(args.text);
    
    // Save result via mutation
    await ctx.runMutation(api.results.save, { 
      content: processed 
    });
    
    return { success: true };
  },
});
```

### Node.js Runtime

Use `"use node"` directive for Node.js-specific APIs:

```typescript
// convex/files.ts
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

export const hashContent = action({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    return crypto.createHash("sha256").update(args.content).digest("hex");
  },
});
```

## Argument Validation

Use the `v` validator for type-safe arguments:

```typescript
import { v } from "convex/values";

// Primitive types
v.string()
v.number()
v.boolean()
v.null()
v.int64()
v.float64()
v.bytes()

// Complex types
v.id("tableName")           // Document ID
v.array(v.string())         // Array of strings
v.object({ key: v.string() }) // Object
v.optional(v.string())      // Optional string
v.union(v.string(), v.number()) // String or number
v.literal("value")          // Exact value
v.any()                     // Any type (avoid if possible)

// Example
export const create = mutation({
  args: {
    title: v.string(),
    tags: v.array(v.string()),
    metadata: v.optional(v.object({
      source: v.string(),
      priority: v.union(v.literal("low"), v.literal("high")),
    })),
  },
  handler: async (ctx, args) => { /* ... */ },
});
```

## Context Object (`ctx`)

The context provides access to:

```typescript
handler: async (ctx, args) => {
  // Database operations
  ctx.db.query("table")
  ctx.db.get(id)
  ctx.db.insert("table", data)
  ctx.db.patch(id, updates)
  ctx.db.replace(id, data)
  ctx.db.delete(id)
  
  // Authentication
  const identity = await ctx.auth.getUserIdentity();
  
  // Storage (file uploads)
  const url = await ctx.storage.getUrl(storageId);
  
  // Scheduling (in mutations)
  await ctx.scheduler.runAfter(0, api.tasks.process, { id });
  
  // Actions only: call other functions
  await ctx.runQuery(api.tasks.list);
  await ctx.runMutation(api.tasks.create, { text: "..." });
  await ctx.runAction(api.external.fetch);
}
```

## Error Handling

```typescript
import { ConvexError } from "convex/values";

export const update = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    
    if (!task) {
      throw new ConvexError("Task not found");
    }
    
    // Custom error data
    throw new ConvexError({ 
      code: "NOT_FOUND", 
      message: "Task not found",
      taskId: args.id 
    });
  },
});
```

## Best Practices

1. **Queries should be fast** - Keep them simple, use indexes
2. **Mutations are transactions** - Group related writes together
3. **Actions for external calls only** - Don't use for pure computation
4. **Validate all inputs** - Use `v` validators
5. **Handle undefined** - `useQuery()` returns `undefined` while loading

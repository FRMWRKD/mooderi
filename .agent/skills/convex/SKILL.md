---
name: Convex Development
description: Comprehensive guide for building applications with Convex - the TypeScript backend platform with real-time sync
---

# Convex Development Skill

Convex is a full-stack TypeScript backend platform that keeps your app in sync in real-time. It provides a document-relational database, serverless functions, and automatic client synchronization.

## Quick Reference

| Component | Purpose | File Location |
|-----------|---------|---------------|
| Queries | Read data (cached, subscribable) | `convex/*.ts` |
| Mutations | Write data (transactions) | `convex/*.ts` |
| Actions | External API calls | `convex/*.ts` |
| Schema | Type-safe database structure | `convex/schema.ts` |

## Sub-Skills

For detailed guidance, refer to these focused sub-skills:

1. **[Setup & Project Structure](./setup.md)** - Initialize projects, folder structure, CLI commands
2. **[Functions (Queries, Mutations, Actions)](./functions.md)** - Writing backend functions
3. **[Schema & Database](./schema.md)** - Define tables, validators, indexes
4. **[Authentication](./auth.md)** - Implement auth with Clerk, Auth0, or Convex Auth
5. **[Frontend Integration](./frontend.md)** - React hooks, client setup

## Core Concepts

### How Convex Works

```
┌─────────────────┐     WebSocket     ┌──────────────────┐
│   Frontend      │◄──────────────────►│   Convex Cloud   │
│   (React App)   │                    │                  │
│                 │   useQuery()       │  ┌────────────┐  │
│  - useQuery     │◄──────────────────►│  │  Queries   │  │
│  - useMutation  │                    │  └────────────┘  │
│  - useAction    │   useMutation()    │  ┌────────────┐  │
│                 │──────────────────►│  │ Mutations  │  │
└─────────────────┘                    │  └────────────┘  │
                                       │  ┌────────────┐  │
                                       │  │  Actions   │  │
                                       │  └────────────┘  │
                                       │  ┌────────────┐  │
                                       │  │  Database  │  │
                                       │  └────────────┘  │
                                       └──────────────────┘
```

### Sync Engine

The Convex sync engine automatically:
- Reruns query functions when data changes
- Pushes updates to all subscribed clients via WebSocket
- Handles cache invalidation automatically
- Guarantees consistency across all connected clients

## Project Structure

```
my-app/
├── convex/                    # Backend code
│   ├── _generated/            # Auto-generated (don't edit)
│   │   ├── api.d.ts
│   │   ├── api.js
│   │   ├── dataModel.d.ts
│   │   └── server.d.ts
│   ├── schema.ts              # Database schema
│   ├── functions.ts           # Your functions (queries, mutations)
│   └── auth.config.ts         # Auth configuration (if using auth)
├── src/
│   └── App.tsx                # Frontend with Convex hooks
├── package.json
└── convex.json                # Convex config
```

## Essential Commands

```bash
# Initialize Convex in existing project
npx convex dev

# Deploy to production
npx convex deploy

# Open dashboard
npx convex dashboard

# Generate types after schema changes
npx convex codegen

# View logs
npx convex logs
```

## Common Patterns

### Basic CRUD Operations

```typescript
// convex/tasks.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// CREATE
export const create = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", { 
      text: args.text, 
      completed: false 
    });
  },
});

// READ
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

// UPDATE
export const update = mutation({
  args: { id: v.id("tasks"), completed: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { completed: args.completed });
  },
});

// DELETE
export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
```

### Frontend Usage

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function TaskList() {
  const tasks = useQuery(api.tasks.list);
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const deleteTask = useMutation(api.tasks.remove);

  if (tasks === undefined) return <div>Loading...</div>;

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task._id}>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => updateTask({ id: task._id, completed: !task.completed })}
          />
          {task.text}
          <button onClick={() => deleteTask({ id: task._id })}>Delete</button>
        </li>
      ))}
      <button onClick={() => createTask({ text: "New Task" })}>Add Task</button>
    </ul>
  );
}
```

## Best Practices

1. **Keep queries lean** - Only return data you need
2. **Use mutations for writes** - They run as transactions
3. **Use actions for external APIs** - Never call external services from queries/mutations
4. **Define schemas** - Get type safety and validation
5. **Index frequently queried fields** - Improves query performance

## Resources

- [Convex Documentation](https://docs.convex.dev/)
- [Convex Dashboard](https://dashboard.convex.dev/)
- [Examples & Demos](https://github.com/get-convex/convex-demos)
- [Discord Community](https://convex.dev/community)

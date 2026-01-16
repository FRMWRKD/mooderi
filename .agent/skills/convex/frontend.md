---
name: Convex Frontend Integration
description: React hooks, client setup, and patterns for building real-time UIs with Convex
---

# Convex Frontend Integration

Convex provides React hooks that automatically sync your UI with backend data in real-time.

## Client Setup

### Vite / Create React App

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>
);
```

### Next.js (App Router)

```tsx
// app/ConvexClientProvider.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

// app/layout.tsx
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

## React Hooks

### useQuery - Read Data

```tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function TaskList() {
  // Automatically re-renders when data changes
  const tasks = useQuery(api.tasks.list);

  // Handle loading state
  if (tasks === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task._id}>{task.text}</li>
      ))}
    </ul>
  );
}
```

### useQuery with Arguments

```tsx
function UserTasks({ userId }: { userId: Id<"users"> }) {
  // Query with arguments
  const tasks = useQuery(api.tasks.getByUser, { userId });

  // Skip query conditionally
  const tasks = useQuery(
    userId ? api.tasks.getByUser : "skip",
    userId ? { userId } : "skip"
  );
  
  // ...
}
```

### useMutation - Write Data

```tsx
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function CreateTask() {
  const [text, setText] = useState("");
  const createTask = useMutation(api.tasks.create);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await createTask({ text });
    setText("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Add Task</button>
    </form>
  );
}
```

### useAction - External APIs

```tsx
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

function AIGenerator() {
  const generate = useAction(api.ai.generateSummary);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const summary = await generate({ text: "..." });
      setResult(summary);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate"}
      </button>
      {result && <p>{result}</p>}
    </div>
  );
}
```

## Pagination

### Basic Pagination

```tsx
import { usePaginatedQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function InfiniteList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.tasks.paginated,
    {},
    { initialNumItems: 10 }
  );

  return (
    <div>
      {results.map((task) => (
        <div key={task._id}>{task.text}</div>
      ))}
      
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(10)}>Load More</button>
      )}
      
      {status === "LoadingMore" && <div>Loading...</div>}
      
      {status === "Exhausted" && <div>No more items</div>}
    </div>
  );
}
```

## Optimistic Updates

```tsx
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function OptimisticTask({ task }) {
  const updateTask = useMutation(api.tasks.update).withOptimisticUpdate(
    (localStore, { id, completed }) => {
      const existingTask = localStore.getQuery(api.tasks.getById, { id });
      if (existingTask) {
        localStore.setQuery(api.tasks.getById, { id }, {
          ...existingTask,
          completed,
        });
      }
    }
  );

  return (
    <input
      type="checkbox"
      checked={task.completed}
      onChange={() => updateTask({ id: task._id, completed: !task.completed })}
    />
  );
}
```

## Authentication State

```tsx
import { useConvexAuth } from "convex/react";

function AuthStatus() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) return <div>Checking auth...</div>;
  if (!isAuthenticated) return <div>Please sign in</div>;
  return <div>You're signed in!</div>;
}
```

## Error Handling

```tsx
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";

function ErrorHandling() {
  const tasks = useQuery(api.tasks.list);
  const createTask = useMutation(api.tasks.create);

  const handleCreate = async () => {
    try {
      await createTask({ text: "New task" });
    } catch (error) {
      if (error instanceof ConvexError) {
        // Handle Convex-specific errors
        console.error("Convex error:", error.data);
      } else {
        // Handle network errors, etc.
        console.error("Error:", error);
      }
    }
  };

  // Query errors throw, so wrap in ErrorBoundary
  // or check for undefined (loading) state
}
```

## Common Patterns

### Loading States

```tsx
function TasksWithLoading() {
  const tasks = useQuery(api.tasks.list);

  if (tasks === undefined) {
    return <Skeleton />;  // Or spinner
  }

  if (tasks.length === 0) {
    return <EmptyState />;
  }

  return <TaskList tasks={tasks} />;
}
```

### Conditional Queries

```tsx
function ConditionalQuery({ userId }: { userId: string | null }) {
  // Skip query when userId is null
  const tasks = useQuery(
    userId !== null ? api.tasks.getByUser : "skip",
    userId !== null ? { userId } : "skip"
  );
}
```

### Combining Multiple Queries

```tsx
function Dashboard() {
  const tasks = useQuery(api.tasks.list);
  const users = useQuery(api.users.list);
  const stats = useQuery(api.stats.get);

  // All queries load in parallel
  const isLoading = tasks === undefined || 
                    users === undefined || 
                    stats === undefined;

  if (isLoading) return <Loading />;

  return (
    <div>
      <Stats data={stats} />
      <TaskList tasks={tasks} users={users} />
    </div>
  );
}
```

### Form with Mutation

```tsx
function TaskForm() {
  const [form, setForm] = useState({ text: "", priority: "medium" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTask = useMutation(api.tasks.create);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createTask(form);
      setForm({ text: "", priority: "medium" });
    } catch (error) {
      alert("Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.text}
        onChange={(e) => setForm({ ...form, text: e.target.value })}
        disabled={isSubmitting}
      />
      <select
        value={form.priority}
        onChange={(e) => setForm({ ...form, priority: e.target.value })}
        disabled={isSubmitting}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

## Type Safety

```tsx
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";

// Types are automatically inferred
const tasks = useQuery(api.tasks.list);
// tasks: Doc<"tasks">[] | undefined

// Explicit types when needed
function TaskItem({ task }: { task: Doc<"tasks"> }) {
  const updateTask = useMutation(api.tasks.update);
  
  // TypeScript enforces correct arguments
  updateTask({ id: task._id, completed: true });
}
```

## Best Practices

1. **Handle `undefined`** - queries return `undefined` while loading
2. **Use loading states** - show skeletons or spinners
3. **Handle errors** - wrap mutations in try-catch
4. **Use optimistic updates** - for better perceived performance
5. **Skip unnecessary queries** - use `"skip"` when conditions aren't met

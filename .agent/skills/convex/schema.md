---
name: Convex Schema & Database
description: Define database schemas, validators, indexes, and work with the document-relational database
---

# Convex Schema & Database

Convex uses a document-relational database with optional but recommended TypeScript schemas for validation and type safety.

## Schema Definition

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  }).index("by_email", ["email"]),

  tasks: defineTable({
    text: v.string(),
    completed: v.boolean(),
    userId: v.id("users"),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    dueDate: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_completed", ["userId", "completed"]),

  messages: defineTable({
    body: v.string(),
    author: v.id("users"),
    channel: v.string(),
  })
    .index("by_channel", ["channel"])
    .searchIndex("search_body", { searchField: "body" }),
});
```

## Validators Reference

```typescript
import { v } from "convex/values";

// Primitives
v.string()              // String
v.number()              // Number (float64)
v.boolean()             // Boolean
v.null()                // Null
v.int64()               // 64-bit integer
v.float64()             // 64-bit float
v.bytes()               // Binary data

// IDs
v.id("tableName")       // Document ID reference

// Arrays
v.array(v.string())     // Array of strings
v.array(v.id("users"))  // Array of user IDs

// Objects
v.object({
  name: v.string(),
  age: v.number(),
})

// Optional fields
v.optional(v.string())  // Field may be missing

// Unions
v.union(v.string(), v.number())  // String OR number

// Literals (exact values)
v.literal("active")
v.literal(42)
v.literal(true)

// Records (dynamic keys)
v.record(v.string(), v.number())  // { [key: string]: number }

// Any type (avoid if possible)
v.any()
```

## System Fields

Every document automatically has:

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `Id<"tableName">` | Unique document ID |
| `_creationTime` | `number` | Creation timestamp (ms since epoch) |

## Indexes

Indexes improve query performance for filtered queries.

### Single-Field Index

```typescript
defineTable({
  email: v.string(),
  name: v.string(),
}).index("by_email", ["email"])
```

```typescript
// Use in query
const user = await ctx.db
  .query("users")
  .withIndex("by_email", (q) => q.eq("email", "user@example.com"))
  .first();
```

### Compound Index

```typescript
defineTable({
  userId: v.id("users"),
  completed: v.boolean(),
  priority: v.string(),
}).index("by_user_and_status", ["userId", "completed", "priority"])
```

```typescript
// Query with compound index (must use fields left-to-right)
const tasks = await ctx.db
  .query("tasks")
  .withIndex("by_user_and_status", (q) => 
    q.eq("userId", userId).eq("completed", false)
  )
  .collect();
```

### Index Query Operators

```typescript
.withIndex("index_name", (q) =>
  q.eq("field", value)        // Equal
   .lt("field", value)        // Less than
   .lte("field", value)       // Less than or equal
   .gt("field", value)        // Greater than
   .gte("field", value)       // Greater than or equal
)
```

## Full-Text Search

```typescript
defineTable({
  title: v.string(),
  content: v.string(),
}).searchIndex("search_content", {
  searchField: "content",
  filterFields: ["title"],
})
```

```typescript
const results = await ctx.db
  .query("articles")
  .withSearchIndex("search_content", (q) =>
    q.search("content", "search terms").eq("title", "Guide")
  )
  .take(10);
```

## Database Operations

### Insert

```typescript
const id = await ctx.db.insert("tasks", {
  text: "Buy groceries",
  completed: false,
  userId: userId,
  priority: "medium",
});
```

### Get by ID

```typescript
const task = await ctx.db.get(taskId);
// Returns null if not found
```

### Query

```typescript
// All documents
const all = await ctx.db.query("tasks").collect();

// With filter
const filtered = await ctx.db
  .query("tasks")
  .filter((q) => q.eq(q.field("completed"), false))
  .collect();

// With index
const indexed = await ctx.db
  .query("tasks")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .collect();

// Ordered
const ordered = await ctx.db
  .query("tasks")
  .order("desc")  // By _creationTime
  .take(10);

// First match only
const first = await ctx.db
  .query("tasks")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .first();
```

### Update

```typescript
// Patch - update specific fields
await ctx.db.patch(taskId, { completed: true });

// Replace - overwrite entire document
await ctx.db.replace(taskId, {
  text: "Updated text",
  completed: true,
  userId: userId,
  priority: "high",
});
```

### Delete

```typescript
await ctx.db.delete(taskId);
```

## Relations

Convex uses document IDs for relations:

```typescript
// Schema with relations
export default defineSchema({
  users: defineTable({
    name: v.string(),
  }),
  
  posts: defineTable({
    title: v.string(),
    authorId: v.id("users"),  // Foreign key
  }).index("by_author", ["authorId"]),
  
  comments: defineTable({
    body: v.string(),
    postId: v.id("posts"),
    authorId: v.id("users"),
  }).index("by_post", ["postId"]),
});
```

```typescript
// Fetch related documents
export const getPostWithAuthor = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    
    const author = await ctx.db.get(post.authorId);
    return { ...post, author };
  },
});
```

## Type Helpers

```typescript
// Get document type from schema
import { Doc, Id } from "./_generated/dataModel";

type User = Doc<"users">;
type UserId = Id<"users">;

// In function handlers
handler: async (ctx, args): Promise<Doc<"tasks">[]> => {
  return await ctx.db.query("tasks").collect();
}
```

## Best Practices

1. **Always define schemas** - Get type safety and validation
2. **Index frequently filtered fields** - Queries without indexes are slow
3. **Use compound indexes wisely** - Order matters (left-to-right)
4. **Normalize data** - Use IDs for relations, not embedded duplicates
5. **Use `_creationTime`** - For default ordering, no custom index needed

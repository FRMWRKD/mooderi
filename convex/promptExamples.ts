import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Prompt Examples Module
 * 
 * Manages rated example prompts for each category.
 * These examples are used as RAG context to improve generation quality.
 * The system automatically prioritizes highest-rated examples.
 * 
 * Note: Actions (searchByEmbedding, generateEmbedding) are in promptExamplesActions.ts
 */

// ============================================
// QUERIES
// ============================================

/**
 * Get top-rated examples for a category (used in generation)
 */
export const getBestByCategory = query({
  args: {
    categoryKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 3;
    
    // Get examples sorted by rating (descending)
    const examples = await ctx.db
      .query("promptExamples")
      .withIndex("by_category_rating", (q) => q.eq("categoryKey", args.categoryKey))
      .order("desc")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(limit * 2); // Get extra to filter
    
    // Sort by rating (since Convex index sorts by second field)
    return examples
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  },
});

/**
 * List all examples for a category (admin view)
 */
export const listByCategory = query({
  args: { categoryKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("promptExamples")
      .withIndex("by_category", (q) => q.eq("categoryKey", args.categoryKey))
      .collect()
      .then(examples => examples.sort((a, b) => b.rating - a.rating));
  },
});

/**
 * Get example by ID
 */
export const getById = query({
  args: { id: v.id("promptExamples") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Add a new example (admin or from approved community submission)
 */
export const add = mutation({
  args: {
    categoryKey: v.string(),
    promptText: v.string(),
    imageId: v.optional(v.id("images")),
    imageUrl: v.optional(v.string()),
    source: v.union(
      v.literal("curated"),
      v.literal("community"),
      v.literal("generated")
    ),
    initialRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify category exists
    const category = await ctx.db
      .query("promptCategories")
      .withIndex("by_key", (q) => q.eq("key", args.categoryKey))
      .first();
    
    if (!category) {
      throw new Error(`Category "${args.categoryKey}" not found`);
    }

    return await ctx.db.insert("promptExamples", {
      categoryKey: args.categoryKey,
      promptText: args.promptText,
      imageId: args.imageId,
      imageUrl: args.imageUrl,
      source: args.source,
      rating: args.initialRating ?? (args.source === "curated" ? 80 : 50),
      ratingCount: args.source === "curated" ? 10 : 0, // Curated starts with weight
      isActive: true,
    });
  },
});

/**
 * Rate an example (user feedback)
 * Updates the running average rating
 */
export const rate = mutation({
  args: {
    id: v.id("promptExamples"),
    rating: v.number(), // 1-5 stars (converted to 0-100 internally)
  },
  handler: async (ctx, args) => {
    const example = await ctx.db.get(args.id);
    if (!example) throw new Error("Example not found");

    // Convert 1-5 to 0-100
    const normalizedRating = Math.max(0, Math.min(100, args.rating * 20));
    
    // Calculate new running average
    const newCount = example.ratingCount + 1;
    const newRating = (example.rating * example.ratingCount + normalizedRating) / newCount;

    await ctx.db.patch(args.id, {
      rating: Math.round(newRating * 10) / 10, // Round to 1 decimal
      ratingCount: newCount,
    });

    return { success: true, newRating: newRating };
  },
});

/**
 * Update example (admin)
 */
export const update = mutation({
  args: {
    id: v.id("promptExamples"),
    promptText: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    const cleanUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    
    await ctx.db.patch(id, cleanUpdates);
    return { success: true };
  },
});

/**
 * Delete example (admin)
 */
export const remove = mutation({
  args: { id: v.id("promptExamples") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Set embedding (internal, called from action)
 */
export const setEmbedding = mutation({
  args: {
    id: v.id("promptExamples"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { embedding: args.embedding });
  },
});

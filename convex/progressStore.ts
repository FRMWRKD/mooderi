import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Progress Store - Track generation progress for real-time UI updates
 * 
 * Steps:
 * 1. initializing - Starting generation
 * 2. embedding - Generating embedding vector
 * 3. searching - Finding similar images (shows count)
 * 4. analyzing - Analyzing image with Visionati (if image provided)
 * 5. generating - Calling Straico for prompt
 * 6. complete - Done!
 */

// Progress step type
export type ProgressStep = 
  | "initializing"
  | "embedding" 
  | "searching"
  | "analyzing"
  | "generating"
  | "complete"
  | "error";

// ============================================
// MUTATIONS
// ============================================

/**
 * Create or reset progress tracking for a client
 */
export const createProgress = internalMutation({
  args: {
    clientKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete any existing progress for this client
    const existing = await ctx.db
      .query("generationProgress")
      .withIndex("by_client", (q) => q.eq("clientKey", args.clientKey))
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Create new progress record
    const id = await ctx.db.insert("generationProgress", {
      clientKey: args.clientKey,
      step: "initializing",
      details: "Starting generation...",
      similarImagesFound: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Update progress step
 */
export const updateProgress = internalMutation({
  args: {
    clientKey: v.string(),
    step: v.string(),
    details: v.optional(v.string()),
    similarImagesFound: v.optional(v.number()),
    similarImages: v.optional(v.array(v.object({
      imageId: v.string(),
      imageUrl: v.string(),
      score: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("generationProgress")
      .withIndex("by_client", (q) => q.eq("clientKey", args.clientKey))
      .first();
    
    if (!progress) return;

    const updates: Record<string, any> = {
      step: args.step,
      updatedAt: Date.now(),
    };

    if (args.details !== undefined) updates.details = args.details;
    if (args.similarImagesFound !== undefined) updates.similarImagesFound = args.similarImagesFound;
    if (args.similarImages !== undefined) updates.similarImages = args.similarImages;

    await ctx.db.patch(progress._id, updates);
  },
});

/**
 * Clear progress after completion
 */
export const clearProgress = internalMutation({
  args: {
    clientKey: v.string(),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("generationProgress")
      .withIndex("by_client", (q) => q.eq("clientKey", args.clientKey))
      .first();
    
    if (progress) {
      await ctx.db.delete(progress._id);
    }
  },
});

// ============================================
// QUERIES
// ============================================

/**
 * Get current progress for a client
 */
export const getProgress = query({
  args: {
    clientKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationProgress")
      .withIndex("by_client", (q) => q.eq("clientKey", args.clientKey))
      .first();
  },
});

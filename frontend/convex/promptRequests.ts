import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Prompt Requests Module
 * 
 * Queries and mutations for the promptRequests table.
 * Separated from promptGenerator.ts which uses Node.js runtime.
 */

// ============================================
// MUTATION: Save Request
// ============================================
export const saveRequest = mutation({
  args: {
    inputText: v.optional(v.string()),
    inputImageUrl: v.optional(v.string()),
    generatedPrompt: v.string(),
    topMatchImageId: v.optional(v.id("images")),
    recommendationIds: v.optional(v.array(v.id("images"))),
    visionatiAnalysis: v.optional(v.object({
      short_description: v.optional(v.string()),
      mood: v.optional(v.string()),
      lighting: v.optional(v.string()),
      colors: v.optional(v.array(v.string())),
    })),
    userId: v.optional(v.id("users")),
    isPublic: v.boolean(),
    source: v.union(v.literal("landing"), v.literal("app")),
    clientKey: v.optional(v.string()),
    creditsUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("promptRequests", args);
  },
});

// ============================================
// QUERY: Get Public Requests (for landing page feed)
// ============================================
export const getPublicRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    const requests = await ctx.db
      .query("promptRequests")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(limit);

    // Fetch top match images for display
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        let topMatchImage = null;
        if (req.topMatchImageId) {
          topMatchImage = await ctx.db.get(req.topMatchImageId);
        }
        return {
          ...req,
          topMatchImage,
        };
      })
    );

    return enrichedRequests;
  },
});

// ============================================
// QUERY: Get User's Requests (for app history)
// ============================================
export const getUserRequests = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    const requests = await ctx.db
      .query("promptRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return requests;
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Prompt Feedback Module
 * 
 * Community feedback system for:
 * - Rating generated prompts (1-5 stars)
 * - Suggesting prompt improvements
 * - Submitting new example prompts
 * 
 * Admin workflow:
 * 1. User submits feedback
 * 2. Admin reviews (pending → approved/rejected)
 * 3. Approved suggestions can be integrated by AI improver
 */

// ============================================
// QUERIES
// ============================================

/**
 * List pending feedback (admin)
 */
export const listPending = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("promptFeedback")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(limit);
  },
});

/**
 * List feedback by category (admin)
 */
export const listByCategory = query({
  args: {
    categoryKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("promptFeedback")
      .withIndex("by_category", (q) => q.eq("categoryKey", args.categoryKey))
      .order("desc")
      .take(limit);
  },
});

/**
 * List user's own feedback
 */
export const listByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    return await ctx.db
      .query("promptFeedback")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get stats for feedback
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("promptFeedback").collect();
    
    return {
      total: all.length,
      pending: all.filter(f => f.status === "pending").length,
      approved: all.filter(f => f.status === "approved").length,
      rejected: all.filter(f => f.status === "rejected").length,
      integrated: all.filter(f => f.status === "integrated").length,
      byType: {
        rating: all.filter(f => f.type === "rating").length,
        suggestion: all.filter(f => f.type === "suggestion").length,
        example: all.filter(f => f.type === "example").length,
      },
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Submit feedback (user)
 */
export const submit = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("rating"),
      v.literal("suggestion"),
      v.literal("example")
    ),
    categoryKey: v.optional(v.string()),
    promptRequestId: v.optional(v.id("promptRequests")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("promptFeedback", {
      userId: args.userId,
      type: args.type,
      categoryKey: args.categoryKey,
      promptRequestId: args.promptRequestId,
      content: args.content,
      status: "pending",
    });
  },
});

/**
 * Rate a generated prompt (simplified submit)
 */
export const ratePrompt = mutation({
  args: {
    userId: v.id("users"),
    promptRequestId: v.id("promptRequests"),
    rating: v.number(), // 1-5 stars
    categoryKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Store as rating feedback
    return await ctx.db.insert("promptFeedback", {
      userId: args.userId,
      type: "rating",
      categoryKey: args.categoryKey,
      promptRequestId: args.promptRequestId,
      content: String(args.rating),
      status: "approved", // Ratings are auto-approved
    });
  },
});

/**
 * Approve feedback (admin)
 */
export const approve = mutation({
  args: {
    id: v.id("promptFeedback"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "approved",
      adminNotes: args.adminNotes,
    });
    return { success: true };
  },
});

/**
 * Reject feedback (admin)
 */
export const reject = mutation({
  args: {
    id: v.id("promptFeedback"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "rejected",
      adminNotes: args.adminNotes,
    });
    return { success: true };
  },
});

/**
 * Mark as integrated (after AI improver applies it)
 */
export const markIntegrated = mutation({
  args: {
    id: v.id("promptFeedback"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "integrated",
      adminNotes: args.adminNotes,
    });
    return { success: true };
  },
});

/**
 * Delete feedback (admin)
 */
export const remove = mutation({
  args: { id: v.id("promptFeedback") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

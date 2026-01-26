import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Prompt Improver Module
 * 
 * Version tracking and rollback for system prompts.
 * 
 * Note: AI-powered actions (analyzeCategory, applyImprovement) 
 * are in promptImproverActions.ts
 */

// ============================================
// QUERIES
// ============================================

/**
 * List version history for a system prompt
 */
export const getVersionHistory = query({
  args: { systemPromptId: v.id("systemPrompts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("promptVersions")
      .withIndex("by_prompt", (q) => q.eq("systemPromptId", args.systemPromptId))
      .order("desc")
      .collect();
  },
});

/**
 * Get a specific version
 */
export const getVersion = query({
  args: {
    systemPromptId: v.id("systemPrompts"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("promptVersions")
      .withIndex("by_prompt_version", (q) => 
        q.eq("systemPromptId", args.systemPromptId).eq("version", args.version)
      )
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Save a version snapshot before making changes
 */
export const saveVersion = mutation({
  args: {
    systemPromptId: v.id("systemPrompts"),
    changeReason: v.string(),
    changedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.systemPromptId);
    if (!prompt) throw new Error("System prompt not found");

    // Get current max version
    const versions = await ctx.db
      .query("promptVersions")
      .withIndex("by_prompt", (q) => q.eq("systemPromptId", args.systemPromptId))
      .collect();
    
    const maxVersion = versions.reduce((max, v) => Math.max(max, v.version), 0);

    return await ctx.db.insert("promptVersions", {
      systemPromptId: args.systemPromptId,
      version: maxVersion + 1,
      content: prompt.content,
      changeReason: args.changeReason,
      changedBy: args.changedBy ?? "admin",
    });
  },
});

/**
 * Rollback to a previous version
 */
export const rollbackToVersion = mutation({
  args: {
    systemPromptId: v.id("systemPrompts"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const versionDoc = await ctx.db
      .query("promptVersions")
      .withIndex("by_prompt_version", (q) =>
        q.eq("systemPromptId", args.systemPromptId).eq("version", args.version)
      )
      .first();

    if (!versionDoc) throw new Error("Version not found");

    // Save current state as new version before rollback
    const prompt = await ctx.db.get(args.systemPromptId);
    if (prompt) {
      const versions = await ctx.db
        .query("promptVersions")
        .withIndex("by_prompt", (q) => q.eq("systemPromptId", args.systemPromptId))
        .collect();
      const maxVersion = versions.reduce((max, v) => Math.max(max, v.version), 0);

      await ctx.db.insert("promptVersions", {
        systemPromptId: args.systemPromptId,
        version: maxVersion + 1,
        content: prompt.content,
        changeReason: `Rollback to version ${args.version}`,
        changedBy: "admin",
      });
    }

    // Apply rollback
    await ctx.db.patch(args.systemPromptId, {
      content: versionDoc.content,
      version: args.version,
    });

    return { success: true };
  },
});

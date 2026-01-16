import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * System Prompts Module
 * Stores AI prompt templates for Straico
 */

export const getByPromptId = query({
  args: { promptId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("systemPrompts")
      .withIndex("by_prompt_id", (q) => q.eq("promptId", args.promptId))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("systemPrompts").collect();
  },
});

export const create = mutation({
  args: {
    promptId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
    version: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("systemPrompts", {
      promptId: args.promptId,
      name: args.name,
      description: args.description,
      content: args.content,
      version: args.version ?? 1,
      isActive: args.isActive ?? true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("systemPrompts"),
    content: v.optional(v.string()),
    version: v.optional(v.number()),
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

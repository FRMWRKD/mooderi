"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Admin Seed Actions
 * 
 * Run these to populate initial data:
 * npx convex run seed:runAll
 */

export const runCategories = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; count?: number; ids?: string[]; message?: string }> => {
    const result = await ctx.runMutation(internal.promptCategories.seed, {});
    return result;
  },
});

export const runSystemPrompts = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; created?: number }> => {
    const result = await ctx.runMutation(internal.promptCategories.seedSystemPrompts, {});
    return result;
  },
});

export const runExamples = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; count?: number }> => {
    const result = await ctx.runMutation(internal.promptCategories.seedExamples, {});
    return result;
  },
});

export const runAll = action({
  args: {},
  handler: async (ctx): Promise<Record<string, any>> => {
    // Run all seeds in order
    const categories = await ctx.runMutation(internal.promptCategories.seed, {});
    const prompts = await ctx.runMutation(internal.promptCategories.seedSystemPrompts, {});
    const examples = await ctx.runMutation(internal.promptCategories.seedExamples, {});
    
    return {
      categories,
      prompts,
      examples,
    };
  },
});


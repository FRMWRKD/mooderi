import { action, internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { rateLimiter } from "./rateLimits";

/**
 * Prompt Agent Module
 * 
 * AI-powered assistant for generating prompts from images.
 * Uses the existing Visionati/Straico pipeline with a chat interface.
 * 
 * Features:
 * - Single image → detailed prompt
 * - Multi-image → combined/unified prompt
 * - Chat-based interaction with message history
 * - Credit-based usage tracking
 */

// NOTE: System prompts are loaded from the database (systemPrompts table)
// See: api.systemPrompts.getByPromptId with promptId "straico_v1"

// ============================================
// QUERIES
// ============================================

/**
 * Get chat history for a user
 */
export const getChatHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    
    // Return in chronological order
    return messages.reverse();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Save a chat message
 */
export const saveMessage = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageIds: v.optional(v.array(v.id("images"))),
    promptType: v.optional(v.string()),
    creditsUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentMessages", {
      userId: args.userId,
      role: args.role,
      content: args.content,
      imageIds: args.imageIds,
      promptType: args.promptType,
      creditsUsed: args.creditsUsed,
      createdAt: Date.now(),
    });
  },
});

/**
 * Clear chat history
 */
export const clearHistory = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    
    return { deleted: messages.length };
  },
});

// ============================================
// ACTIONS
// ============================================

/**
 * Generate a prompt from a single image
 * Cost: 1 credit (simple), 2 credits (detailed)
 */
export const generateImagePrompt = action({
  args: {
    userId: v.id("users"),
    imageId: v.id("images"),
    detailed: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; prompt?: string; structured_analysis?: any; generated_prompts?: any; cached: boolean; creditsUsed: number }> => {
    const credits = args.detailed ? 2 : 1;
    
    // Rate limiting
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "promptGeneration", {
      key: args.userId,
      throws: false,
    });
    
    if (!ok) {
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil((retryAfter || 60000) / 1000)} seconds.`);
    }
    
    // Check user has enough credits
    const user = await ctx.runQuery(api.users.getById, { id: args.userId });
    if (!user) throw new Error("User not found");
    if ((user.credits ?? 0) < credits && !user.isUnlimitedSubscriber) {
      throw new Error(`Insufficient credits. Need ${credits}, have ${user.credits ?? 0}`);
    }
    
    // Get image
    const image = await ctx.runQuery(api.images.getById, { id: args.imageId });
    if (!image) throw new Error("Image not found");
    
    // Check if image already has prompts
    if (image.generatedPrompts?.text_to_image) {
      // Use existing prompt
      const prompt = image.generatedPrompts.text_to_image;
      
      // Save to chat history
      await ctx.runMutation(internal.promptAgent.saveMessage, {
        userId: args.userId,
        role: "assistant",
        content: prompt,
        imageIds: [args.imageId],
        promptType: "single",
        creditsUsed: 0, // No credits for cached prompts
      });
      
      return {
        success: true,
        prompt,
        cached: true,
        creditsUsed: 0,
      };
    }
    
    // Generate new prompt using existing AI pipeline
    const result = await ctx.runAction(api.ai.analyzeImage, {
      imageId: args.imageId,
      imageUrl: image.imageUrl,
      userId: args.userId,
    });
    
    // Deduct credits
    if (!user.isUnlimitedSubscriber) {
      await ctx.runMutation(api.users.deductCredits, {
        userId: args.userId,
        amount: credits,
      });
    }
    
    // Save to chat history
    await ctx.runMutation(internal.promptAgent.saveMessage, {
      userId: args.userId,
      role: "assistant",
      content: result.prompt || "Unable to generate prompt",
      imageIds: [args.imageId],
      promptType: args.detailed ? "detailed" : "simple",
      creditsUsed: credits,
    });
    
    return {
      success: true,
      prompt: result.prompt,
      structured_analysis: result.structured_analysis,
      generated_prompts: result.generated_prompts,
      cached: false,
      creditsUsed: credits,
    };
  },
});

/**
 * Generate a combined prompt from multiple images
 * Cost: 0.5 credits per image
 */
export const generateMultiImagePrompt = action({
  args: {
    userId: v.id("users"),
    imageIds: v.array(v.id("images")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; prompt: string; individualPrompts: string[]; creditsUsed: number }> => {
    if (args.imageIds.length < 2) {
      throw new Error("Need at least 2 images for multi-image prompt");
    }
    if (args.imageIds.length > 5) {
      throw new Error("Maximum 5 images allowed");
    }
    
    const credits = Math.ceil(args.imageIds.length * 0.5);
    
    // Rate limiting
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "promptGeneration", {
      key: args.userId,
      throws: false,
    });
    
    if (!ok) {
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil((retryAfter || 60000) / 1000)} seconds.`);
    }
    
    // Check user has enough credits
    const user = await ctx.runQuery(api.users.getById, { id: args.userId });
    if (!user) throw new Error("User not found");
    if ((user.credits ?? 0) < credits && !user.isUnlimitedSubscriber) {
      throw new Error(`Insufficient credits. Need ${credits}, have ${user.credits ?? 0}`);
    }
    
    // Get all images
    const images = await Promise.all(
      args.imageIds.map(id => ctx.runQuery(api.images.getById, { id }))
    );
    
    // Collect existing prompts
    const existingPrompts: string[] = [];
    const needsAnalysis: Id<"images">[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image) continue;
      
      if (image.generatedPrompts?.text_to_image) {
        existingPrompts.push(image.generatedPrompts.text_to_image);
      } else {
        needsAnalysis.push(args.imageIds[i]);
      }
    }
    
    // Analyze images that don't have prompts
    for (const imageId of needsAnalysis) {
      const image = images.find((img: any) => img?._id === imageId);
      if (!image) continue;
      
      const result = await ctx.runAction(api.ai.analyzeImage, {
        imageId,
        imageUrl: image.imageUrl,
        userId: args.userId,
      });
      
      if (result.prompt) {
        existingPrompts.push(result.prompt);
      }
    }
    
    // Combine prompts into a unified description
    const combinedPrompt = `Based on ${args.imageIds.length} reference images, create an image with these elements:

${existingPrompts.map((p, i) => `Reference ${i + 1}: ${p}`).join("\n\n")}

Combined prompt suggestion:
- Blend the key visual elements from all references
- Maintain consistent lighting and color palette
- Create a cohesive mood that merges all aesthetics`;

    // Deduct credits
    if (!user.isUnlimitedSubscriber) {
      await ctx.runMutation(api.users.deductCredits, {
        userId: args.userId,
        amount: credits,
      });
    }
    
    // Save to chat history
    await ctx.runMutation(internal.promptAgent.saveMessage, {
      userId: args.userId,
      role: "assistant",
      content: combinedPrompt,
      imageIds: args.imageIds,
      promptType: "multi",
      creditsUsed: credits,
    });
    
    return {
      success: true,
      prompt: combinedPrompt,
      individualPrompts: existingPrompts,
      creditsUsed: credits,
    };
  },
});

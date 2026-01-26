import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Simple Prompt Builder Functions
 * 
 * Handles:
 * - Fetching preset options (shot types, lighting, cameras, etc.)
 * - Constructing prompts from selected options
 * - Saving generated images
 * - Community feed for public generations
 */

// ============================================
// PRESET CATEGORIES
// ============================================

export const PRESET_CATEGORIES = [
  "shot_type",
  "lighting", 
  "camera",
  "film_stock",
  "lens",
  "movie_look",
  "photographer",
  "filter",
  "aspect_ratio",
] as const;

export type PresetCategory = typeof PRESET_CATEGORIES[number];

// ============================================
// QUERIES
// ============================================

/**
 * Get all active presets grouped by category
 */
export const getAllPresets = query({
  args: {},
  handler: async (ctx) => {
    const presets = await ctx.db
      .query("builderPresets")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Group by category
    const grouped: Record<string, typeof presets> = {};
    for (const preset of presets) {
      if (!grouped[preset.category]) {
        grouped[preset.category] = [];
      }
      grouped[preset.category].push(preset);
    }
    
    // Sort each category by sortOrder
    for (const category of Object.keys(grouped)) {
      grouped[category].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    
    return grouped;
  },
});

/**
 * Get presets for a specific category
 */
export const getPresetsByCategory = query({
  args: {
    category: v.string(),
  },
  handler: async (ctx, { category }) => {
    const presets = await ctx.db
      .query("builderPresets")
      .withIndex("by_category_active", (q) => 
        q.eq("category", category).eq("isActive", true)
      )
      .collect();
    
    return presets.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/**
 * Get community feed of public generated images
 */
export const getCommunityGenerations = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("generatedImages")),
  },
  handler: async (ctx, { limit = 20, cursor }) => {
    let query = ctx.db
      .query("generatedImages")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc");
    
    if (cursor) {
      // Simple pagination - skip past cursor
      const cursorDoc = await ctx.db.get(cursor);
      if (cursorDoc) {
        query = query.filter((q) => 
          q.lt(q.field("_creationTime"), cursorDoc._creationTime)
        );
      }
    }
    
    const generations = await query.take(limit + 1);
    
    const hasMore = generations.length > limit;
    const items = generations.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]._id : null;
    
    return {
      items,
      nextCursor,
      hasMore,
    };
  },
});

/**
 * Get user's saved generations
 */
export const getUserGenerations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) return [];
    
    const generations = await ctx.db
      .query("generatedImages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    
    return generations;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Save a generation to the database
 */
export const saveGeneration = mutation({
  args: {
    prompt: v.string(),
    builderConfig: v.object({
      subject: v.optional(v.string()),
      environment: v.optional(v.string()),
      shotType: v.optional(v.string()),
      lighting: v.optional(v.string()),
      camera: v.optional(v.string()),
      filmStock: v.optional(v.string()),
      lens: v.optional(v.string()),
      movieLook: v.optional(v.string()),
      photographer: v.optional(v.string()),
      aspectRatio: v.optional(v.string()),
      filters: v.optional(v.array(v.string())),
      customModifiers: v.optional(v.string()),
    }),
    imageUrl: v.optional(v.string()),
    provider: v.optional(v.union(v.literal("google"), v.literal("fal"))),
    isPublic: v.boolean(),
    generationTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    let userId: Id<"users"> | undefined;
    let canSavePrivate = false;
    
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .first();
      
      if (user) {
        userId = user._id;
        // Check if user is subscriber (can save private)
        canSavePrivate = user.isUnlimitedSubscriber === true;
      }
    }
    
    // Force public if not subscriber
    const finalIsPublic = !canSavePrivate ? true : args.isPublic;
    
    const generationId = await ctx.db.insert("generatedImages", {
      userId,
      prompt: args.prompt,
      builderConfig: args.builderConfig,
      imageUrl: args.imageUrl,
      provider: args.provider,
      isPublic: finalIsPublic,
      isSaved: canSavePrivate && !args.isPublic,
      generationTime: args.generationTime,
    });
    
    return { 
      generationId, 
      isPublic: finalIsPublic,
      canSavePrivate,
    };
  },
});

/**
 * Toggle save status for a generation (subscribers only)
 */
export const toggleSaveGeneration = mutation({
  args: {
    generationId: v.id("generatedImages"),
  },
  handler: async (ctx, { generationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be logged in");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) throw new Error("User not found");
    if (!user.isUnlimitedSubscriber) throw new Error("Subscription required to save images");
    
    const generation = await ctx.db.get(generationId);
    if (!generation) throw new Error("Generation not found");
    if (generation.userId !== user._id) throw new Error("Not your generation");
    
    await ctx.db.patch(generationId, {
      isSaved: !generation.isSaved,
      isPublic: generation.isSaved ? true : false, // If unsaving, make public
    });
    
    return { saved: !generation.isSaved };
  },
});

// ============================================
// ADMIN MUTATIONS (for seeding)
// ============================================

/**
 * Add a preset (admin only)
 */
export const addPreset = mutation({
  args: {
    category: v.string(),
    key: v.string(),
    label: v.string(),
    promptFragment: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if preset with this key already exists
    const existing = await ctx.db
      .query("builderPresets")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    
    return await ctx.db.insert("builderPresets", args);
  },
});

/**
 * Bulk add presets
 */
export const bulkAddPresets = mutation({
  args: {
    presets: v.array(v.object({
      category: v.string(),
      key: v.string(),
      label: v.string(),
      promptFragment: v.string(),
      description: v.optional(v.string()),
      icon: v.optional(v.string()),
      sortOrder: v.number(),
      isActive: v.boolean(),
    })),
  },
  handler: async (ctx, { presets }) => {
    const results = [];
    for (const preset of presets) {
      const existing = await ctx.db
        .query("builderPresets")
        .withIndex("by_key", (q) => q.eq("key", preset.key))
        .first();
      
      if (existing) {
        await ctx.db.patch(existing._id, preset);
        results.push({ key: preset.key, action: "updated" });
      } else {
        await ctx.db.insert("builderPresets", preset);
        results.push({ key: preset.key, action: "created" });
      }
    }
    return results;
  },
});

// ============================================
// HELPER: Construct prompt from selections
// ============================================

/**
 * Build a prompt from selected options
 * This runs client-side for instant preview, but we expose it for reference
 */
export const constructPromptHelper = (config: {
  subject?: string;
  environment?: string;
  shotType?: string;
  lighting?: string;
  camera?: string;
  filmStock?: string;
  lens?: string;
  movieLook?: string;
  photographer?: string;
  aspectRatio?: string;
  filters?: string[];
  customModifiers?: string;
}): string => {
  const parts: string[] = [];
  
  // Subject and environment first
  if (config.subject) parts.push(config.subject);
  if (config.environment) parts.push(config.environment);
  
  // Shot type
  if (config.shotType) parts.push(config.shotType);
  
  // Lighting
  if (config.lighting) parts.push(config.lighting);
  
  // Camera and film
  if (config.camera) parts.push(`shot on ${config.camera}`);
  if (config.filmStock) parts.push(config.filmStock);
  if (config.lens) parts.push(config.lens);
  
  // Style references
  if (config.movieLook) parts.push(config.movieLook);
  if (config.photographer) parts.push(config.photographer);
  
  // Filters
  if (config.filters && config.filters.length > 0) {
    parts.push(...config.filters);
  }
  
  // Custom modifiers
  if (config.customModifiers) parts.push(config.customModifiers);
  
  // Aspect ratio at end
  if (config.aspectRatio) parts.push(config.aspectRatio);
  
  return parts.join(", ");
};

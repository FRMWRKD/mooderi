import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Prompt Categories Module
 * 
 * Manages predefined prompt categories like:
 * - YouTube Thumbnail (vibrant, clickbait-optimized)
 * - Realistic/Photorealistic (lifelike detail)
 * - Anime/Manga (Japanese animation style)
 * - Illustration (artistic, stylized)
 * - Cinematic (film-like, dramatic)
 * - Logo/Icon (brand, minimalist)
 * - Product Photography (commercial, clean)
 * - Abstract Art (creative, conceptual)
 */

// ============================================
// QUERIES
// ============================================

/**
 * List all active categories (for UI dropdowns)
 */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("promptCategories")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()
      .then(cats => cats.sort((a, b) => a.sortOrder - b.sortOrder));
  },
});

/**
 * List all categories (for admin)
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("promptCategories")
      .collect()
      .then(cats => cats.sort((a, b) => a.sortOrder - b.sortOrder));
  },
});

/**
 * Get category by key
 */
export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("promptCategories")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new category (admin only)
 */
export const create = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    description: v.string(),
    icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate key
    const existing = await ctx.db
      .query("promptCategories")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      throw new Error(`Category with key "${args.key}" already exists`);
    }

    // Get max sort order for positioning
    const allCats = await ctx.db.query("promptCategories").collect();
    const maxOrder = allCats.reduce((max, cat) => Math.max(max, cat.sortOrder), 0);

    return await ctx.db.insert("promptCategories", {
      key: args.key,
      name: args.name,
      description: args.description,
      icon: args.icon,
      sortOrder: args.sortOrder ?? maxOrder + 1,
      isActive: args.isActive ?? true,
    });
  },
});

/**
 * Update a category (admin only)
 */
export const update = mutation({
  args: {
    id: v.id("promptCategories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    systemPromptId: v.optional(v.id("systemPrompts")),
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
 * Delete a category (admin only)
 */
export const remove = mutation({
  args: { id: v.id("promptCategories") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ============================================
// SEED: Initial categories
// ============================================

/**
 * Seed initial categories (run once)
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("promptCategories").first();
    if (existing) {
      return { success: false, message: "Categories already seeded" };
    }

    const categories = [
      {
        key: "youtube_thumbnail",
        name: "YouTube Thumbnail",
        description: "Vibrant, eye-catching thumbnails optimized for clicks. Bold colors, expressive faces, dramatic compositions.",
        icon: "🎬",
        sortOrder: 1,
      },
      {
        key: "realistic",
        name: "Realistic / Photorealistic",
        description: "Lifelike images with incredible detail. Perfect for portraits, landscapes, and product visualization.",
        icon: "📷",
        sortOrder: 2,
      },
      {
        key: "anime",
        name: "Anime / Manga",
        description: "Japanese animation style with distinctive character designs, expressive eyes, and dynamic poses.",
        icon: "🎌",
        sortOrder: 3,
      },
      {
        key: "illustration",
        name: "Illustration / Digital Art",
        description: "Artistic, stylized illustrations. Book covers, concept art, fantasy scenes.",
        icon: "🎨",
        sortOrder: 4,
      },
      {
        key: "cinematic",
        name: "Cinematic / Film",
        description: "Film-like compositions with dramatic lighting, movie poster aesthetics, epic scenes.",
        icon: "🎥",
        sortOrder: 5,
      },
      {
        key: "logo",
        name: "Logo / Icon Design",
        description: "Clean, minimalist brand elements. Icons, logos, symbols with strong silhouettes.",
        icon: "✨",
        sortOrder: 6,
      },
      {
        key: "product",
        name: "Product Photography",
        description: "Commercial product shots with clean backgrounds, professional lighting, e-commerce ready.",
        icon: "🛍️",
        sortOrder: 7,
      },
      {
        key: "abstract",
        name: "Abstract Art",
        description: "Creative, conceptual imagery. Patterns, shapes, textures, experimental compositions.",
        icon: "🌀",
        sortOrder: 8,
      },
    ];

    const ids = [];
    for (const cat of categories) {
      const id = await ctx.db.insert("promptCategories", {
        ...cat,
        isActive: true,
      });
      ids.push(id);
    }

    return { success: true, count: ids.length, ids };
  },
});

/**
 * Seed initial category system prompts (run after seeding categories)
 */
export const seedSystemPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const prompts = [
      {
        promptId: "category_youtube_v1",
        name: "YouTube Thumbnail Generator",
        description: "Optimized for vibrant, click-worthy YouTube thumbnails",
        categoryKey: "youtube_thumbnail",
        content: `You are an expert at creating YouTube thumbnail prompts. Generate prompts that are:
- VIBRANT: Use bold, saturated colors that pop
- EXPRESSIVE: Include strong facial expressions or dramatic poses
- HIGH CONTRAST: Ensure text readability with contrasting backgrounds
- CLICKBAIT-OPTIMIZED: Create curiosity and urgency
- SIMPLE COMPOSITION: Clear focal point, not cluttered

Output format: A single, detailed prompt optimized for thumbnail generation.`,
      },
      {
        promptId: "category_realistic_v1",
        name: "Realistic/Photorealistic Generator",
        description: "For lifelike images with incredible detail",
        categoryKey: "realistic",
        content: `You are an expert at creating photorealistic image prompts. Generate prompts that:
- EMPHASIZE DETAIL: Skin pores, fabric texture, light reflections
- USE CAMERA TERMINOLOGY: 85mm lens, f/1.8, bokeh, golden hour
- SPECIFY LIGHTING: studio lighting, natural light, rim light
- INCLUDE REFERENCE STYLES: "in the style of Annie Leibovitz", "National Geographic quality"
- DESCRIBE ENVIRONMENT: Specific settings with atmospheric details

Output format: A detailed, technically-accurate prompt for photorealistic generation.`,
      },
      {
        promptId: "category_anime_v1",
        name: "Anime/Manga Generator",
        description: "Japanese animation style prompts",
        categoryKey: "anime",
        content: `You are an expert at creating anime/manga style prompts. Generate prompts that:
- USE ANIME TERMINOLOGY: "cel shaded", "studio Ghibli style", "shonen aesthetic"
- EMPHASIZE EYES: Large, expressive eyes with highlights
- DYNAMIC POSES: Action lines, dramatic angles
- SPECIFY SUBSTYLES: chibi, moe, seinen, shoujo
- INCLUDE EFFECTS: speed lines, sparkles, dramatic lighting

Output format: A detailed prompt optimized for anime/manga style generation.`,
      },
    ];

    const ids = [];
    for (const prompt of prompts) {
      // Check if already exists
      const existing = await ctx.db
        .query("systemPrompts")
        .withIndex("by_prompt_id", (q) => q.eq("promptId", prompt.promptId))
        .first();
      
      if (!existing) {
        const id = await ctx.db.insert("systemPrompts", {
          ...prompt,
          version: 1,
          isActive: true,
        });
        ids.push(id);
      }
    }

    return { success: true, created: ids.length };
  },
});

/**
 * Seed initial examples for each category
 */
export const seedExamples = internalMutation({
  args: {},
  handler: async (ctx) => {
    const examples = [
      // YouTube Thumbnail Examples
      {
        categoryKey: "youtube_thumbnail",
        promptText: "Shocked YouTuber with mouth wide open, neon pink and electric blue gradient background, giant 3D text saying 'OMG' floating behind, dramatic rim lighting, hyperrealistic portrait style, 4K, trending on YouTube",
        source: "curated" as const,
        rating: 95,
      },
      {
        categoryKey: "youtube_thumbnail",
        promptText: "Split composition, left side showing before (sad face, gray), right side showing after (excited, golden), red arrow pointing right, explosive particle effects, YouTube thumbnail style, attention-grabbing",
        source: "curated" as const,
        rating: 90,
      },
      // Realistic Examples
      {
        categoryKey: "realistic",
        promptText: "Portrait of elderly fisherman, weathered face with deep wrinkles telling stories of the sea, piercing blue eyes, morning golden hour light, shallow depth of field, shot on Hasselblad, 85mm f/1.4, National Geographic quality",
        source: "curated" as const,
        rating: 92,
      },
      {
        categoryKey: "realistic",
        promptText: "Hyperrealistic macro photograph of morning dew on spider web, each droplet reflecting the sunrise, bokeh background of purple lavender field, professional nature photography, 8K resolution",
        source: "curated" as const,
        rating: 88,
      },
      // Anime Examples
      {
        categoryKey: "anime",
        promptText: "Anime girl with long flowing silver hair, cherry blossoms falling, soft pink and white color palette, Studio Ghibli inspired, gentle smile, school uniform, watercolor background, dreamy atmosphere",
        source: "curated" as const,
        rating: 93,
      },
      {
        categoryKey: "anime",
        promptText: "Epic shonen battle scene, two warriors clashing mid-air, energy auras surrounding them, speed lines, dramatic low angle, intense expressions, vibrant color explosions, dynamic composition",
        source: "curated" as const,
        rating: 91,
      },
      // Cinematic Examples
      {
        categoryKey: "cinematic",
        promptText: "Lone figure standing on cliff edge overlooking dystopian city at sunset, volumetric god rays, teal and orange color grading, anamorphic lens flare, Blade Runner 2049 aesthetic, 21:9 aspect ratio",
        source: "curated" as const,
        rating: 94,
      },
      // Illustration Examples
      {
        categoryKey: "illustration",
        promptText: "Fantasy book cover illustration, ancient dragon coiled around a crystal tower, magical runes glowing, epic fantasy art style, rich detail, dramatic lighting, by artist Greg Rutkowski",
        source: "curated" as const,
        rating: 89,
      },
    ];

    const ids = [];
    for (const example of examples) {
      const id = await ctx.db.insert("promptExamples", {
        ...example,
        ratingCount: 10, // Pre-seeded with some weight
        isActive: true,
      });
      ids.push(id);
    }

    return { success: true, count: ids.length };
  },
});

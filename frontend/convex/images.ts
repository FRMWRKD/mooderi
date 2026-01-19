import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

/**
 * Images Module
 * Migrated from backend/server.js
 * 
 * Handles:
 * - Listing and filtering images
 * - Text and semantic search
 * - CRUD operations
 * - Visibility management
 */

// ============================================
// QUERIES - Read operations
// ============================================

/**
 * List public images with pagination
 * Migrated from: GET /api/images
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    
    const images = await ctx.db
      .query("images")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(limit + 1);
    
    const hasMore = images.length > limit;
    const results = hasMore ? images.slice(0, limit) : images;
    
    return {
      images: results,
      hasMore,
      nextCursor: hasMore ? results[results.length - 1]._id : null,
    };
  },
});

/**
 * Get a single image by ID
 * Migrated from: GET /api/images/:id
 */
export const getById = query({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Filter images by mood, lighting, tags, etc.
 * Migrated from: GET /api/images/filter
 */
export const filter = query({
  args: {
    mood: v.optional(v.array(v.string())),
    lighting: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    sourceType: v.optional(v.string()),
    sort: v.optional(v.string()),
    limit: v.optional(v.number()),
    onlyPublic: v.optional(v.boolean()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    
    // Fetch images based on filter type
    let allImages: Doc<"images">[];
    
    if (args.userId && args.onlyPublic === false) {
      // User's own images
      allImages = await ctx.db
        .query("images")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(500);
    } else {
      // Public images (default)
      allImages = await ctx.db
        .query("images")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .order("desc")
        .take(500);
    }
    
    let filtered = allImages;
    
    // Apply filters
    if (args.mood && args.mood.length > 0) {
      filtered = filtered.filter(img => 
        img.mood && args.mood!.includes(img.mood)
      );
    }
    
    if (args.lighting && args.lighting.length > 0) {
      filtered = filtered.filter(img => 
        img.lighting && args.lighting!.includes(img.lighting)
      );
    }
    
    if (args.tags && args.tags.length > 0) {
      filtered = filtered.filter(img =>
        img.tags && args.tags!.some(tag => img.tags!.includes(tag))
      );
    }
    
    if (args.sourceType === "video_import") {
      filtered = filtered.filter(img => img.sourceVideoUrl != null);
    }
    
    // Apply sorting
    if (args.sort === "ranked" || args.sort === "rating") {
      filtered = filtered.sort((a, b) => 
        (b.aestheticScore ?? 0) - (a.aestheticScore ?? 0)
      );
    }
    
    return {
      images: filtered.slice(0, limit),
      count: filtered.length,
      hasMore: filtered.length > limit,
    };
  },
});

/**
 * Get filter options (unique moods, lighting, tags)
 * Migrated from: GET /api/filter-options
 */
export const getFilterOptions = query({
  args: {},
  handler: async (ctx) => {
    const images = await ctx.db
      .query("images")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .take(1000);
    
    // Extract unique values
    const moodSet = new Set(images.map(i => i.mood).filter((m): m is string => Boolean(m)));
    const moods = Array.from(moodSet).sort();
    
    const lightingSet = new Set(images.map(i => i.lighting).filter((l): l is string => Boolean(l)));
    const lighting = Array.from(lightingSet).sort();
    
    const allTags = images.flatMap(i => i.tags ?? []);
    const tagSet = new Set(allTags);
    const tags = Array.from(tagSet).sort();
    
    return {
      moods,
      lighting,
      tags,
      colors: [], // Not used currently
      camera_shots: [], // Not used currently
      total_images: images.length,
    };
  },
});

/**
 * Text search in prompts
 * Migrated from: GET /api/search (text mode)
 */
export const textSearch = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    
    if (!args.query.trim()) {
      return { images: [], count: 0 };
    }
    
    const results = await ctx.db
      .query("images")
      .withSearchIndex("search_prompt", (q) =>
        q.search("prompt", args.query).eq("isPublic", true)
      )
      .take(limit);
    
    return {
      images: results,
      count: results.length,
      type: "text",
    };
  },
});

/**
 * Semantic search using vector embeddings
 * Migrated from: GET /api/search (semantic mode)
 * Note: Actual vector search requires using ctx.vectorSearch - this is a fallback
 */
export const semanticSearch = query({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    
    // Note: For true vector search, use an action with ctx.vectorSearch
    // This query returns public images with embeddings as a fallback
    const results = await ctx.db
      .query("images")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .filter((q) => q.neq(q.field("embedding"), undefined))
      .take(limit);
    
    return {
      images: results,
      count: results.length,
      type: "semantic",
    };
  },
});

/**
 * Get similar images by embedding
 * Migrated from: search_similar_images RPC
 */
export const getSimilar = query({
  args: {
    imageId: v.id("images"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image || !image.embedding) {
      return { images: [], count: 0 };
    }
    
    // Get similar using vector search
    const limit = args.limit ?? 10;
    
    // For now, return images with similar mood/lighting as fallback
    const results = await ctx.db
      .query("images")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .filter((q) => 
        q.and(
          q.neq(q.field("_id"), args.imageId),
          q.or(
            q.eq(q.field("mood"), image.mood),
            q.eq(q.field("lighting"), image.lighting)
          )
        )
      )
      .take(limit);
    
    return {
      images: results,
      count: results.length,
    };
  },
});

/**
 * Get ranked images for homepage
 * Migrated from: get_ranked_images RPC
 */
export const getRanked = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    
    // Get curated images first, then by aesthetic score
    const images = await ctx.db
      .query("images")
      .withIndex("by_curated_score")
      .order("desc")
      .filter((q) => q.eq(q.field("isPublic"), true))
      .take(limit + (args.offset ?? 0));
    
    const results = images.slice(args.offset ?? 0);
    
    // Calculate ranking scores
    const ranked = results.map(img => ({
      ...img,
      rankingScore: 
        (img.aestheticScore ?? 0) * 2 +
        (img.likes ?? 0) - (img.dislikes ?? 0) +
        (img.isCurated ? 5 : 0) +
        (img.embedding ? 2 : 0) +
        (img.sourceType === "video_import" ? 1 : 0),
    }));
    
    return {
      images: ranked.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, limit),
      count: ranked.length,
    };
  },
});

// ============================================
// MUTATIONS - Write operations
// ============================================

/**
 * Create a new image
 * Migrated from: POST /api/images/analyze (partial)
 */
export const create = mutation({
  args: {
    imageUrl: v.optional(v.string()), // Optional if storageId provided
    storageId: v.optional(v.id("_storage")),
    thumbnailUrl: v.optional(v.string()), // Optional thumbnail URL
    prompt: v.optional(v.string()),
    mood: v.optional(v.string()),
    lighting: v.optional(v.string()),
    colors: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
    sourceType: v.optional(v.string()),
    sourceVideoUrl: v.optional(v.string()),
    videoId: v.optional(v.id("videos")),
    frameNumber: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    signature: v.optional(v.string()), // SHA-256 or perceptual hash for deduplication - implement in frontend
  },
  handler: async (ctx, args) => {
    // Validate that we have either an image URL or a storage ID
    if (!args.imageUrl && !args.storageId) {
      throw new Error("Must provide either imageUrl or storageId");
    }
    // Signature-based deduplication (frontend should generate & pass hash on upload)
    if (args.signature) {
      const existing = await ctx.db
        .query("images")
        .withIndex("by_signature", (q) => q.eq("signature", args.signature))
        .first();
      
      if (existing) {
        return existing._id;
      }
    }

    let finalImageUrl = args.imageUrl;
    let finalStorageId = args.storageId;

    // If storageId is provided, generate the public URL
    if (args.storageId) {
      finalImageUrl = (await ctx.storage.getUrl(args.storageId)) ?? "";
      finalStorageId = args.storageId;
    }

    return await ctx.db.insert("images", {
      imageUrl: finalImageUrl || "",
      storageId: finalStorageId,
      thumbnailUrl: args.thumbnailUrl,
      prompt: args.prompt,
      mood: args.mood,
      lighting: args.lighting,
      colors: args.colors,
      tags: args.tags,
      isPublic: args.isPublic ?? true,
      sourceType: args.sourceType as "upload" | "video_import" | "url_import" | undefined,
      sourceVideoUrl: args.sourceVideoUrl,
      videoId: args.videoId,
      frameNumber: args.frameNumber,
      userId: args.userId,
      status: "pending",
      likes: 0,
      dislikes: 0,
      isCurated: false,
      signature: args.signature,
    });
  },
});

/**
 * Generate a short-lived upload URL for Convex Storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update image fields (after AI analysis)
 */
export const update = mutation({
  args: {
    id: v.id("images"),
    prompt: v.optional(v.string()),
    generatedPrompts: v.optional(v.any()),
    mood: v.optional(v.string()),
    lighting: v.optional(v.string()),
    cameraShot: v.optional(v.string()),
    colors: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.float64())),
    aestheticScore: v.optional(v.float64()),
    detectedCategory: v.optional(v.string()),
    status: v.optional(v.string()),
    isAnalyzed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // Filter out undefined values
    const cleanUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    
    await ctx.db.patch(id, cleanUpdates);
    return { success: true, id };
  },
});

/**
 * Update image visibility
 * Migrated from: update_image_visibility RPC
 */
export const updateVisibility = mutation({
  args: {
    id: v.id("images"),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isPublic: args.isPublic });
    return { success: true, id: args.id, isPublic: args.isPublic };
  },
});

/**
 * Bulk update visibility
 * Migrated from: bulk_update_visibility RPC
 */
export const bulkUpdateVisibility = mutation({
  args: {
    ids: v.array(v.id("images")),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, { isPublic: args.isPublic });
    }
    return { success: true, updatedCount: args.ids.length };
  },
});

/**
 * Like or dislike an image
 * Migrated from: POST /api/images/:id/like, /dislike
 */
export const vote = mutation({
  args: {
    imageId: v.id("images"),
    voteType: v.union(v.literal("like"), v.literal("dislike")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to vote");
    }

    try {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();

      if (!user) throw new Error("User not found");

      const image = await ctx.db.get(args.imageId);
      if (!image) throw new Error("Image not found");

      // Check if user already voted
      const existingVote = await ctx.db
        .query("userActions")
        .withIndex("by_user_and_image", (q) => q.eq("userId", user._id).eq("imageId", args.imageId))
        .filter((q) => q.or(
          q.eq(q.field("actionType"), "like"),
          q.eq(q.field("actionType"), "dislike")
        ))
        .first();

      if (existingVote) {
        // If same vote type, remove it (toggle off)
        if (existingVote.actionType === args.voteType) {
          await ctx.db.delete(existingVote._id);
          
          // Decrement count
          if (args.voteType === "like") {
            await ctx.db.patch(args.imageId, { likes: Math.max(0, (image.likes || 0) - 1) });
          } else {
            await ctx.db.patch(args.imageId, { dislikes: Math.max(0, (image.dislikes || 0) - 1) });
          }
          
          return { success: true, removed: true };
        }
        
        // If different vote type, swap it
        await ctx.db.patch(existingVote._id, { actionType: args.voteType });
        
        const updates: any = {};
        if (args.voteType === "like") {
          updates.likes = (image.likes || 0) + 1;
          updates.dislikes = Math.max(0, (image.dislikes || 0) - 1);
        } else {
          updates.likes = Math.max(0, (image.likes || 0) - 1);
          updates.dislikes = (image.dislikes || 0) + 1;
        }
        await ctx.db.patch(args.imageId, updates);
        
        return { success: true, swapped: true };
      }

      // New vote
      await ctx.db.insert("userActions", {
        userId: user._id,
        imageId: args.imageId,
        actionType: args.voteType,
      });
      
      // Increment count
      if (args.voteType === "like") {
        await ctx.db.patch(args.imageId, { likes: (image.likes || 0) + 1 });
      } else {
        await ctx.db.patch(args.imageId, { dislikes: (image.dislikes || 0) + 1 });
      }
      
      return { success: true, added: true };
    } catch (error: any) {
      console.error("Vote operation failed:", error);
      throw new Error(`Failed to process vote: ${error.message}`);
    }
  },
});

/**
 * Delete an image
 */
export const remove = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    // Also remove from any boards
    const boardImages = await ctx.db
      .query("boardImages")
      .withIndex("by_image", (q) => q.eq("imageId", args.id))
      .collect();
    
    for (const bi of boardImages) {
      await ctx.db.delete(bi._id);
    }
    
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// ============================================
// AI / VECTOR SEARCH ACTIONS
// ============================================

/**
 * Search for images using text (Semantic Search)
 * Generates embedding for query and searches vector index
 */
export const searchByText = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"images">[]> => {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      throw new Error("Missing GOOGLE_API_KEY");
    }

    // 1. Generate embedding for query
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: args.query.substring(0, 2000) }] },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding) {
      return [];
    }

    // 2. Vector search
    const limit = args.limit ?? 20;
    const results = await ctx.vectorSearch("images", "by_embedding", {
      vector: embedding,
      limit: limit,
      filter: (q) => q.eq("isPublic", true),
    });

    // 3. Fetch full documents
    const images = await Promise.all(
      results.map((r) => ctx.runQuery(api.images.getById, { id: r._id }))
    );

    return images.filter((img: Doc<"images"> | null): img is Doc<"images"> => !!img);
  },
});

/**
 * Find similar images using vector embedding
 * Uses the embedding of the source image to find others
 */
export const searchSimilar = action({
  args: {
    imageId: v.id("images"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ images: Doc<"images">[]; count: number }> => {
    // 1. Get source image to retrieve its embedding
    const sourceImage = await ctx.runQuery(api.images.getById, { id: args.imageId });
    
    if (!sourceImage || !sourceImage.embedding) {
      // Fallback: use getSimilar query (metadata match) if no embedding
      // But we can't call query from action easily if it returns different shape
      return { images: [], count: 0 };
    }

    // 2. Vector search using source image embedding
    const limit = args.limit ?? 10;
    const results = await ctx.vectorSearch("images", "by_embedding", {
      vector: sourceImage.embedding,
      limit: limit + 1, // Fetch extra finding source image
      filter: (q) => q.eq("isPublic", true),
    });

    // 3. Fetch full documents and filter out source image
    const images = await Promise.all(
      results
        .filter((r) => r._id !== args.imageId)
        .slice(0, limit)
        .map((r) => ctx.runQuery(api.images.getById, { id: r._id }))
    );

    return {
      images: images.filter((img: Doc<"images"> | null): img is Doc<"images"> => !!img),
      count: images.length
    };
  },
});

"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { components, api, internal } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { rateLimiter } from "./rateLimits";

/**
 * RAG Module - Semantic Search for Prompts
 * 
 * Uses the @convex-dev/rag component for:
 * - Indexing image prompts as searchable entries
 * - Semantic search across all prompts
 * - "Similar Prompts" feature for finding related content
 * 
 * This complements the existing vector search on images,
 * which is used for image-to-image similarity.
 */

// Initialize RAG with Google embedding model
// Note: We use the same embedding model as the image embeddings for consistency
const rag = new RAG(components.rag, {
  // Custom embedding using Google's text-embedding API
  // The RAG component will call this for each chunk
  textEmbeddingModel: {
    // Using a custom embedding implementation via Google API
    // v2 specification for AI SDK 5 compatibility
    specificationVersion: "v2" as const,
    provider: "google",
    modelId: "text-embedding-004",
    maxEmbeddingsPerCall: 100,
    supportsParallelCalls: true,
    doEmbed: async ({ values }: { values: string[] }) => {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) throw new Error("Missing GOOGLE_API_KEY");

      const embeddings = await Promise.all(
        values.map(async (text: string) => {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text }] },
                taskType: "RETRIEVAL_DOCUMENT",
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Embedding API error: ${response.status}`);
          }

          const data = await response.json();
          return {
            embedding: data.embedding?.values || [],
            // v2 requires usage stats
            usage: { tokens: Math.ceil((text?.length || 0) / 4) },
          };
        })
      );

      return { 
        embeddings: embeddings.map(e => e.embedding),
        // Aggregate usage for v2 spec
        usage: { tokens: embeddings.reduce((acc, e) => acc + e.usage.tokens, 0) },
      };
    },
  } as any, // Type cast required for @convex-dev/rag AI SDK v2 compatibility - custom embedding interface
  embeddingDimension: 768, // Google text-embedding-004 outputs 768 dimensions
  filterNames: ["mood", "lighting", "sourceType"],
});

// ============================================
// ACTIONS: Index prompts into RAG
// ============================================

/**
 * Index a single image's prompt into RAG
 */
export const indexPrompt = action({
  args: {
    imageId: v.id("images"),
    forceReindex: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const image = await ctx.runQuery(api.images.getById, { id: args.imageId });
    if (!image) throw new Error("Image not found");

    const prompt = image.generatedPrompts?.text_to_image || image.prompt;
    if (!prompt) {
      return { success: false, error: "No prompt available for this image" };
    }

    // Build filter values from image metadata
    const filterValues: Array<{ name: string; value: string }> = [];
    if (image.mood) filterValues.push({ name: "mood", value: image.mood });
    if (image.lighting) filterValues.push({ name: "lighting", value: image.lighting });
    if (image.sourceType) filterValues.push({ name: "sourceType", value: image.sourceType });

    // Add to RAG with imageId as key for deduplication
    const result = await rag.add(ctx, {
      namespace: "prompts",
      key: args.imageId,
      text: prompt,
      title: image.generatedPrompts?.visionati_analysis?.substring(0, 100) || undefined,
      filterValues,
      metadata: {
        imageId: args.imageId,
        imageUrl: image.imageUrl,
        mood: image.mood ?? null,
        lighting: image.lighting ?? null,
        aestheticScore: image.aestheticScore ?? null,
        likes: image.likes ?? null,
        isCurated: image.isCurated ?? null,
      },
    });

    return {
      success: true,
      entryId: result.entryId,
      status: result.status,
    };
  },
});

/**
 * Batch index multiple images' prompts
 */
export const batchIndexPrompts = internalAction({
  args: {
    imageIds: v.array(v.id("images")),
  },
  handler: async (ctx, args) => {
    let indexed = 0;
    let skipped = 0;
    let errors = 0;

    for (const imageId of args.imageIds) {
      try {
        const result = await ctx.runAction(api.rag.indexPrompt, { imageId });
        if (result.success) {
          indexed++;
        } else {
          skipped++;
        }
      } catch (e) {
        errors++;
        console.error(`[batchIndexPrompts] Error indexing ${imageId}:`, e);
      }
    }

    return { indexed, skipped, errors };
  },
});

// ============================================
// ACTIONS: Semantic Search
// ============================================

/**
 * Search prompts semantically
 */
export const searchPrompts = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    mood: v.optional(v.string()),
    lighting: v.optional(v.string()),
    userId: v.optional(v.string()), // For rate limiting
    clientKey: v.optional(v.string()), // For rate limiting (non-logged in)
  },
  handler: async (ctx, args) => {
    // Rate limiting
    const rateLimitKey = args.userId || args.clientKey;
    const limitName = args.userId ? "semanticSearch" : "landingLiveSearch";
    
    if (rateLimitKey) {
      const { ok, retryAfter } = await rateLimiter.limit(ctx, limitName, {
        key: rateLimitKey,
        throws: false,
      });

      if (!ok) {
        // Return empty result to prevent frontend crashes during typing
        return {
          results: [],
          text: "",
          usage: { tokens: 0 }
        };
      }
    }

    // Build filters
    const filters: Array<{ name: string; value: string }> = [];
    if (args.mood) filters.push({ name: "mood", value: args.mood });
    if (args.lighting) filters.push({ name: "lighting", value: args.lighting });

    const { results, text, entries, usage } = await rag.search(ctx, {
      namespace: "prompts",
      query: args.query,
      limit: args.limit ?? 10,
      vectorScoreThreshold: 0.5,
      filters: filters.length > 0 ? filters : undefined,
    });

    // Map results back to image IDs
    const enrichedResults = entries.map((entry) => ({
      entryId: entry.entryId,
      promptText: entry.text,
      title: entry.title,
      metadata: entry.metadata,
      score: calculateRankingScore(
        results.find((r) => r.entryId === entry.entryId)?.score ?? 0,
        entry.metadata
      ),
    }));

    // Deduplicate by imageUrl (keeping highest scored)
    const sorted = enrichedResults.sort((a, b) => b.score - a.score);
    const uniqueResults = [];
    const seenUrls = new Set<string>();
    
    for (const r of sorted) {
      const url = r.metadata?.imageUrl;
      if (typeof url === 'string') {
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          uniqueResults.push(r);
        }
      } else {
        uniqueResults.push(r);
      }
    }

    return {
      results: uniqueResults,
      text,
      usage,
    };
  },
});

/**
 * Calculate ranking score combining vector similarity with engagement data
 */
function calculateRankingScore(vectorScore: number, metadata?: any): number {
  if (!metadata) return vectorScore;
  
  let boost = 0;
  
  // Curated content gets a 10% boost
  if (metadata.isCurated) boost += 0.1;
  
  // Aesthetic score (0-10 or 0-1?) gets up to 10% boost
  // Assuming score is roughly 0-10 based on schema float64
  if (metadata.aestheticScore) {
    boost += (metadata.aestheticScore / 100); // Conservative boost
  }
  
  // Likes get a small boost (capped at 5%)
  if (metadata.likes) {
     boost += Math.min(metadata.likes * 0.01, 0.05);
  }
  
  return vectorScore * (1 + boost);
}

/**
 * Find similar prompts to a given image
 */
export const findSimilarPrompts = action({
  args: {
    imageId: v.id("images"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const image = await ctx.runQuery(api.images.getById, { id: args.imageId });
    if (!image) throw new Error("Image not found");

    const prompt = image.generatedPrompts?.text_to_image || image.prompt;
    if (!prompt) {
      return { success: false, results: [], error: "No prompt for this image" };
    }

    // Search for similar prompts, excluding the current image
    const { results, entries } = await rag.search(ctx, {
      namespace: "prompts",
      query: prompt,
      limit: (args.limit ?? 5) + 1, // Get one extra to filter out self
      vectorScoreThreshold: 0.6, // Higher threshold for similarity
    });

    // Filter out the current image and enrich results
    const similarPrompts = entries
      .filter((entry) => entry.metadata?.imageId !== args.imageId)
      .slice(0, args.limit ?? 5)
      .map((entry) => ({
        entryId: entry.entryId,
        imageId: entry.metadata?.imageId,
        imageUrl: entry.metadata?.imageUrl,
        promptText: entry.text,
        mood: entry.metadata?.mood,
        lighting: entry.metadata?.lighting,
        score: results.find((r) => r.entryId === entry.entryId)?.score ?? 0,
      }));

    return {
      success: true,
      results: similarPrompts,
    };
  },
});

// Export the RAG instance for use in other modules
export { rag };

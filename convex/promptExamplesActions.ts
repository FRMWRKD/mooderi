"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Prompt Examples Actions Module
 * 
 * Node.js actions for vector search and embedding generation.
 * Separated from queries/mutations which don't need Node.js runtime.
 */

// ============================================
// ACTIONS: Vector Search within Category
// ============================================

/**
 * Search examples by embedding within a category
 * Used to find relevant examples for a specific input
 */
export const searchByEmbedding = action({
  args: {
    embedding: v.array(v.float64()),
    categoryKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Record<string, any>>> => {
    const limit = args.limit ?? 5;

    // Vector search with category filter
    const results = await ctx.vectorSearch("promptExamples", "by_embedding", {
      vector: args.embedding,
      limit: limit,
      filter: (q: any) => 
        q.and(
          q.eq("categoryKey", args.categoryKey),
          q.eq("isActive", true)
        ),
    });

    // Fetch full documents
    const examples: Array<Record<string, any> | null> = await Promise.all(
      results.map(async (r: any) => {
        const example = await ctx.runQuery(api.promptExamples.getById, { id: r._id });
        return example ? { ...example, score: r._score } : null;
      })
    );

    // Sort by weighted score (similarity * rating)
    return examples
      .filter((e): e is Record<string, any> => e !== null)
      .map(e => ({
        ...e,
        weightedScore: (e.score ?? 0) * (1 + (e.rating ?? 50) / 100),
      }))
      .sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0));
  },
});

/**
 * Generate embedding for an example (to enable vector search)
 */
export const generateEmbedding = action({
  args: { id: v.id("promptExamples") },
  handler: async (ctx, args) => {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) throw new Error("Missing GOOGLE_API_KEY");

    const example = await ctx.runQuery(api.promptExamples.getById, { id: args.id });
    if (!example) throw new Error("Example not found");

    // Generate embedding
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: example.promptText.substring(0, 2000) }] },
          outputDimensionality: 768,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (embedding && embedding.length === 768) {
      await ctx.runMutation(api.promptExamples.setEmbedding, {
        id: args.id,
        embedding,
      });
      return { success: true };
    }

    return { success: false, error: "Failed to generate embedding" };
  },
});

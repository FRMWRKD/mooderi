"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { rateLimiter } from "./rateLimits";
import { retrier } from "./retrier";

/**
 * AI Module - Actions for external AI services
 * 
 * Uses "use node" for Node.js runtime (required for fetch to external APIs)
 * 
 * Features:
 * - Rate limiting: Prevents abuse with token bucket rate limits
 * - Automatic retries: Exponential backoff for failed API calls
 * 
 * Pipeline:
 * 1. analyzeImage → Visionati API (tags, colors, structured analysis)
 * 2. generatePrompts → Straico API (text_to_image, image_to_image, text_to_video)
 * 3. generateEmbedding → Google API (768-dim vector for semantic search)
 */

// ============================================
// HELPER: Fetch with Retry
// ============================================
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, initialBackoff = 2000): Promise<Response> {
  let backoff = initialBackoff;
  let lastError: any;

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      
      // Success
      if (res.ok) return res;
      
      // Don't retry client errors (4xx) except Rate Limit (429)
      if (res.status < 500 && res.status !== 429) {
        return res;
      }
      
      console.warn(`[fetchWithRetry] Request failed (${res.status}). Attempt ${i + 1}/${retries + 1}. Retrying in ${backoff}ms...`);
      
    } catch (e: any) {
      lastError = e;
      console.warn(`[fetchWithRetry] Network error (${e.message}). Attempt ${i + 1}/${retries + 1}. Retrying in ${backoff}ms...`);
    }

    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2; // Exponential backoff
    }
  }

  if (lastError) throw lastError;
  throw new Error(`Request failed after ${retries + 1} attempts`);
}

// ============================================
// HELPER: Fetch System Prompt from DB
// ============================================
async function getSystemPrompt(ctx: any, promptId: string): Promise<string | null> {
  const prompt = await ctx.runQuery(api.systemPrompts.getByPromptId, { promptId });
  return prompt?.content || null;
}

// ============================================
// HELPER: Auto-detect category from Visionati analysis
// ============================================
type CategoryKey = 'youtube_thumbnail' | 'realistic' | 'anime' | 'illustration' | 'cinematic' | 'logo' | 'product' | 'abstract';

function detectCategoryFromAnalysis(
  tags: string[],
  structuredAnalysis: any,
  colors: string[]
): CategoryKey {
  const tagsLower = tags.map(t => t.toLowerCase());
  const description = structuredAnalysis?.short_description?.toLowerCase() || '';
  const style = structuredAnalysis?.style?.toLowerCase() || '';
  const allText = [...tagsLower, description, style].join(' ');

  // YouTube Thumbnail detection
  if (
    tagsLower.some(t => ['thumbnail', 'youtube', 'clickbait', 'reaction', 'shocked', 'surprised'].includes(t)) ||
    allText.includes('thumbnail') ||
    allText.includes('youtube')
  ) {
    return 'youtube_thumbnail';
  }

  // Anime/Manga detection
  if (
    tagsLower.some(t => ['anime', 'manga', 'cartoon', 'chibi', 'kawaii', 'cel-shaded', 'japanese animation'].includes(t)) ||
    allText.includes('anime') ||
    allText.includes('manga') ||
    allText.includes('japanese') ||
    allText.includes('cel shaded')
  ) {
    return 'anime';
  }

  // Logo/Icon detection
  if (
    tagsLower.some(t => ['logo', 'icon', 'symbol', 'brand', 'emblem', 'badge', 'minimalist'].includes(t)) ||
    allText.includes('logo') ||
    allText.includes('icon') ||
    allText.includes('brand')
  ) {
    return 'logo';
  }

  // Product Photography detection
  if (
    tagsLower.some(t => ['product', 'commercial', 'packshot', 'e-commerce', 'advertisement'].includes(t)) ||
    allText.includes('product') ||
    allText.includes('commercial') ||
    allText.includes('advertisement')
  ) {
    return 'product';
  }

  // Abstract Art detection
  if (
    tagsLower.some(t => ['abstract', 'surreal', 'conceptual', 'pattern', 'geometric', 'fractal'].includes(t)) ||
    allText.includes('abstract') ||
    allText.includes('surreal') ||
    allText.includes('conceptual')
  ) {
    return 'abstract';
  }

  // Cinematic detection
  if (
    tagsLower.some(t => ['cinematic', 'movie', 'film', 'dramatic', 'epic', 'widescreen', 'poster'].includes(t)) ||
    allText.includes('cinematic') ||
    allText.includes('movie') ||
    allText.includes('film') ||
    allText.includes('dramatic lighting')
  ) {
    return 'cinematic';
  }

  // Illustration detection
  if (
    tagsLower.some(t => ['illustration', 'drawing', 'artwork', 'digital art', 'concept art', 'fantasy'].includes(t)) ||
    allText.includes('illustration') ||
    allText.includes('artwork') ||
    allText.includes('concept art')
  ) {
    return 'illustration';
  }

  // Default: Realistic/Photorealistic (most common for real photos)
  if (
    tagsLower.some(t => ['photo', 'photograph', 'realistic', 'portrait', 'landscape', 'nature'].includes(t)) ||
    allText.includes('photo') ||
    allText.includes('realistic') ||
    allText.includes('portrait')
  ) {
    return 'realistic';
  }

  // Fallback: realistic is safest default
  return 'realistic';
}

// ============================================
// MAIN ACTION: Analyze Image (Full Pipeline)
// ============================================
export const analyzeImage = action({
  args: {
    imageId: v.id("images"),
    imageUrl: v.string(),
    userId: v.optional(v.string()), // For rate limiting by user
  },
  handler: async (ctx, args) => {
    const visionatiKey = process.env.VISIONATI_API_KEY;
    const straicoKey = process.env.STRAICO_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!visionatiKey) throw new Error("Missing VISIONATI_API_KEY");

    // ============================================
    // RATE LIMITING: Check imageAnalysis limit
    // ============================================
    const rateLimitKey = args.userId || args.imageId;
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "imageAnalysis", {
      key: rateLimitKey,
      throws: false,
    });
    
    if (!ok) {
      console.log(`[analyzeImage] Rate limited. Retry after ${retryAfter}ms`);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil((retryAfter || 60000) / 1000)} seconds.`);
    }

    console.log(`[analyzeImage] Starting analysis for imageId=${args.imageId}`);

    // ============================================
    // STEP 1: Call Visionati for image analysis
    // ============================================
    // Fetch Visionati prompt from database
    const visionatiPrompt = await getSystemPrompt(ctx, 'visionati_v1');
    if (!visionatiPrompt) {
      console.error("[analyzeImage] CRITICAL: No system prompt found in database for 'visionati_v1'");
      throw new Error("Visionati prompt not configured in database. Please add 'visionati_v1' to systemPrompts table.");
    }

    const visionatiPayload = {
      role: 'prompt',
      feature: ['tags', 'colors', 'descriptions'],
      prompt: visionatiPrompt,
      url: args.imageUrl,
    };

    console.log("[analyzeImage] Step 1: Calling Visionati...");
    const visionatiResponse = await fetchWithRetry('https://api.visionati.com/api/fetch', {
      method: 'POST',
      headers: {
        'X-API-Key': `Token ${visionatiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visionatiPayload),
    });

    if (!visionatiResponse.ok) {
      const errText = await visionatiResponse.text();
      throw new Error(`Visionati API Error: ${visionatiResponse.status} - ${errText}`);
    }

    let visionatiResult = await visionatiResponse.json();

    // Handle Async Polling
    if (visionatiResult.response_uri) {
      console.log("[analyzeImage] Async response received. Polling...");
      const pollUrl = visionatiResult.response_uri;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 2s = 120s timeout
      let pollingSuccess = false;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));

        const pollResp = await fetchWithRetry(pollUrl, {
          headers: { 'X-API-Key': `Token ${visionatiKey}` },
        }, 5, 2000); // 5 retries for polling errors

        if (pollResp.ok) {
          const pollResult = await pollResp.json();
          console.log(`[analyzeImage] Poll attempt ${attempts + 1}/${maxAttempts}`);

          if (pollResult.all && pollResult.all.assets) {
            visionatiResult = pollResult;
            pollingSuccess = true;
            console.log("[analyzeImage] Polling complete - assets received");
            break;
          }
          if (pollResult.status === 'failed') {
            throw new Error("Visionati processing failed during polling");
          }
        }
        attempts++;
      }

      if (!pollingSuccess) {
        throw new Error("Visionati polling timed out");
      }
    }

    // Parse Visionati response
    const allData = visionatiResult.all || {};
    let visionatiDescription = '';
    let colors: string[] = [];
    let tags: string[] = [];
    let structuredAnalysis: any = null;

    if (allData.assets && allData.assets.length > 0) {
      const asset = allData.assets[0];

      if (asset.descriptions && asset.descriptions.length > 0) {
        visionatiDescription = asset.descriptions[0].description || '';
      } else if (allData.descriptions && allData.descriptions.length > 0) {
        visionatiDescription = allData.descriptions[0].description || '';
      }

      const colorData = asset.colors || allData.colors || {};
      colors = Object.keys(colorData).slice(0, 5);

      const tagData = asset.tags || allData.tags || {};
      tags = Object.keys(tagData).slice(0, 10);
    } else {
      const desc = allData.descriptions || [];
      visionatiDescription = desc.length > 0 ? desc[0].description : '';
      colors = Object.keys(allData.colors || {}).slice(0, 5);
      tags = Object.keys(allData.tags || {}).slice(0, 10);
    }

    // Try to parse structured JSON from the description
    if (visionatiDescription) {
      try {
        let cleanedPrompt = visionatiDescription
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();

        const jsonMatch = cleanedPrompt.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          structuredAnalysis = JSON.parse(jsonMatch[0]);
          console.log("[analyzeImage] Parsed structured analysis");
        }
      } catch (e) {
        console.log("[analyzeImage] Could not parse JSON from Visionati response");
      }
    }

    console.log("[analyzeImage] Visionati complete:", {
      hasStructured: !!structuredAnalysis,
      descriptionLen: visionatiDescription.length,
      colors: colors.length,
      tags: tags.length,
    });

    // ============================================
    // STEP 2: Generate embedding for semantic search
    // ============================================
    let embedding: number[] | null = null;

    if (visionatiDescription && googleApiKey) {
      try {
        console.log("[analyzeImage] Step 2: Generating embedding...");
        const embeddingResponse = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text: visionatiDescription.substring(0, 2000) }] },
            }),
          }
        );

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.embedding?.values || null;
          console.log("[analyzeImage] Embedding generated:", embedding ? `${embedding.length} dimensions` : 'failed');
        } else {
          console.error("[analyzeImage] Embedding API error:", embeddingResponse.status);
        }
      } catch (embError) {
        console.error("[analyzeImage] Embedding generation failed:", embError);
      }
    }

    // ============================================
    // STEP 3: Call Straico to generate AI prompts
    // ============================================
    let straicoPrompts: any = null;
    let finalPrompt = visionatiDescription;
    let detectedCategory: CategoryKey = 'realistic';

    if (straicoKey) {
      try {
        console.log("[analyzeImage] Step 3: Calling Straico...");

        // Auto-detect category from Visionati analysis
        detectedCategory = detectCategoryFromAnalysis(tags, structuredAnalysis, colors);
        console.log(`[analyzeImage] Auto-detected category: ${detectedCategory}`);

        // Try to load category-specific system prompt
        let systemPrompt = await getSystemPrompt(ctx, `category_${detectedCategory}_v1`);
        
        // Fallback to generic if category prompt not found
        if (!systemPrompt) {
          console.log(`[analyzeImage] No category-specific prompt for ${detectedCategory}, using generic`);
          systemPrompt = await getSystemPrompt(ctx, 'straico_v1');
        }
        
        if (!systemPrompt) {
          console.error("[analyzeImage] CRITICAL: No system prompt found in database");
          throw new Error("System prompt not configured in database.");
        }

        // Fetch top-rated examples for this category
        let categoryExamples: any[] = [];
        try {
          categoryExamples = await ctx.runQuery(api.promptExamples.getBestByCategory, {
            categoryKey: detectedCategory,
            limit: 3,
          });
          console.log(`[analyzeImage] Loaded ${categoryExamples.length} top examples for ${detectedCategory}`);
        } catch (e) {
          console.log("[analyzeImage] Could not load category examples:", e);
        }

        const inputData = {
          image_url: args.imageUrl,
          detected_category: detectedCategory,
          analysis: {
            detailed_description: visionatiDescription,
            structured_analysis: structuredAnalysis,
          },
          // Include top-rated examples as context
          top_rated_examples: categoryExamples.length > 0
            ? categoryExamples.map((e, i) => ({
                rank: i + 1,
                prompt: e.promptText,
                rating: e.rating,
              }))
            : undefined,
        };

        // Build user message with examples context
        let userMessage = `DETECTED STYLE: ${detectedCategory.replace('_', ' ').toUpperCase()}\n\n`;
        
        if (categoryExamples.length > 0) {
          userMessage += `TOP RATED EXAMPLES FOR THIS STYLE (learn from these):\n`;
          categoryExamples.forEach((e, i) => {
            userMessage += `Example ${i + 1} (Rating: ${e.rating}/100): ${e.promptText}\n\n`;
          });
        }
        
        userMessage += `INPUT ANALYSIS:\n${JSON.stringify(inputData, null, 2)}`;

        const straicoRes = await fetchWithRetry('https://api.straico.com/v1/prompt/completion', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${straicoKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            models: ["minimax/minimax-m2"],
            message: `${systemPrompt}\n\n${userMessage}`,
          }),
        }, 3, 2000);

        if (straicoRes.ok) {
          const straicoJson = await straicoRes.json();

          try {
            let content = '';
            let choices: any[] = [];

            // Check for standard structure
            if (straicoJson.data?.completion?.choices) {
              choices = straicoJson.data.completion.choices;
            } else if (straicoJson.data?.completions) {
              const modelKeys = Object.keys(straicoJson.data.completions);
              if (modelKeys.length > 0) {
                choices = straicoJson.data.completions[modelKeys[0]]?.completion?.choices || [];
              }
            }

            if (choices.length > 0 && choices[0]?.message?.content) {
              content = choices[0].message.content;
              content = content.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim();

              const jsonStart = content.indexOf('{');
              const jsonEnd = content.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                content = content.substring(jsonStart, jsonEnd + 1);
              }

              straicoPrompts = JSON.parse(content);
              console.log("[analyzeImage] Straico prompts parsed:", Object.keys(straicoPrompts));

              // Include Visionati analysis in prompts
              if (structuredAnalysis) {
                straicoPrompts.structured_analysis = structuredAnalysis;
              }
              straicoPrompts.visionati_analysis = visionatiDescription;

              if (straicoPrompts.text_to_image) {
                finalPrompt = straicoPrompts.text_to_image;
              }
            }
          } catch (parseError) {
            console.error("[analyzeImage] Straico parse error:", parseError);
          }
        } else {
          console.error("[analyzeImage] Straico API error:", straicoRes.status);
        }
      } catch (straicoError) {
        console.error("[analyzeImage] Straico call error:", straicoError);
      }
    }

    // ============================================
    // STEP 4: Update database with all data
    // ============================================
    console.log("[analyzeImage] Step 4: Updating database...");

    const updatePayload: any = {
      id: args.imageId,
      colors: colors,
      tags: tags,
    };

    // Add embedding if available
    if (embedding && embedding.length === 768) {
      updatePayload.embedding = embedding;
    }

    // Add prompts
    if (straicoPrompts && straicoPrompts.text_to_image) {
      updatePayload.prompt = straicoPrompts.text_to_image;
      updatePayload.generatedPrompts = straicoPrompts;
    } else {
      const shortDesc = structuredAnalysis?.short_description || visionatiDescription.substring(0, 500);
      updatePayload.prompt = shortDesc;
      updatePayload.generatedPrompts = {
        text_to_image: shortDesc,
        visionati_analysis: visionatiDescription,
        structured_analysis: structuredAnalysis,
      };
    }

    // Extract mood and lighting from structured analysis
    if (structuredAnalysis?.mood?.emotion) {
      updatePayload.mood = structuredAnalysis.mood.emotion;
    }
    if (structuredAnalysis?.lighting?.type) {
      updatePayload.lighting = structuredAnalysis.lighting.type;
    }
    if (structuredAnalysis?.camera?.shot_type) {
      updatePayload.cameraShot = structuredAnalysis.camera.shot_type;
    }
    if (structuredAnalysis?.aesthetic_score) {
      updatePayload.aestheticScore = structuredAnalysis.aesthetic_score;
    }

    // Store detected category
    updatePayload.detectedCategory = detectedCategory;

    // Mark as analyzed
    updatePayload.isAnalyzed = true;

    await ctx.runMutation(api.images.update, updatePayload);

    // ============================================
    // STEP 5: Index prompt into RAG for semantic search
    // ============================================
    try {
      console.log("[analyzeImage] Step 5: Indexing prompt into RAG...");
      const ragResult = await ctx.runAction(api.rag.indexPrompt, {
        imageId: args.imageId,
        forceReindex: true,
      });
      console.log("[analyzeImage] RAG indexing result:", ragResult);
    } catch (ragError) {
      // Don't fail the entire pipeline if RAG indexing fails
      console.error("[analyzeImage] RAG indexing failed (non-fatal):", ragError);
    }

    console.log("[analyzeImage] Pipeline complete!");

    return {
      success: true,
      prompt: finalPrompt,
      colors,
      tags,
      detectedCategory,
      structured_analysis: structuredAnalysis,
      generated_prompts: straicoPrompts,
      hasEmbedding: !!embedding,
    };
  },
});

// ============================================
// Generate Search Embedding
// ============================================
export const generateSearchEmbedding = action({
  args: { 
    text: v.string(),
    userId: v.optional(v.string()), // For rate limiting
  },
  handler: async (ctx, args) => {
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!googleApiKey) {
      throw new Error("Missing GOOGLE_API_KEY");
    }

    // Rate limiting for semantic search (generous limit)
    if (args.userId) {
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "semanticSearch", {
        key: args.userId,
        throws: false,
      });
      
      if (!ok) {
        throw new Error(`Search rate limit exceeded. Please wait ${Math.ceil((retryAfter || 60000) / 1000)} seconds.`);
      }
    }

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: args.text.substring(0, 2000) }] },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding?.values || null;
  },
});

// ============================================
// Generate Smart Board (Semantic Search)
// ============================================
export const generateSmartBoard = action({
  args: {
    prompt: v.string(),
    count: v.optional(v.number()),
    strictness: v.optional(v.number()),
    userId: v.optional(v.string()), // For rate limiting
  },
  handler: async (ctx, args): Promise<{
    board: {
      id: string;
      name: string;
      images: Id<"images">[];
      prompt: string;
      isSmartBoard: boolean;
    };
    images: Doc<"images">[];
    count: number;
  }> => {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const count = args.count ?? 20;

    if (!googleApiKey) {
      throw new Error("Missing GOOGLE_API_KEY");
    }

    // Rate limiting for semantic search
    if (args.userId) {
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "semanticSearch", {
        key: args.userId,
        throws: false,
      });
      
      if (!ok) {
        throw new Error(`Smart board rate limit exceeded. Please wait ${Math.ceil((retryAfter || 60000) / 1000)} seconds.`);
      }
    }

    // 1. Generate embedding for the prompt
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: args.prompt.substring(0, 2000) }] },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding) {
      return {
        board: {
          id: "temp-smart-" + Date.now(),
          name: args.prompt,
          images: [],
          prompt: args.prompt,
          isSmartBoard: true,
        },
        images: [],
        count: 0,
      };
    }

    // 2. Perform vector search
    const results = await ctx.vectorSearch("images", "by_embedding", {
      vector: embedding,
      limit: count,
      filter: (q) => q.eq("isPublic", true),
    });

    // 3. Fetch full image documents
    const images: (Doc<"images"> | null)[] = await Promise.all(
      results.map((r) => ctx.runQuery(api.images.getById, { id: r._id }))
    );

    const validImages: Doc<"images">[] = images.filter((img): img is Doc<"images"> => !!img);

    return {
      board: {
        id: "temp-smart-" + Date.now(),
        name: args.prompt,
        images: validImages.map((img) => img._id),
        prompt: args.prompt,
        isSmartBoard: true,
      },
      images: validImages,
      count: validImages.length,
    };
  },
});

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { rateLimiter } from "./rateLimits";

/**
 * Prompt Generator Module
 * 
 * AI-powered prompt generation with:
 * - Visionati image analysis
 * - RAG (vector search for similar high-ranked images)
 * - Straico prompt generation with context
 * - Rate limiting for landing page
 * - Credit system for app
 */

// ============================================
// TYPES
// ============================================
interface RagResult {
  imageId: Id<"images">;
  imageUrl: string;
  prompt: string | null;
  score: number;
  aestheticScore: number | null;
  isCurated: boolean;
  weight: number;
}

interface CategoryExample {
  promptText: string;
  rating: number;
  source: string;
}

interface GeneratePromptResult {
  success: boolean;
  generatedPrompt: string;
  topMatch: RagResult | null;
  recommendations: RagResult[];
  visionatiAnalysis: {
    short_description?: string;
    mood?: string;
    lighting?: string;
    colors?: string[];
  } | null;
  categoryKey?: string;
  categoryName?: string;
  usedExamples?: CategoryExample[];
  error?: string;
  rateLimitInfo?: {
    minuteRemaining: number;
    hourRemaining: number;
    retryAfterSeconds?: number;
  };
}

// ============================================
// HELPER: Apply ranking algorithm to RAG results
// ============================================
function applyRankingAlgorithm(
  results: Array<{
    _id: Id<"images">;
    _score: number;
    imageUrl?: string;
    prompt?: string | null;
    aestheticScore?: number | null;
    isCurated?: boolean;
  }>
): RagResult[] {
  return results.map(r => {
    const aestheticScore = r.aestheticScore ?? 5;
    const isCurated = r.isCurated ?? false;
    
    // Weight = similarity_score * (1 + aestheticScore/10) * (isCurated ? 1.5 : 1)
    const weight = r._score * (1 + aestheticScore / 10) * (isCurated ? 1.5 : 1);
    
    return {
      imageId: r._id,
      imageUrl: r.imageUrl || "",
      prompt: r.prompt || null,
      score: r._score,
      aestheticScore: aestheticScore,
      isCurated: isCurated,
      weight: weight,
    };
  }).sort((a, b) => b.weight - a.weight);
}

// ============================================
// HELPER: Auto-detect category from Visionati analysis
// ============================================
type CategoryKey = 'youtube_thumbnail' | 'realistic' | 'anime' | 'illustration' | 'cinematic' | 'logo' | 'product' | 'abstract';

function detectCategoryFromVisionati(
  visionatiAnalysis: { tags?: string[]; mood?: string; lighting?: string; short_description?: string } | null
): CategoryKey {
  if (!visionatiAnalysis) return 'realistic';
  
  const tags = visionatiAnalysis.tags || [];
  const tagsLower = tags.map(t => t.toLowerCase());
  const description = visionatiAnalysis.short_description?.toLowerCase() || '';
  const allText = [...tagsLower, description].join(' ');

  // YouTube Thumbnail
  if (tagsLower.some(t => ['thumbnail', 'youtube', 'clickbait', 'reaction'].includes(t)) || allText.includes('youtube')) {
    return 'youtube_thumbnail';
  }

  // Anime/Manga
  if (tagsLower.some(t => ['anime', 'manga', 'cartoon', 'chibi', 'kawaii'].includes(t)) || allText.includes('anime')) {
    return 'anime';
  }

  // Logo/Icon
  if (tagsLower.some(t => ['logo', 'icon', 'symbol', 'brand', 'emblem'].includes(t)) || allText.includes('logo')) {
    return 'logo';
  }

  // Product Photography
  if (tagsLower.some(t => ['product', 'commercial', 'packshot', 'advertisement'].includes(t))) {
    return 'product';
  }

  // Abstract Art
  if (tagsLower.some(t => ['abstract', 'surreal', 'conceptual', 'geometric'].includes(t))) {
    return 'abstract';
  }

  // Cinematic
  if (tagsLower.some(t => ['cinematic', 'movie', 'film', 'dramatic', 'epic'].includes(t))) {
    return 'cinematic';
  }

  // Illustration
  if (tagsLower.some(t => ['illustration', 'drawing', 'artwork', 'concept art'].includes(t))) {
    return 'illustration';
  }

  // Default: Realistic
  return 'realistic';
}

// ============================================
// MAIN ACTION: Generate Prompt
// ============================================
export const generatePrompt = action({
  args: {
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    categoryKey: v.optional(v.string()), // Category for specialized prompts
    source: v.union(v.literal("landing"), v.literal("app")),
    clientKey: v.optional(v.string()), // IP hash for landing page
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<GeneratePromptResult> => {
    const visionatiKey = process.env.VISIONATI_API_KEY;
    const straicoKey = process.env.STRAICO_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!straicoKey || !googleApiKey) {
      throw new Error("Missing required API keys");
    }

    // ============================================
    // RATE LIMITING (Landing page only)
    // ============================================
    if (args.source === "landing") {
      const rateLimitKey = args.clientKey || "anonymous";
      
      // Check minute limit
      const minuteResult = await rateLimiter.limit(ctx, "landingPromptGenMinute", {
        key: rateLimitKey,
        throws: false,
      });
      
      if (!minuteResult.ok) {
        return {
          success: false,
          generatedPrompt: "",
          topMatch: null,
          recommendations: [],
          visionatiAnalysis: null,
          error: "Rate limit exceeded. Please wait before trying again.",
          rateLimitInfo: {
            minuteRemaining: 0,
            hourRemaining: 0,
            retryAfterSeconds: Math.ceil((minuteResult.retryAfter || 60000) / 1000),
          },
        };
      }
      
      // Check hourly limit
      const hourResult = await rateLimiter.limit(ctx, "landingPromptGenHour", {
        key: rateLimitKey,
        throws: false,
      });
      
      if (!hourResult.ok) {
        return {
          success: false,
          generatedPrompt: "",
          topMatch: null,
          recommendations: [],
          visionatiAnalysis: null,
          error: "Hourly limit reached. Sign in for unlimited access!",
          rateLimitInfo: {
            minuteRemaining: 0,
            hourRemaining: 0,
            retryAfterSeconds: Math.ceil((hourResult.retryAfter || 3600000) / 1000),
          },
        };
      }
    }

    // Initialize progress tracking
    if (args.clientKey) {
      await ctx.runMutation(internal.progressStore.createProgress, {
        clientKey: args.clientKey,
      });
    }

    try {
      // ============================================
      // CREDIT CHECK (App only)
      // ============================================
    let finalImageUrl = args.imageUrl;
    if (args.storageId) {
      finalImageUrl = (await ctx.storage.getUrl(args.storageId)) ?? undefined;
    }

    let creditsToCharge = finalImageUrl ? 2 : 1;
    
    if (args.source === "app" && args.userId) {
      const user = await ctx.runQuery(api.users.getById, { id: args.userId });
      if (!user) {
        throw new Error("User not found");
      }
      if ((user.credits || 0) < creditsToCharge) {
        return {
          success: false,
          generatedPrompt: "",
          topMatch: null,
          recommendations: [],
          visionatiAnalysis: null,
          error: `Not enough credits. You need ${creditsToCharge} credits for this operation.`,
        };
      }
    }

    console.log(`[generatePrompt] Starting - source: ${args.source}, hasImage: ${!!finalImageUrl}`);

    // ============================================
    // STEP 1: Image Analysis (if image provided)
    // ============================================
    let visionatiAnalysis: {
      short_description?: string;
      mood?: string;
      lighting?: string;
      colors?: string[];
    } | null = null;
    let textForEmbedding = args.text || "";

    if (finalImageUrl && visionatiKey) {
      console.log("[generatePrompt] Step 1: Analyzing image with Visionati...");
      
      if (args.clientKey) {
        await ctx.runMutation(internal.progressStore.updateProgress, {
          clientKey: args.clientKey,
          step: "analyzing",
          details: "Analyzing image composition, lighting, and mood..."
        });
      }
      
      // Fetch Visionati prompt from database
      const visionatiDbPrompt = await ctx.runQuery(api.systemPrompts.getByPromptId, { promptId: "visionati_v1" });
      if (!visionatiDbPrompt?.content) {
        console.error("[generatePrompt] No Visionati prompt found in database");
        return {
          success: false,
          generatedPrompt: "",
          topMatch: null,
          recommendations: [],
          visionatiAnalysis: null,
          error: "Visionati prompt not configured. Please contact support.",
        };
      }

      const visionatiPayload = {
        role: 'prompt',
        feature: ['tags', 'colors', 'descriptions'],
        prompt: visionatiDbPrompt.content,
        url: finalImageUrl,
      };

      try {
        const visionatiResponse = await fetch('https://api.visionati.com/api/fetch', {
          method: 'POST',
          headers: {
            'X-API-Key': `Token ${visionatiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(visionatiPayload),
        });

        if (visionatiResponse.ok) {
          let visionatiResult = await visionatiResponse.json();

          // Handle async polling
          if (visionatiResult.response_uri) {
            console.log("[generatePrompt] Polling Visionati async response...");
            const pollUrl = visionatiResult.response_uri;
            let attempts = 0;
            const maxAttempts = 30;

            while (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 2000));
              
              const pollResp = await fetch(pollUrl, {
                headers: { 'X-API-Key': `Token ${visionatiKey}` },
              });

              if (pollResp.ok) {
                const pollResult = await pollResp.json();
                if (pollResult.all?.assets) {
                  visionatiResult = pollResult;
                  break;
                }
              }
              attempts++;
            }
          }

          // Parse response
          const allData = visionatiResult.all || {};
          let description = '';
          
          if (allData.assets?.[0]?.descriptions?.[0]?.description) {
            description = allData.assets[0].descriptions[0].description;
          } else if (allData.descriptions?.[0]?.description) {
            description = allData.descriptions[0].description;
          }

          // Try to parse structured JSON
          if (description) {
            try {
              const cleanedPrompt = description
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

              const jsonMatch = cleanedPrompt.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                visionatiAnalysis = {
                  short_description: parsed.short_description,
                  mood: parsed.mood,
                  lighting: parsed.lighting,
                  colors: parsed.colors,
                };
                textForEmbedding = parsed.short_description || description;
              }
            } catch (e) {
              // Fallback to raw description
              visionatiAnalysis = { short_description: description };
              textForEmbedding = description;
            }
          }

          // Extract colors from Visionati if not in JSON
          if (!visionatiAnalysis?.colors) {
            const colorData = allData.assets?.[0]?.colors || allData.colors || {};
            const extractedColors = Object.keys(colorData).slice(0, 5);
            if (visionatiAnalysis) {
              visionatiAnalysis.colors = extractedColors;
            }
          }

          console.log("[generatePrompt] Visionati analysis complete:", visionatiAnalysis);
        }
      } catch (e) {
        console.error("[generatePrompt] Visionati error:", e);
      }
    }

    // If no text and no image analysis, cannot proceed
    if (!textForEmbedding) {
      return {
        success: false,
        generatedPrompt: "",
        topMatch: null,
        recommendations: [],
        visionatiAnalysis: null,
        error: "Please provide either text or an image to analyze.",
      };
    }

    // ============================================
    // STEP 2: Generate embedding for RAG
    // ============================================
    console.log("[generatePrompt] Step 2: Generating embedding...");
    
    if (args.clientKey) {
      await ctx.runMutation(internal.progressStore.updateProgress, {
        clientKey: args.clientKey,
        step: "embedding",
        details: "Understanding prompt semantic meaning..."
      });
    }
    
    let embedding: number[] | null = null;
    
    try {
      const embeddingResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: textForEmbedding.substring(0, 2000) }] },
          }),
        }
      );

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        embedding = embeddingData.embedding?.values || null;
        console.log("[generatePrompt] Embedding generated:", embedding ? `${embedding.length} dimensions` : 'failed');
      }
    } catch (e) {
      console.error("[generatePrompt] Embedding error:", e);
    }

    // ============================================
    // STEP 3: RAG - Find similar images
    // ============================================
    console.log("[generatePrompt] Step 3: Vector search for similar images...");
    
    if (args.clientKey) {
      await ctx.runMutation(internal.progressStore.updateProgress, {
        clientKey: args.clientKey,
        step: "searching",
        details: "Searching for high-quality reference examples..."
      });
    }
    
    let ragResults: RagResult[] = [];
    
    if (embedding) {
      try {
        const vectorResults = await ctx.vectorSearch("images", "by_embedding", {
          vector: embedding,
          limit: 20,
          filter: (q) => q.eq("isPublic", true),
        });

        // Fetch full image data for ranking
        const imagePromises = vectorResults.map(async (r) => {
          const img = await ctx.runQuery(api.images.getById, { id: r._id });
          return img ? { ...r, ...img } : null;
        });
        
        const fullResults = (await Promise.all(imagePromises)).filter(Boolean);

        // Deduplicate by imageUrl to avoid showing identical images
        const seenUrls = new Set<string>();
        const uniqueResults: typeof fullResults = [];
        
        for (const r of fullResults) {
          if (r && r.imageUrl) {
            if (!seenUrls.has(r.imageUrl)) {
              seenUrls.add(r.imageUrl);
              uniqueResults.push(r);
            }
          } else if (r) {
            uniqueResults.push(r);
          }
        }
        
        // Apply ranking algorithm
        ragResults = applyRankingAlgorithm(uniqueResults as any);
        console.log("[generatePrompt] Found", ragResults.length, "similar images");

        if (args.clientKey) {
          await ctx.runMutation(internal.progressStore.updateProgress, {
            clientKey: args.clientKey,
            step: "searching",
            details: `Found ${ragResults.length} similar high-quality references`,
            similarImagesFound: ragResults.length,
            similarImages: ragResults.slice(0, 4).map(r => ({
              imageId: r.imageId,
              imageUrl: r.imageUrl,
              score: r.score
            }))
          });
        }
      } catch (e) {
        console.error("[generatePrompt] Vector search error:", e);
      }
    }

    // ============================================
    // STEP 4: Build context for Straico
    // ============================================
    const topMatch = ragResults[0] || null;
    const recommendations = ragResults.slice(1, 4);

    // Build context from RAG results
    const ragContext = ragResults.slice(0, 5).map((r, i) => ({
      rank: i + 1,
      prompt: r.prompt,
      aestheticScore: r.aestheticScore,
      isCurated: r.isCurated,
    })).filter(r => r.prompt);

    // ============================================
    // STEP 5: Call Straico to generate prompt
    // ============================================
    console.log("[generatePrompt] Step 5: Generating prompt with Straico...");
    
    if (args.clientKey) {
      await ctx.runMutation(internal.progressStore.updateProgress, {
        clientKey: args.clientKey,
        step: "generating",
        details: "Crafting professional AI prompt..."
      });
    }
    
    let generatedPrompt = "";
    let usedCategory: { key: string; name: string } | null = null;
    let usedExamples: CategoryExample[] = [];
    
    try {
      // ============================================
      // STEP 5a: Determine category (user selection OR auto-detect)
      // ============================================
      let categoryExamples: any[] = [];
      let effectiveCategoryKey: string | null = null;
      
      // Priority 1: User-selected category
      if (args.categoryKey) {
        effectiveCategoryKey = args.categoryKey;
        console.log(`[generatePrompt] Using user-selected category: ${args.categoryKey}`);
      } 
      // Priority 2: Auto-detect from Visionati analysis (when image analyzed)
      else if (visionatiAnalysis) {
        effectiveCategoryKey = detectCategoryFromVisionati(visionatiAnalysis);
        console.log(`[generatePrompt] Auto-detected category from Visionati: ${effectiveCategoryKey}`);
      }
      
      // Load category details and examples
      if (effectiveCategoryKey) {
        const category = await ctx.runQuery(api.promptCategories.getByKey, {
          key: effectiveCategoryKey,
        });
        
        if (category && category.isActive) {
          usedCategory = { key: category.key, name: category.name };
          
          // Get top-rated examples for this category
          categoryExamples = await ctx.runQuery(api.promptExamples.getBestByCategory, {
            categoryKey: effectiveCategoryKey,
            limit: 3,
          });
          
          usedExamples = categoryExamples.map(e => ({
            promptText: e.promptText,
            rating: e.rating,
            source: e.source,
          }));
          
          console.log(`[generatePrompt] Loaded category "${category.name}" with ${categoryExamples.length} top examples`);
        } else {
          console.log(`[generatePrompt] Category "${effectiveCategoryKey}" not found or inactive, using generic`);
        }
      }

      // ============================================
      // STEP 5b: Fetch system prompt (category-specific or default)
      // ============================================
      // Try category-specific prompt first, fall back to generic
      const promptId = effectiveCategoryKey 
        ? `category_${effectiveCategoryKey}_v1` 
        : "prompt_generator_v1";
      
      console.log(`[generatePrompt] Loading system prompt: ${promptId}`);
      let dbPrompt = await ctx.runQuery(api.systemPrompts.getByPromptId, { promptId });
      
      // Fallback to generic if category prompt not found
      if (!dbPrompt?.content && effectiveCategoryKey) {
        console.log("[generatePrompt] Category prompt not found, using generic");
        dbPrompt = await ctx.runQuery(api.systemPrompts.getByPromptId, { 
          promptId: "prompt_generator_v1" 
        });
      }
      
      if (!dbPrompt?.content) {
        console.error(`[generatePrompt] No system prompt found in database`);
        return {
          success: false,
          generatedPrompt: "",
          topMatch: null,
          recommendations: [],
          visionatiAnalysis,
          error: "System prompt not configured. Please contact support.",
        };
      }

      // ============================================
      // STEP 5c: Build enhanced context with examples
      // ============================================
      const inputData = {
        description: textForEmbedding,
        analysis: visionatiAnalysis,
        user_context: args.text,
        category: usedCategory ? {
          key: usedCategory.key,
          name: usedCategory.name,
        } : undefined,
        // High-rated examples for this category
        top_rated_examples: categoryExamples.length > 0 
          ? categoryExamples.map((e, i) => ({
              rank: i + 1,
              prompt: e.promptText,
              rating: e.rating,
              source: e.source,
            }))
          : undefined,
        // RAG results from similar images
        rag_references: ragContext.length > 0 ? ragContext.map(r => ({
          prompt: r.prompt,
          aestheticScore: r.aestheticScore,
          isCurated: r.isCurated,
        })) : undefined,
      };

      const userMessage = args.categoryKey && categoryExamples.length > 0
        ? `You are generating a prompt in the "${usedCategory?.name}" style.

TOP RATED EXAMPLES (learn from these):
${categoryExamples.map((e, i) => `Example ${i + 1} (Rating: ${e.rating}/100): ${e.promptText}`).join('\n\n')}

INPUT ANALYSIS:
${JSON.stringify(inputData, null, 2)}

Generate a prompt that matches the style and quality of the top-rated examples above.`
        : `INPUT ANALYSIS:\n${JSON.stringify(inputData, null, 2)}\n\nGenerate prompts based on this analysis.`;

      const straicoRequestBody = {
        models: ["minimax/minimax-m2"],
        message: `${dbPrompt.content}\n\n${userMessage}`,
      };

      console.log("[generatePrompt] Straico request body:", JSON.stringify(straicoRequestBody, null, 2).substring(0, 500));

      const straicoRes = await fetch('https://api.straico.com/v1/prompt/completion', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${straicoKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(straicoRequestBody),
      });

      if (straicoRes.ok) {
        const straicoJson = await straicoRes.json();
        
        // Extract content from response
        let content = '';
        let choices: any[] = [];

        if (straicoJson.data?.completion?.choices) {
          choices = straicoJson.data.completion.choices;
        } else if (straicoJson.data?.completions) {
          const modelKeys = Object.keys(straicoJson.data.completions);
          if (modelKeys.length > 0) {
            choices = straicoJson.data.completions[modelKeys[0]]?.completion?.choices || [];
          }
        }

        if (choices.length > 0 && choices[0]?.message?.content) {
          generatedPrompt = choices[0].message.content.trim();
          // Clean up if it has quotes or extra formatting
          generatedPrompt = generatedPrompt.replace(/^["']|["']$/g, '').trim();
          console.log("[generatePrompt] Prompt generated successfully");
        }
      } else {
        const errorBody = await straicoRes.text();
        console.error("[generatePrompt] Straico error:", straicoRes.status, errorBody);
      }
    } catch (e) {
      console.error("[generatePrompt] Straico call error:", e);
    }

    // Fallback if Straico fails
    if (!generatedPrompt && visionatiAnalysis?.short_description) {
      generatedPrompt = visionatiAnalysis.short_description;
    }

    if (!generatedPrompt) {
      return {
        success: false,
        generatedPrompt: "",
        topMatch: null,
        recommendations: [],
        visionatiAnalysis,
        error: "Failed to generate prompt. Please try again.",
      };
    }

    // ============================================
    // STEP 6: Save request and deduct credits
    // ============================================
    console.log("[generatePrompt] Step 6: Saving request...");
    
    // Deduct credits for app users
    if (args.source === "app" && args.userId) {
      await ctx.runMutation(api.users.deductCredits, {
        userId: args.userId,
        amount: creditsToCharge,
      });
    }

    // Save to promptRequests table
    await ctx.runMutation(api.promptRequests.saveRequest, {
      inputText: args.text,
      inputImageUrl: finalImageUrl,
      generatedPrompt,
      topMatchImageId: topMatch?.imageId,
      recommendationIds: recommendations.map(r => r.imageId),
      visionatiAnalysis: visionatiAnalysis ?? undefined,
      userId: args.userId,
      isPublic: args.source === "landing",
      source: args.source,
      clientKey: args.clientKey,
      creditsUsed: args.source === "app" ? creditsToCharge : undefined,
    });

    console.log("[generatePrompt] Complete!");
    
    if (args.clientKey) {
      await ctx.runMutation(internal.progressStore.updateProgress, {
        clientKey: args.clientKey,
        step: "complete",
        details: "Generation complete!",
      });
    }

    return {
      success: true,
      generatedPrompt,
      topMatch,
      recommendations,
      visionatiAnalysis,
      categoryKey: usedCategory?.key,
      categoryName: usedCategory?.name,
      usedExamples,
    };
  } catch (error: any) {
    console.error("[generatePrompt] Error:", error);
    
    if (args.clientKey) {
      // Don't await this to ensure error is rethrown quickly
      ctx.runMutation(internal.progressStore.updateProgress, {
        clientKey: args.clientKey,
        step: "error",
        details: error.message || "An unexpected error occurred",
      }).catch(console.error);
    }
    
    throw error;
  }
  },
});

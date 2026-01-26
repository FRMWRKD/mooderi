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
    // RATE LIMITING
    // ============================================
    if (args.source === "landing") {
      // Guest rate limiting (IP-based)
      const rateLimitKey = args.clientKey || "anonymous";

      // Check minute limit (1/minute for guests)
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

      // Check hourly limit (3/hour for guests)
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
          error: "Hourly limit reached (3 per hour for guests). Sign in for more access!",
          rateLimitInfo: {
            minuteRemaining: 0,
            hourRemaining: 0,
            retryAfterSeconds: Math.ceil((hourResult.retryAfter || 3600000) / 1000),
          },
        };
      }
    } else if (args.source === "app" && args.userId) {
      // Authenticated user rate limiting (user ID-based)
      const rateLimitKey = args.userId;

      // Check if user is unlimited subscriber (bypasses rate limits)
      const user = await ctx.runQuery(api.users.getById, { id: args.userId });
      const isUnlimited = user?.isUnlimitedSubscriber &&
        (!user.subscriptionExpiresAt || user.subscriptionExpiresAt > Date.now());

      if (!isUnlimited) {
        // Check minute limit (5/minute for authenticated users)
        const minuteResult = await rateLimiter.limit(ctx, "userPromptGenMinute", {
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
            error: "Rate limit exceeded. Please wait a moment before trying again.",
            rateLimitInfo: {
              minuteRemaining: 0,
              hourRemaining: 0,
              retryAfterSeconds: Math.ceil((minuteResult.retryAfter || 60000) / 1000),
            },
          };
        }

        // Check hourly limit (20/hour for authenticated users)
        const hourResult = await rateLimiter.limit(ctx, "userPromptGenHour", {
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
            error: "Hourly limit reached (20 per hour). Upgrade to unlimited for more access!",
            rateLimitInfo: {
              minuteRemaining: 0,
              hourRemaining: 0,
              retryAfterSeconds: Math.ceil((hourResult.retryAfter || 3600000) / 1000),
            },
          };
        }
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
    
    // Debug: [generatePrompt] Credit check - source: ${args.source}, userId: ${args.userId}, creditsNeeded: ${creditsToCharge}`);
    
    if (args.source === "app" && args.userId) {
      const user = await ctx.runQuery(api.users.getById, { id: args.userId });
      // Debug: [generatePrompt] User credits: ${user?.credits ?? 'user not found'}`);
      if (!user) {
        throw new Error("User not found");
      }
      if ((user.credits || 0) < creditsToCharge) {
        // Debug: [generatePrompt] Insufficient credits - returning error`);
        return {
          success: false,
          generatedPrompt: "",
          topMatch: null,
          recommendations: [],
          visionatiAnalysis: null,
          error: `Not enough credits. You need ${creditsToCharge} credits but you have ${user.credits || 0}. Please purchase more credits.`,
        };
      }
    } else {
      // Debug: [generatePrompt] Skipping credit check - source: ${args.source}, hasUserId: ${!!args.userId}`);
    }

    // Debug: [generatePrompt] Starting - source: ${args.source}, hasImage: ${!!finalImageUrl}`);

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
      // Debug: [generatePrompt] Step 1: Analyzing image with Visionati...");
      
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
            // Debug: [generatePrompt] Polling Visionati async response...");
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
                // Debug: [generatePrompt] Poll attempt ${attempts + 1}: status=${pollResult.status}, hasAll=${!!pollResult.all}, hasAssets=${!!pollResult.all?.assets}`);
                
                // Check various response structures
                if (pollResult.all?.assets || pollResult.assets || pollResult.all?.descriptions || pollResult.descriptions) {
                  visionatiResult = pollResult;
                  // Debug: [generatePrompt] Visionati polling complete");
                  break;
                }
                
                // Check if still processing
                if (pollResult.status === 'pending' || pollResult.status === 'processing') {
                  attempts++;
                  continue;
                }
                
                // If we got a result with data but different structure, use it
                if (pollResult.all || pollResult.status === 'completed' || pollResult.status === 'success') {
                  visionatiResult = pollResult;
                  // Debug: [generatePrompt] Visionati polling complete (alt structure)");
                  break;
                }
              } else {
                // Debug: [generatePrompt] Poll attempt ${attempts + 1} failed: ${pollResp.status}`);
              }
              attempts++;
            }
            
            if (attempts >= maxAttempts) {
              // Debug: [generatePrompt] Visionati polling timed out after max attempts");
            }
          }

          // Parse response
          const allData = visionatiResult.all || visionatiResult || {};
          let description = '';
          
          // Try multiple paths to find the description
          if (allData.assets?.[0]?.descriptions?.[0]?.description) {
            description = allData.assets[0].descriptions[0].description;
          } else if (allData.descriptions?.[0]?.description) {
            description = allData.descriptions[0].description;
          } else if (allData.assets?.[0]?.description) {
            description = allData.assets[0].description;
          } else if (typeof allData.description === 'string') {
            description = allData.description;
          } else if (visionatiResult.description) {
            description = visionatiResult.description;
          }
          
          // Debug: [generatePrompt] Visionati description found: ${description ? 'yes (' + description.length + ' chars)' : 'no'}`);

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
                
                // Handle colors - check if it's the new format with dominant array
                let parsedColors: string[] = [];
                if (parsed.colors) {
                  if (parsed.colors.dominant && Array.isArray(parsed.colors.dominant)) {
                    parsedColors = parsed.colors.dominant;
                  } else if (Array.isArray(parsed.colors)) {
                    parsedColors = parsed.colors;
                  } else if (typeof parsed.colors === 'object') {
                    parsedColors = Object.keys(parsed.colors);
                  }
                }
                
                // Handle lighting - normalize object to string if needed
                let parsedLighting: string | undefined;
                if (parsed.lighting) {
                  if (typeof parsed.lighting === 'string') {
                    parsedLighting = parsed.lighting;
                  } else if (typeof parsed.lighting === 'object') {
                    // Extract type or combine object properties into a readable string
                    const lightingObj = parsed.lighting;
                    parsedLighting = lightingObj.type || 
                      [lightingObj.quality, lightingObj.direction].filter(Boolean).join(', ') ||
                      'mixed';
                  }
                }
                
                // Handle mood - normalize object to string if needed
                let parsedMood: string | undefined;
                if (parsed.mood) {
                  if (typeof parsed.mood === 'string') {
                    parsedMood = parsed.mood;
                  } else if (typeof parsed.mood === 'object') {
                    parsedMood = parsed.mood.overall || parsed.mood.type || JSON.stringify(parsed.mood);
                  }
                }
                
                visionatiAnalysis = {
                  short_description: parsed.short_description,
                  mood: parsedMood,
                  lighting: parsedLighting,
                  colors: parsedColors,
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
            let extractedColors: string[] = [];
            
            // Handle new Visionati API format where colors is an object with dominant array
            if (colorData.dominant && Array.isArray(colorData.dominant)) {
              extractedColors = colorData.dominant.slice(0, 5);
            } else if (typeof colorData === 'object' && !Array.isArray(colorData)) {
              extractedColors = Object.keys(colorData).slice(0, 5);
            } else if (Array.isArray(colorData)) {
              extractedColors = colorData.slice(0, 5);
            }
            
            if (visionatiAnalysis) {
              visionatiAnalysis.colors = extractedColors;
            }
          }

          // Debug: [generatePrompt] Visionati analysis complete:", visionatiAnalysis);
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
    // Debug: [generatePrompt] Step 2: Generating embedding...");
    
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
        // Debug: [generatePrompt] Embedding generated:", embedding ? `${embedding.length} dimensions` : 'failed');
      }
    } catch (e) {
      console.error("[generatePrompt] Embedding error:", e);
    }

    // ============================================
    // STEP 3: RAG - Find similar images
    // ============================================
    // Debug: [generatePrompt] Step 3: Vector search for similar images...");
    
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
        // Debug: [generatePrompt] Found", ragResults.length, "similar images");

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
    // Debug: [generatePrompt] Step 5: Generating prompt with Straico...");
    
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
        // Debug: [generatePrompt] Using user-selected category: ${args.categoryKey}`);
      } 
      // Priority 2: Auto-detect from Visionati analysis (when image analyzed)
      else if (visionatiAnalysis) {
        effectiveCategoryKey = detectCategoryFromVisionati(visionatiAnalysis);
        // Debug: [generatePrompt] Auto-detected category from Visionati: ${effectiveCategoryKey}`);
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
          
          // Debug: [generatePrompt] Loaded category "${category.name}" with ${categoryExamples.length} top examples`);
        } else {
          // Debug: [generatePrompt] Category "${effectiveCategoryKey}" not found or inactive, using generic`);
        }
      }

      // ============================================
      // STEP 5b: Fetch system prompt (category-specific or default)
      // ============================================
      // Try category-specific prompt first, fall back to generic
      const promptId = effectiveCategoryKey 
        ? `category_${effectiveCategoryKey}_v1` 
        : "prompt_generator_v1";
      
      // Debug: [generatePrompt] Loading system prompt: ${promptId}`);
      let dbPrompt = await ctx.runQuery(api.systemPrompts.getByPromptId, { promptId });
      
      // Fallback to generic if category prompt not found
      if (!dbPrompt?.content && effectiveCategoryKey) {
        // Debug: [generatePrompt] Category prompt not found, using generic");
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

      // Debug: [generatePrompt] Straico request body:", JSON.stringify(straicoRequestBody, null, 2).substring(0, 500));

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
          // Debug: [generatePrompt] Prompt generated successfully");
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
    // Debug: [generatePrompt] Step 6: Saving request...");
    
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

    // Debug: [generatePrompt] Complete!");
    
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

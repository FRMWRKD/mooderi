import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Image Generation HTTP Actions
 * 
 * Proxies image generation requests to external APIs (Google Gemini, Fal.ai)
 * using user's own API keys stored in the database
 */

// ============================================
// GOOGLE GEMINI IMAGE GENERATION
// ============================================

export const generateWithGoogle = httpAction(async (ctx, request) => {
  try {
    // Verify auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { prompt, aspectRatio = "1:1" } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user's API key
    const keyData = await ctx.runQuery(api.userApiKeys.getDecryptedKey, { 
      provider: "google" 
    });

    if (!keyData?.key) {
      return new Response(JSON.stringify({ 
        error: "No Google API key configured. Please add your API key in settings." 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call Google Gemini API
    const startTime = Date.now();
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${keyData.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Generate an image: ${prompt}` }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    const generationTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Google API Error]", errorText);
      
      // Mark key as invalid if auth error
      if (response.status === 401 || response.status === 403) {
        await ctx.runMutation(internal.userApiKeys.updateKeyStatus, {
          userId: keyData.userId,
          provider: "google",
          isValid: false,
        });
      }
      
      return new Response(JSON.stringify({ 
        error: "Google API error",
        details: errorText,
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    
    // Mark key as valid
    await ctx.runMutation(internal.userApiKeys.updateKeyStatus, {
      userId: keyData.userId,
      provider: "google",
      isValid: true,
    });

    // Extract image from response
    let imageData = null;
    if (result.candidates?.[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          imageData = {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          };
          break;
        }
      }
    }

    if (!imageData) {
      return new Response(JSON.stringify({ 
        error: "No image in response",
        rawResponse: result,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      image: imageData,
      generationTime,
      provider: "google",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[generateWithGoogle] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ============================================
// FAL.AI IMAGE GENERATION
// ============================================

export const generateWithFal = httpAction(async (ctx, request) => {
  try {
    // Verify auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { prompt, aspectRatio = "square", model = "fal-ai/flux/schnell" } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user's API key
    const keyData = await ctx.runQuery(api.userApiKeys.getDecryptedKey, { 
      provider: "fal" 
    });

    if (!keyData?.key) {
      return new Response(JSON.stringify({ 
        error: "No Fal.ai API key configured. Please add your API key in settings." 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Map aspect ratio to image size
    const sizeMap: Record<string, { width: number; height: number }> = {
      "square": { width: 1024, height: 1024 },
      "1:1": { width: 1024, height: 1024 },
      "16:9": { width: 1344, height: 768 },
      "21:9": { width: 1536, height: 640 },
      "9:16": { width: 768, height: 1344 },
      "4:3": { width: 1152, height: 896 },
      "3:4": { width: 896, height: 1152 },
    };
    const size = sizeMap[aspectRatio] || sizeMap["square"];

    // Call Fal.ai API
    const startTime = Date.now();
    
    const response = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${keyData.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: size,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    const generationTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Fal.ai API Error]", errorText);
      
      // Mark key as invalid if auth error
      if (response.status === 401 || response.status === 403) {
        await ctx.runMutation(internal.userApiKeys.updateKeyStatus, {
          userId: keyData.userId,
          provider: "fal",
          isValid: false,
        });
      }
      
      return new Response(JSON.stringify({ 
        error: "Fal.ai API error",
        details: errorText,
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    
    // Mark key as valid
    await ctx.runMutation(internal.userApiKeys.updateKeyStatus, {
      userId: keyData.userId,
      provider: "fal",
      isValid: true,
    });

    // Extract image URL from response
    const imageUrl = result.images?.[0]?.url;
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ 
        error: "No image in response",
        rawResponse: result,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl,
      generationTime,
      provider: "fal",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[generateWithFal] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ============================================
// TEST API KEY VALIDITY
// ============================================

export const testApiKey = httpAction(async (ctx, request) => {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return new Response(JSON.stringify({ error: "Provider and API key required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let isValid = false;
    let message = "";

    if (provider === "google") {
      // Test Google API key with a simple request
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      isValid = response.ok;
      message = isValid ? "Google API key is valid" : "Invalid Google API key";
    } else if (provider === "fal") {
      // Test Fal.ai API key
      const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "test",
          num_images: 0, // Just validate, don't generate
        }),
      });
      // Fal returns 422 for validation errors but 401/403 for auth
      isValid = response.status !== 401 && response.status !== 403;
      message = isValid ? "Fal.ai API key is valid" : "Invalid Fal.ai API key";
    }

    return new Response(JSON.stringify({ isValid, message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      isValid: false, 
      message: error.message 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});

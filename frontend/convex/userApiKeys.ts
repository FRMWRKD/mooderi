import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * User API Keys Management
 * 
 * Handles secure storage of user's external API keys (Google AI, Fal.ai)
 * Keys are stored Base64 encoded - in production, consider additional encryption
 */

// ============================================
// QUERIES
// ============================================

/**
 * Check if user has API keys configured (without revealing them)
 */
export const getApiKeyStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { google: false, fal: false };
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) return { google: false, fal: false };
    
    const keys = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    const status: Record<string, { configured: boolean; isValid?: boolean; lastUsed?: number }> = {
      google: { configured: false },
      fal: { configured: false },
    };
    
    for (const key of keys) {
      status[key.provider] = {
        configured: true,
        isValid: key.isValid,
        lastUsed: key.lastUsed,
      };
    }
    
    return status;
  },
});

/**
 * Get masked API key for display (last 4 chars only)
 */
export const getMaskedApiKey = query({
  args: {
    provider: v.union(v.literal("google"), v.literal("fal")),
  },
  handler: async (ctx, { provider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) return null;
    
    const keyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", user._id).eq("provider", provider)
      )
      .first();
    
    if (!keyRecord) return null;
    
    // Decode and mask
    const decoded = Buffer.from(keyRecord.encryptedKey, "base64").toString("utf-8");
    const masked = "•".repeat(Math.max(0, decoded.length - 4)) + decoded.slice(-4);
    
    return {
      masked,
      isValid: keyRecord.isValid,
      lastUsed: keyRecord.lastUsed,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Save an API key
 */
export const saveApiKey = mutation({
  args: {
    provider: v.union(v.literal("google"), v.literal("fal")),
    apiKey: v.string(),
  },
  handler: async (ctx, { provider, apiKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be logged in");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) throw new Error("User not found");
    
    // Base64 encode the key (basic obfuscation)
    const encoded = Buffer.from(apiKey).toString("base64");
    
    // Check if key exists
    const existing = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", user._id).eq("provider", provider)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedKey: encoded,
        isValid: undefined, // Reset validation status
      });
      return { keyId: existing._id, action: "updated" };
    }
    
    const keyId = await ctx.db.insert("userApiKeys", {
      userId: user._id,
      provider,
      encryptedKey: encoded,
    });
    
    return { keyId, action: "created" };
  },
});

/**
 * Delete an API key
 */
export const deleteApiKey = mutation({
  args: {
    provider: v.union(v.literal("google"), v.literal("fal")),
  },
  handler: async (ctx, { provider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be logged in");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) throw new Error("User not found");
    
    const existing = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", user._id).eq("provider", provider)
      )
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
      return { success: true };
    }
    
    return { success: false, reason: "Key not found" };
  },
});

/**
 * Mark API key as valid/invalid and update last used
 */
export const updateKeyStatus = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("fal")),
    isValid: v.boolean(),
  },
  handler: async (ctx, { userId, provider, isValid }) => {
    const keyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", userId).eq("provider", provider)
      )
      .first();
    
    if (keyRecord) {
      await ctx.db.patch(keyRecord._id, {
        isValid,
        lastUsed: Date.now(),
      });
    }
  },
});

// ============================================
// INTERNAL: Get decrypted key (for server-side use only)
// ============================================

/**
 * Get the actual API key (internal use only)
 * This should only be called from HTTP actions that proxy API calls
 */
export const getDecryptedKey = query({
  args: {
    provider: v.union(v.literal("google"), v.literal("fal")),
  },
  handler: async (ctx, { provider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) return null;
    
    const keyRecord = await ctx.db
      .query("userApiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", user._id).eq("provider", provider)
      )
      .first();
    
    if (!keyRecord) return null;
    
    // Decode
    const decoded = Buffer.from(keyRecord.encryptedKey, "base64").toString("utf-8");
    
    return {
      key: decoded,
      userId: user._id,
    };
  },
});

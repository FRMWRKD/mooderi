import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Users Module
 * Migrated from 003_user_profiles.sql and server.js auth logic
 * 
 * Handles:
 * - User profile management (synced from auth provider)
 * - Credits system
 * - User preferences
 */

// ============================================
// QUERIES
// ============================================

/**
 * Get current authenticated user
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
  },
});

/**
 * Get user by ID
 */
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get user by email
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Get user by Supabase ID (tokenIdentifier)
 * Used when Supabase auth is used instead of Convex auth
 */
export const getBySupabaseId = query({
  args: { supabaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.supabaseId))
      .first();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Store/update user from Supabase auth
 * Call this after Supabase authentication to sync user data to Convex
 */
export const storeFromSupabase = mutation({
  args: {
    supabaseId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists by Supabase ID
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", args.supabaseId)
      )
      .first();
    
    if (existingUser) {
      // Update existing user with latest info
      await ctx.db.patch(existingUser._id, {
        name: args.name ?? existingUser.name,
        email: args.email ?? existingUser.email,
        avatarUrl: args.avatarUrl ?? existingUser.avatarUrl,
      });
      return existingUser._id;
    }
    
    // Create new user with initial credits
    const userId = await ctx.db.insert("users", {
      name: args.name ?? "Anonymous",
      email: args.email,
      avatarUrl: args.avatarUrl,
      tokenIdentifier: args.supabaseId,
      credits: 100, // Free initial credits
      totalCreditsUsed: 0,
    });
    
    // Schedule welcome email
    if (args.email) {
      await ctx.scheduler.runAfter(0, internal.email.sendWelcomeEmail, {
        email: args.email,
        name: args.name ?? "Friend",
      });
    }

    return userId;
  },
});

/**
 * Store/update user from Convex auth provider (legacy)
 * Call this after authentication to sync user data
 */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
    
    if (existingUser) {
      // Update existing user with latest info
      await ctx.db.patch(existingUser._id, {
        name: identity.name ?? existingUser.name,
        email: identity.email ?? existingUser.email,
        avatarUrl: identity.pictureUrl ?? existingUser.avatarUrl,
      });
      return existingUser._id;
    }
    
    // Create new user with initial credits
    const userId = await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous",
      email: identity.email,
      avatarUrl: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
      credits: 100, // Free initial credits
      totalCreditsUsed: 0,
    });
    
    // Schedule welcome email
    if (identity.email) {
      await ctx.scheduler.runAfter(0, internal.email.sendWelcomeEmail, {
        email: identity.email,
        name: identity.name ?? "Friend",
      });
    }
    
    return userId;
  },
});

/**
 * Update user profile - works with Supabase auth
 */
export const updateProfile = mutation({
  args: {
    supabaseId: v.optional(v.string()), // Allow Supabase ID for auth
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    preferences: v.optional(v.object({
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
      defaultBoardId: v.optional(v.id("boards")),
    })),
  },
  handler: async (ctx, args) => {
    let tokenId: string | undefined;
    
    // Try Supabase ID first, then fall back to Convex auth
    if (args.supabaseId) {
      tokenId = args.supabaseId;
    } else {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated");
      tokenId = identity.tokenIdentifier;
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", tokenId!)
      )
      .first();
    
    if (!user) throw new Error("User not found");
    
    const { supabaseId, ...updates } = args;
    const cleanUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    
    await ctx.db.patch(user._id, cleanUpdates);
    return { success: true };
  },
});

/**
 * Use credits (for copying prompts, etc.)
 */
export const useCredits = mutation({
  args: {
    amount: v.number(),
    action: v.string(), // "copy_prompt", "analyze_image", "video_frame"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();
    
    if (!user) throw new Error("User not found");
    
    const currentCredits = user.credits ?? 0;
    if (currentCredits < args.amount) {
      return { success: false, error: "Insufficient credits" };
    }
    
    await ctx.db.patch(user._id, {
      credits: currentCredits - args.amount,
      totalCreditsUsed: (user.totalCreditsUsed ?? 0) + args.amount,
    });
    
    return { 
      success: true, 
      remainingCredits: currentCredits - args.amount 
    };
  },
});

/**
 * Add credits (after purchase)
 */
export const addCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    
    await ctx.db.patch(args.userId, {
      credits: (user.credits ?? 0) + args.amount,
    });
    
    return { success: true, newBalance: (user.credits ?? 0) + args.amount };
  },
});

/**
 * Deduct credits (for actions that take userId directly)
 */
export const deductCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    
    const currentCredits = user.credits ?? 0;
    if (currentCredits < args.amount) {
      throw new Error("Insufficient credits");
    }
    
    await ctx.db.patch(args.userId, {
      credits: currentCredits - args.amount,
      totalCreditsUsed: (user.totalCreditsUsed ?? 0) + args.amount,
    });
    
    return { 
      success: true, 
      remainingCredits: currentCredits - args.amount 
    };
  },
});

/**
 * Get user activity history
 */
export const getActivity = query({
  args: { 
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get current user if userId not provided
    let userId = args.userId;
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return { activities: [] };
      
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .first();
      
      if (!user) return { activities: [] };
      userId = user._id;
    }
    
    // Fetch user actions (likes, copies, etc.)
    const actions = await ctx.db
      .query("userActions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 50);
    
    return { activities: actions };
  },
});

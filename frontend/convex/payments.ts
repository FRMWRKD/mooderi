import { Polar } from "@convex-dev/polar";
import { api, components } from "./_generated/api";
import { query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Polar Payments Configuration
 * 
 * Handles:
 * - Credit purchases (one-time)
 * - Subscription management
 * - Webhook processing for payment events
 * 
 * Products (create in Polar dashboard):
 * - starterPack: 100 credits for $5
 * - proPack: 500 credits for $20
 * - unlimitedMonthly: Unlimited for $15/month
 */

// Initialize Polar client
export const polar: any = new Polar(components.polar, {
  // Get current user info for checkout
  getUserInfo: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }
    
    // Find user by email
    const user = await ctx.runQuery(api.users.getByEmail, { 
      email: identity.email! 
    });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      userId: user._id,
      email: identity.email!,
    };
  },
  // Map product keys to Polar product IDs (update these after creating products in Polar)
  products: {
    starterPack: process.env.POLAR_STARTER_PACK_ID ?? "placeholder_starter",
    proPack: process.env.POLAR_PRO_PACK_ID ?? "placeholder_pro",
    unlimitedMonthly: process.env.POLAR_UNLIMITED_MONTHLY_ID ?? "placeholder_unlimited",
  },
  // Server mode: sandbox for testing, production for live
  server: "sandbox" as const,
});

// Export API functions for frontend
export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  generateCheckoutLink,
  generateCustomerPortalUrl,
} = polar.api();

// ============================================
// QUERIES
// ============================================

/**
 * Get current user's subscription info
 */
export const getCurrentSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!user) return null;
    
    return polar.getCurrentSubscription(ctx, { userId: user._id });
  },
});

/**
 * Get user's credit balance
 */
export const getCreditBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    
    return user?.credits ?? 0;
  },
});

// ============================================
// MUTATIONS (Internal - called by webhooks)
// ============================================

/**
 * Add credits to user after successful payment
 * Called by Polar webhook on order.paid event
 */
export const addCredits = internalMutation({
  args: {
    userId: v.id("users"),
    credits: v.number(),
    productId: v.string(),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, credits, productId, orderId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    
    const currentCredits = user.credits ?? 0;
    
    await ctx.db.patch(userId, {
      credits: currentCredits + credits,
    });
    
    console.log(`[addCredits] Added ${credits} credits to user ${userId}. New balance: ${currentCredits + credits}`);
    
    return { success: true, newBalance: currentCredits + credits };
  },
});

/**
 * Set user as unlimited subscriber
 */
export const setUnlimitedSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    isUnlimited: v.boolean(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { userId, isUnlimited, expiresAt }) => {
    await ctx.db.patch(userId, {
      isUnlimitedSubscriber: isUnlimited,
      subscriptionExpiresAt: expiresAt,
    });
    
    return { success: true };
  },
});

// ============================================
// ACTIONS
// ============================================

/**
 * Sync products from Polar dashboard
 */
export const syncProducts = action({
  args: {},
  handler: async (ctx) => {
    await polar.syncProducts(ctx);
    return { success: true };
  },
});

// ============================================
// CREDIT PACKAGES (for reference)
// ============================================
export const CREDIT_PACKAGES = {
  starterPack: {
    name: "Starter Pack",
    credits: 100,
    price: 500, // $5 in cents
    description: "100 credits for prompt generation and video processing",
  },
  proPack: {
    name: "Pro Pack", 
    credits: 500,
    price: 2000, // $20 in cents
    description: "500 credits - Best value for power users",
  },
  unlimitedMonthly: {
    name: "Unlimited Monthly",
    credits: -1, // -1 means unlimited
    price: 1500, // $15/month in cents
    description: "Unlimited access to all features",
  },
} as const;

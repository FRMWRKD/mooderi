import { Polar } from "@convex-dev/polar";
import { Polar as PolarSDK } from "@polar-sh/sdk";
import { api, components } from "./_generated/api";
import { query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    // Use getAuthUserId to get the user ID from @convex-dev/auth
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated");
    }
    
    // Get the user from database using runQuery (actions don't have direct db access)
    const user = await ctx.runQuery(api.users.getById, { id: userId });
    if (!user) {
      throw new Error("User not found");
    }
    
    if (!user.email) {
      throw new Error("User email is required for checkout. Please update your profile.");
    }
    
    return {
      userId: user._id,
      email: user.email,
    };
  },
  // Map product keys to Polar product IDs (update these after creating products in Polar)
  products: {
    starterPack: process.env.POLAR_STARTER_PACK_ID ?? "placeholder_starter",
    proPack: process.env.POLAR_PRO_PACK_ID ?? "placeholder_pro",
    unlimitedMonthly: process.env.POLAR_UNLIMITED_MONTHLY_ID ?? "placeholder_unlimited",
  },
  // Server mode: sandbox for testing, production for live
  server: "production" as const,
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
      .withIndex("email", (q) => q.eq("email", identity.email!))
      .first();
    
    if (!user) return null;
    
    return polar.getCurrentSubscription(ctx, { userId: user._id });
  },
});

/**
 * Get user's credit balance
 * Uses getAuthUserId for consistency with users.getCurrent
 */
export const getCreditBalance = query({
  args: {},
  handler: async (ctx) => {
    // Use getAuthUserId for consistency with users.getCurrent
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    return user?.credits ?? 0;
  },
});

// ============================================
// MUTATIONS (Internal - called by webhooks)
// ============================================

/**
 * Add credits to user after successful payment
 * Called by Polar webhook on order.paid event
 * Includes idempotency check to prevent duplicate credit additions
 */
export const addCredits = internalMutation({
  args: {
    userId: v.id("users"),
    credits: v.number(),
    productId: v.string(),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, credits, productId, orderId }) => {
    // Idempotency check - prevent duplicate credit additions
    if (orderId) {
      const existingPayment = await ctx.db
        .query("processedPayments")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .first();

      if (existingPayment) {
        return { success: false, duplicate: true, message: "Order already processed" };
      }
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const currentCredits = user.credits ?? 0;

    // Add credits
    await ctx.db.patch(userId, {
      credits: currentCredits + credits,
    });

    // Record the processed payment for idempotency
    if (orderId) {
      await ctx.db.insert("processedPayments", {
        orderId,
        userId,
        productId,
        credits,
        processedAt: Date.now(),
      });
    }

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

/**
 * Create a checkout URL using Polar SDK directly
 * This works with both one-time payments and subscriptions
 *
 * For embedded checkout, pass embedOrigin (e.g., "http://localhost:3005")
 * to enable the checkout to communicate with the parent page.
 */
export const createCheckoutUrl = action({
  args: {
    productId: v.string(),
    successUrl: v.string(),
    embedOrigin: v.optional(v.string()),
  },
  handler: async (ctx, { productId, successUrl, embedOrigin }) => {
    // Get authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User must be authenticated");
    }

    // Get user email
    const user = await ctx.runQuery(api.users.getById, { id: userId });
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.email) {
      throw new Error("User email is required for checkout");
    }

    // Initialize Polar SDK with organization token
    const polarSdk = new PolarSDK({
      accessToken: process.env.POLAR_ORGANIZATION_TOKEN,
      server: "production",
    });

    try {
      // Create checkout session with embedOrigin for embedded checkout support
      const checkout = await polarSdk.checkouts.create({
        products: [productId],
        customerEmail: user.email,
        successUrl,
        embedOrigin: embedOrigin || undefined,
        metadata: {
          userId: String(userId),
          source: "mooderi",
        },
      });

      return {
        success: true,
        checkoutUrl: checkout.url,
        checkoutId: checkout.id,
      };
    } catch (error: any) {
      console.error("[createCheckoutUrl] Error:", error);
      throw new Error(`Failed to create checkout: ${error.message}`);
    }
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

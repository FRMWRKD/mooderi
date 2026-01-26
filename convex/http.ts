import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";
import { polar } from "./payments";
import { generateWithGoogle, generateWithFal, testApiKey } from "./imageGeneration";

/**
 * HTTP Endpoints
 * For external webhook integrations (Modal, Polar, etc.), Auth, and R2 uploads
 */

const http = httpRouter();

// Convex Auth routes (OAuth callbacks, etc.)
auth.addHttpRoutes(http);

// ============================================
// R2 STORAGE UPLOAD ENDPOINT
// ============================================

/**
 * Get presigned URL for R2 upload
 * POST /r2/upload-url
 * Body: { contentType: string, prefix?: string }
 */
http.route({
  path: "/r2/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify authentication
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const body = await request.json();
      const { contentType, prefix } = body;

      if (!contentType) {
        return new Response(JSON.stringify({ error: "contentType is required" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Generate presigned URL
      const result = await ctx.runAction(api.r2Storage.generatePresignedUploadUrl, {
        contentType,
        prefix,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (e: any) {
      console.error("[R2 Upload URL] Error:", e);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }),
});

/**
 * CORS preflight for R2 upload endpoint
 */
http.route({
  path: "/r2/upload-url",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

// Polar webhook routes (payment events)
// Endpoint: /polar/events
// Type cast needed due to @convex-dev/polar router type mismatch with httpRouter
polar.registerRoutes(http as any, {
  onSubscriptionCreated: async (ctx: any, event: any) => {
    // Handle new subscription - could trigger welcome email, etc.
  },
  onSubscriptionUpdated: async (ctx: any, event: any) => {
    // Handle cancellation, renewal, etc.
  },
});

// ============================================
// POLAR CUSTOM WEBHOOK FOR ONE-TIME PAYMENTS
// ============================================

// Product ID to credits mapping (uses environment variables for production)
const STARTER_PACK_ID = process.env.POLAR_STARTER_PACK_ID || "";
const PRO_PACK_ID = process.env.POLAR_PRO_PACK_ID || "";

const PRODUCT_CREDITS: Record<string, number> = {
  ...(STARTER_PACK_ID && { [STARTER_PACK_ID]: 100 }),  // Starter Pack - 100 credits
  ...(PRO_PACK_ID && { [PRO_PACK_ID]: 500 }),          // Pro Pack - 500 credits
};

/**
 * Custom Polar webhook handler for one-time payments (order.paid)
 * The @convex-dev/polar library only handles subscriptions, not one-time purchases
 * POST /polar/order-webhook
 */
http.route({
  path: "/polar/order-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Handle checkout.created - payment initiated
      if (body.type === "checkout.created") {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle checkout.updated - payment completed
      if (body.type === "checkout.updated" && body.data?.status === "succeeded") {
        const checkout = body.data;
        const userId = checkout.metadata?.userId;

        // Try multiple paths to find productId - Polar's structure varies
        let productId = checkout.productId
          || checkout.product?.id
          || checkout.products?.[0]?.productId
          || checkout.products?.[0]?.id
          || checkout.product_id;

        if (!userId) {
          console.error("[Polar Order Webhook] No userId in metadata");
          return new Response(JSON.stringify({ error: "No userId in metadata" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Get credits for this product
        const credits = PRODUCT_CREDITS[productId];
        if (!credits) {
          return new Response(JSON.stringify({ received: true, message: "Unknown product or subscription" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Add credits to user
        await ctx.runMutation(internal.payments.addCredits, {
          userId: userId as any,
          credits,
          productId,
          orderId: checkout.id,
        });

        return new Response(JSON.stringify({ success: true, credits }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle order.paid event (alternative event type)
      // Use checkout_id for idempotency so it matches checkout.updated events
      if (body.type === "order.paid") {
        const order = body.data;
        const userId = order.metadata?.userId;
        const productId = order.productId || order.product?.id;
        // Use checkout_id as the idempotency key to match checkout.updated events
        const checkoutId = order.checkout_id;

        if (!userId) {
          console.error("[Polar Order Webhook] No userId in order metadata");
          return new Response(JSON.stringify({ error: "No userId in metadata" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const credits = PRODUCT_CREDITS[productId];
        if (!credits) {
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Use checkoutId for idempotency (not order.id) so it matches checkout.updated
        await ctx.runMutation(internal.payments.addCredits, {
          userId: userId as any,
          credits,
          productId,
          orderId: checkoutId || order.id,
        });

        return new Response(JSON.stringify({ success: true, credits }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Acknowledge other events
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("[Polar Order Webhook] Error:", e);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Modal webhook - receives video processing updates
 * POST /modal/webhook
 */
http.route({
  path: "/modal/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      const { 
        job_id, 
        video_id, 
        status, 
        progress, 
        frame_count,
        thumbnail_url,
        duration,
        error 
      } = body;
      
      // Find video by modal job ID or video ID
      let video = null;
      if (video_id) {
        video = await ctx.runQuery(api.videos.getById, { id: video_id });
      } else if (job_id) {
        video = await ctx.runQuery(api.videos.getByModalJobId, { modalJobId: job_id });
      }
      
      if (!video) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Update video status
      await ctx.runMutation(api.videos.updateStatus, {
        id: video._id,
        status: mapModalStatus(status),
        progress,
        frameCount: frame_count,
        thumbnailUrl: thumbnail_url,
        duration,
        errorMessage: error,
      });
      
      // Create notification if completed
      if (status === "completed" && video.userId) {
        await ctx.runMutation(api.notifications.create, {
          userId: video.userId,
          type: "video_complete",
          title: "Video Processing Complete",
          message: `Your video "${video.title || "Untitled"}" is ready with ${frame_count} frames.`,
          relatedId: video._id,
          relatedType: "video",
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("[Modal Webhook] Error:", e);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Modal frame webhook - receives individual frame data
 * POST /modal/frame
 */
http.route({
  path: "/modal/frame",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      
      const {
        video_id,
        frame_number,
        image_url,
        user_id,
      } = body;
      
      if (!video_id || !image_url) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Add frame to video
      const result = await ctx.runMutation(api.videos.addFrame, {
        videoId: video_id,
        frameNumber: frame_number ?? 0,
        imageUrl: image_url,
        userId: user_id,
      });
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("[Modal Frame Webhook] Error:", e);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Health check endpoint
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Helper to map Modal status to our status enum
// Maps to actual schema values: pending, downloading, processing, extracting_frames, analyzing, completed, pending_approval, failed
function mapModalStatus(modalStatus: string): "pending" | "downloading" | "processing" | "extracting_frames" | "analyzing" | "completed" | "pending_approval" | "failed" {
  const statusMap: Record<string, "pending" | "downloading" | "processing" | "extracting_frames" | "analyzing" | "completed" | "pending_approval" | "failed"> = {
    pending: "pending",
    downloading: "downloading",
    processing: "processing",
    extracting: "extracting_frames",
    analyzing: "analyzing",
    completed: "completed",
    pending_approval: "pending_approval",
    failed: "failed",
    error: "failed",
  };
  return statusMap[modalStatus] || "processing";
}

// ============================================
// SIMPLE BUILDER IMAGE GENERATION
// ============================================

/**
 * Generate image with Google Gemini
 * POST /generate/google
 */
http.route({
  path: "/generate/google",
  method: "POST",
  handler: generateWithGoogle,
});

/**
 * Generate image with Fal.ai
 * POST /generate/fal
 */
http.route({
  path: "/generate/fal",
  method: "POST",
  handler: generateWithFal,
});

/**
 * Test API key validity
 * POST /api-key/test
 */
http.route({
  path: "/api-key/test",
  method: "POST",
  handler: testApiKey,
});

export default http;

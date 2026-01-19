import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";
import { polar } from "./payments";
import { generateWithGoogle, generateWithFal, testApiKey } from "./imageGeneration";

/**
 * HTTP Endpoints
 * For external webhook integrations (Modal, Polar, etc.) and Auth
 */

const http = httpRouter();

// Convex Auth routes (OAuth callbacks, etc.)
auth.addHttpRoutes(http);

// Polar webhook routes (payment events)
// Endpoint: /polar/events
// Type cast needed due to @convex-dev/polar router type mismatch with httpRouter
polar.registerRoutes(http as any, {
  onSubscriptionCreated: async (ctx: any, event: any) => {
    console.log("[Polar] Subscription created:", event.data.id);
    // Handle new subscription - could trigger welcome email, etc.
  },
  onSubscriptionUpdated: async (ctx: any, event: any) => {
    console.log("[Polar] Subscription updated:", event.data.id, event.data.status);
    // Handle cancellation, renewal, etc.
    if (event.data.customerCancellationReason) {
      console.log("[Polar] Cancellation reason:", event.data.customerCancellationReason);
    }
  },
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
      
      console.log("[Modal Webhook] Received:", body);
      
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

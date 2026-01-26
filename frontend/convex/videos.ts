import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { rateLimiter } from "./rateLimits";

/**
 * Videos Module
 * Migrated from backend/services/video.js and APPLY_NOW.sql
 * 
 * Handles:
 * - Video processing job tracking
 * - Modal webhook integration
 * - Frame extraction status
 */

// ============================================
// QUERIES
// ============================================

/**
 * List user's videos
 * Migrated from: get_user_videos RPC
 */
export const list = query({
  args: {
    userId: v.optional(v.id("users")),
    includePublic: v.optional(v.boolean()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let videos: Doc<"videos">[];
    
    if (args.userId) {
      videos = await ctx.db
        .query("videos")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .collect();
    } else if (args.status) {
      videos = await ctx.db
        .query("videos")
        .withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "downloading" | "processing" | "extracting_frames" | "analyzing" | "completed" | "pending_approval" | "failed"))
        .order("desc")
        .collect();
    } else {
      videos = await ctx.db
        .query("videos")
        .order("desc")
        .collect();
    }
    
    // Filter by public if needed
    if (!args.userId && args.includePublic) {
      return videos.filter(v => v.isPublic);
    }
    
    return videos;
  },
});

/**
 * Get a single video by ID
 */
export const getById = query({
  args: { id: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get video by Modal job ID (for webhook lookup)
 */
export const getByModalJobId = query({
  args: { modalJobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videos")
      .withIndex("by_modal_job", (q) => q.eq("modalJobId", args.modalJobId))
      .first();
  },
});

/**
 * Get frames (images) extracted from a video
 */
export const getFrames = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("images")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .order("asc") // Order by creation time (frame order)
      .collect();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new video processing job
 */
export const create = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    qualityMode: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const videoId = await ctx.db.insert("videos", {
      url: args.url,
      title: args.title,
      qualityMode: (args.qualityMode ?? "medium") as "low" | "medium" | "high",
      userId: args.userId,
      isPublic: args.isPublic ?? true,
      status: "pending",
      frameCount: 0,
      progress: 0,
    });
    
    return { success: true, id: videoId };
  },
});

/**
 * Update video status (called by Modal webhook)
 */
export const updateStatus = mutation({
  args: {
    id: v.id("videos"),
    status: v.string(),
    progress: v.optional(v.number()),
    frameCount: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    modalJobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Check if the video still exists (may have been cancelled/deleted)
    const video = await ctx.db.get(id);
    if (!video) {
      // Video was deleted/cancelled - this is expected, not an error
      // Debug: [updateStatus] Video ${id} no longer exists (likely cancelled)`);
      return { success: false, cancelled: true, id };
    }

    // Filter out undefined values
    const cleanUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, cleanUpdates);
    return { success: true, id };
  },
});

/**
 * Set Modal job ID after submission
 */
export const setModalJobId = mutation({
  args: {
    id: v.id("videos"),
    modalJobId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { 
      modalJobId: args.modalJobId,
      status: "downloading",
    });
    return { success: true };
  },
});

/**
 * Add a frame (image) from video
 */
export const addFrame = mutation({
  args: {
    videoId: v.id("videos"),
    imageUrl: v.string(),
    frameNumber: v.number(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Get video to inherit properties
    const video = await ctx.db.get(args.videoId);
    
    const imageId = await ctx.db.insert("images", {
      imageUrl: args.imageUrl,
      videoId: args.videoId,
      frameNumber: args.frameNumber,
      userId: args.userId ?? video?.userId,
      isPublic: video?.isPublic ?? true,
      sourceType: "video_import",
      sourceVideoUrl: video?.url,
      status: "pending",
      likes: 0,
      dislikes: 0,
      isAnalyzed: false, // Will be set to true after AI analysis completes
    });
    
    // Update frame count
    if (video) {
      await ctx.db.patch(args.videoId, {
        frameCount: (video.frameCount ?? 0) + 1,
      });
    }
    
    return { success: true, imageId };
  },
});

/**
 * Delete a video and its frames
 */
export const remove = mutation({
  args: { id: v.id("videos") },
  handler: async (ctx, args) => {
    // Delete all frames (images) from this video
    const frames = await ctx.db
      .query("images")
      .withIndex("by_video", (q) => q.eq("videoId", args.id))
      .collect();
    
    for (const frame of frames) {
      // Remove from boards first
      const boardImages = await ctx.db
        .query("boardImages")
        .withIndex("by_image", (q) => q.eq("imageId", frame._id))
        .collect();
      
      for (const bi of boardImages) {
        await ctx.db.delete(bi._id);
      }
      
      await ctx.db.delete(frame._id);
    }
    
    // Delete the video
    await ctx.db.delete(args.id);
    
    return { success: true };
  },
});
/**
 * Approve multiple frames and save as images
 * This is called after frame selection to finalize the save with visibility/folder settings
 * Images are already created during analyze - this just updates them and handles credits
 */
export const approveFrames = mutation({
  args: {
    videoId: v.id("videos"),
    approvedUrls: v.array(v.string()),
    isPublic: v.optional(v.boolean()),
    folderId: v.optional(v.id("boards")),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    
    // Debug: [approveFrames] Starting. videoId:", args.videoId, "isPublic:", args.isPublic, "frameCount:", args.approvedUrls.length);
    
    if (!video) {
      throw new Error("Video not found.");
    }
    
    // Debug: [approveFrames] Video found. userId:", video.userId, "videoStatus:", video.status);
    
    // Check if video is already completed (prevent double-processing)
    if (video.status === "completed") {
      // Debug: [approveFrames] Video already completed, returning early");
      const existingImages = await ctx.db
        .query("images")
        .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
        .collect();
      return { 
        success: true, 
        approved_count: existingImages.length, 
        imageIds: existingImages.map(img => img._id),
        alreadyProcessed: true 
      };
    }
    
    // Get existing images created during analyze
    const existingImages = await ctx.db
      .query("images")
      .withIndex("by_video", (q) => q.eq("videoId", args.videoId))
      .collect();
    
    // Debug: [approveFrames] Existing images count:", existingImages.length);
    
    // Filter to only approved URLs
    const approvedImages = existingImages.filter(img => args.approvedUrls.includes(img.imageUrl));
    const approvedImageIds: string[] = approvedImages.map(img => img._id);
    
    // Debug: [approveFrames] Approved images count:", approvedImages.length);
    
    // Handle credits FIRST before any other operations
    const isPrivate = args.isPublic === false;
    const frameCount = approvedImages.length;
    
    // Debug: [approveFrames] video.userId:", video.userId, "isPrivate:", isPrivate, "frameCount:", frameCount);
    
    if (video.userId) {
      const user = await ctx.db.get(video.userId);
      // Debug: [approveFrames] user found:", !!user, "currentCredits:", user?.credits);
      if (user) {
        const currentCredits = user.credits ?? 0;
        
        if (isPrivate) {
          // Private: Deduct 1 credit per frame for AI analysis
          const creditCost = frameCount;
          if (currentCredits < creditCost) {
            throw new Error(`Insufficient credits. Need ${creditCost} credits but you have ${currentCredits}.`);
          }
          await ctx.db.patch(video.userId, {
            credits: currentCredits - creditCost,
          });
          // Debug: [approveFrames] Deducted", creditCost, "credits. New balance:", currentCredits - creditCost);
        } else if (frameCount > 0) {
          // Public: reward +1 credit per save (per request)
          await ctx.db.patch(video.userId, {
            credits: currentCredits + 1,
          });
          // Debug: [approveFrames] Added 1 credit. New balance:", currentCredits + 1);
        }
      }
    } else {
      // Debug: [approveFrames] No userId on video, skipping credit update");
    }

    // Update approved images with visibility and add to folder
    let position = 0;
    for (const image of approvedImages) {
      // Update visibility
      await ctx.db.patch(image._id, {
        isPublic: args.isPublic ?? true,
        status: "pending", // Mark as pending for AI analysis
      });

      // Add to folder if requested
      if (args.folderId) {
        // Check if already in folder
        const existingBoardImage = await ctx.db
          .query("boardImages")
          .withIndex("by_board", (q) => q.eq("boardId", args.folderId!))
          .filter((q) => q.eq(q.field("imageId"), image._id))
          .first();
        
        if (!existingBoardImage) {
          // Get max position
          const boardImages = await ctx.db
            .query("boardImages")
            .withIndex("by_board", (q) => q.eq("boardId", args.folderId!))
            .collect();
          const maxPos = Math.max(0, ...boardImages.map(bi => bi.position ?? 0));
          
          await ctx.db.insert("boardImages", {
            boardId: args.folderId,
            imageId: image._id,
            position: maxPos + 1 + position,
          });
          position++;
        }
      }
    }
    
    // Delete non-approved images (user deselected them)
    const nonApprovedImages = existingImages.filter(img => !args.approvedUrls.includes(img.imageUrl));
    for (const img of nonApprovedImages) {
      await ctx.db.delete(img._id);
    }
    // Debug: [approveFrames] Deleted", nonApprovedImages.length, "non-approved images");

    // Mark video as completed
    await ctx.db.patch(args.videoId, { status: "completed" });
    // Debug: [approveFrames] Video marked as completed");

    return { success: true, approved_count: approvedImages.length, imageIds: approvedImageIds };
  },
});

/**
 * Analyze approved frames in the background
 * This is called after approveFrames to trigger AI analysis
 * Processes images in parallel with concurrency limit to avoid timeout
 */
export const analyzeApprovedFrames = action({
  args: {
    imageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const CONCURRENCY_LIMIT = 5; // Process 5 images at a time for faster throughput
    const results: { imageId: string; success: boolean; error?: string }[] = [];
    
    // Helper to process a single image
    const processImage = async (imageId: string) => {
      try {
        const image = await ctx.runQuery(api.images.getById, { 
          id: imageId as any 
        });
        
        if (!image) {
          console.error(`Image ${imageId} not found`);
          return { imageId, success: false, error: "Image not found" };
        }
        
        if (!image.imageUrl) {
          console.error(`Image ${imageId} has no URL`);
          return { imageId, success: false, error: "Image has no URL" };
        }
        
        // Trigger analysis - don't await to allow parallel processing
        await ctx.runAction(api.ai.analyzeImage, { 
          imageId: imageId as any,
          imageUrl: image.imageUrl,
        });
        return { imageId, success: true };
      } catch (error: any) {
        console.error(`Failed to analyze image ${imageId}:`, error);
        return { imageId, success: false, error: error.message };
      }
    };
    
    // Process in batches with concurrency limit
    for (let i = 0; i < args.imageIds.length; i += CONCURRENCY_LIMIT) {
      const batch = args.imageIds.slice(i, i + CONCURRENCY_LIMIT);
      // Debug: [analyzeApprovedFrames] Processing batch ${Math.floor(i/CONCURRENCY_LIMIT) + 1}, images: ${batch.length}`);
      
      const batchResults = await Promise.all(batch.map(processImage));
      results.push(...batchResults);
    }
    
    // Debug: [analyzeApprovedFrames] Completed: ${results.filter(r => r.success).length}/${results.length} succeeded`);
    return { results };
  },
});


/**
 * Trigger video analysis via Modal
 */
export const analyze = action({
  args: {
    videoId: v.id("videos"),
    videoUrl: v.string(),
    qualityMode: v.optional(v.string()),
    userId: v.optional(v.string()), // For rate limiting
  },
  handler: async (ctx, args) => {
    const modalEndpoint = process.env.MODAL_VIDEO_ENDPOINT;
    if (!modalEndpoint) {
      throw new Error("MODAL_VIDEO_ENDPOINT is not configured");
    }

    // Rate limiting for video processing (expensive operation, 2/hour per user)
    if (args.userId) {
      const { ok, retryAfter } = await rateLimiter.limit(ctx, "videoProcessing", {
        key: args.userId,
        throws: false,
      });
      
      if (!ok) {
        const waitMinutes = Math.ceil((retryAfter || 3600000) / 60000);
        throw new Error(`Video processing rate limit exceeded. Please wait ${waitMinutes} minutes.`);
      }
    }

    // Update status to processing (also verifies video still exists)
    const statusResult = await ctx.runMutation(api.videos.updateStatus, {
      id: args.videoId,
      status: "processing",
      progress: 10,
    });

    // Check if video was cancelled before we started
    if (statusResult.cancelled) {
      // Debug: [analyze] Video ${args.videoId} was cancelled before analysis started`);
      return { status: "cancelled", message: "Video analysis was cancelled" };
    }

    // Call Modal endpoint
    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: args.videoUrl,
        video_id: args.videoId,
        quality_mode: args.qualityMode ?? "medium",
        job_id: `convex-${args.videoId}`,
        webhook_url: `${process.env.CONVEX_SITE_URL || "https://hidden-falcon-801.convex.cloud"}/modal/webhook`,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      // Try to update status to failed (video may have been cancelled)
      const failResult = await ctx.runMutation(api.videos.updateStatus, {
        id: args.videoId,
        status: "failed",
        errorMessage: `Modal error: ${response.status} ${text}`,
      });
      if (failResult.cancelled) {
        return { status: "cancelled", message: "Video analysis was cancelled" };
      }
      throw new Error(`Modal error: ${response.status} ${text}`);
    }

    const result = await response.json();

    // Check for errors in the result
    if (result.status === "failed" || result.errors?.length > 0) {
      const errorMsg = result.errors?.join(", ") || result.message || "Processing failed";
      const failResult = await ctx.runMutation(api.videos.updateStatus, {
        id: args.videoId,
        status: "failed",
        errorMessage: errorMsg,
      });
      if (failResult.cancelled) {
        return { status: "cancelled", message: "Video analysis was cancelled" };
      }
      throw new Error(errorMsg);
    }

    // Check if we got no frames
    if (!result.selected_frames || result.selected_frames.length === 0) {
      const errorMsg = "Unable to extract frames from this video. This can happen if the video is too short, has no distinct scenes, or is in an unsupported format. Try a longer video or a different source.";
      const failResult = await ctx.runMutation(api.videos.updateStatus, {
        id: args.videoId,
        status: "failed",
        errorMessage: errorMsg,
      });
      if (failResult.cancelled) {
        return { status: "cancelled", message: "Video analysis was cancelled" };
      }
      throw new Error(errorMsg);
    }

    // Process the result - Modal returns synchronously with frames
    if (result.status === "pending_approval" && result.selected_frames) {
      // Save each selected frame to the database
      let frameNumber = 0;
      for (const frame of result.selected_frames) {
        try {
          await ctx.runMutation(api.videos.addFrame, {
            videoId: args.videoId,
            imageUrl: frame.url,
            frameNumber: frameNumber++,
          });
        } catch (e: any) {
          // Video may have been cancelled during frame processing
          if (e.message?.includes("nonexistent document")) {
            // Debug: [analyze] Video ${args.videoId} was cancelled during frame processing`);
            return { status: "cancelled", message: "Video analysis was cancelled" };
          }
          throw e;
        }
      }

      // Update video status to pending_approval
      const finalResult = await ctx.runMutation(api.videos.updateStatus, {
        id: args.videoId,
        status: "pending_approval",
        frameCount: result.selected_frames.length,
        progress: 100,
        thumbnailUrl: result.selected_frames[0]?.url,
      });
      if (finalResult.cancelled) {
        return { status: "cancelled", message: "Video analysis was cancelled" };
      }
    }

    return result;
  },
});

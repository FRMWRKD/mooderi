import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
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
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
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
      qualityMode: (args.qualityMode ?? "medium") as any,
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
 */
export const approveFrames = mutation({
  args: {
    videoId: v.id("videos"),
    approvedUrls: v.array(v.string()),
    isPublic: v.optional(v.boolean()),
    folderId: v.optional(v.id("boards")),
  },
  handler: async (ctx, args) => {
    let approvedCount = 0;
    const video = await ctx.db.get(args.videoId);

    for (const url of args.approvedUrls) {
      // Create image record
      const imageId = await ctx.db.insert("images", {
        imageUrl: url,
        videoId: args.videoId,
        userId: video?.userId,
        isPublic: args.isPublic ?? true,
        sourceType: "video_import",
        sourceVideoUrl: video?.url,
        status: "completed", // Mark as completed so it shows up
        likes: 0,
        dislikes: 0,
        // We miss frameNumber, scene_start etc. because UI only passes URLs
        // In V2 we should pass full frame objects
      });

      // Add to folder if requested
      if (args.folderId) {
        // Get max position
        const boardImages = await ctx.db
          .query("boardImages")
          .withIndex("by_board", (q) => q.eq("boardId", args.folderId!))
          .collect();
        const maxPos = Math.max(0, ...boardImages.map(bi => bi.position ?? 0));
        
        await ctx.db.insert("boardImages", {
          boardId: args.folderId,
          imageId: imageId,
          position: maxPos + 1 + approvedCount,
        });
      }
      
      approvedCount++;
    }

    // Mark video as completed/approved
    await ctx.db.patch(args.videoId, { status: "completed" }); // or "approved"

    return { success: true, approved_count: approvedCount };
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

    // Call Modal endpoint
    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: args.videoUrl,
        video_id: args.videoId,
        quality_mode: args.qualityMode ?? "medium",
        job_id: `convex-${args.videoId}`,
        webhook_url: process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/modal/webhook` : "https://hidden-falcon-801.convex.cloud/modal/webhook",
      }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Modal error: ${response.status} ${text}`);
    }

    const result = await response.json();
    return result;
  },
});

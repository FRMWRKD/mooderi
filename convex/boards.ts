import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

/**
 * Boards Module
 * Migrated from backend/server.js and 002_boards.sql
 * 
 * Handles:
 * - User board/folder management
 * - Adding/removing images from boards
 * - Board visibility
 */

// ============================================
// QUERIES
// ============================================

/**
 * List user's boards with image counts
 * Migrated from: get_user_boards RPC
 */
export const list = query({
  args: {
    userId: v.optional(v.id("users")),
    includePublic: v.optional(v.boolean()),
    imageId: v.optional(v.id("images")),
  },
  handler: async (ctx, args) => {
    let boards: Doc<"boards">[] = [];
    
    if (args.userId) {
      boards = await ctx.db
        .query("boards")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .collect();
    } else if (args.includePublic) {
      boards = await ctx.db
        .query("boards")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .order("desc")
        .collect();
    } else {
      boards = [];
    }
    
    // Get image counts and check presence if imageId provided
    const boardsWithCounts = await Promise.all(
      boards.map(async (board) => {
        const imageCount = await ctx.db
          .query("boardImages")
          .withIndex("by_board", (q) => q.eq("boardId", board._id))
          .collect();
        
        let hasImage = false;
        if (args.imageId) {
           hasImage = !!imageCount.find(bi => bi.imageId === args.imageId);
           // optimization: could potential use a direct query if list is huge, 
           // but boardImages per board is likely small (<1000).
        }

        return {
          ...board,
          imageCount: imageCount.length,
          hasImage,
        };
      })
    );
    
    return boardsWithCounts;
  },
});

/**
 * Get a single board with its images
 * Migrated from: get_board_with_images RPC
 */
export const getWithImages = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    if (!board) return null;
    
    // Get all images in this board
    const boardImages = await ctx.db
      .query("boardImages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    
    // Sort by position
    boardImages.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    
    // Fetch full image data
    const images = await Promise.all(
      boardImages.map(async (bi) => {
        const image = await ctx.db.get(bi.imageId);
        return image ? { ...image, position: bi.position } : null;
      })
    );
    
    return {
      ...board,
      images: images.filter(Boolean),
    };
  },
});

/**
 * Get board by ID (without images)
 */
export const getById = query({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get subfolders of a board
 */
export const getSubfolders = query({
  args: { parentId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("boards")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new board
 * Migrated from: create_board RPC
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    parentId: v.optional(v.id("boards")),
    isPublic: v.optional(v.boolean()),
    colorTheme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      userId: args.userId,
      parentId: args.parentId,
      isPublic: args.isPublic ?? false,
      colorTheme: args.colorTheme ?? "#6366f1",
    });
    
    return { success: true, id: boardId, name: args.name };
  },
});

/**
 * Update a board
 * Migrated from: update_board RPC
 */
export const update = mutation({
  args: {
    id: v.id("boards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    colorTheme: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
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
 * Delete a board (cascades to board_images)
 * Migrated from: delete_board RPC
 */
export const remove = mutation({
  args: { id: v.id("boards") },
  handler: async (ctx, args) => {
    // Delete all board_images entries first
    const boardImages = await ctx.db
      .query("boardImages")
      .withIndex("by_board", (q) => q.eq("boardId", args.id))
      .collect();
    
    for (const bi of boardImages) {
      await ctx.db.delete(bi._id);
    }
    
    // Delete subfolders recursively
    const subfolders = await ctx.db
      .query("boards")
      .withIndex("by_parent", (q) => q.eq("parentId", args.id))
      .collect();
    
    for (const subfolder of subfolders) {
      // Recursively delete subfolder's board_images
      const subBoardImages = await ctx.db
        .query("boardImages")
        .withIndex("by_board", (q) => q.eq("boardId", subfolder._id))
        .collect();
      
      for (const bi of subBoardImages) {
        await ctx.db.delete(bi._id);
      }
      
      await ctx.db.delete(subfolder._id);
    }
    
    // Delete the board itself
    await ctx.db.delete(args.id);
    
    return { success: true, deleted: args.id };
  },
});

/**
 * Add an image to a board
 * Migrated from: add_image_to_board RPC
 */
export const addImage = mutation({
  args: {
    boardId: v.id("boards"),
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("boardImages")
      .withIndex("by_board_and_image", (q) =>
        q.eq("boardId", args.boardId).eq("imageId", args.imageId)
      )
      .first();
    
    if (existing) {
      return { success: true, alreadyExists: true };
    }
    
    // Get max position for this board
    const boardImages = await ctx.db
      .query("boardImages")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
    
    const maxPosition = Math.max(0, ...boardImages.map(bi => bi.position ?? 0));
    
    await ctx.db.insert("boardImages", {
      boardId: args.boardId,
      imageId: args.imageId,
      position: maxPosition + 1,
    });
    
    return { success: true, boardId: args.boardId, imageId: args.imageId };
  },
});

/**
 * Remove an image from a board
 * Migrated from: remove_image_from_board RPC
 */
export const removeImage = mutation({
  args: {
    boardId: v.id("boards"),
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("boardImages")
      .withIndex("by_board_and_image", (q) =>
        q.eq("boardId", args.boardId).eq("imageId", args.imageId)
      )
      .first();
    
    if (entry) {
      await ctx.db.delete(entry._id);
    }
    
    return { success: true, removed: true };
  },
});

/**
 * Reorder images in a board
 */
export const reorderImages = mutation({
  args: {
    boardId: v.id("boards"),
    imageIds: v.array(v.id("images")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.imageIds.length; i++) {
      const entry = await ctx.db
        .query("boardImages")
        .withIndex("by_board_and_image", (q) =>
          q.eq("boardId", args.boardId).eq("imageId", args.imageIds[i])
        )
        .first();
      
      if (entry) {
        await ctx.db.patch(entry._id, { position: i });
      }
    }
    
    return { success: true };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Notifications Module
 * Migrated from 005_notifications.sql
 */

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { notifications: [], unreadCount: 0 };
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) {
      return { notifications: [], unreadCount: 0 };
    }
    
    const limit = args.limit ?? 20;
    
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    
    const unreadCount = notifications.filter(n => !n.isRead).length;
    
    return {
      notifications,
      unreadCount,
    };
  },
});

export const markAsRead = mutation({
  args: {
    notificationId: v.optional(v.id("notifications")),
    markAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    
    if (!user) throw new Error("User not found");
    
    if (args.markAll) {
      const unread = await ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q) => 
          q.eq("userId", user._id).eq("isRead", false)
        )
        .collect();
      
      for (const n of unread) {
        await ctx.db.patch(n._id, { isRead: true });
      }
      
      return { success: true, count: unread.length };
    } else if (args.notificationId) {
      await ctx.db.patch(args.notificationId, { isRead: true });
      return { success: true, count: 1 };
    }
    
    return { success: false };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("video_complete"),
      v.literal("analysis_complete"),
      v.literal("credit_low"),
      v.literal("system")
    ),
    title: v.string(),
    message: v.string(),
    relatedId: v.optional(v.string()),
    relatedType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      isRead: false,
      relatedId: args.relatedId,
      relatedType: args.relatedType,
    });
  },
});

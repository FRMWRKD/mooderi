import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Resend Email Configuration
 * 
 * Email notifications for:
 * - Welcome emails
 * - Video processing complete
 * - Low credits warning
 * - Weekly digest
 */
export const resend = new Resend(components.resend, {
  // Start in test mode - change to false for production
  testMode: true,
});

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, name }) => {
    await resend.sendEmail(ctx, {
      from: "MoodBoard <hello@mooderi.com>",
      to: email,
      subject: "Welcome to MoodBoard! 🎨",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Welcome to MoodBoard, ${name}!</h1>
          <p>You've got <strong>100 free credits</strong> to get started.</p>
          <p>Here's what you can do:</p>
          <ul>
            <li>🎬 Extract frames from videos</li>
            <li>🖼️ Upload and analyze images</li>
            <li>✨ Generate AI prompts from your references</li>
            <li>📁 Organize with boards</li>
          </ul>
          <p>
            <a href="https://mooderi.com" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none;">
              Start Creating
            </a>
          </p>
        </div>
      `,
    });
  },
});

/**
 * Send video processing complete notification
 */
export const sendVideoCompleteEmail = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    videoTitle: v.string(),
    frameCount: v.number(),
  },
  handler: async (ctx, { email, name, videoTitle, frameCount }) => {
    await resend.sendEmail(ctx, {
      from: "MoodBoard <notifications@mooderi.com>",
      to: email,
      subject: `Your video "${videoTitle}" is ready! 🎬`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Video Processing Complete!</h1>
          <p>Hey ${name},</p>
          <p>Your video <strong>"${videoTitle}"</strong> has been processed with <strong>${frameCount} frames</strong> extracted.</p>
          <p>
            <a href="https://mooderi.com/videos" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none;">
              View Frames
            </a>
          </p>
        </div>
      `,
    });
  },
});

/**
 * Send low credits warning
 */
export const sendLowCreditsEmail = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    credits: v.number(),
  },
  handler: async (ctx, { email, name, credits }) => {
    await resend.sendEmail(ctx, {
      from: "MoodBoard <notifications@mooderi.com>",
      to: email,
      subject: "Running low on credits ⚡",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Low Credits Alert</h1>
          <p>Hey ${name},</p>
          <p>You have <strong>${credits} credits</strong> remaining.</p>
          <p>Top up to keep generating amazing prompts and processing videos.</p>
          <p>
            <a href="https://mooderi.com/pricing" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none;">
              Get More Credits
            </a>
          </p>
        </div>
      `,
    });
  },
});

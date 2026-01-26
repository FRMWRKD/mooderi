import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "./_generated/api";

/**
 * Action Retrier Configuration
 * 
 * Provides reliable retries for external service calls:
 * - Modal (video processing)
 * - Straico (AI prompts)
 * - Visionati (image analysis)
 */
export const retrier = new ActionRetrier(components.actionRetrier, {
  // Initial delay after failure: 5 seconds
  initialBackoffMs: 5000,
  // Exponential backoff base: 2x
  base: 2,
  // Maximum retry attempts: 4
  maxFailures: 4,
});

import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/**
 * Rate Limiter Configuration
 * 
 * Protects AI and API endpoints from abuse.
 * Uses token bucket algorithm for smooth rate limiting.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // AI Prompt Generation - 10 per minute, burst of 3
  promptGeneration: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 3,
  },
  
  // Image Analysis (Visionati/Straico) - 5 per minute
  imageAnalysis: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  
  // Video Processing - 2 per hour (expensive operation)
  videoProcessing: {
    kind: "fixed window",
    rate: 2,
    period: HOUR,
  },
  
  // Semantic Search - 30 per minute (relatively cheap)
  semanticSearch: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  
  // AI Chat Messages - 20 per minute
  chatMessage: {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  
  // API requests (general) - 100 per minute
  apiRequests: {
    kind: "fixed window",
    rate: 100,
    period: MINUTE,
  },
  
  // Failed login attempts - 10 per hour
  failedLogins: {
    kind: "token bucket",
    rate: 10,
    period: HOUR,
  },
  
  // Landing Page Prompt Generator - 1 per minute per IP
  landingPromptGenMinute: {
    kind: "fixed window",
    rate: 1,
    period: MINUTE,
  },
  
  // Landing Page Prompt Generator - 5 per hour per IP
  landingPromptGenHour: {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  // Landing Page Live Search - 30 per minute per IP
  landingLiveSearch: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
});

// Export helper for checking rate limits
export { MINUTE, HOUR };

import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import actionRetrier from "@convex-dev/action-retrier/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import polar from "@convex-dev/polar/convex.config.js";
import agent from "@convex-dev/agent/convex.config.js";
import rag from "@convex-dev/rag/convex.config.js";

/**
 * Convex Component Configuration
 * 
 * Components registered:
 * - rateLimiter: Protect AI and API calls from abuse
 * - actionRetrier: Reliable retries for external service calls
 * - resend: Email notifications
 * - polar: Payment processing
 * - agent: AI agents for prompt generation
 * - rag: Retrieval-Augmented Generation for semantic search
 * 
 * Note: Convex Auth (@convex-dev/auth) is configured separately in convex/auth.ts
 */
const app = defineApp();

app.use(rateLimiter);
app.use(actionRetrier);
app.use(resend);
app.use(polar);
app.use(agent);
app.use(rag);

export default app;

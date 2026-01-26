/**
 * Convex Auth Configuration
 * This configures the JWT token validation for Convex Auth
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!.replace(/^https?:\/\//, ""),
      applicationID: "convex",
    },
  ],
};

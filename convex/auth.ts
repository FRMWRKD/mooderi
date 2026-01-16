import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Convex Auth Configuration
 * Supports both Google OAuth and Email/Password authentication
 * 
 * Required environment variables (set via `npx convex env set`):
 * - AUTH_GOOGLE_ID: Google OAuth Client ID
 * - AUTH_GOOGLE_SECRET: Google OAuth Client Secret
 * - SITE_URL: Your frontend URL (e.g., http://localhost:3005)
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password({
      // Store additional user info on signup
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string) || (params.email as string).split('@')[0],
        };
      },
    }),
  ],
});

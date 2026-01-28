"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

/**
 * Convex Client Provider with Auth
 * Wraps the app with Convex context and authentication
 */

// Get the Convex URL - required for the app to function
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

// Create client instance (singleton)
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    // During build/SSR without URL, just render children
    if (!convex) {
        return <>{children}</>;
    }

    return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}

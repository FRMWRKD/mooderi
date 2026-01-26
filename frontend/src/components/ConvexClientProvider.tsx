"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

/**
 * Convex Client Provider with Auth
 * Wraps the app with Convex context and authentication
 */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

// Create the client lazily to avoid issues during static generation
let convexClient: ConvexReactClient | null = null;

function getConvexClient() {
    if (!convexClient && convexUrl) {
        convexClient = new ConvexReactClient(convexUrl);
    }
    return convexClient;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    const client = useMemo(() => getConvexClient(), []);

    if (!client) {
        // During static generation or if env var is missing, render children without Convex
        // This allows the build to complete; the client will work at runtime
        return <>{children}</>;
    }

    return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}

"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

/**
 * Convex Client Provider with Auth
 * Wraps the app with Convex context and authentication
 */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Create the client lazily to avoid issues during static generation
let convexClient: ConvexReactClient | null = null;

function getConvexClient() {
    if (!convexUrl) {
        return null;
    }
    if (!convexClient) {
        convexClient = new ConvexReactClient(convexUrl);
    }
    return convexClient;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    const client = useMemo(() => getConvexClient(), []);

    // In the browser, we MUST have the Convex URL configured
    if (typeof window !== "undefined" && !client) {
        throw new Error(
            "NEXT_PUBLIC_CONVEX_URL is not configured. " +
            "Please add this environment variable to your Vercel project settings: " +
            "https://vercel.com/docs/environment-variables"
        );
    }

    // During SSR/build without the URL, render children (build will succeed, runtime will fail clearly)
    if (!client) {
        return <>{children}</>;
    }

    return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}

"use client";

import { createContext, useContext, useEffect, ReactNode, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

interface User {
    id: string;
    _id: Id<"users">;
    email?: string;
    name: string;
    avatarUrl?: string;
    credits?: number;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderInner({ children }: { children: ReactNode }) {
    const { isLoading, isAuthenticated } = useConvexAuth();
    const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();

    // Get current user from Convex
    const currentUser = useQuery(api.users.getCurrent);

    // Store/sync user profile info
    const storeUser = useMutation(api.users.store);
    // Initialize user credits if needed (only once per session)
    const initializeUser = useMutation(api.users.initializeNewUser);
    const initializationAttempted = useRef(false);
    const storeAttempted = useRef(false);
    const previousAuthState = useRef(isAuthenticated);

    // Reset refs when auth state changes (logout -> login)
    useEffect(() => {
        if (previousAuthState.current !== isAuthenticated) {
            previousAuthState.current = isAuthenticated;
            if (isAuthenticated) {
                // User just logged in - reset the refs
                initializationAttempted.current = false;
                storeAttempted.current = false;
            }
        }
    }, [isAuthenticated]);

    // Sync user profile info after login
    useEffect(() => {
        if (isAuthenticated && currentUser && !storeAttempted.current) {
            storeAttempted.current = true;
            storeUser().catch(console.error);
        }
    }, [isAuthenticated, currentUser, storeUser]);

    useEffect(() => {
        // Only attempt initialization once when user is authenticated but has no credits set
        if (isAuthenticated && currentUser && currentUser.credits === undefined && !initializationAttempted.current) {
            initializationAttempted.current = true;
            initializeUser({ userId: currentUser._id }).catch(console.error);
        }
    }, [isAuthenticated, currentUser, initializeUser]);

    // Map Convex user to our User type
    const user: User | null = currentUser ? {
        id: currentUser.tokenIdentifier || currentUser._id,
        _id: currentUser._id,
        email: currentUser.email,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        credits: currentUser.credits,
    } : null;

    const signIn = async (email: string, password: string) => {
        try {
            await convexSignIn("password", { email, password, flow: "signIn" });
            return { error: null };
        } catch (e: any) {
            return { error: e.message || "Invalid email or password" };
        }
    };

    const signUp = async (email: string, password: string, name?: string) => {
        try {
            await convexSignIn("password", { email, password, flow: "signUp", ...(name ? { name } : {}) });
            return { error: null };
        } catch (e: any) {
            return { error: e.message || "Failed to create account" };
        }
    };

    const signOut = async () => {
        await convexSignOut();
    };

    const signInWithGoogle = async () => {
        await convexSignIn("google");
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated,
                signIn,
                signUp,
                signOut,
                signInWithGoogle,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
    return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

// Protected route wrapper
export function RequireAuth({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-void">
                <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        // Redirect to login
        if (typeof window !== "undefined") {
            window.location.href = "/login";
        }
        return null;
    }

    return <>{children}</>;
}

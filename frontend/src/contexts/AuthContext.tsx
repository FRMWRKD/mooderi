"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
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

    // Store user mutation (called after OAuth)
    const storeUser = useMutation(api.users.store);

    // Sync user to database after authentication
    useEffect(() => {
        if (isAuthenticated && currentUser === null) {
            // User is authenticated but not in database yet, store them
            storeUser({}).catch(console.error);
        }
    }, [isAuthenticated, currentUser, storeUser]);

    // Map Convex user to our User type
    const user: User | null = currentUser ? {
        id: currentUser.tokenIdentifier,
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

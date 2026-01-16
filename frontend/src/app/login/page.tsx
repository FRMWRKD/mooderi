"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Mail, Lock, User } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const { signIn, signUp, signInWithGoogle, user, isLoading: authLoading } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);

    // Form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    // Redirect if already logged in
    if (user) {
        router.push("/");
        return null;
    }

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signInWithGoogle();
        } catch (e) {
            setError("Failed to sign in with Google. Please try again.");
            setIsLoading(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const result = await signUp(email, password, name);
                if (result.error) {
                    setError(result.error);
                    setIsLoading(false);
                }
            } else {
                const result = await signIn(email, password);
                if (result.error) {
                    setError(result.error);
                    setIsLoading(false);
                }
            }
        } catch (e: any) {
            setError(e.message || "An error occurred");
            setIsLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="fixed inset-0 bg-black text-white flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black text-white font-sans flex items-center justify-center">
            {/* Outer border frame */}
            <div className="absolute inset-8 md:inset-16 border-2 border-white" />

            {/* Content */}
            <div className="relative z-10 w-full max-w-md px-8">
                {/* Logo */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-3">MOODERI</h1>
                    <p className="text-xs md:text-sm font-mono uppercase tracking-widest text-white/60">
                        {isSignUp ? "Create your account" : "Sign in to continue"}
                    </p>
                </div>

                {/* Form */}
                <div className="space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 border border-red-500/50 bg-red-500/10 text-sm font-mono text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        {isSignUp && (
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                <input
                                    type="text"
                                    placeholder="Name (optional)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-transparent border-2 border-white/30 focus:border-white outline-none transition-colors text-sm font-mono placeholder:text-white/30"
                                />
                            </div>
                        )}

                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-12 pl-12 pr-4 bg-transparent border-2 border-white/30 focus:border-white outline-none transition-colors text-sm font-mono placeholder:text-white/30"
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                className="w-full h-12 pl-12 pr-4 bg-transparent border-2 border-white/30 focus:border-white outline-none transition-colors text-sm font-mono placeholder:text-white/30"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-white text-black font-medium uppercase tracking-wider text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isSignUp ? "Create Account" : "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Toggle Sign Up / Sign In */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        className="w-full text-center text-xs font-mono text-white/60 hover:text-white transition-colors"
                    >
                        {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/20" />
                        <span className="text-xs font-mono text-white/40 uppercase">or</span>
                        <div className="flex-1 h-px bg-white/20" />
                    </div>

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full h-12 border-2 border-white hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-3 font-medium uppercase tracking-wider text-sm disabled:opacity-50"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>

                    {/* Info */}
                    <p className="text-center text-xs font-mono text-white/40">
                        By signing in, you agree to our Terms of Service
                    </p>
                </div>

                {/* Back to home */}
                <p className="text-center text-xs font-mono text-white/40 mt-12 uppercase tracking-widest">
                    <Link href="/" className="hover:text-white/60 transition-colors">
                        ← Back to Gallery
                    </Link>
                </p>
            </div>
        </div>
    );
}

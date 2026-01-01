"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const { signIn, signUp, signInWithGoogle, user } = useAuth();

    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    // Redirect if already logged in
    if (user) {
        router.push("/");
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsLoading(true);

        if (isSignUp) {
            const result = await signUp(email, password, name);
            if (result.error) {
                setError(result.error);
            } else {
                setSuccess("Check your email to confirm your account!");
            }
        } else {
            const result = await signIn(email, password);
            if (result.error) {
                setError(result.error);
            } else {
                router.push("/");
            }
        }

        setIsLoading(false);
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        await signInWithGoogle();
    };

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
                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full h-12 border-2 border-white hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-3 font-medium uppercase tracking-wider text-sm disabled:opacity-50"
                    >
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
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-white/30" />
                        <span className="text-xs font-mono uppercase tracking-widest text-white/40">or</span>
                        <div className="flex-1 h-px bg-white/30" />
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="p-3 border border-white/50 bg-white/5 text-sm font-mono">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 border border-white/50 bg-white/5 text-sm font-mono text-white/80">
                            {success}
                        </div>
                    )}

                    {/* Email Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div>
                                <label className="block text-xs font-mono uppercase tracking-widest text-white/60 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full h-12 px-4 bg-transparent border-2 border-white/50 focus:border-white outline-none transition-colors placeholder:text-white/30"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-mono uppercase tracking-widest text-white/60 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-12 px-4 bg-transparent border-2 border-white/50 focus:border-white outline-none transition-colors placeholder:text-white/30"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-mono uppercase tracking-widest text-white/60 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 px-4 bg-transparent border-2 border-white/50 focus:border-white outline-none transition-colors placeholder:text-white/30"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-white text-black font-bold uppercase tracking-wider text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {isSignUp ? "Creating..." : "Signing in..."}
                                </>
                            ) : (
                                isSignUp ? "Create Account" : "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Toggle Sign Up / Sign In */}
                    <p className="text-center text-sm font-mono text-white/60">
                        {isSignUp ? (
                            <>
                                Already have an account?{" "}
                                <button
                                    onClick={() => setIsSignUp(false)}
                                    className="text-white underline underline-offset-4 hover:text-white/80"
                                >
                                    Sign in
                                </button>
                            </>
                        ) : (
                            <>
                                Don&apos;t have an account?{" "}
                                <button
                                    onClick={() => setIsSignUp(true)}
                                    className="text-white underline underline-offset-4 hover:text-white/80"
                                >
                                    Sign up
                                </button>
                            </>
                        )}
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

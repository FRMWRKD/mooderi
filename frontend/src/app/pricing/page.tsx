"use client";

import { useQuery, useAction } from "convex/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { api } from "../../../../convex/_generated/api";
import { Check, Sparkles, Zap, Crown, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";

// Polar Product UUIDs (from polar.sh dashboard)
// These are loaded from environment variables for production
const POLAR_PRODUCT_IDS = {
    starterPack: process.env.NEXT_PUBLIC_POLAR_STARTER_PACK_ID || "",
    proPack: process.env.NEXT_PUBLIC_POLAR_PRO_PACK_ID || "",
    unlimitedMonthly: process.env.NEXT_PUBLIC_POLAR_UNLIMITED_MONTHLY_ID || "",
} as const;

// Credit packages with features
const PACKAGES = [
    {
        key: "starterPack" as const,
        productId: POLAR_PRODUCT_IDS.starterPack,
        name: "Starter Pack",
        price: "$5",
        priceNote: "one-time",
        credits: "100",
        popular: false,
        features: [
            "100 AI prompt generations",
            "~10 video analyses",
            "Never expires",
            "Basic support",
        ],
        icon: Zap,
    },
    {
        key: "proPack" as const,
        productId: POLAR_PRODUCT_IDS.proPack,
        name: "Pro Pack",
        price: "$20",
        priceNote: "one-time",
        credits: "500",
        popular: true,
        features: [
            "500 AI prompt generations",
            "~50 video analyses",
            "Never expires",
            "Priority support",
            "Best value: 5x credits for 4x price",
        ],
        icon: Sparkles,
    },
    {
        key: "unlimitedMonthly" as const,
        productId: POLAR_PRODUCT_IDS.unlimitedMonthly,
        name: "Unlimited",
        price: "$15",
        priceNote: "/month",
        credits: "∞",
        popular: false,
        features: [
            "Unlimited prompt generations",
            "Unlimited video analyses",
            "Priority processing queue",
            "Premium support",
            "Cancel anytime",
        ],
        icon: Crown,
    },
];

// Custom checkout button component with embedded modal support
function CheckoutButton({
    productId,
    isSubscription,
    popular,
    children
}: {
    productId: string;
    isSubscription: boolean;
    popular: boolean;
    children: React.ReactNode;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const checkoutRef = useRef<any>(null);
    const createCheckout = useAction(api.payments.createCheckoutUrl);

    // Cleanup checkout instance on unmount
    useEffect(() => {
        return () => {
            if (checkoutRef.current) {
                try {
                    checkoutRef.current.close();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, []);

    const handleCheckout = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsLoading(true);
        setError(null);

        try {
            console.log("[Checkout] Starting embedded checkout for product:", productId);

            // Get the current origin for embedded checkout
            const embedOrigin = window.location.origin;

            const result = await createCheckout({
                productId,
                successUrl: `${embedOrigin}/pricing?success=true`,
                embedOrigin,
            });

            console.log("[Checkout] Result:", result);

            if (result?.checkoutUrl && result.checkoutUrl.startsWith('http')) {
                console.log("[Checkout] Opening embedded checkout:", result.checkoutUrl);

                // Create embedded checkout modal
                const checkout = await PolarEmbedCheckout.create(result.checkoutUrl, { theme: 'dark' });
                checkoutRef.current = checkout;

                // Listen for checkout events
                checkout.addEventListener('success', () => {
                    console.log("[Checkout] Payment successful!");
                    // Wait for webhook to process before redirecting
                    setTimeout(() => {
                        window.location.href = `${embedOrigin}/pricing?success=true`;
                    }, 2000);
                });

                checkout.addEventListener('close', () => {
                    console.log("[Checkout] Checkout closed");
                    checkoutRef.current = null;
                    setIsLoading(false);
                });

                checkout.addEventListener('confirmed', () => {
                    console.log("[Checkout] Payment confirmed, processing...");
                });

            } else {
                console.error("[Checkout] Invalid checkout URL:", result?.checkoutUrl);
                setError("Failed to create checkout - invalid URL returned");
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error("[Checkout] Error:", err);
            setError(err.message || "Failed to create checkout");
            setIsLoading(false);
        }
    };

    return (
        <div>
            <button
                type="button"
                onClick={handleCheckout}
                disabled={isLoading}
                className={`block w-full py-3 text-center font-bold uppercase tracking-wider text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${popular
                    ? "bg-white text-black hover:bg-white/90"
                    : "border-2 border-white hover:bg-white hover:text-black"
                }`}
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                    </span>
                ) : (
                    children
                )}
            </button>
            {error && (
                <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
            )}
        </div>
    );
}

export default function PricingPage() {
    const { user, isLoading: authLoading } = useAuth();
    const creditBalance = useQuery(api.payments.getCreditBalance);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);

    // Update displayed balance when creditBalance changes
    useEffect(() => {
        if (creditBalance !== undefined && creditBalance !== null) {
            setDisplayedBalance(creditBalance);
            if (isRefreshing && creditBalance > 0) {
                setIsRefreshing(false);
            }
        }
    }, [creditBalance, isRefreshing]);

    // Check for success query parameter
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setShowSuccess(true);
            setIsRefreshing(true);
            // Remove the query parameter from URL
            window.history.replaceState({}, '', '/pricing');
            // Hide the success message after 5 seconds
            setTimeout(() => setShowSuccess(false), 5000);
            // Stop refreshing indicator after 10 seconds max
            setTimeout(() => setIsRefreshing(false), 10000);
        }
    }, []);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Success Banner */}
            {showSuccess && (
                <div className="fixed top-16 left-0 right-0 z-40 bg-green-600 text-white py-3 px-6 text-center">
                    <p className="font-bold flex items-center justify-center gap-2">
                        {isRefreshing && <Loader2 className="w-4 h-4 animate-spin" />}
                        Payment successful! {isRefreshing ? "Credits are being added..." : "Your credits have been added."}
                    </p>
                </div>
            )}

            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-mono uppercase tracking-wider">Back to Gallery</span>
                    </Link>

                    {user && (
                        <div className="text-sm font-mono">
                            <span className="text-white/60">Balance:</span>{" "}
                            {isRefreshing ? (
                                <span className="text-yellow-400 font-bold flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Updating...
                                </span>
                            ) : (
                                <span className="text-white font-bold">{displayedBalance ?? creditBalance ?? 0} credits</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`pt-24 pb-16 px-6 ${showSuccess ? 'mt-12' : ''}`}>
                <div className="max-w-6xl mx-auto">
                    {/* Title */}
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                            Get More Credits
                        </h1>
                        <p className="text-lg text-white/60 max-w-2xl mx-auto">
                            Power your creative workflow with AI-generated prompts and video analysis.
                            Choose the plan that fits your needs.
                        </p>
                    </div>

                    {/* Pricing Cards */}
                    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {PACKAGES.map((pkg) => {
                            const Icon = pkg.icon;

                            return (
                                <div
                                    key={pkg.key}
                                    className={`relative p-6 border-2 ${pkg.popular
                                        ? "border-white bg-white/5"
                                        : "border-white/20 hover:border-white/40"
                                        } transition-colors`}
                                >
                                    {/* Popular badge */}
                                    {pkg.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-black text-xs font-bold uppercase tracking-wider">
                                            Most Popular
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className="w-12 h-12 border border-white/30 flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6" />
                                    </div>

                                    {/* Name & Price */}
                                    <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-1">
                                        <span className="text-3xl font-black">{pkg.price}</span>
                                        <span className="text-white/60 text-sm">{pkg.priceNote}</span>
                                    </div>
                                    <div className="text-sm text-white/60 mb-6">
                                        {pkg.credits} credits
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-3 mb-8">
                                        {pkg.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm">
                                                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-white/80">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA Button */}
                                    {user ? (
                                        <CheckoutButton
                                            productId={pkg.productId}
                                            isSubscription={pkg.key === "unlimitedMonthly"}
                                            popular={pkg.popular}
                                        >
                                            {pkg.key === "unlimitedMonthly" ? "Subscribe Now" : "Purchase Credits"}
                                        </CheckoutButton>
                                    ) : (
                                        <Link
                                            href="/login"
                                            className={`block w-full py-3 text-center font-bold uppercase tracking-wider text-sm transition-colors ${pkg.popular
                                                ? "bg-white text-black hover:bg-white/90"
                                                : "border-2 border-white hover:bg-white hover:text-black"
                                                }`}
                                        >
                                            Sign In to Purchase
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* FAQ or Additional Info */}
                    <div className="mt-16 max-w-2xl mx-auto text-center">
                        <h2 className="text-xl font-bold mb-4">How Credits Work</h2>
                        <div className="text-sm text-white/60 space-y-2">
                            <p>• <strong>1 credit</strong> = Generate a detailed AI prompt from any image</p>
                            <p>• <strong>10 credits</strong> = Process a video and extract key frames</p>
                            <p>• Credits never expire (except unlimited subscription)</p>
                            <p>• New users get <strong>100 free credits</strong> to start</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

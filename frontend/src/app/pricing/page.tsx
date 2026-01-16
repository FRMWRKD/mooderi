"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { CheckoutLink } from "@convex-dev/polar/react";
import { Check, Sparkles, Zap, Crown, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Credit packages with features
const PACKAGES = [
    {
        key: "starterPack",
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
        key: "proPack",
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
        key: "unlimitedMonthly",
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

export default function PricingPage() {
    const { user, isLoading: authLoading } = useAuth();
    const creditBalance = useQuery(api.payments.getCreditBalance);
    // Products are configured in payments.ts CREDIT_PACKAGES

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-mono uppercase tracking-wider">Back to Gallery</span>
                    </Link>

                    {user && creditBalance !== undefined && (
                        <div className="text-sm font-mono">
                            <span className="text-white/60">Balance:</span>{" "}
                            <span className="text-white font-bold">{creditBalance} credits</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="pt-24 pb-16 px-6">
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
                                        <CheckoutLink
                                            product={pkg.key}
                                            className={`block w-full py-3 text-center font-bold uppercase tracking-wider text-sm transition-colors ${pkg.popular
                                                ? "bg-white text-black hover:bg-white/90"
                                                : "border-2 border-white hover:bg-white hover:text-black"
                                                }`}
                                        >
                                            {pkg.key === "unlimitedMonthly" ? "Subscribe Now" : "Purchase Credits"}
                                        </CheckoutLink>
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

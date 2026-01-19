"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import {
    X,
    Key,
    Check,
    AlertCircle,
    Loader2,
    Eye,
    EyeOff,
    ExternalLink,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ApiKeySettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ApiKeySettings({ isOpen, onClose }: ApiKeySettingsProps) {
    const [googleKey, setGoogleKey] = useState("");
    const [falKey, setFalKey] = useState("");
    const [showGoogleKey, setShowGoogleKey] = useState(false);
    const [showFalKey, setShowFalKey] = useState(false);
    const [isSaving, setIsSaving] = useState<"google" | "fal" | null>(null);
    const [isDeleting, setIsDeleting] = useState<"google" | "fal" | null>(null);
    const [isTesting, setIsTesting] = useState<"google" | "fal" | null>(null);
    const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);

    // Queries
    const apiKeyStatus = useQuery(api.userApiKeys.getApiKeyStatus, {});
    const maskedGoogleKey = useQuery(api.userApiKeys.getMaskedApiKey, { provider: "google" });
    const maskedFalKey = useQuery(api.userApiKeys.getMaskedApiKey, { provider: "fal" });

    // Mutations
    const saveApiKey = useMutation(api.userApiKeys.saveApiKey);
    const deleteApiKey = useMutation(api.userApiKeys.deleteApiKey);

    const handleSave = async (provider: "google" | "fal") => {
        const key = provider === "google" ? googleKey : falKey;
        if (!key.trim()) return;

        setIsSaving(provider);
        try {
            await saveApiKey({ provider, apiKey: key.trim() });
            // Clear input after save
            if (provider === "google") setGoogleKey("");
            else setFalKey("");
            setTestResult(null);
        } catch (error: any) {
            console.error("Failed to save API key:", error);
        } finally {
            setIsSaving(null);
        }
    };

    const handleDelete = async (provider: "google" | "fal") => {
        if (!confirm(`Are you sure you want to delete your ${provider === "google" ? "Google" : "Fal.ai"} API key?`)) {
            return;
        }

        setIsDeleting(provider);
        try {
            await deleteApiKey({ provider });
            setTestResult(null);
        } catch (error: any) {
            console.error("Failed to delete API key:", error);
        } finally {
            setIsDeleting(null);
        }
    };

    const handleTest = async (provider: "google" | "fal") => {
        const key = provider === "google" ? googleKey : falKey;
        const existingKey = provider === "google" ? maskedGoogleKey : maskedFalKey;

        // Use existing key if no new key entered
        if (!key.trim() && !existingKey) {
            setTestResult({ provider, success: false, message: "Please enter an API key first" });
            return;
        }

        setIsTesting(provider);
        setTestResult(null);

        try {
            const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site") || "";

            const response = await fetch(`${convexUrl}/api-key/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    apiKey: key.trim() || "use-stored", // Server will use stored key if this is the value
                }),
                credentials: "include",
            });

            const data = await response.json();
            setTestResult({ provider, success: data.isValid, message: data.message });
        } catch (error: any) {
            setTestResult({ provider, success: false, message: error.message });
        } finally {
            setIsTesting(null);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Key className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">API Keys</h2>
                                <p className="text-sm text-white/50">Configure your image generation keys</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-white/70" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Google API Key */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-white">Google Gemini API Key</label>
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                >
                                    Get API Key <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {maskedGoogleKey ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-green-400 font-mono">
                                                {maskedGoogleKey.masked}
                                            </span>
                                            <Check className="w-4 h-4 text-green-500" />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete("google")}
                                        disabled={isDeleting === "google"}
                                        className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-colors"
                                    >
                                        {isDeleting === "google" ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showGoogleKey ? "text" : "password"}
                                            value={googleKey}
                                            onChange={(e) => setGoogleKey(e.target.value)}
                                            placeholder="AIza..."
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 pr-10"
                                        />
                                        <button
                                            onClick={() => setShowGoogleKey(!showGoogleKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                                        >
                                            {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <Button
                                        onClick={() => handleSave("google")}
                                        disabled={!googleKey.trim() || isSaving === "google"}
                                        size="sm"
                                    >
                                        {isSaving === "google" ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>
                                </div>
                            )}

                            <p className="text-xs text-white/40">
                                Uses Google Gemini for high-quality image generation. Free tier available.
                            </p>
                        </div>

                        {/* Fal.ai API Key */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-white">Fal.ai API Key</label>
                                <a
                                    href="https://fal.ai/dashboard/keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                >
                                    Get API Key <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {maskedFalKey ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-green-400 font-mono">
                                                {maskedFalKey.masked}
                                            </span>
                                            <Check className="w-4 h-4 text-green-500" />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete("fal")}
                                        disabled={isDeleting === "fal"}
                                        className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-colors"
                                    >
                                        {isDeleting === "fal" ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showFalKey ? "text" : "password"}
                                            value={falKey}
                                            onChange={(e) => setFalKey(e.target.value)}
                                            placeholder="fal_..."
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 pr-10"
                                        />
                                        <button
                                            onClick={() => setShowFalKey(!showFalKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                                        >
                                            {showFalKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <Button
                                        onClick={() => handleSave("fal")}
                                        disabled={!falKey.trim() || isSaving === "fal"}
                                        size="sm"
                                    >
                                        {isSaving === "fal" ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>
                                </div>
                            )}

                            <p className="text-xs text-white/40">
                                Uses Fal.ai Flux models for fast generation. Pay-as-you-go pricing.
                            </p>
                        </div>

                        {/* Test Result */}
                        {testResult && (
                            <div className={`p-4 rounded-xl border ${testResult.success
                                    ? "bg-green-500/10 border-green-500/30"
                                    : "bg-red-500/10 border-red-500/30"
                                }`}>
                                <div className="flex items-center gap-2">
                                    {testResult.success ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                    )}
                                    <span className={`text-sm ${testResult.success ? "text-green-400" : "text-red-400"}`}>
                                        {testResult.message}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-sm font-semibold text-white mb-2">🔒 Security Note</h4>
                            <p className="text-xs text-white/50 leading-relaxed">
                                Your API keys are stored encrypted and only used server-side for image generation.
                                They are never exposed to other users or included in client-side code.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

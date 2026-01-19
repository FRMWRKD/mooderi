"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
    Copy,
    Check,
    Loader2,
    Sparkles,
    Settings,
    ChevronDown,
    X,
    Image as ImageIcon,
    Zap,
    Key,
    Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// TYPES
// ============================================

interface BuilderConfig {
    subject: string;
    environment: string;
    shotType?: string;
    lighting?: string;
    camera?: string;
    filmStock?: string;
    lens?: string;
    movieLook?: string;
    photographer?: string;
    aspectRatio?: string;
    filters: string[];
    customModifiers?: string;
}

interface Preset {
    _id: string;
    category: string;
    key: string;
    label: string;
    promptFragment: string;
    description?: string;
    icon?: string;
    sortOrder: number;
    isActive: boolean;
}

interface SimplePromptBuilderProps {
    onApiKeySettings?: () => void;
}

// ============================================
// PRESET SELECTOR COMPONENT
// ============================================

function PresetSelector({
    title,
    presets,
    selectedKey,
    onSelect,
    multi = false,
    selectedKeys = [],
    onMultiSelect,
}: {
    title: string;
    presets: Preset[];
    selectedKey?: string;
    onSelect?: (key: string | undefined) => void;
    multi?: boolean;
    selectedKeys?: string[];
    onMultiSelect?: (keys: string[]) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayPresets = isExpanded ? presets : presets.slice(0, 8);
    const hasMore = presets.length > 8;

    const handleClick = (preset: Preset) => {
        if (multi && onMultiSelect) {
            if (selectedKeys.includes(preset.key)) {
                onMultiSelect(selectedKeys.filter(k => k !== preset.key));
            } else {
                onMultiSelect([...selectedKeys, preset.key]);
            }
        } else if (onSelect) {
            onSelect(selectedKey === preset.key ? undefined : preset.key);
        }
    };

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                {title}
            </h3>
            <div className="flex flex-wrap gap-2">
                {displayPresets.map((preset) => {
                    const isSelected = multi
                        ? selectedKeys.includes(preset.key)
                        : selectedKey === preset.key;

                    return (
                        <button
                            key={preset._id}
                            onClick={() => handleClick(preset)}
                            className={`
                                px-3 py-2 rounded-lg text-sm font-medium transition-all
                                border flex items-center gap-2
                                ${isSelected
                                    ? "bg-purple-500/30 border-purple-500 text-white"
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                                }
                            `}
                            title={preset.description}
                        >
                            {preset.icon && <span>{preset.icon}</span>}
                            <span>{preset.label}</span>
                        </button>
                    );
                })}
            </div>
            {hasMore && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    {isExpanded ? "Show less" : `Show ${presets.length - 8} more`}
                </button>
            )}
        </div>
    );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SimplePromptBuilder({ onApiKeySettings }: SimplePromptBuilderProps) {
    const { user } = useAuth();

    // Fetch presets
    const presetsData = useQuery(api.simpleBuilder.getAllPresets, {});
    const apiKeyStatus = useQuery(api.userApiKeys.getApiKeyStatus, {});

    // Mutations
    const saveGeneration = useMutation(api.simpleBuilder.saveGeneration);

    // Builder state
    const [config, setConfig] = useState<BuilderConfig>({
        subject: "",
        environment: "",
        filters: [],
    });

    // UI state
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<"google" | "fal">("google");

    // Construct prompt from config
    const constructedPrompt = useMemo(() => {
        const parts: string[] = [];

        if (config.subject) parts.push(config.subject);
        if (config.environment) parts.push(config.environment);

        // Get preset fragments
        const getFragment = (category: string, key?: string) => {
            if (!key || !presetsData?.[category]) return null;
            const preset = presetsData[category].find((p: Preset) => p.key === key);
            return preset?.promptFragment || null;
        };

        const shotType = getFragment("shot_type", config.shotType);
        if (shotType) parts.push(shotType);

        const lighting = getFragment("lighting", config.lighting);
        if (lighting) parts.push(lighting);

        const camera = getFragment("camera", config.camera);
        if (camera) parts.push(camera);

        const filmStock = getFragment("film_stock", config.filmStock);
        if (filmStock) parts.push(filmStock);

        const lens = getFragment("lens", config.lens);
        if (lens) parts.push(lens);

        const movieLook = getFragment("movie_look", config.movieLook);
        if (movieLook) parts.push(movieLook);

        const photographer = getFragment("photographer", config.photographer);
        if (photographer) parts.push(photographer);

        // Filters (multiple)
        if (config.filters.length > 0 && presetsData?.filter) {
            config.filters.forEach((filterKey) => {
                const filter = presetsData.filter.find((p: Preset) => p.key === filterKey);
                if (filter) parts.push(filter.promptFragment);
            });
        }

        if (config.customModifiers) parts.push(config.customModifiers);

        const aspectRatio = getFragment("aspect_ratio", config.aspectRatio);
        if (aspectRatio) parts.push(aspectRatio);

        return parts.join(", ");
    }, [config, presetsData]);

    // Copy prompt
    const handleCopy = useCallback(() => {
        if (!constructedPrompt) return;
        navigator.clipboard.writeText(constructedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [constructedPrompt]);

    // Generate image
    const handleGenerate = async () => {
        if (!constructedPrompt || isGenerating) return;

        setIsGenerating(true);
        setGenerationError(null);
        setGeneratedImage(null);

        const startTime = Date.now();

        try {
            const endpoint = selectedProvider === "google"
                ? "/generate/google"
                : "/generate/fal";

            const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site") || "";

            const response = await fetch(`${convexUrl}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: constructedPrompt,
                    aspectRatio: config.aspectRatio || "1:1",
                }),
                credentials: "include",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate image");
            }

            if (data.image?.base64) {
                // Google returns base64
                setGeneratedImage(`data:${data.image.mimeType};base64,${data.image.base64}`);
            } else if (data.imageUrl) {
                // Fal returns URL
                setGeneratedImage(data.imageUrl);
            }

            // Save to database
            await saveGeneration({
                prompt: constructedPrompt,
                builderConfig: config,
                imageUrl: data.imageUrl || undefined,
                provider: selectedProvider,
                isPublic: true,
                generationTime: Date.now() - startTime,
            });

        } catch (error: any) {
            console.error("Generation error:", error);
            setGenerationError(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // Clear all
    const handleClear = () => {
        setConfig({
            subject: "",
            environment: "",
            filters: [],
        });
        setGeneratedImage(null);
        setGenerationError(null);
    };

    // Check if API keys are configured
    const googleStatus = apiKeyStatus?.google;
    const falStatus = apiKeyStatus?.fal;
    const hasGoogleKey = typeof googleStatus === 'object' ? googleStatus?.configured : !!googleStatus;
    const hasFalKey = typeof falStatus === 'object' ? falStatus?.configured : !!falStatus;
    const hasAnyKey = hasGoogleKey || hasFalKey;

    // Loading state
    if (!presetsData) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Wand2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Simple Prompt Builder</h2>
                        <p className="text-sm text-white/50">Click to construct your perfect prompt</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onApiKeySettings}
                        className={`p-2 rounded-lg transition-colors ${hasAnyKey
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-white/5 text-white/50 hover:bg-white/10"
                            }`}
                        title="API Key Settings"
                    >
                        <Key className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Builder Options */}
                <div className="space-y-6">
                    {/* Subject & Environment */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                                Subject / Action
                            </label>
                            <input
                                type="text"
                                value={config.subject}
                                onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                                placeholder="A woman in a red dress dancing..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                                Environment / Setting
                            </label>
                            <input
                                type="text"
                                value={config.environment}
                                onChange={(e) => setConfig({ ...config, environment: e.target.value })}
                                placeholder="In a moody jazz club at night..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                            />
                        </div>
                    </div>

                    {/* Preset Selectors */}
                    {presetsData.shot_type && (
                        <PresetSelector
                            title="Shot Type"
                            presets={presetsData.shot_type}
                            selectedKey={config.shotType}
                            onSelect={(key) => setConfig({ ...config, shotType: key })}
                        />
                    )}

                    {presetsData.lighting && (
                        <PresetSelector
                            title="Lighting"
                            presets={presetsData.lighting}
                            selectedKey={config.lighting}
                            onSelect={(key) => setConfig({ ...config, lighting: key })}
                        />
                    )}

                    {presetsData.camera && (
                        <PresetSelector
                            title="Camera Body"
                            presets={presetsData.camera}
                            selectedKey={config.camera}
                            onSelect={(key) => setConfig({ ...config, camera: key })}
                        />
                    )}

                    {presetsData.lens && (
                        <PresetSelector
                            title="Lens"
                            presets={presetsData.lens}
                            selectedKey={config.lens}
                            onSelect={(key) => setConfig({ ...config, lens: key })}
                        />
                    )}

                    {presetsData.film_stock && (
                        <PresetSelector
                            title="Film Stock"
                            presets={presetsData.film_stock}
                            selectedKey={config.filmStock}
                            onSelect={(key) => setConfig({ ...config, filmStock: key })}
                        />
                    )}

                    {presetsData.movie_look && (
                        <PresetSelector
                            title="Movie Look"
                            presets={presetsData.movie_look}
                            selectedKey={config.movieLook}
                            onSelect={(key) => setConfig({ ...config, movieLook: key })}
                        />
                    )}

                    {presetsData.photographer && (
                        <PresetSelector
                            title="Photographer Style"
                            presets={presetsData.photographer}
                            selectedKey={config.photographer}
                            onSelect={(key) => setConfig({ ...config, photographer: key })}
                        />
                    )}

                    {presetsData.filter && (
                        <PresetSelector
                            title="Filters (Multiple)"
                            presets={presetsData.filter}
                            multi
                            selectedKeys={config.filters}
                            onMultiSelect={(keys) => setConfig({ ...config, filters: keys })}
                        />
                    )}

                    {presetsData.aspect_ratio && (
                        <PresetSelector
                            title="Aspect Ratio"
                            presets={presetsData.aspect_ratio}
                            selectedKey={config.aspectRatio}
                            onSelect={(key) => setConfig({ ...config, aspectRatio: key })}
                        />
                    )}

                    {/* Custom Modifiers */}
                    <div>
                        <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                            Custom Modifiers
                        </label>
                        <input
                            type="text"
                            value={config.customModifiers || ""}
                            onChange={(e) => setConfig({ ...config, customModifiers: e.target.value })}
                            placeholder="Add any custom keywords..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                        />
                    </div>
                </div>

                {/* Right: Preview & Generated Image */}
                <div className="space-y-6">
                    {/* Prompt Preview */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                                Constructed Prompt
                            </h3>
                            <span className="text-xs text-white/30">
                                {constructedPrompt.length} characters
                            </span>
                        </div>
                        <div className="min-h-[100px] p-4 bg-white/5 rounded-xl">
                            {constructedPrompt ? (
                                <p className="text-white/80 leading-relaxed">{constructedPrompt}</p>
                            ) : (
                                <p className="text-white/30 italic">
                                    Start selecting options to build your prompt...
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button
                                onClick={handleCopy}
                                disabled={!constructedPrompt}
                                className="flex-1"
                                variant="secondary"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy Prompt
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleClear}
                                variant="ghost"
                                className="text-white/50"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Clear
                            </Button>
                        </div>
                    </div>

                    {/* Image Generation */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                Generate Image
                            </h3>
                            {user && (
                                <select
                                    value={selectedProvider}
                                    onChange={(e) => setSelectedProvider(e.target.value as "google" | "fal")}
                                    className="text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white"
                                    disabled={!hasAnyKey}
                                >
                                    <option value="google" disabled={!hasGoogleKey}>
                                        Google Gemini {!hasGoogleKey && "(No key)"}
                                    </option>
                                    <option value="fal" disabled={!hasFalKey}>
                                        Fal.ai {!hasFalKey && "(No key)"}
                                    </option>
                                </select>
                            )}
                        </div>

                        {!user ? (
                            <p className="text-sm text-white/50">
                                Sign in and add your API key to generate images directly.
                            </p>
                        ) : !hasAnyKey ? (
                            <div className="text-center py-4">
                                <p className="text-sm text-white/50 mb-3">
                                    Add your API key to generate images
                                </p>
                                <Button onClick={onApiKeySettings} variant="secondary" size="sm">
                                    <Key className="w-4 h-4 mr-2" />
                                    Add API Key
                                </Button>
                            </div>
                        ) : (
                            <Button
                                onClick={handleGenerate}
                                disabled={!constructedPrompt || isGenerating}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4 mr-2" />
                                        Generate Image
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Generated Image Display */}
                        {generatedImage && (
                            <div className="relative rounded-xl overflow-hidden border border-white/10">
                                <img
                                    src={generatedImage}
                                    alt="Generated"
                                    className="w-full h-auto"
                                />
                            </div>
                        )}

                        {/* Error Display */}
                        {generationError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-sm text-red-400">{generationError}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

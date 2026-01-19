"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
    Upload,
    Image as ImageIcon,
    Type,
    Loader2,
    Copy,
    Check,
    AlertCircle,
    Sparkles,
    Clock,
    X,
    ChevronDown,
    Palette
} from "lucide-react";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { useMutation } from "convex/react";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

// ============================================
// TYPES
// ============================================
interface RagResult {
    imageId: string;
    imageUrl: string;
    prompt: string | null;
    score: number;
    aestheticScore: number | null;
    isCurated: boolean;
    weight: number;
}

interface GeneratePromptResult {
    success: boolean;
    generatedPrompt: string;
    topMatch: RagResult | null;
    recommendations: RagResult[];
    visionatiAnalysis: {
        short_description?: string;
        mood?: string;
        lighting?: string;
        colors?: string[];
    } | null;
    categoryKey?: string;
    categoryName?: string;
    usedExamples?: Array<{ promptText: string; rating: number; source: string }>;
    error?: string;
    rateLimitInfo?: {
        minuteRemaining: number;
        hourRemaining: number;
        retryAfterSeconds?: number;
    };
}

interface PromptCategory {
    _id: string;
    key: string;
    name: string;
    description: string;
    icon?: string;
    sortOrder: number;
    isActive: boolean;
}

interface PromptGeneratorProps {
    userId?: string;
    mode?: "landing" | "app";
    displayMode?: "modal" | "inline";
    initialInputMode?: "text" | "image";
    onClose?: () => void;
    isOpen?: boolean; // Only relevant for modal mode
    onSaveToBoard?: (prompt: string, imageUrl?: string) => void;
    hideRecent?: boolean;
    initialPrompt?: string;
}

// ============================================
// HELPER: Generate client key from fingerprint
// ============================================
function getClientKey(): string {
    // Simple client fingerprint for rate limiting
    const fp = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset(),
    ].join("|");

    // Simple hash
    let hash = 0;
    for (let i = 0; i < fp.length; i++) {
        const char = fp.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `client_${Math.abs(hash).toString(36)}`;
}

// ============================================
// MAIN COMPONENT
// ============================================
export const PromptGenerator = ({
    userId,
    mode = "landing",
    displayMode = "modal",
    initialInputMode = "text",
    onClose = () => { },
    isOpen = true,
    onSaveToBoard,
    hideRecent = false,
    initialPrompt = ""
}: PromptGeneratorProps) => {
    // State
    const [inputMode, setInputMode] = useState<"text" | "image">(initialInputMode);
    const [promptText, setPromptText] = useState(initialPrompt);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<GeneratePromptResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editablePrompt, setEditablePrompt] = useState<string>("");
    const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);

    // Update state if initialPrompt changes
    useEffect(() => {
        if (initialPrompt) {
            setPromptText(initialPrompt);
            setInputMode("text"); // efficient switch to text mode
        }
    }, [initialPrompt]);

    // Fetch categories
    const categories = useQuery(api.promptCategories.listActive) as PromptCategory[] | undefined;

    // Close on escape (only for modal)
    useEffect(() => {
        if (displayMode !== "modal") return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose, displayMode]);

    if (displayMode === "modal" && !isOpen) return null;

    // Convex action (not mutation)
    const generatePrompt = useAction(api.promptGenerator.generatePrompt);
    const generateUploadUrl = useMutation(api.images.generateUploadUrl);

    // Progress polling
    const clientKey = mode === "landing" ? getClientKey() : `user_${userId || "anon"}`;
    const progress = useQuery(api.progressStore.getProgress, { clientKey });

    // Handle image selection
    const handleImageSelect = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Please select a valid image file");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("Image must be less than 10MB");
            return;
        }

        setImageFile(file);
        setError(null);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    // Handle drag and drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            handleImageSelect(file);
        }
    }, [handleImageSelect]);

    // Upload image to Convex Storage
    const uploadImage = async (file: File): Promise<Id<"_storage">> => {
        // 1. Get upload URL
        const postUrl = await generateUploadUrl();

        // 2. Upload file
        const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
        });

        if (!result.ok) {
            throw new Error(`Upload failed: ${result.statusText}`);
        }

        const { storageId } = await result.json();

        return storageId as Id<"_storage">;
    };

    // Handle generation
    const handleGenerate = async () => {
        if (inputMode === "text" && !promptText.trim()) {
            setError("Please enter a description");
            return;
        }

        if (inputMode === "image" && !imageFile) {
            setError("Please upload an image");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            let storageId: Id<"_storage"> | undefined;

            if (inputMode === "image" && imageFile) {
                // Upload image first
                storageId = await uploadImage(imageFile);
            }

            const response = await generatePrompt({
                text: inputMode === "text" ? promptText : undefined,
                storageId,
                categoryKey: selectedCategory || undefined,
                source: mode,
                clientKey: clientKey,
                userId: userId as any,
            });

            if (!response.success && response.rateLimitInfo?.retryAfterSeconds) {
                // Start countdown
                setRateLimitCountdown(response.rateLimitInfo.retryAfterSeconds);
                const interval = setInterval(() => {
                    setRateLimitCountdown(prev => {
                        if (prev === null || prev <= 1) {
                            clearInterval(interval);
                            return null;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }

            setResult(response);

            if (!response.success && response.error) {
                setError(response.error);
            }
        } catch (err: any) {
            setError(err.message || "Failed to generate prompt");
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate progress percentage based on step
    const getProgressInfo = () => {
        if (!progress) return { percent: 0, text: "Starting..." };

        switch (progress.step) {
            case "initializing": return { percent: 10, text: "Initializing..." };
            case "analyzing": return { percent: 30, text: "Analyzing image details..." };
            case "embedding": return { percent: 50, text: "Understanding concept..." };
            case "searching": return {
                percent: 70,
                text: progress.details || "Searching reference database..."
            };
            case "generating": return { percent: 90, text: "Crafting final prompt..." };
            case "complete": return { percent: 100, text: "Complete!" };
            default: return { percent: 0, text: "Processing..." };
        }
    };

    const progressInfo = getProgressInfo();

    // Copy prompt (uses edited version if modified)
    const handleCopy = () => {
        const promptToCopy = editablePrompt || result?.generatedPrompt;
        if (promptToCopy) {
            navigator.clipboard.writeText(promptToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // When result changes, update editable prompt
    useEffect(() => {
        if (result?.generatedPrompt) {
            setEditablePrompt(result.generatedPrompt);
        }
    }, [result?.generatedPrompt]);

    // Clear and reset
    const handleClear = () => {
        setResult(null);
        setPromptText("");
        setImageFile(null);
        setImagePreview(null);
        setError(null);
    };

    const content = (
        <div className={`w-full max-w-4xl mx-auto space-y-6 ${displayMode === 'modal' ? '' : 'py-8'}`}>
            {/* Header (Only for Modal) */}
            {displayMode === "modal" && (
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="text-lg font-bold tracking-widest uppercase">AI Prompt Generator</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
            {/* Mode Toggle */}
            <div className="flex items-center justify-center gap-2 p-1 bg-white/5 border border-white/10 w-fit mx-auto">
                <button
                    onClick={() => { setInputMode("text"); setResult(null); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-colors ${inputMode === "text"
                        ? "bg-white text-black"
                        : "text-white/60 hover:text-white"
                        }`}
                >
                    <Type className="w-4 h-4" />
                    Text Only
                </button>
                <button
                    onClick={() => { setInputMode("image"); setResult(null); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-colors ${inputMode === "image"
                        ? "bg-white text-black"
                        : "text-white/60 hover:text-white"
                        }`}
                >
                    <ImageIcon className="w-4 h-4" />
                    With Image
                </button>
            </div>

            {/* Category Selector */}
            {categories && categories.length > 0 && (
                <div className="relative" ref={categoryDropdownRef}>
                    <button
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className="flex items-center gap-2 px-4 py-2 mx-auto bg-white/5 border border-white/20 hover:border-white/40 transition-colors text-sm"
                    >
                        <Palette className="w-4 h-4 text-white/60" />
                        <span className="text-white/80">
                            {selectedCategory
                                ? categories.find(c => c.key === selectedCategory)?.icon + " " + categories.find(c => c.key === selectedCategory)?.name
                                : "All Styles (Auto-detect)"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showCategoryDropdown && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-black border border-white/30 shadow-xl z-50 max-h-80 overflow-y-auto">
                            <button
                                onClick={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
                                className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/10 ${!selectedCategory ? 'bg-white/10' : ''}`}
                            >
                                <span className="text-sm text-white">✨ Auto-detect from Image</span>
                                <p className="text-xs text-white/50 mt-0.5">AI detects style from your image</p>
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat._id}
                                    onClick={() => { setSelectedCategory(cat.key); setShowCategoryDropdown(false); }}
                                    className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 ${selectedCategory === cat.key ? 'bg-white/10' : ''}`}
                                >
                                    <span className="text-sm text-white">{cat.icon} {cat.name}</span>
                                    <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{cat.description}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Rate Limit Warning */}
            {mode === "landing" && (
                <div className="text-center text-xs text-white/40 flex items-center justify-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Free: 1 request/minute, 5 requests/hour</span>
                    <span className="text-white/20">|</span>
                    <a href="/login" className="text-white/60 hover:text-white underline">Sign in for unlimited</a>
                </div>
            )}

            {/* Input Section */}
            <AnimatePresence mode="wait">
                {!result && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        {inputMode === "text" ? (
                            <div className="relative">
                                <textarea
                                    value={promptText}
                                    onChange={(e) => setPromptText(e.target.value)}
                                    placeholder="Describe the image style you want to create... e.g., 'moody neon-lit alley at night with rain reflections'"
                                    className="w-full h-32 px-4 py-3 bg-black border-2 border-white text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/80"
                                    disabled={isLoading}
                                />
                            </div>
                        ) : (
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed ${imagePreview ? "border-white/50" : "border-white/30"
                                    } bg-white/5 hover:bg-white/10 transition-colors cursor-pointer ${imagePreview ? "p-4" : "p-12"
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                                    className="hidden"
                                />

                                {imagePreview ? (
                                    <div className="relative">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="max-h-64 mx-auto object-contain"
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setImageFile(null);
                                                setImagePreview(null);
                                            }}
                                            className="absolute top-2 right-2 p-1 bg-black/80 hover:bg-black border border-white/30 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Upload className="w-12 h-12 mx-auto mb-4 text-white/30" />
                                        <p className="text-white/60 text-sm uppercase tracking-widest mb-2">
                                            Drop image here or click to upload
                                        </p>
                                        <p className="text-white/30 text-xs">
                                            PNG, JPG, WebP • Max 10MB
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Optional text with image */}
                        {inputMode === "image" && imagePreview && (
                            <input
                                type="text"
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                placeholder="Optional: Add context or specific style directions..."
                                className="w-full px-4 py-3 bg-black border-2 border-white/50 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white"
                            />
                        )}



                        {/* Error Display */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/50 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                                {rateLimitCountdown && (
                                    <span className="ml-auto font-mono">{rateLimitCountdown}s</span>
                                )}
                            </div>
                        )}

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerate}
                            disabled={isLoading || rateLimitCountdown !== null}
                            className="w-full h-12 bg-white text-black hover:bg-white/90 text-sm uppercase tracking-widest font-bold flex items-center justify-center gap-2 rounded-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : rateLimitCountdown ? (
                                <>
                                    <Clock className="w-4 h-4" />
                                    Wait {rateLimitCountdown}s
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate Prompt
                                </>
                            )}
                        </Button>
                    </motion.div>
                )}

            </AnimatePresence>

            {/* Progress Display */}
            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full bg-black border-2 border-white p-8 text-center space-y-6"
                    >
                        <div className="relative w-24 h-24 mx-auto">
                            <svg className="w-full h-full -rotate-90">
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    className="text-white/10"
                                />
                                <motion.circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                    className="text-white"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: progressInfo.percent / 100 }}
                                    transition={{ duration: 0.5, ease: "easeInOut" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold">{progressInfo.percent}%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg uppercase tracking-widest font-bold">
                                {progressInfo.text}
                            </h3>
                            <p className="text-white/50 text-sm font-mono h-6">
                                {progress?.details}
                            </p>
                        </div>

                        {/* Similar Images Preview during search */}
                        {progress?.step === "searching" && progress.similarImagesFound ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="pt-4 border-t border-white/20"
                            >
                                <p className="text-xs uppercase tracking-widest text-white/50 mb-3">
                                    Found {progress.similarImagesFound} Similar References
                                </p>
                                <div className="flex justify-center gap-2">
                                    {progress.similarImages?.map((img) => (
                                        <motion.div
                                            key={img.imageId}
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-12 h-12 border border-white/30"
                                        >
                                            <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : null}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results Display */}
            <AnimatePresence mode="wait">
                {result?.success && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {/* Generated Prompt */}
                        <div className="border-2 border-white bg-black">
                            <div className="h-10 border-b-2 border-white flex items-center justify-between px-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] uppercase tracking-widest text-white/70">Generated Prompt</span>
                                    {result.categoryName && (
                                        <span className="px-2 py-0.5 bg-white/10 border border-white/20 text-[9px] uppercase tracking-wider text-white/80">
                                            {selectedCategory ? '🎯 ' : '✨ '}{result.categoryName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1 px-2 py-1 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
                                    >
                                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <textarea
                                    value={editablePrompt}
                                    onChange={(e) => setEditablePrompt(e.target.value)}
                                    className="w-full bg-transparent font-mono text-sm leading-relaxed border-0 resize-y min-h-[100px] focus:outline-none focus:ring-1 focus:ring-white/30"
                                    placeholder="Edit your prompt here..."
                                />
                            </div>

                            {/* Visionati Analysis (if image) */}
                            {result.visionatiAnalysis && (
                                <div className="border-t-2 border-white p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    {result.visionatiAnalysis.mood && (
                                        <div>
                                            <span className="text-white/50 uppercase tracking-widest">Mood</span>
                                            <p className="mt-1">{result.visionatiAnalysis.mood}</p>
                                        </div>
                                    )}
                                    {result.visionatiAnalysis.lighting && (
                                        <div>
                                            <span className="text-white/50 uppercase tracking-widest">Lighting</span>
                                            <p className="mt-1">{result.visionatiAnalysis.lighting}</p>
                                        </div>
                                    )}
                                    {result.visionatiAnalysis.colors && result.visionatiAnalysis.colors.length > 0 && (
                                        <div className="col-span-2">
                                            <span className="text-white/50 uppercase tracking-widest">Colors</span>
                                            <div className="flex gap-1 mt-1">
                                                {result.visionatiAnalysis.colors.slice(0, 5).map((color, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-6 h-6 border border-white/30"
                                                        style={{ backgroundColor: color }}
                                                        title={color}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Similar Images / Recommendations */}
                        {(result.topMatch || result.recommendations.length > 0) && (
                            <div className="border-2 border-white/50 bg-black">
                                <div className="h-10 border-b-2 border-white/50 flex items-center px-4">
                                    <span className="text-[10px] uppercase tracking-widest text-white/70">
                                        Similar Reference Images
                                    </span>
                                </div>
                                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {result.topMatch && (
                                        <div className="relative group">
                                            <div className="absolute -top-2 -left-2 bg-white text-black text-[10px] px-2 py-0.5 uppercase tracking-widest z-10">
                                                Top Match
                                            </div>
                                            <img
                                                src={result.topMatch.imageUrl}
                                                alt="Top match"
                                                className="w-full aspect-square object-cover border-2 border-white"
                                            />
                                            {result.topMatch.prompt && (
                                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex items-end">
                                                    <p className="text-[10px] line-clamp-3">{result.topMatch.prompt}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {result.recommendations.map((rec, i) => (
                                        <div key={rec.imageId} className="relative group">
                                            <img
                                                src={rec.imageUrl}
                                                alt={`Recommendation ${i + 1}`}
                                                className="w-full aspect-square object-cover border border-white/30"
                                            />
                                            {rec.prompt && (
                                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex items-end">
                                                    <p className="text-[10px] line-clamp-3">{rec.prompt}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}



                        {/* Actions */}
                        <div className="flex justify-center gap-4">
                            <Button
                                onClick={handleClear}
                                variant="ghost"
                                className="px-6 py-2 border-2 border-white text-white hover:bg-white hover:text-black text-sm uppercase tracking-widest rounded-none"
                            >
                                Generate Another
                            </Button>
                            {mode === "landing" && (
                                <a href="/login?action=signup">
                                    <Button className="px-6 py-2 bg-white text-black hover:bg-white/90 text-sm uppercase tracking-widest rounded-none">
                                        Sign Up for More
                                    </Button>
                                </a>
                            )}
                            {mode === "app" && onSaveToBoard && (
                                <Button
                                    onClick={() => onSaveToBoard(result.generatedPrompt, result.topMatch?.imageUrl)}
                                    className="px-6 py-2 bg-white text-black hover:bg-white/90 text-sm uppercase tracking-widest rounded-none"
                                >
                                    Save to Board
                                </Button>
                            )}
                        </div>
                    </motion.div >
                )}
            </AnimatePresence >
        </div >
    );

    if (displayMode === "inline") {
        return content;
    }

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 overflow-y-auto"
            >
                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="min-h-screen py-12 px-4"
                >
                    {content}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

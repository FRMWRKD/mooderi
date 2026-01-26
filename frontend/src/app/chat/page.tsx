"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { AppShell } from "@/components/layout";
import { RequireAuth, useAuth } from "@/contexts/AuthContext";
import { ImageCard, UploadModal } from "@/components/features";
import {
    Send,
    ImageIcon,
    Loader2,
    Sparkles,
    Copy,
    Check,
    Trash2,
    X,
    AlertCircle,
    Upload
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Id } from "@convex/_generated/dataModel";

// ============================================
// CHAT PAGE - AI Prompt Assistant
// ============================================

interface ChatMessage {
    _id: string;
    role: "user" | "assistant";
    content: string;
    imageIds?: Id<"images">[];
    promptType?: string;
    creditsUsed?: number;
    createdAt: number;
}

function ChatContent() {
    const { user } = useAuth();
    const userId = user?._id;

    // State
    const [inputText, setInputText] = useState("");
    const [selectedImages, setSelectedImages] = useState<Id<"images">[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showImagePicker, setShowImagePicker] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Convex data
    const chatHistory = useQuery(
        api.promptAgent.getChatHistory,
        userId ? { userId, limit: 50 } : "skip"
    );
    const userImages = useQuery(
        api.images.filter,
        userId ? { userId, onlyPublic: false, limit: 50 } : "skip"
    );
    const userCredits = user?.credits ?? 0;

    // Actions
    const generateSinglePrompt = useAction(api.promptAgent.generateImagePrompt);
    const generateMultiPrompt = useAction(api.promptAgent.generateMultiImagePrompt);
    const clearChatHistory = useMutation(api.promptAgent.clearChatHistory);
    const copyPromptMutation = useMutation(api.promptAgent.copyPromptFromChat);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // Handle image selection
    const toggleImageSelection = (imageId: Id<"images">) => {
        setSelectedImages(prev =>
            prev.includes(imageId)
                ? prev.filter(id => id !== imageId)
                : prev.length < 5
                    ? [...prev, imageId]
                    : prev
        );
    };

    // Generate prompt
    const handleGenerate = async () => {
        if (!userId) return;
        if (selectedImages.length === 0) {
            setError("Please select at least one image");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (selectedImages.length === 1) {
                await generateSinglePrompt({
                    userId,
                    imageId: selectedImages[0],
                    detailed: true,
                });
            } else {
                await generateMultiPrompt({
                    userId,
                    imageIds: selectedImages,
                });
            }

            // Clear selection after success
            setSelectedImages([]);
            setShowImagePicker(false);
        } catch (err: any) {
            setError(err.message || "Failed to generate prompt");
        } finally {
            setIsLoading(false);
        }
    };

    // Copy to clipboard (charges 1 credit)
    const handleCopy = async (content: string, id: string) => {
        if (!userId) return;

        try {
            const result = await copyPromptMutation({ userId, messageId: id as Id<"agentMessages"> });
            if (!result.success) {
                setError(result.error || "Failed to copy");
                return;
            }
            navigator.clipboard.writeText(content);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err: any) {
            setError(err.message || "Failed to copy prompt");
        }
    };

    // Clear chat history (TC-10: New Conversation)
    const handleClearHistory = async () => {
        if (!userId) return;
        if (!confirm("Clear all chat history? This cannot be undone.")) return;

        try {
            await clearChatHistory({ userId });
        } catch (err) {
            console.error("Failed to clear history:", err);
        }
    };

    // Format time
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 border-b-2 border-white/20 pb-4 mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="w-6 h-6" />
                            AI Prompt Assistant
                        </h1>
                        <p className="text-white/60 text-sm mt-1">
                            Select images to generate detailed AI prompts
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {chatHistory && chatHistory.length > 0 && (
                            <Button
                                onClick={handleClearHistory}
                                variant="ghost"
                                className="text-white/60 hover:text-white text-sm uppercase tracking-widest flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear
                            </Button>
                        )}
                        <div className="text-right">
                            <div className="text-sm text-white/60">Credits</div>
                            <div className="text-xl font-bold">{userCredits}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {!chatHistory && (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                    </div>
                )}

                {chatHistory?.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-24 h-24 border-2 border-white/20 flex items-center justify-center mb-6">
                            <Sparkles className="w-12 h-12 text-white/30" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Start Creating</h3>
                        <p className="text-white/60 max-w-md">
                            Select images from your library to generate detailed AI prompts.
                            Perfect for recreating styles in Midjourney, DALL-E, or Stable Diffusion.
                        </p>
                    </div>
                )}

                {chatHistory?.map((message) => (
                    <motion.div
                        key={message._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[80%] ${message.role === "user"
                                    ? "bg-white text-black"
                                    : "bg-white/10 border border-white/20"
                                }`}
                        >
                            {/* Message Header */}
                            <div className="px-4 py-2 border-b border-current/10 flex items-center justify-between text-xs">
                                <span className="uppercase tracking-widest opacity-60">
                                    {message.role === "user" ? "You" : "Assistant"}
                                </span>
                                <div className="flex items-center gap-2">
                                    {message.creditsUsed !== undefined && message.creditsUsed > 0 && (
                                        <span className="opacity-60">-{message.creditsUsed} credits</span>
                                    )}
                                    <span className="opacity-40">{formatTime(message.createdAt)}</span>
                                </div>
                            </div>

                            {/* Message Content */}
                            <div className="p-4">
                                <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                    {message.content}
                                </p>
                            </div>

                            {/* Copy Button for assistant messages */}
                            {message.role === "assistant" && (
                                <div className="px-4 pb-3">
                                    <button
                                        onClick={() => handleCopy(message.content, message._id)}
                                        className="flex items-center gap-1 text-xs uppercase tracking-widest hover:text-white/80 transition-colors"
                                    >
                                        {copiedId === message._id ? (
                                            <>
                                                <Check className="w-3 h-3" />
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3 h-3" />
                                                Copy Prompt
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Image Picker Modal */}
            <AnimatePresence>
                {showImagePicker && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={() => setShowImagePicker(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-black border-2 border-white w-full max-w-4xl max-h-[80vh] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="h-12 border-b-2 border-white flex items-center justify-between px-4">
                                <span className="text-sm uppercase tracking-widest">
                                    Select Images ({selectedImages.length}/5)
                                </span>
                                <div className="flex items-center gap-3">
                                    <UploadModal
                                        trigger={
                                            <Button variant="ghost" className="text-sm uppercase tracking-widest flex items-center gap-2">
                                                <Upload className="w-4 h-4" />
                                                Upload
                                            </Button>
                                        }
                                        onImageUploaded={(imageId) => {
                                            // Auto-select the newly uploaded image
                                            if (selectedImages.length < 5) {
                                                setSelectedImages(prev => [...prev, imageId as Id<"images">]);
                                            }
                                        }}
                                    />
                                    <button onClick={() => setShowImagePicker(false)}>
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                {userImages?.images && userImages.images.length > 0 ? (
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {userImages.images.map((image: any) => (
                                            <button
                                                key={image._id}
                                                onClick={() => toggleImageSelection(image._id)}
                                                className={`relative aspect-square border-2 transition-all ${selectedImages.includes(image._id)
                                                        ? "border-white ring-2 ring-white/50"
                                                        : "border-white/30 hover:border-white/60"
                                                    }`}
                                            >
                                                <img
                                                    src={image.thumbnailUrl || image.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                                {selectedImages.includes(image._id) && (
                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-white text-black flex items-center justify-center text-sm font-bold">
                                                        {selectedImages.indexOf(image._id) + 1}
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-white/60">
                                        <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                        <p className="mb-4">No images in your library</p>
                                        <UploadModal
                                            trigger={
                                                <Button variant="default" className="bg-white text-black hover:bg-white/90">
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Upload Image
                                                </Button>
                                            }
                                            onImageUploaded={(imageId) => {
                                                if (selectedImages.length < 5) {
                                                    setSelectedImages(prev => [...prev, imageId as Id<"images">]);
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="h-16 border-t-2 border-white flex items-center justify-end px-4 gap-4">
                                <Button
                                    onClick={() => setSelectedImages([])}
                                    variant="ghost"
                                    className="px-4 py-2 text-sm uppercase tracking-widest"
                                >
                                    Clear
                                </Button>
                                <Button
                                    onClick={() => setShowImagePicker(false)}
                                    disabled={selectedImages.length === 0}
                                    className="px-6 py-2 bg-white text-black text-sm uppercase tracking-widest"
                                >
                                    Confirm ({selectedImages.length})
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t-2 border-white/20 pt-4 mt-4">
                {/* Error */}
                {error && (
                    <div className="mb-4 flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/50 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Selected Images Preview */}
                {selectedImages.length > 0 && (
                    <div className="mb-4 flex items-center gap-2">
                        <span className="text-xs uppercase tracking-widest text-white/60">
                            Selected:
                        </span>
                        <div className="flex gap-2">
                            {selectedImages.map((id, i) => (
                                <div key={id} className="w-10 h-10 bg-white/10 border border-white/30 flex items-center justify-center text-sm font-bold">
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setSelectedImages([])}
                            className="ml-2 text-white/60 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex gap-4">
                    <Button
                        onClick={() => setShowImagePicker(true)}
                        variant="ghost"
                        className="h-12 px-4 border-2 border-white/50 hover:border-white flex items-center gap-2 text-sm uppercase tracking-widest"
                    >
                        <ImageIcon className="w-4 h-4" />
                        {selectedImages.length > 0 ? `${selectedImages.length} Images` : "Select Images"}
                    </Button>

                    <Button
                        onClick={handleGenerate}
                        disabled={isLoading || selectedImages.length === 0}
                        className="flex-1 h-12 bg-white text-black hover:bg-white/90 text-sm uppercase tracking-widest font-bold flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generate Prompt ({selectedImages.length === 1 ? "1 credit" : `${Math.ceil(selectedImages.length * 0.5)} credits`})
                            </>
                        )}
                    </Button>
                </div>

                <p className="mt-3 text-center text-xs text-white/40">
                    Single image: 1 credit detailed • Multi-image: 0.5 credits per image
                </p>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <RequireAuth>
            <AppShell>
                <ChatContent />
            </AppShell>
        </RequireAuth>
    );
}

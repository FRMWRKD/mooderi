"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { motion } from "framer-motion";
import { Clock, Copy, Check, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

/**
 * PublicRequestFeed - Shows recent prompt generation results from all users
 * Displayed on the landing page to demonstrate the tool's capabilities
 */
export function PublicRequestFeed() {
    const requests = useQuery(api.promptRequests.getPublicRequests, { limit: 10 });
    const [copiedId, setCopiedId] = useState<string | null>(null);

    if (!requests || requests.length === 0) {
        return null; // Don't show section if no requests yet
    }

    const handleCopy = (id: string, prompt: string) => {
        navigator.clipboard.writeText(prompt);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatTime = (timestamp: number) => {
        try {
            return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
        } catch {
            return "recently";
        }
    };

    return (
        <div className="mt-8 border-t-2 border-white/30 pt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-widest text-white/50">
                    Recent Community Generations
                </h3>
                <span className="text-[10px] uppercase tracking-widest text-white/30">
                    Public Feed
                </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {requests.map((req, index) => (
                    <motion.div
                        key={req._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group border border-white/20 hover:border-white/40 bg-white/5 p-3 transition-colors"
                    >
                        <div className="flex gap-3">
                            {/* Image preview if available */}
                            {req.topMatchImage?.imageUrl && (
                                <div className="flex-shrink-0 w-16 h-16 border border-white/30 overflow-hidden">
                                    <img
                                        src={req.topMatchImage.imageUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            {/* Input indicator if no image */}
                            {!req.topMatchImage?.imageUrl && (
                                <div className="flex-shrink-0 w-16 h-16 border border-white/20 bg-white/5 flex items-center justify-center">
                                    {req.inputImageUrl ? (
                                        <ImageIcon className="w-6 h-6 text-white/30" />
                                    ) : (
                                        <span className="text-lg text-white/30">Aa</span>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                {/* Input preview */}
                                {req.inputText && (
                                    <p className="text-[10px] text-white/40 truncate mb-1">
                                        "{req.inputText}"
                                    </p>
                                )}

                                {/* Generated prompt */}
                                <p className="text-xs font-mono line-clamp-2 text-white/80">
                                    {req.generatedPrompt}
                                </p>

                                {/* Metadata */}
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(req._creationTime)}
                                    </span>

                                    {req.visionatiAnalysis?.mood && (
                                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 text-white/50">
                                            {req.visionatiAnalysis.mood}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Copy button */}
                            <button
                                onClick={() => handleCopy(req._id, req.generatedPrompt)}
                                className="flex-shrink-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-black"
                                title="Copy prompt"
                            >
                                {copiedId === req._id ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default PublicRequestFeed;

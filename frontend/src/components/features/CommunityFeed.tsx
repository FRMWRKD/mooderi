import { useState } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Masonry } from "react-plock";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutGrid,
    List,
    Lock,
    Copy,
    Check,
    Sparkles,
    Heart
} from "lucide-react";

export const CommunityFeed = () => {
    const { isAuthenticated } = useConvexAuth();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    // Fetch public images
    // using api.images.list which we verified exists
    const result = useQuery(api.images.list, { limit: 50 });
    const images = result?.images || [];

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 py-12">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Community Creations</h2>
                    <p className="text-white/50 text-sm mt-1">Recent generations from around the world</p>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {viewMode === "grid" ? (
                <Masonry
                    items={images}
                    config={{
                        columns: [1, 2, 3, 4],
                        gap: [16, 16, 16, 16],
                        media: [640, 768, 1024, 1280],
                    }}
                    render={(image, idx) => (
                        <FeedItem
                            key={image._id}
                            image={image}
                            isAuthenticated={isAuthenticated}
                            onClick={() => setSelectedImage(image)}
                        />
                    )}
                />
            ) : (
                <div className="space-y-4">
                    {images.map((image) => (
                        <FeedItem
                            key={image._id}
                            image={image}
                            isAuthenticated={isAuthenticated}
                            view="list"
                            onClick={() => setSelectedImage(image)}
                        />
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-[#0A0A0A] border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row rounded-xl shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="md:w-1/2 bg-black flex items-center justify-center p-4">
                                <img
                                    src={selectedImage.imageUrl}
                                    alt="Generation"
                                    className="max-h-full max-w-full object-contain rounded-lg"
                                />
                            </div>
                            <div className="md:w-1/2 p-8 flex flex-col h-full overflow-y-auto">
                                <div className="flex items-start justify-between mb-6">
                                    <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-purple-400" />
                                        Generation Details
                                    </h3>
                                    <button onClick={() => setSelectedImage(null)} className="p-2 hover:bg-white/10 rounded-full">
                                        <span className="sr-only">Close</span>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="space-y-6 flex-1">
                                    <div>
                                        <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Prompt</label>
                                        <div className="relative group">
                                            <div className={`p-4 bg-white/5 rounded-lg border border-white/10 font-mono text-sm leading-relaxed ${!isAuthenticated ? 'blur-sm select-none' : ''}`}>
                                                {isAuthenticated ? selectedImage.prompt : "Sign up to view the full prompt details used for this generation."}
                                            </div>
                                            {!isAuthenticated && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="bg-black/80 border border-white/20 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium">
                                                        <Lock className="w-3 h-3" />
                                                        Sign Up to View
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-6 border-t border-white/10 flex flex-wrap gap-3">
                                        {isAuthenticated ? (
                                            <>
                                                <button
                                                    onClick={() => handleCopy(selectedImage.prompt || "")}
                                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors uppercase tracking-wider"
                                                >
                                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    {copied ? "Copied" : "Copy Prompt"}
                                                </button>
                                                <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm uppercase tracking-wider">
                                                    <Heart className="w-4 h-4" />
                                                    Save to Board
                                                </button>
                                            </>
                                        ) : (
                                            <a href="/login?action=signup" className="w-full">
                                                <button className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest hover:bg-white/90 transition-colors">
                                                    Sign Up to Copy & Save
                                                </button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FeedItem = ({ image, isAuthenticated, view = "grid", onClick }: any) => {
    return (
        <div
            onClick={onClick}
            className={`group cursor-pointer bg-white/5 border border-white/10 overflow-hidden hover:border-white/30 transition-all ${view === 'list' ? 'flex h-48' : ''}`}
        >
            <div className={`relative ${view === 'list' ? 'w-48 h-full' : 'w-full aspect-[4/5]'}`}>
                <img
                    src={image.imageUrl}
                    alt="Generation"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    {!isAuthenticated && (
                        <div className="flex items-center gap-2 text-xs font-medium text-white/80">
                            <Lock className="w-3 h-3" />
                            Private Prompt
                        </div>
                    )}
                </div>
            </div>

            {view === 'list' && (
                <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            {image.detectedCategory && (
                                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider border border-white/20 rounded-full">
                                    {image.detectedCategory}
                                </span>
                            )}
                            <span className="text-white/40 text-xs">
                                {new Date(image._creationTime).toLocaleDateString()}
                            </span>
                        </div>
                        <div className={`font-mono text-sm text-white/80 line-clamp-2 ${!isAuthenticated ? 'blur-sm select-none' : ''}`}>
                            {isAuthenticated ? image.prompt : "This prompt is hidden for non-authenticated user preview."}
                        </div>
                    </div>
                    {!isAuthenticated && (
                        <div className="text-xs text-white/50 flex items-center gap-1.5 mt-2">
                            <Lock className="w-3 h-3" /> Sign up to view full details
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

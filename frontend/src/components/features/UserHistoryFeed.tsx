import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { Masonry } from "react-plock";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutGrid,
    List,
    Copy,
    Check,
    Sparkles,
    Trash2,
    RefreshCw,
    MoreHorizontal
} from "lucide-react";
import { FilterBar, FilterState } from "./FilterBar";

interface UserHistoryFeedProps {
    onSelectPrompt?: (prompt: string) => void;
}

export const UserHistoryFeed = ({ onSelectPrompt }: UserHistoryFeedProps) => {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    // Filter State
    const [filters, setFilters] = useState<FilterState>({
        moods: [],
        colors: [],
        colorTolerance: 100,
        lighting: [],
        cameraShots: [],
        tags: [],
        minScore: 0,
        sort: "newest"
    });

    // Fetch user images with filters


    // Fetch user images with filters
    const result = useQuery(api.images.filter, {
        userId: user?.id as any,
        onlyPublic: false,
        limit: 50,
        mood: filters.moods.length > 0 ? filters.moods : undefined,
        lighting: filters.lighting.length > 0 ? filters.lighting : undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        sort: filters.sort
    });

    const images = result?.images || [];

    // Fetch filter options
    const filterOptions = useQuery(api.images.getFilterOptions);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReuse = (prompt: string) => {
        if (onSelectPrompt) {
            onSelectPrompt(prompt);
            // Optionally scroll up
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    if (!user) return null;

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">My Recent Prompts</h2>
                        <p className="text-white/50 text-sm mt-1">
                            Your personal library of generated images and prompts
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
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
                </div>

                {/* Filter Bar */}
                <FilterBar
                    onSearch={(query, type) => {
                        // Implement search if needed, or pass query to filter
                        console.log("Search", query, type);
                    }}
                    onFilterChange={setFilters}
                    dynamicMoods={filterOptions?.moods || []}
                    dynamicColors={filterOptions?.colors || []}
                    dynamicLighting={filterOptions?.lighting || []}
                    dynamicCameraShots={filterOptions?.camera_shots || []}
                    dynamicTags={filterOptions?.tags || []}
                    isLoading={!filterOptions}
                />
            </div>

            {/* Results */}
            {images.length === 0 ? (
                <div className="py-20 text-center border border-white/10 rounded-xl bg-white/5">
                    <Sparkles className="w-12 h-12 mx-auto text-white/20 mb-4" />
                    <p className="text-white/60">No prompts found in your history.</p>
                    <p className="text-xs text-white/40 mt-2">Generate something above to get started!</p>
                </div>
            ) : viewMode === "grid" ? (
                <Masonry
                    items={images}
                    config={{
                        columns: [1, 2, 3, 4],
                        gap: [16, 16, 16, 16],
                        media: [640, 768, 1024, 1280],
                    }}
                    render={(image, idx) => (
                        <HistoryItem
                            key={image._id}
                            image={image}
                            onSelect={() => setSelectedImage(image)}
                            onReuse={() => handleReuse(image.prompt || "")}
                        />
                    )}
                />
            ) : (
                <div className="space-y-4">
                    {images.map((image) => (
                        <HistoryItem
                            key={image._id}
                            image={image}
                            view="list"
                            onSelect={() => setSelectedImage(image)}
                            onReuse={() => handleReuse(image.prompt || "")}
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
                                        Details
                                    </h3>
                                    <button onClick={() => setSelectedImage(null)} className="p-2 hover:bg-white/10 rounded-full">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-6 flex-1">
                                    <div>
                                        <label className="text-xs uppercase tracking-widest text-white/50 mb-2 block">Prompt</label>
                                        <div className="p-4 bg-white/5 rounded-lg border border-white/10 font-mono text-sm leading-relaxed">
                                            {selectedImage.prompt}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {selectedImage.mood && (
                                            <div>
                                                <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Mood</label>
                                                <span className="text-sm">{selectedImage.mood}</span>
                                            </div>
                                        )}
                                        {selectedImage.lighting && (
                                            <div>
                                                <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Lighting</label>
                                                <span className="text-sm">{selectedImage.lighting}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 border-t border-white/10 flex flex-wrap gap-3 mt-auto">
                                        <button
                                            onClick={() => handleCopy(selectedImage.prompt || "")}
                                            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 hover:bg-white/20 transition-colors text-sm uppercase tracking-wider"
                                        >
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            {copied ? "Copied" : "Copy"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleReuse(selectedImage.prompt);
                                                setSelectedImage(null);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors uppercase tracking-wider"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Reuse Prompt
                                        </button>
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

const HistoryItem = ({ image, view = "grid", onSelect, onReuse }: any) => {
    return (
        <div
            onClick={onSelect}
            className={`group cursor-pointer bg-white/5 border border-white/10 overflow-hidden hover:border-white/30 transition-all ${view === 'list' ? 'flex h-48' : ''}`}
        >
            <div className={`relative ${view === 'list' ? 'w-48 h-full' : 'w-full aspect-[4/5]'}`}>
                <img
                    src={image.imageUrl}
                    alt="Generation"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />

                {/* Overlay Actions */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onReuse();
                        }}
                        className="p-1.5 bg-white text-black rounded-full hover:bg-white/90"
                        title="Reuse Prompt"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
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
                        <div className="font-mono text-sm text-white/80 line-clamp-2">
                            {image.prompt}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onReuse();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs uppercase tracking-wider rounded"
                        >
                            <RefreshCw className="w-3 h-3" /> Reuse
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple X icon component since lucide import might be tricky if not exported
function X({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}

"use client";

import { AppShell } from "@/components/layout";
import { ImageCard } from "@/components/features/ImageCard";
import { Button } from "@/components/ui/Button";
import { api, type Image } from "@/lib/api";
import { Images, ChevronDown, SlidersHorizontal, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

type SortOption = "newest" | "oldest" | "mood" | "lighting";
type FilterOption = "all" | "video_import" | "upload" | "discover";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "mood", label: "By Mood" },
    { value: "lighting", label: "By Lighting" },
];

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
    { value: "all", label: "All Sources" },
    { value: "video_import", label: "Video Imports" },
    { value: "upload", label: "Uploads" },
    { value: "discover", label: "Discovered" },
];

export default function MyImagesPage() {
    const [images, setImages] = useState<Image[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("newest");
    const [filterBy, setFilterBy] = useState<FilterOption>("all");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    const loadImages = useCallback(async (showFullLoader = true) => {
        if (showFullLoader) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }
        setError(null);

        // Build params based on filter and sort
        const params: {
            source_type?: string;
            limit: number;
            sort: string;
        } = {
            limit: 100,
            sort: sortBy === "oldest" ? "oldest" : "newest",
        };

        // Apply source filter
        if (filterBy !== "all") {
            params.source_type = filterBy;
        }

        const result = await api.getFilteredImages(params);

        if (result.data) {
            let sortedImages = result.data.images || [];

            // Client-side sorting for mood/lighting
            if (sortBy === "mood") {
                sortedImages = [...sortedImages].sort((a, b) => (a.mood || "").localeCompare(b.mood || ""));
            } else if (sortBy === "lighting") {
                sortedImages = [...sortedImages].sort((a, b) => (a.lighting || "").localeCompare(b.lighting || ""));
            }

            setImages(sortedImages);
        } else {
            // Fallback to regular images call
            const fallback = await api.getImages({ limit: 50, sort: "newest" });
            if (fallback.data) {
                setImages(fallback.data.images || []);
            } else {
                setError(fallback.error || "Failed to load images");
            }
        }
        setIsLoading(false);
        setIsRefreshing(false);
    }, [sortBy, filterBy]);

    // Initial load and reload on filter/sort change
    useEffect(() => {
        loadImages();
    }, [loadImages]);

    // Auto-refresh when window gains focus
    useEffect(() => {
        const handleFocus = () => {
            loadImages(false);
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [loadImages]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowSortMenu(false);
            setShowFilterMenu(false);
        };
        if (showSortMenu || showFilterMenu) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [showSortMenu, showFilterMenu]);

    if (isLoading) {
        return (
            <AppShell>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-2" />
                            <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
                        </div>
                    </div>
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5">
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="aspect-[4/5] bg-white/5 rounded-xl animate-pulse mb-5"
                            />
                        ))}
                    </div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">My Images</h1>
                        <p className="text-text-secondary">
                            {images.length} images in your library
                            {isRefreshing && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
                        </p>
                    </div>

                    {/* Sort & Filter Controls */}
                    <div className="flex gap-2">
                        {/* Sort Dropdown */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSortMenu(!showSortMenu);
                                    setShowFilterMenu(false);
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm"
                            >
                                <span className="text-text-secondary">Sort:</span>
                                <span className="font-medium">{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
                                <ChevronDown className="w-4 h-4 text-text-tertiary" />
                            </button>
                            {showSortMenu && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-surface-elevated border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                                    {SORT_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSortBy(option.value);
                                                setShowSortMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${sortBy === option.value ? "bg-accent-blue/10 text-accent-blue" : ""}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Filter Dropdown */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFilterMenu(!showFilterMenu);
                                    setShowSortMenu(false);
                                }}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-white/10 transition-colors text-sm ${filterBy !== "all" ? "bg-accent-blue/10 border-accent-blue/30" : "bg-white/5 border-white/10"}`}
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                <span>{filterBy === "all" ? "Filter" : FILTER_OPTIONS.find(o => o.value === filterBy)?.label}</span>
                                {filterBy !== "all" && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFilterBy("all");
                                        }}
                                        className="ml-1 p-0.5 hover:bg-white/10 rounded"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                                <ChevronDown className="w-4 h-4 text-text-tertiary" />
                            </button>
                            {showFilterMenu && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-surface-elevated border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                                    {FILTER_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFilterBy(option.value);
                                                setShowFilterMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${filterBy === option.value ? "bg-accent-blue/10 text-accent-blue" : ""}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                        {error}
                    </div>
                )}

                {/* Content */}
                {images.length === 0 ? (
                    <div className="text-center py-20">
                        <Images className="w-16 h-16 mx-auto mb-4 text-text-tertiary opacity-30" />
                        <h2 className="text-xl font-semibold mb-2">No images yet</h2>
                        <p className="text-text-secondary mb-6 max-w-md mx-auto">
                            {filterBy !== "all"
                                ? `No ${FILTER_OPTIONS.find(o => o.value === filterBy)?.label.toLowerCase()} found.`
                                : "Import a video or upload images to get started."
                            }
                        </p>
                        {filterBy !== "all" && (
                            <Button variant="secondary" onClick={() => setFilterBy("all")}>
                                Clear Filter
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5">
                        {images.map((image) => (
                            <ImageCard
                                key={image.id}
                                id={image.id}
                                imageUrl={image.image_url}
                                mood={image.mood}
                                colors={image.colors}
                                tags={image.tags}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

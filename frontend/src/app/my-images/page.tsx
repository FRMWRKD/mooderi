"use client";

import { AppShell } from "@/components/layout";
import { ImageCard } from "@/components/features/ImageCard";
import { Button } from "@/components/ui/Button";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
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
    const { user } = useAuth();
    const [sortBy, setSortBy] = useState<SortOption>("newest");
    const [filterBy, setFilterBy] = useState<FilterOption>("all");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Use user._id directly from auth context
    const userImages = useQuery(api.images.filter, user?._id ? {
        limit: 100,
        sort: sortBy === "oldest" ? "oldest" : "newest", // Simplified sort
        sourceType: filterBy === "all" ? undefined : filterBy,
        userId: user._id,
        onlyPublic: false, // Show private images too
    } : "skip");

    const isLoading = userImages === undefined;
    const images = userImages?.images || [];

    // Filter Logic client side for mood/lighting if needed?
    // api.images.filter supports mood/lighting args but UI here selects sort option "mood".
    // "mood" sort isn't supported by backend sort param (only date/rating).
    // So if sortBy='mood', disable backend sort and sort locally?
    // Or just ignore.

    // Client-side sort fallback
    const sortedImages = [...images];
    if (sortBy === "mood") {
        sortedImages.sort((a, b) => (a.mood || "").localeCompare(b.mood || ""));
    } else if (sortBy === "lighting") {
        sortedImages.sort((a, b) => (a.lighting || "").localeCompare(b.lighting || ""));
    }

    // Close menus when clicking outside (kept same)
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
                            {sortedImages.length} images in your library
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
                                <div className="absolute right-0 top-full mt-1 w-44 bg-black border border-white/20 rounded-lg shadow-2xl z-50 overflow-hidden">
                                    {SORT_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSortBy(option.value);
                                                setShowSortMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors ${sortBy === option.value ? "bg-white/10 text-accent-blue" : ""}`}
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
                                <div className="absolute right-0 top-full mt-1 w-44 bg-black border border-white/20 rounded-lg shadow-2xl z-50 overflow-hidden">
                                    {FILTER_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFilterBy(option.value);
                                                setShowFilterMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors ${filterBy === option.value ? "bg-white/10 text-accent-blue" : ""}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                {sortedImages.length === 0 ? (
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
                        {sortedImages.map((image) => (
                            <ImageCard
                                key={image._id}
                                id={image._id as any} // Temporary cast until ImageCard update
                                imageUrl={image.imageUrl} // Note: imageUrl vs image_url (Convex uses imageUrl)
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

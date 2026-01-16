"use client";

import { AppShell } from "@/components/layout";
import { ImageCard, FilterBar, type FilterState } from "@/components/features";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import { Search } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { useSemanticSearch } from "@/hooks/useConvex";

function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // URL Params
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "text";
    const colorParam = searchParams.get("color") || "";
    const colorToleranceParam = searchParams.get("colorTolerance") || "100";
    const moodParam = searchParams.get("mood") || "";
    const lightingParam = searchParams.get("lighting") || "";
    const cameraParam = searchParams.get("camera") || "";
    const tagsParam = searchParams.get("tags") || "";

    const parseParam = (param: string): string[] => param ? param.split(",").filter(Boolean) : [];

    const selectedColors = parseParam(colorParam);
    const selectedMoods = parseParam(moodParam);
    const selectedLighting = parseParam(lightingParam);
    const selectedCameraShots = parseParam(cameraParam);
    const selectedTags = parseParam(tagsParam);

    // Convex Data Fetching
    const filterOptionsData = useQuery(api.images.getFilterOptions);

    // Determine which query to run
    const hasFilters = selectedColors.length > 0 || selectedMoods.length > 0 || selectedLighting.length > 0 || selectedCameraShots.length > 0 || selectedTags.length > 0;

    // Filter Query Args
    const filterArgs = {
        mood: selectedMoods.length > 0 ? selectedMoods : undefined,
        lighting: selectedLighting.length > 0 ? selectedLighting : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        limit: 100,
        sort: "ranked",
        // Note: Backend might not support colors/camera/tolerance yet, matching Home Page logic
    };

    // Text Search Args
    const searchArgs = {
        query: query,
        limit: 100,
    };

    const filterResults = useQuery(api.images.filter, !query && hasFilters ? filterArgs : "skip");
    // Use Semantic Search (Vector) instead of Text Search
    const searchResults = useSemanticSearch(query, 100);

    // Unified Results
    const results = query ? searchResults : filterResults;
    const images = results?.images || [];
    const isLoading = query ? searchResults.isLoading : (filterResults === undefined && hasFilters);
    const error = null; // Convex handles errors via boundary usually

    // Dynamic Options
    const dynamicMoods = filterOptionsData?.moods || [];
    const dynamicColors = filterOptionsData?.colors || [];
    const dynamicLighting = filterOptionsData?.lighting || [];
    const dynamicCameraShots = filterOptionsData?.camera_shots || [];
    const dynamicTags = filterOptionsData?.tags || [];
    const filtersLoading = filterOptionsData === undefined;

    // State to handle client-size filtering if needed (e.g. for refined text search on filtered results)
    // Legacy code did client-side text filtering if filters were active:
    // "filtered = filtered.filter(img => img.prompt...)"
    // We can replicate this if needed, but Convex textSearch is powerful.
    // If both filters AND text query are present, legacy used `getFilteredImages` then client-filtered.
    // Ideally we should use a Convex query that does both.
    // For now, if query exists, we prioritize `textSearch` (which likely searches prompts/tags).
    // If we want to strictly support "Filters + Text Search", we might need a dedicated Convex query or use `filter` and do client side text match,
    // OR use `textSearch` and do client side filtering (better for relevance).

    // Let's stick to: If query -> textSearch. If no query but filters -> filter.
    // The legacy code had a specific logic: `if (hasFilters) { ... } else if (query) { ... }`
    // Wait, line 77: `if (hasFilters) { api.getFilteredImages... if (query) clientFilter }`
    // So if filters are present, it uses filter API.
    // We will do the same precedence.

    const finalImages = useQuery(api.images.filter, hasFilters ? filterArgs : "skip")?.images;
    const textImages = useSemanticSearch(hasFilters && query ? query : "", 100)?.images;

    let displayImages = hasFilters ? (finalImages || []) : (query ? (textImages || []) : []);

    // Apply client-side text filter if both filters and query exist
    if (hasFilters && query && displayImages.length > 0) {
        const lowerQuery = query.toLowerCase();
        displayImages = displayImages.filter((img: any) =>
            img.prompt?.toLowerCase().includes(lowerQuery) ||
            img.mood?.toLowerCase().includes(lowerQuery) ||
            img.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))
        );
    }

    // If no params, empty
    if (!query && !hasFilters) {
        displayImages = [];
    }

    const isDataLoading = (hasFilters && finalImages === undefined) || (!hasFilters && query && textImages === undefined);


    // Handlers
    const handleSearch = useCallback((newQuery: string, newType: "text" | "semantic") => {
        const params = new URLSearchParams(searchParams.toString());
        if (newQuery) {
            params.set("q", newQuery);
            params.set("type", newType);
        } else {
            params.delete("q");
            params.delete("type");
        }
        router.push(`/search?${params.toString()}`);
    }, [router, searchParams]);

    const handleFilterChange = useCallback((filters: FilterState) => {
        const params = new URLSearchParams(searchParams.toString());

        if (filters.colors.length > 0) {
            params.set("color", filters.colors.join(","));
            params.set("colorTolerance", filters.colorTolerance.toString());
        } else {
            params.delete("color");
            params.delete("colorTolerance");
        }

        if (filters.moods.length > 0) params.set("mood", filters.moods.join(","));
        else params.delete("mood");

        if (filters.lighting.length > 0) params.set("lighting", filters.lighting.join(","));
        else params.delete("lighting");

        if (filters.cameraShots.length > 0) params.set("camera", filters.cameraShots.join(","));
        else params.delete("camera");

        if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
        else params.delete("tags");

        router.push(`/search?${params.toString()}`);
    }, [router, searchParams]);

    return (
        <div className="space-y-6">
            <FilterBar
                initialQuery={query}
                initialType={type as "text" | "semantic"}
                initialColors={selectedColors}
                initialMoods={selectedMoods}
                initialLighting={selectedLighting}
                initialCameraShots={selectedCameraShots}
                initialTags={selectedTags}
                onSearch={handleSearch}
                onFilterChange={handleFilterChange}
                dynamicMoods={dynamicMoods}
                dynamicColors={dynamicColors}
                dynamicLighting={dynamicLighting}
                dynamicCameraShots={dynamicCameraShots}
                dynamicTags={dynamicTags}
                isLoading={filtersLoading}
            />

            {/* Results Grid */}
            {!isDataLoading && displayImages.length > 0 && (
                <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {displayImages.map((image: any) => (
                        <div key={image._id} className="break-inside-avoid">
                            <ImageCard
                                id={image._id}
                                imageUrl={image.imageUrl}
                                prompt={image.prompt}
                                mood={image.mood}
                                colors={image.colors}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty States */}
            {!isDataLoading && displayImages.length === 0 && (
                <div className="text-center py-32 opacity-50">
                    <div className="w-20 h-20 mx-auto mb-6 bg-white/5 border border-white/10 flex items-center justify-center">
                        <Search className="w-8 h-8 text-white/30" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">
                        {query || hasFilters ? "No results found" : "Ready to Search"}
                    </h2>
                    <p className="text-text-secondary max-w-md mx-auto">
                        {query || hasFilters
                            ? "Try adjusting your filters or search query."
                            : "Use the search bar or filters above to explore the visual library."}
                    </p>
                </div>
            )}

            {/* Loading Skeletons */}
            {isDataLoading && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="aspect-[4/5] bg-white/5 border border-white/10 animate-pulse" />
                    ))}
                </div>
            )}
        </div>
    );
}

function SearchFallback() {
    return (
        <div className="space-y-6">
            <div className="h-20 w-full bg-white/5 border border-white/10 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {[...Array(8)].map((_, i) => (
                    <div
                        key={i}
                        className="aspect-[4/5] bg-white/5 border border-white/10 animate-pulse"
                    />
                ))}
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <AppShell>
            <Suspense fallback={<SearchFallback />}>
                <SearchContent />
            </Suspense>
        </AppShell>
    );
}

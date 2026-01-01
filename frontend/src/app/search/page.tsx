"use client";

import { AppShell } from "@/components/layout";
import { ImageCard, FilterBar, FilterState } from "@/components/features";
import { api, type Image } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import { Search } from "lucide-react";

function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // URL Params - now arrays for multi-select
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "text";
    const colorParam = searchParams.get("color") || "";
    const colorToleranceParam = searchParams.get("colorTolerance") || "100";  // NEW
    const moodParam = searchParams.get("mood") || "";
    const lightingParam = searchParams.get("lighting") || "";
    const cameraParam = searchParams.get("camera") || "";
    const tagsParam = searchParams.get("tags") || "";

    // Data State
    const [images, setImages] = useState<Image[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dynamic Options State
    const [dynamicMoods, setDynamicMoods] = useState<string[]>([]);
    const [dynamicColors, setDynamicColors] = useState<string[]>([]);
    const [dynamicLighting, setDynamicLighting] = useState<string[]>([]);
    const [dynamicCameraShots, setDynamicCameraShots] = useState<string[]>([]);
    const [dynamicTags, setDynamicTags] = useState<string[]>([]);
    const [filtersLoading, setFiltersLoading] = useState(true);

    // Fetch filter options on mount
    useEffect(() => {
        setFiltersLoading(true);
        api.getFilterOptions().then(result => {
            if (result.data) {
                if (result.data.moods?.length > 0) setDynamicMoods(result.data.moods);
                if (result.data.colors?.length > 0) setDynamicColors(result.data.colors);
                if (result.data.lighting?.length > 0) setDynamicLighting(result.data.lighting);
                if (result.data.camera_shots?.length > 0) setDynamicCameraShots(result.data.camera_shots);
                if (result.data.tags?.length > 0) setDynamicTags(result.data.tags);
            }
            setFiltersLoading(false);
        }).catch(() => setFiltersLoading(false));
    }, []);

    // Parse comma-separated params into arrays
    const parseParam = (param: string): string[] => param ? param.split(",").filter(Boolean) : [];

    // Perform Search when URL params change
    useEffect(() => {
        const performSearch = async () => {
            const selectedColors = parseParam(colorParam);
            const selectedMoods = parseParam(moodParam);
            const selectedLighting = parseParam(lightingParam);
            const selectedCameraShots = parseParam(cameraParam);
            const selectedTags = parseParam(tagsParam);

            // If no params, clear results
            if (!query && selectedColors.length === 0 && selectedMoods.length === 0 && selectedLighting.length === 0 && selectedCameraShots.length === 0 && selectedTags.length === 0) {
                setImages([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const hasFilters = selectedColors.length > 0 || selectedMoods.length > 0 || selectedLighting.length > 0 || selectedCameraShots.length > 0 || selectedTags.length > 0;

                if (hasFilters) {
                    const result = await api.getFilteredImages({
                        colors: selectedColors.length > 0 ? selectedColors : undefined,
                        color_tolerance: parseInt(colorToleranceParam),  // NEW
                        moods: selectedMoods.length > 0 ? selectedMoods : undefined,
                        lighting: selectedLighting.length > 0 ? selectedLighting : undefined,
                        camera_shots: selectedCameraShots.length > 0 ? selectedCameraShots : undefined,
                        tags: selectedTags.length > 0 ? selectedTags : undefined,
                        limit: 100,
                        sort: "ranked",
                    });

                    if (result.data) {
                        let filtered = result.data.images;
                        // Client-side text refinement if query exists
                        if (query) {
                            const lowerQuery = query.toLowerCase();
                            filtered = filtered.filter(img =>
                                img.prompt?.toLowerCase().includes(lowerQuery) ||
                                img.mood?.toLowerCase().includes(lowerQuery) ||
                                img.tags?.some(t => t.toLowerCase().includes(lowerQuery))
                            );
                        }
                        setImages(filtered);
                    } else if (result.error) {
                        setError(result.error);
                    }
                } else if (query) {
                    const result = await api.searchImages(query, type as "text" | "semantic");
                    if (result.data) setImages(result.data.images);
                    else if (result.error) setError(result.error);
                }
            } catch (e) {
                setError("An unexpected error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [query, type, colorParam, colorToleranceParam, moodParam, lightingParam, cameraParam, tagsParam]);

    // Handlers to update URL
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

        // Update Colors
        if (filters.colors.length > 0) {
            params.set("color", filters.colors.join(","));
            params.set("colorTolerance", filters.colorTolerance.toString());
        } else {
            params.delete("color");
            params.delete("colorTolerance");
        }

        // Update Moods (now array)
        if (filters.moods.length > 0) {
            params.set("mood", filters.moods.join(","));
        } else {
            params.delete("mood");
        }

        // Update Lighting (now array)
        if (filters.lighting.length > 0) {
            params.set("lighting", filters.lighting.join(","));
        } else {
            params.delete("lighting");
        }

        // Update Camera (now array)
        if (filters.cameraShots.length > 0) {
            params.set("camera", filters.cameraShots.join(","));
        } else {
            params.delete("camera");
        }

        // Update Tags
        if (filters.tags.length > 0) {
            params.set("tags", filters.tags.join(","));
        } else {
            params.delete("tags");
        }

        router.push(`/search?${params.toString()}`);
    }, [router, searchParams]);

    return (
        <div className="space-y-6">
            <FilterBar
                initialQuery={query}
                initialType={type as "text" | "semantic"}
                initialColors={parseParam(colorParam)}
                initialMoods={parseParam(moodParam)}
                initialLighting={parseParam(lightingParam)}
                initialCameraShots={parseParam(cameraParam)}
                initialTags={parseParam(tagsParam)}
                onSearch={handleSearch}
                onFilterChange={handleFilterChange}
                dynamicMoods={dynamicMoods}
                dynamicColors={dynamicColors}
                dynamicLighting={dynamicLighting}
                dynamicCameraShots={dynamicCameraShots}
                dynamicTags={dynamicTags}
                isLoading={filtersLoading}
            />

            {/* Error & Content */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-center">
                    <p>Search error: {error}</p>
                </div>
            )}

            {/* Results Grid */}
            {!isLoading && images.length > 0 && (
                <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {images.map((image) => (
                        <div key={image.id} className="break-inside-avoid">
                            <ImageCard
                                id={image.id}
                                imageUrl={image.image_url}
                                prompt={image.prompt}
                                mood={image.mood}
                                colors={image.colors}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty States */}
            {!isLoading && !error && images.length === 0 && (
                <div className="text-center py-32 opacity-50">
                    <div className="w-20 h-20 mx-auto mb-6 bg-white/5 border border-white/10 flex items-center justify-center">
                        <Search className="w-8 h-8 text-white/30" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">Ready to Search</h2>
                    <p className="text-text-secondary max-w-md mx-auto">
                        Use the search bar or filters above to explore the visual library.
                    </p>
                </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && (
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

"use client";

import { AppShell } from "@/components/layout";
import { ImageCard, FilterBar, type FilterState, NewBoardModal, LandingPage, SortDropdown } from "@/components/features";
import { Button } from "@/components/ui/Button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { api, type Image, type Board, type Video } from "@/lib/api";
import { X, FolderPlus, Trash2, Check, Loader2, Play, Grid, LayoutList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownLabel,
    DropdownSeparator,
} from "@/components/ui/Dropdown";

export default function HomePage() {
    const { user, isLoading: isAuthLoading } = useAuth();

    // Existing State
    const [images, setImages] = useState<Image[]>([]);
    const [currentSort, setCurrentSort] = useState("ranked");
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchType, setSearchType] = useState<"text" | "semantic">("text");
    const [activeFilters, setActiveFilters] = useState<FilterState>({
        moods: [],
        colors: [],
        colorTolerance: 100,
        lighting: [],
        cameraShots: [],
        tags: [],
        minScore: 3,
        sort: "ranked",
    });

    // Dynamic filter options
    const [dynamicMoods, setDynamicMoods] = useState<string[]>([]);
    const [dynamicColors, setDynamicColors] = useState<string[]>([]);
    const [dynamicLighting, setDynamicLighting] = useState<string[]>([]);
    const [dynamicCameraShots, setDynamicCameraShots] = useState<string[]>([]);
    const [dynamicTags, setDynamicTags] = useState<string[]>([]);
    const [isLoadingFilters, setIsLoadingFilters] = useState(true);

    // Batch selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [boards, setBoards] = useState<Board[]>([]);
    const [isSavingToBoard, setIsSavingToBoard] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list" | "videos">("grid");
    const [showFilters, setShowFilters] = useState(false);

    // Fetch dynamic filter options on mount
    useEffect(() => {
        const loadFilterOptions = async () => {
            setIsLoadingFilters(true);
            const result = await api.getFilterOptions();
            if (result.data) {
                setDynamicMoods(result.data.moods || []);
                setDynamicColors(result.data.colors || []);
                setDynamicLighting(result.data.lighting || []);
                setDynamicCameraShots(result.data.camera_shots || []);
                setDynamicTags(result.data.tags || []);
            }
            setIsLoadingFilters(false);
        };
        if (user) {
            loadFilterOptions();
        }
    }, [user]);

    const fetchImages = useCallback(async (reset = false) => {
        setIsLoading(true);
        setError(null);

        const newOffset = reset ? 0 : offset;
        const hasFilters = activeFilters.moods.length > 0 || activeFilters.colors.length > 0 || activeFilters.lighting.length > 0 || activeFilters.cameraShots.length > 0 || activeFilters.tags.length > 0;
        const hasSearch = searchQuery.trim().length > 0;

        try {
            let result;

            // Priority: Search > Filters > Default
            if (hasSearch) {
                // Use search API
                result = await api.searchImages(searchQuery, searchType);
            } else if (hasFilters) {
                result = await api.getFilteredImages({
                    moods: activeFilters.moods.length > 0 ? activeFilters.moods : undefined,
                    colors: activeFilters.colors.length > 0 ? activeFilters.colors : undefined,
                    color_tolerance: activeFilters.colorTolerance,
                    lighting: activeFilters.lighting.length > 0 ? activeFilters.lighting : undefined,
                    camera_shots: activeFilters.cameraShots.length > 0 ? activeFilters.cameraShots : undefined,
                    tags: activeFilters.tags.length > 0 ? activeFilters.tags : undefined,
                    sort: currentSort,
                    limit: 50,
                    offset: newOffset,
                });
            } else {
                result = await api.getImages({
                    sort: currentSort,
                    limit: 50,
                    offset: newOffset,
                });
            }

            if (result.error) {
                setError(result.error);
                setIsLoading(false);
                return;
            }

            if (result.data) {
                const newImages = result.data.images;
                if (reset) {
                    setImages(newImages);
                } else {
                    setImages((prev) => [...prev, ...newImages]);
                }
                setHasMore(result.data.has_more);
                setOffset(newOffset + newImages.length);
            }
        } catch (e) {
            setError("Failed to load images");
        }

        setIsLoading(false);
    }, [currentSort, offset, activeFilters, searchQuery, searchType]);

    // Fetch boards for batch save
    useEffect(() => {
        if (isSelectionMode && boards.length === 0) {
            api.getBoards().then(result => {
                if (result.data?.boards) {
                    setBoards(result.data.boards);
                }
            });
        }
    }, [isSelectionMode, boards.length]);

    // Debounce filter changes to avoid rapid refetching
    useEffect(() => {
        if (!user) return;

        const timer = setTimeout(() => {
            fetchImages(true);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSort, activeFilters, searchQuery, searchType, user]);

    const handleSortChange = (sort: string) => {
        setOffset(0);
        setCurrentSort(sort);
    };

    const handleFilterChange = (filters: FilterState) => {
        setOffset(0);
        setActiveFilters(filters);
    };

    const handleSearch = (query: string, type: "text" | "semantic") => {
        setOffset(0);
        setSearchQuery(query);
        setSearchType(type);
    };

    const loadMore = () => {
        if (!isLoading && hasMore) {
            fetchImages();
        }
    };

    // Batch selection handlers
    const toggleSelection = (id: number) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);

        // Auto-enable selection mode when first item selected
        if (newSelection.size > 0 && !isSelectionMode) {
            setIsSelectionMode(true);
        }
    };

    const selectAll = () => {
        setSelectedIds(new Set(images.map(img => img.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    const handleBatchSaveToBoard = async (boardId: string) => {
        if (selectedIds.size === 0) return;

        setIsSavingToBoard(true);
        let successCount = 0;

        // Convert Set to array for iteration
        const idsArray = Array.from(selectedIds);
        for (const imageId of idsArray) {
            const result = await api.addToBoard(boardId, imageId);
            if (result.data?.success) {
                successCount++;
            }
        }

        setIsSavingToBoard(false);
        alert(`Saved ${successCount} of ${selectedIds.size} images to board!`);
        clearSelection();
    };

    // Loading check
    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
        );
    }

    // Show Landing Page if not authenticated
    if (!user) {
        return <LandingPage />;
    }

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Page Title */}
                <h1 className="text-5xl font-black text-center tracking-tight">Discover</h1>


                {/* Selection Toolbar */}
                {isSelectionMode && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-black border border-white/30">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white text-black flex items-center justify-center text-sm font-bold">
                                {selectedIds.size}
                            </div>
                            <span className="text-sm">selected</span>
                        </div>

                        <div className="w-px h-6 bg-white/20" />

                        <button
                            onClick={selectAll}
                            className="text-sm text-white/60 hover:text-white transition-colors"
                        >
                            Select all
                        </button>

                        <div className="w-px h-6 bg-white/20" />

                        {/* Save to Board Dropdown */}
                        <Dropdown>
                            <DropdownTrigger asChild>
                                <Button variant="accent" size="sm" disabled={isSavingToBoard}>
                                    {isSavingToBoard ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <FolderPlus className="w-4 h-4 mr-2" />
                                    )}
                                    Save to Board
                                </Button>
                            </DropdownTrigger>
                            <DropdownContent align="center" className="w-64">
                                <DropdownLabel>Choose a board</DropdownLabel>
                                {boards.length > 0 ? (
                                    boards.map((board) => (
                                        <DropdownItem
                                            key={board.id}
                                            onClick={() => handleBatchSaveToBoard(board.id)}
                                        >
                                            <FolderPlus className="w-4 h-4 mr-2 opacity-60" />
                                            {board.name}
                                        </DropdownItem>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-sm text-text-tertiary">
                                        No boards yet
                                    </div>
                                )}
                                <DropdownSeparator />
                                <NewBoardModal
                                    trigger={
                                        <DropdownItem onSelect={(e) => e.preventDefault()}>
                                            <FolderPlus className="w-4 h-4 mr-2" />
                                            Create new board
                                        </DropdownItem>
                                    }
                                    onBoardCreated={async (board) => {
                                        // Refresh boards
                                        const result = await api.getBoards();
                                        if (result.data?.boards) {
                                            const newBoards = result.data.boards;
                                            setBoards(newBoards);
                                        }
                                    }}
                                />
                            </DropdownContent>
                        </Dropdown>

                        <button
                            onClick={clearSelection}
                            className="w-8 h-8 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Filter Bar + Sort + View Mode Toggle */}
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                        <FilterBar
                            onSearch={handleSearch}
                            onFilterChange={handleFilterChange}
                            dynamicMoods={dynamicMoods}
                            dynamicColors={dynamicColors}
                            dynamicLighting={dynamicLighting}
                            dynamicCameraShots={dynamicCameraShots}
                            dynamicTags={dynamicTags}
                            isLoading={isLoadingFilters}
                        />
                    </div>

                    {/* Sort Dropdown */}
                    <SortDropdown
                        value={currentSort}
                        onChange={handleSortChange}
                    />

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg flex-shrink-0">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}
                            title="Grid View"
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}
                            title="List View"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode("videos")}
                            className={`p-2 rounded flex items-center gap-1.5 transition-colors ${viewMode === "videos" ? "bg-red-600/20 text-red-400" : "text-white/50 hover:text-white/80"}`}
                            title="Videos View"
                        >
                            <Play className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400">
                        <p>Error loading images: {error}</p>
                        <button
                            onClick={() => fetchImages(true)}
                            className="mt-2 text-sm underline hover:no-underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && images.length === 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                        {[...Array(10)].map((_, i) => (
                            <div
                                key={i}
                                className="aspect-[4/5] bg-white/5 border border-white/10 animate-pulse"
                            />
                        ))}
                    </div>
                )}

                {/* Image Grid / List / Videos */}
                {images.length > 0 && viewMode !== "videos" && (
                    <div className={
                        viewMode === "grid"
                            ? "columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-4"
                            : "flex flex-col gap-4"
                    }>
                        {images.map((image) => (
                            <Link key={image.id} href={`/image/${image.id}`} className={viewMode === "list" ? "flex gap-5 p-4 bg-white/5 rounded-xl border border-border-subtle hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer" : ""}>
                                {viewMode === "list" && (
                                    <img
                                        src={image.image_url}
                                        alt={image.prompt || ""}
                                        className="w-28 h-28 object-cover rounded-lg flex-shrink-0"
                                    />
                                )}
                                {viewMode === "list" ? (
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <p className="text-base text-text-primary font-medium line-clamp-2 mb-2">{image.prompt || "Untitled"}</p>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {image.mood && (
                                                    <span className="text-xs bg-white/10 px-2 py-1 rounded">{image.mood}</span>
                                                )}
                                                {image.lighting && (
                                                    <span className="text-xs text-text-tertiary">{image.lighting}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex gap-1">
                                                {image.colors?.slice(0, 5).map((color, i) => (
                                                    <span key={i} className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: color }} />
                                                ))}
                                            </div>
                                            {image.source_video_url && (
                                                <span className="text-[10px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <Play className="w-3 h-3" />
                                                    Video Frame
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <ImageCard
                                        id={image.id}
                                        imageUrl={image.image_url}
                                        prompt={image.prompt}
                                        mood={image.mood}
                                        colors={image.colors}
                                        hasGif={!!image.gif_url}
                                        isSelected={selectedIds.has(image.id)}
                                        onSelect={() => toggleSelection(image.id)}
                                    />
                                )}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Videos View - Group by video_id */}
                {images.length > 0 && viewMode === "videos" && (() => {
                    // Group images by video
                    const videoGroups = images.reduce((acc, img) => {
                        if (img.video_id) {
                            if (!acc[img.video_id]) {
                                acc[img.video_id] = {
                                    videoId: img.video_id,
                                    sourceUrl: img.source_video_url || "",
                                    images: []
                                };
                            }
                            acc[img.video_id].images.push(img);
                        }
                        return acc;
                    }, {} as Record<string, { videoId: string; sourceUrl: string; images: Image[] }>);

                    const videoEntries = Object.values(videoGroups).sort((a, b) => b.images.length - a.images.length);

                    if (videoEntries.length === 0) {
                        return (
                            <div className="text-center py-12">
                                <Play className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <p className="text-text-secondary">No video frames found matching your search.</p>
                                <p className="text-text-tertiary text-sm mt-1">Try switching to Grid view to see all images.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {videoEntries.map((group) => {
                                const youtubeMatch = group.sourceUrl?.match(/(?:v=|\/embed\/|youtu\.be\/)([^&?/]+)/);
                                const youtubeId = youtubeMatch ? youtubeMatch[1] : null;
                                const thumbnailUrl = youtubeId
                                    ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
                                    : group.images[0]?.image_url;

                                return (
                                    <Link
                                        key={group.videoId}
                                        href={`/video/${group.videoId}`}
                                        className="group relative bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all"
                                    >
                                        {/* Video Thumbnail / Preview */}
                                        <div className="relative aspect-video">
                                            <img
                                                src={thumbnailUrl}
                                                alt="Video thumbnail"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                            {/* Play Button Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                                    <Play className="w-6 h-6 text-white fill-current ml-1" />
                                                </div>
                                            </div>

                                            {/* Frame count badge */}
                                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                                <span className="bg-black/70 px-2 py-1 rounded text-xs font-medium">
                                                    {group.images.length} frames
                                                </span>
                                            </div>

                                            {/* Frame previews on hover */}
                                            <div className="absolute bottom-3 right-3 flex -space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {group.images.slice(0, 4).map((img, i) => (
                                                    <img
                                                        key={img.id}
                                                        src={img.image_url}
                                                        alt=""
                                                        className="w-10 h-10 rounded border-2 border-black object-cover"
                                                        style={{ zIndex: 4 - i }}
                                                    />
                                                ))}
                                                {group.images.length > 4 && (
                                                    <div className="w-10 h-10 rounded border-2 border-black bg-black/80 flex items-center justify-center text-xs font-medium">
                                                        +{group.images.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Video Info */}
                                        <div className="p-3">
                                            <p className="text-sm font-medium truncate group-hover:text-white transition-colors">
                                                {youtubeId ? "YouTube Video" : "Video"}
                                            </p>
                                            <p className="text-xs text-text-tertiary mt-1">
                                                {group.images.length} extracted frames
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Empty State */}
                {!isLoading && !error && images.length === 0 && (
                    <div className="text-center py-20">
                        <h2 className="text-xl font-semibold mb-2">No images found</h2>
                        <p className="text-text-secondary">
                            Try adjusting your filters or sort options.
                        </p>
                    </div>
                )}

                {/* Load More */}
                {hasMore && (
                    <div className="flex justify-center pt-8 pb-20">
                        <button
                            onClick={loadMore}
                            disabled={isLoading}
                            className="px-6 py-3 bg-white/5 border border-white/20 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Loading..." : "Load more"}
                        </button>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

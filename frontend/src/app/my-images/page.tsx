"use client";

import { AppShell } from "@/components/layout";
import { ImageCard } from "@/components/features/ImageCard";
import { Button } from "@/components/ui/Button";
import { api, type Image } from "@/lib/api";
import { Images, Upload, Plus, Video, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function MyImagesPage() {
    const [images, setImages] = useState<Image[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        setIsLoading(true);
        setError(null);

        // Get images with source_type = video_import (frames extracted from videos)
        const result = await api.getFilteredImages({
            source_type: "video_import",
            limit: 100,
            sort: "newest",
        });

        if (result.data) {
            setImages(result.data.images || []);
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
    };

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
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">My Images</h1>
                        <p className="text-text-secondary">
                            Frames extracted from your video imports
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={loadImages}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button variant="accent" asChild>
                            <Link href="/videos">
                                <Video className="w-4 h-4 mr-2" />
                                Import Video
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                        {error}
                    </div>
                )}

                {/* Result Count */}
                {images.length > 0 && (
                    <div className="text-sm text-text-secondary">
                        {images.length} images in your library
                    </div>
                )}

                {/* Content */}
                {images.length === 0 ? (
                    <div className="text-center py-20">
                        <Images className="w-16 h-16 mx-auto mb-4 text-text-tertiary opacity-30" />
                        <h2 className="text-xl font-semibold mb-2">No images yet</h2>
                        <p className="text-text-secondary mb-6 max-w-md mx-auto">
                            Import a YouTube or Vimeo video to automatically extract and curate the best frames.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="accent" asChild>
                                <Link href="/videos">
                                    <Video className="w-4 h-4 mr-2" />
                                    Import a Video
                                </Link>
                            </Button>
                            <Button variant="secondary" asChild>
                                <Link href="/">
                                    Browse Discover
                                </Link>
                            </Button>
                        </div>
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

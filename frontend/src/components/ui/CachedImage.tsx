"use client";

import { useState, useEffect, useRef, memo } from "react";
import { cn } from "@/lib/utils";

// Global in-memory cache for loaded image URLs
// This persists across component re-renders and navigations within the same session
const loadedImages = new Set<string>();
const preloadQueue = new Map<string, Promise<void>>();

// Preload an image and cache it
function preloadImage(src: string): Promise<void> {
    // Already loaded
    if (loadedImages.has(src)) {
        return Promise.resolve();
    }

    // Already preloading
    if (preloadQueue.has(src)) {
        return preloadQueue.get(src)!;
    }

    // Start preloading
    const promise = new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
            loadedImages.add(src);
            preloadQueue.delete(src);
            resolve();
        };
        img.onerror = () => {
            preloadQueue.delete(src);
            resolve(); // Resolve anyway to not block
        };
        img.src = src;
    });

    preloadQueue.set(src, promise);
    return promise;
}

// Batch preload multiple images (useful for grid views)
export function preloadImages(urls: string[], priority: "high" | "low" = "low") {
    if (priority === "high") {
        // High priority: load immediately
        urls.forEach(url => preloadImage(url));
    } else {
        // Low priority: use requestIdleCallback
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            (window as any).requestIdleCallback(() => {
                urls.forEach(url => preloadImage(url));
            });
        } else {
            // Fallback: use setTimeout
            setTimeout(() => {
                urls.forEach(url => preloadImage(url));
            }, 100);
        }
    }
}

interface CachedImageProps {
    src: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    // Dominant color for placeholder (extracted from image metadata or auto-detected)
    placeholderColor?: string;
    // Whether to show shimmer effect while loading
    shimmer?: boolean;
    // Callback when image loads
    onLoad?: () => void;
    // Loading priority
    priority?: boolean;
}

export const CachedImage = memo(function CachedImage({
    src,
    alt,
    className,
    style,
    placeholderColor = "#1a1a1a",
    shimmer = true,
    onLoad,
    priority = false,
}: CachedImageProps) {
    // Check if image is already in cache
    const isPreloaded = loadedImages.has(src);
    const [isLoaded, setIsLoaded] = useState(isPreloaded);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Start preloading on mount if not already loaded
    useEffect(() => {
        if (!isPreloaded && src) {
            preloadImage(src).then(() => {
                setIsLoaded(true);
                onLoad?.();
            });
        }
    }, [src, isPreloaded, onLoad]);

    // Handle native image load (backup)
    const handleLoad = () => {
        loadedImages.add(src);
        setIsLoaded(true);
        onLoad?.();
    };

    const handleError = () => {
        setHasError(true);
    };

    return (
        <div
            className={cn("relative overflow-hidden", className)}
            style={{
                backgroundColor: placeholderColor,
                ...style,
            }}
        >
            {/* Shimmer placeholder */}
            {shimmer && !isLoaded && !hasError && (
                <div className="absolute inset-0 shimmer-effect" />
            )}

            {/* Actual image */}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    isLoaded ? "opacity-100" : "opacity-0"
                )}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                onLoad={handleLoad}
                onError={handleError}
            />

            {/* Error state */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                    <span className="text-xs text-white/40">Failed to load</span>
                </div>
            )}
        </div>
    );
});

// Hook to preload images when they come into view
export function useImagePreloader(imageUrls: string[]) {
    useEffect(() => {
        if (imageUrls.length === 0) return;

        // Preload first batch immediately (above the fold)
        const immediateBatch = imageUrls.slice(0, 12);
        preloadImages(immediateBatch, "high");

        // Preload rest with low priority
        const restBatch = imageUrls.slice(12);
        if (restBatch.length > 0) {
            preloadImages(restBatch, "low");
        }
    }, [imageUrls]);
}

// Check if an image is cached
export function isImageCached(src: string): boolean {
    return loadedImages.has(src);
}

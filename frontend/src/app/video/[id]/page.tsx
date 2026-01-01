"use client";

import { AppShell } from "@/components/layout";
import { ImageCard } from "@/components/features/ImageCard";
import { Button } from "@/components/ui/Button";
import { api, type Image, type Video } from "@/lib/api";
import {
    ArrowLeft,
    Play,
    Clock,
    Images,
    Calendar,
    Activity,
    RotateCw,
    Trash2,
    Grid,
    ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VideoDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const [video, setVideo] = useState<Video | null>(null);
    const [frames, setFrames] = useState<Image[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const videoId = params.id;

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);

            // Get video list and find the one we need
            const videosResult = await api.getVideos();
            let videoList = videosResult.data || [];

            const found = videoList.find((v) => v.id === videoId);
            if (found) {
                setVideo(found);
            } else {
                setError("Video not found");
                setIsLoading(false);
                return;
            }

            // Get frames from this video
            const framesResult = await api.getImagesByVideo(videoId);
            if (framesResult.data) {
                setFrames(framesResult.data.images || []);
            }

            setIsLoading(false);
        }

        loadData();
    }, [videoId]);

    const handleDelete = async () => {
        if (!confirm("Are you sure? This will delete the video and all extracted frames.")) {
            return;
        }

        setIsDeleting(true);
        const result = await api.deleteVideo(videoId);
        if (result.data?.success) {
            router.push("/videos");
        } else {
            alert(result.error || "Failed to delete video");
            setIsDeleting(false);
        }
    };

    const formatDuration = (duration?: string | number) => {
        if (!duration) return "0m 0s";
        const seconds = typeof duration === "string" ? parseInt(duration, 10) : duration;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };

    if (isLoading) {
        return (
            <AppShell>
                <div className="p-10">
                    <div className="h-8 w-32 bg-white/5 rounded animate-pulse mb-6" />
                    <div className="flex gap-8">
                        <div className="w-80 aspect-video bg-white/5 rounded-xl animate-pulse" />
                        <div className="flex-1 space-y-4">
                            <div className="h-8 w-64 bg-white/5 rounded animate-pulse" />
                            <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                        </div>
                    </div>
                </div>
            </AppShell>
        );
    }

    if (error || !video) {
        return (
            <AppShell>
                <div className="text-center py-20">
                    <h2 className="text-xl font-semibold mb-2">Video not found</h2>
                    <p className="text-text-secondary mb-6">
                        {error || "This video doesn't exist or has been removed."}
                    </p>
                    <Button variant="accent" asChild>
                        <Link href="/videos">Back to Videos</Link>
                    </Button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            {/* Header */}
            <div className="p-10 bg-black/30 border-b border-border-subtle">
                <div className="max-w-[1200px] mx-auto">
                    <div className="flex items-start gap-8">
                        {/* Thumbnail */}
                        <div className="w-80 flex-shrink-0">
                            <div className="relative aspect-video rounded-xl overflow-hidden group">
                                <img
                                    src={video.thumbnail_url || "https://via.placeholder.com/640x360?text=No+Thumbnail"}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <a
                                        href={video.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-16 h-16 rounded-full bg-accent-purple flex items-center justify-center"
                                    >
                                        <Play className="w-6 h-6 ml-1" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <Link
                                href="/videos"
                                className="inline-flex items-center gap-2 text-text-tertiary text-sm hover:text-text-secondary mb-3"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to My Videos
                            </Link>
                            <h1 className="text-2xl font-bold mb-2">{video.title || "Untitled Video"}</h1>
                            <div className="flex gap-4 text-sm text-text-secondary mb-6">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {formatDuration(video.duration)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Images className="w-4 h-4" />
                                    {video.frame_count} frames
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {video.created_at?.substring(0, 10)}
                                </span>
                                <span className="flex items-center gap-1 capitalize">
                                    <Activity className="w-4 h-4" />
                                    {video.status}
                                </span>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="accent" disabled>
                                    <RotateCw className="w-4 h-4 mr-1" />
                                    Reprocess
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    {isDeleting ? "Deleting..." : "Delete Video"}
                                </Button>
                            </div>

                            <p className="mt-6 text-sm text-text-secondary">
                                Source URL:{" "}
                                <a
                                    href={video.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent-blue hover:underline inline-flex items-center gap-1"
                                >
                                    {video.url}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Frames */}
            <div className="p-10 max-w-[1400px] mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold">Extracted Frames</h3>
                    <Button variant="secondary" size="sm" asChild>
                        <Link href={`/?video_id=${video.id}`}>
                            <Grid className="w-4 h-4 mr-1" />
                            View in Gallery
                        </Link>
                    </Button>
                </div>

                {frames.length > 0 ? (
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
                        {frames.map((image) => (
                            <ImageCard
                                key={image.id}
                                id={image.id}
                                imageUrl={image.image_url}
                                mood={image.mood}
                                colors={image.colors}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-text-secondary">
                        <p>No frames extracted yet. The video might still be processing.</p>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

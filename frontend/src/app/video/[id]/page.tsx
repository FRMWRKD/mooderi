"use client";

import { AppShell } from "@/components/layout";
import { ImageCard } from "@/components/features/ImageCard";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Play, ExternalLink, Trash2, Images, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

export default function VideoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as Id<"videos">;

    // Convex queries
    const video = useQuery(api.videos.getById, { id: videoId });
    const frames = useQuery(api.videos.getFrames, { videoId });

    // Convex mutations
    const deleteVideo = useMutation(api.videos.remove);

    const isLoading = video === undefined || frames === undefined;

    const handleDeleteVideo = async () => {
        if (!confirm("Are you sure you want to delete this video and all its frames?")) {
            return;
        }
        try {
            await deleteVideo({ id: videoId });
            router.push("/videos");
        } catch (error) {
            alert("Failed to delete video");
        }
    };

    if (isLoading) {
        return (
            <AppShell>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
                </div>
            </AppShell>
        );
    }

    // Handle case where video is not found (deleted or invalid ID)
    if (video === null) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <p className="text-text-secondary">Video not found</p>
                    <Link href="/videos">
                        <Button variant="secondary">Back to Videos</Button>
                    </Link>
                </div>
            </AppShell>
        );
    }

    const videoImages = frames || [];

    return (
        <AppShell>
            <div className="space-y-8">
                {/* Back Link */}
                <Link
                    href="/videos"
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Videos
                </Link>

                {/* Video Header */}
                {video && (
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Thumbnail */}
                        <div className="relative aspect-video w-full md:w-96 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                            <img
                                src={video.thumbnailUrl || "https://via.placeholder.com/400x225?text=Video"}
                                alt={video.title || "Video"}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <button
                                    onClick={() => window.open(video.url, "_blank")}
                                    className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                                >
                                    <Play className="w-8 h-8 text-white fill-white" />
                                </button>
                            </div>
                            {video.duration && (
                                <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs font-medium">
                                    {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                                </span>
                            )}
                        </div>

                        {/* Video Info */}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold mb-3">{video.title || "Untitled Video"}</h1>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary mb-6">
                                <span className="flex items-center gap-1.5">
                                    <Images className="w-4 h-4" />
                                    {videoImages.length} frames extracted
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    {new Date(video._creationTime).toLocaleDateString()}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${video.status === "completed"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                                    }`}>
                                    {video.status}
                                </span>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => window.open(video.url, "_blank")}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Open Source
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="text-red-400 hover:bg-red-500/10"
                                    onClick={handleDeleteVideo}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Video
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Frames Section */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">
                        Extracted Frames
                        <span className="text-text-tertiary font-normal ml-2">({videoImages.length})</span>
                    </h2>

                    {videoImages.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 rounded-xl">
                            <Images className="w-12 h-12 mx-auto mb-3 text-text-tertiary opacity-50" />
                            <p className="text-text-secondary">No frames extracted yet</p>
                        </div>
                    ) : (
                        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5">
                            {videoImages.map((image) => (
                                <ImageCard
                                    key={image._id}
                                    id={image._id}
                                    imageUrl={image.imageUrl}
                                    mood={image.mood}
                                    colors={image.colors}
                                    tags={image.tags}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

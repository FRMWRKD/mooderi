"use client";

import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
    Play,
    Clock,
    Images,
    MoreHorizontal,
    ExternalLink,
    Trash2,
    Eye,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Doc } from "@convex/_generated/dataModel";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from "@/components/ui/Dropdown";

type Video = Doc<"videos">;

export default function VideosPage() {
    const router = useRouter();

    // Real-time videos list
    const videos = useQuery(api.videos.list, {});
    const deleteVideo = useMutation(api.videos.remove);

    const isLoading = videos === undefined;

    const handleDeleteVideo = async (videoId: string) => {
        if (!confirm("Are you sure you want to delete this video and all its frames?")) {
            return;
        }
        await deleteVideo({ id: videoId as any });
    };

    const displayVideos = videos || [];

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">My Videos</h1>
                        <p className="text-sm text-text-secondary">
                            {displayVideos.length} source videos processed
                        </p>
                    </div>
                </div>

                {/* Video Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-video bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : displayVideos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {displayVideos.map((video) => (
                            <VideoCard
                                key={video._id}
                                video={video}
                                onDelete={() => handleDeleteVideo(video._id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <Play className="w-8 h-8 text-text-tertiary" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No videos yet</h2>
                        <p className="text-text-secondary mb-6">
                            Use the <strong>Add</strong> button above to analyze your first video
                        </p>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function VideoCard({
    video,
    onDelete,
}: {
    video: Video;
    onDelete: () => void;
}) {
    const isProcessing = video.status === "processing" || video.status === "downloading" || video.status === "pending";

    // Extract YouTube ID from URL for auto-generating thumbnail
    const getYouTubeId = (url: string) => {
        const patterns = [
            /(?:v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:embed\/)([a-zA-Z0-9_-]{11})/,
            /(?:shorts\/)([a-zA-Z0-9_-]{11})/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const youtubeId = getYouTubeId(video.url);

    // Generate thumbnail URL - prefer stored, fallback to YouTube API
    const thumbnailUrl = video.thumbnailUrl
        || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null)
        || "https://via.placeholder.com/400x225?text=Video";

    // Generate display title - prefer stored, fallback to platform name
    const displayTitle = video.title
        || (youtubeId ? "YouTube Video" : "Video")
        || video._id.substring(0, 8);

    return (
        <div className="group relative bg-background-glass border border-border-subtle rounded-xl overflow-hidden transition-all hover:border-border-light hover:shadow-glass">
            {/* Thumbnail */}
            <div className="relative aspect-video">
                <img
                    src={thumbnailUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                />

                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <span className="text-sm text-text-secondary capitalize">{video.status}...</span>
                        </div>
                    </div>
                )}

                {/* Duration Badge */}
                {video.duration && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs font-medium">
                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                    </span>
                )}

                {/* YouTube Badge */}
                {youtubeId && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 rounded text-xs font-medium flex items-center gap-1">
                        <Play className="w-3 h-3 fill-current" />
                        YouTube
                    </span>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link href={`/video/${video._id}`}>
                        <Button variant="default" size="sm">
                            <Eye className="w-4 h-4" />
                            View Frames
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Info */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate mb-1">{displayTitle}</h3>
                        <div className="flex items-center gap-3 text-xs text-text-secondary">
                            <span className="flex items-center gap-1">
                                <Images className="w-3.5 h-3.5" />
                                {video.frameCount || 0} frames
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(video._creationTime).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* Actions Dropdown */}
                    <Dropdown>
                        <DropdownTrigger asChild>
                            <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </DropdownTrigger>
                        <DropdownContent align="end">
                            <DropdownItem asChild>
                                <Link href={`/video/${video._id}`} className="flex items-center">
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Frames
                                </Link>
                            </DropdownItem>
                            <DropdownItem onClick={() => window.open(video.url, "_blank")}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open Source
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem className="text-red-400" onClick={onDelete}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </DropdownItem>
                        </DropdownContent>
                    </Dropdown>
                </div>
            </div>
        </div>
    );
}

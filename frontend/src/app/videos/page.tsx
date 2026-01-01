"use client";

import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
    Modal,
    ModalTrigger,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
} from "@/components/ui/Modal";
import {
    Play,
    Clock,
    Images,
    MoreHorizontal,
    ExternalLink,
    Trash2,
    Eye,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, type Video } from "@/lib/api";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from "@/components/ui/Dropdown";

export default function VideosPage() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [videoUrl, setVideoUrl] = useState("");
    const [quality, setQuality] = useState<"strict" | "medium" | "high">("medium");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        loadVideos();
    }, []);

    const loadVideos = async () => {
        setIsLoading(true);
        const result = await api.getVideos();
        if (result.data && result.data.length > 0) {
            setVideos(result.data);
        } else {
            // No videos found - show empty state
            setVideos([]);
        }
        setIsLoading(false);
    };

    const handleStartAnalysis = async () => {
        if (!videoUrl.trim()) {
            setError("Please enter a valid video URL");
            return;
        }

        setError(null);
        setIsAnalyzing(true);

        try {
            const result = await api.analyzeVideo(videoUrl, quality);
            if (result.data?.job_id) {
                setIsModalOpen(false);
                setVideoUrl("");
                // Refresh the video list
                loadVideos();
            } else {
                setError(result.error || "Failed to start analysis");
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeleteVideo = async (videoId: string) => {
        if (!confirm("Are you sure you want to delete this video and all its frames?")) {
            return;
        }
        const result = await api.deleteVideo(videoId);
        if (result.data?.success) {
            loadVideos();
        } else {
            alert(result.error || "Failed to delete video");
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        setVideoUrl("");
        setError(null);
    };

    const displayVideos = videos;

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">My Videos</h1>
                        <p className="text-sm text-text-secondary">
                            {displayVideos.length} source videos processed
                        </p>
                    </div>
                    <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <ModalTrigger asChild>
                            <Button variant="accent" onClick={() => setIsModalOpen(true)}>
                                <Play className="w-4 h-4" />
                                New Video
                            </Button>
                        </ModalTrigger>
                        <ModalContent className="max-w-md">
                            <ModalHeader>
                                <ModalTitle>Analyze Video</ModalTitle>
                                <ModalCloseButton />
                            </ModalHeader>
                            <ModalBody className="space-y-6">
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 block">
                                        YouTube or Vimeo URL
                                    </label>
                                    <Input
                                        placeholder="https://youtube.com/watch?v=..."
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                    />
                                    {error && (
                                        <p className="text-sm text-red-400 mt-2">{error}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm text-text-secondary mb-3 block">
                                        Frame Selection Quality
                                    </label>
                                    <div className="space-y-2">
                                        {(["strict", "medium", "high"] as const).map((q) => (
                                            <label
                                                key={q}
                                                className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${quality === q
                                                    ? "border-accent-blue bg-accent-blue/5"
                                                    : "border-border-subtle hover:border-border-light"
                                                    }`}
                                                onClick={() => setQuality(q)}
                                            >
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${quality === q ? "border-accent-blue" : "border-text-tertiary"
                                                    }`}>
                                                    {quality === q && <div className="w-2.5 h-2.5 rounded-full bg-accent-blue" />}
                                                </div>
                                                <span className="font-medium capitalize">{q}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                                <Button
                                    variant="default"
                                    onClick={handleStartAnalysis}
                                    disabled={isAnalyzing || !videoUrl.trim()}
                                >
                                    {isAnalyzing ? "Analyzing..." : "▶ Start Analysis"}
                                </Button>
                            </ModalFooter>
                        </ModalContent>
                    </Modal>
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
                                key={video.id}
                                video={video}
                                onDelete={() => handleDeleteVideo(video.id)}
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
                            Analyze your first video to extract cinematic frames
                        </p>
                        <Button variant="accent" onClick={() => setIsModalOpen(true)}>
                            <Play className="w-4 h-4" />
                            Analyze Video
                        </Button>
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
    const isProcessing = video.status === "processing";

    return (
        <div className="group relative bg-background-glass border border-border-subtle rounded-xl overflow-hidden transition-all hover:border-border-light hover:shadow-glass">
            {/* Thumbnail */}
            <div className="relative aspect-video">
                <img
                    src={video.thumbnail_url || "https://via.placeholder.com/400x225?text=Video"}
                    alt={video.title}
                    className="w-full h-full object-cover"
                />

                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <span className="text-sm text-text-secondary">Processing...</span>
                        </div>
                    </div>
                )}

                {/* Duration Badge */}
                <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs font-medium">
                    {video.duration}
                </span>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link href={`/video/${video.id}`}>
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
                        <h3 className="font-medium truncate mb-1">{video.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-text-secondary">
                            <span className="flex items-center gap-1">
                                <Images className="w-3.5 h-3.5" />
                                {video.frame_count} frames
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {video.created_at?.substring(0, 10)}
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
                                <Link href={`/video/${video.id}`} className="flex items-center">
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


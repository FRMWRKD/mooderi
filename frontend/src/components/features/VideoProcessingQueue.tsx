"use client";

import { useState, useEffect } from "react";
import { X, Minimize2, Maximize2, Play, Check, AlertCircle, Loader2, Plus, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useVideoJobs, type VideoJob } from "@/contexts/VideoJobContext";
import { api } from "@/lib/api";
import { FrameSelectionModal } from "./FrameSelectionModal";

export function VideoProcessingQueue() {
    const { jobs, addJob, removeJob, clearCompleted, activeCount } = useVideoJobs();
    const [isMinimized, setIsMinimized] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [newUrl, setNewUrl] = useState("");
    const [quality, setQuality] = useState<"strict" | "medium" | "high">("medium");
    const [isAdding, setIsAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    // Frame selection modal state
    const [showFrameModal, setShowFrameModal] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [pendingFrames, setPendingFrames] = useState<string[]>([]);
    const [pendingVideoUrl, setPendingVideoUrl] = useState("");
    const [autoOpenedJobs, setAutoOpenedJobs] = useState<Set<string>>(new Set());

    // AUTO-OPEN modal when job reaches pending_approval
    useEffect(() => {
        const pendingJob = jobs.find(j =>
            j.status === "pending_approval" &&
            !autoOpenedJobs.has(j.id) &&
            !showFrameModal
        );

        if (pendingJob) {
            console.log("[VideoQueue] Auto-opening frame modal for job:", pendingJob.id);
            // Mark as auto-opened to prevent reopening
            setAutoOpenedJobs(prev => new Set([...prev, pendingJob.id]));
            // Trigger review click
            (async () => {
                try {
                    const framesResult = await api.getVideoFrames(pendingJob.id);
                    const frames = framesResult.data?.selected_frames || framesResult.data?.frames;
                    if (frames && frames.length > 0) {
                        const frameUrls = frames.map((f: { url?: string; image_url?: string }) => f.url || f.image_url || "");
                        setPendingFrames(frameUrls.filter(Boolean));
                        setPendingVideoUrl(pendingJob.url);
                        setSelectedJobId(pendingJob.id);
                        setShowFrameModal(true);
                    }
                } catch (e) {
                    console.error("Auto-open failed:", e);
                }
            })();
        }
    }, [jobs, autoOpenedJobs, showFrameModal]);

    const handleReviewClick = async (job: VideoJob) => {
        if (job.status !== "pending_approval") return;

        try {
            const framesResult = await api.getVideoFrames(job.id);
            // API returns selected_frames with url property
            const frames = framesResult.data?.selected_frames || framesResult.data?.frames;
            if (frames && frames.length > 0) {
                // Handle both url and image_url formats
                const frameUrls = frames.map((f: { url?: string; image_url?: string }) => f.url || f.image_url || "");
                const videoSource = job.url;

                setPendingFrames(frameUrls.filter(Boolean));
                setPendingVideoUrl(videoSource);
                setSelectedJobId(job.id);
                setShowFrameModal(true);
            } else {
                alert("No frames available for review");
            }
        } catch (e) {
            console.error("Failed to fetch frames", e);
            alert("Failed to load frames for review");
        }
    };

    const addVideo = async () => {
        if (!newUrl.trim()) return;

        setIsAdding(true);
        try {
            const result = await api.analyzeVideo(newUrl, quality);
            if (result.data?.job_id) {
                addJob(result.data.job_id, newUrl);
                setNewUrl("");
                setShowAddForm(false);
            } else {
                alert(result.error || "Failed to start video processing");
            }
        } catch (e) {
            alert("Failed to add video");
        } finally {
            setIsAdding(false);
        }
    };

    const completedCount = jobs.filter(j =>
        j.status === "completed" || j.status === "pending_approval"
    ).length;

    // Don't render if no jobs and not adding
    if (jobs.length === 0 && !showAddForm) {
        return null;
    }

    return (
        <div className={`fixed bottom-6 right-6 z-40 transition-all duration-300 ${isMinimized ? "w-auto" : "w-96"
            }`}>
            {/* Minimized State */}
            {isMinimized ? (
                <button
                    onClick={() => setIsMinimized(false)}
                    className="flex items-center gap-3 px-4 py-3 bg-black border border-white/30 hover:border-white/50 transition-all shadow-2xl"
                >
                    <div className="relative">
                        <Play className="w-5 h-5" />
                        {activeCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-blue text-[10px] flex items-center justify-center rounded-full font-bold">
                                {activeCount}
                            </span>
                        )}
                    </div>
                    <span className="text-sm font-medium">
                        {activeCount > 0 ? `${activeCount} processing` : `${jobs.length} videos`}
                    </span>
                    <Maximize2 className="w-4 h-4 text-white/50" />
                </button>
            ) : (
                /* Expanded State */
                <div className="bg-black border border-white/30 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-white/5">
                        <div className="flex items-center gap-2">
                            <Play className="w-4 h-4" />
                            <span className="font-medium text-sm">Video Queue</span>
                            {activeCount > 0 && (
                                <span className="px-2 py-0.5 bg-accent-blue/20 text-accent-blue text-xs font-mono">
                                    {activeCount} active
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {isExpanded && (
                        <>
                            {/* Job List */}
                            <div className="max-h-64 overflow-y-auto">
                                {jobs.length === 0 ? (
                                    <div className="p-6 text-center text-text-tertiary text-sm">
                                        No videos in queue
                                    </div>
                                ) : (
                                    jobs.map((job) => (
                                        <JobItem
                                            key={job.id}
                                            job={job}
                                            onRemove={() => removeJob(job.id)}
                                            onReview={() => handleReviewClick(job)}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Add Form */}
                            {showAddForm ? (
                                <div className="p-4 border-t border-white/20 space-y-3">
                                    <Input
                                        placeholder="YouTube or Vimeo URL..."
                                        value={newUrl}
                                        onChange={(e) => setNewUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && addVideo()}
                                    />
                                    <div className="flex gap-2">
                                        {(["strict", "medium", "high"] as const).map((q) => (
                                            <button
                                                key={q}
                                                onClick={() => setQuality(q)}
                                                className={`flex-1 py-1.5 text-xs font-medium border transition-all ${quality === q
                                                    ? "border-accent-blue bg-accent-blue/10 text-white"
                                                    : "border-white/20 text-text-tertiary hover:border-white/40"
                                                    }`}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setShowAddForm(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1"
                                            onClick={addVideo}
                                            disabled={isAdding || !newUrl.trim()}
                                        >
                                            {isAdding ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Add"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 border-t border-white/20 flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => setShowAddForm(true)}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Video
                                    </Button>
                                    {completedCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearCompleted}
                                        >
                                            Clear done
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Frame Selection Modal */}
            <FrameSelectionModal
                isOpen={showFrameModal}
                onClose={() => setShowFrameModal(false)}
                jobId={selectedJobId || ""}
                frames={pendingFrames}
                videoUrl={pendingVideoUrl}
                onComplete={() => {
                    setShowFrameModal(false);
                    setPendingFrames([]);
                    setSelectedJobId(null);
                }}
            />
        </div>
    );
}

function JobItem({ job, onRemove, onReview }: { job: VideoJob; onRemove: () => void; onReview: () => void }) {
    const isClickable = job.status === "pending_approval";
    const [dots, setDots] = useState("");

    // Animated dots for processing status
    useEffect(() => {
        if (job.status !== "processing" && job.status !== "queued") return;
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? "" : prev + ".");
        }, 400);
        return () => clearInterval(interval);
    }, [job.status]);

    const getStatusIcon = () => {
        switch (job.status) {
            case "queued":
                return <div className="w-4 h-4 border-2 border-white/30 border-t-white/60 rounded-full animate-spin" />;
            case "processing":
                return <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />;
            case "pending_approval":
            case "completed":
                return <Check className="w-4 h-4 text-green-500" />;
            case "failed":
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = () => {
        switch (job.status) {
            case "queued":
                return "Waiting to start" + dots;
            case "processing":
                return job.stage ? `${job.stage}${dots}` : `Processing${dots}`;
            case "pending_approval":
                return "Ready for review ✨";
            case "completed":
                return "Completed ✓";
            case "failed":
                return job.error || "Failed";
            default:
                return job.status;
        }
    };

    return (
        <div
            className={`px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors group ${isClickable ? "cursor-pointer hover:bg-accent-blue/10" : ""
                }`}
            onClick={isClickable ? onReview : undefined}
        >
            <div className="flex items-start gap-3">
                <div className="pt-0.5">
                    {getStatusIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className={`text-xs mt-0.5 ${job.status === "processing" ? "text-accent-blue" : "text-text-tertiary"}`}>
                        {getStatusText()}
                    </p>

                    {/* Progress Bar */}
                    {(job.status === "processing" || job.status === "queued") && (
                        <div className="mt-2 space-y-1">
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-accent-blue to-blue-400 transition-all duration-300 ease-out"
                                    style={{ width: `${Math.round(job.progress)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-text-tertiary">
                                {Math.round(job.progress)}% complete
                            </p>
                        </div>
                    )}

                    {/* Review Button for pending approval */}
                    {isClickable && (
                        <button
                            className="mt-2 px-3 py-1 text-xs font-medium bg-accent-blue/20 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/30 transition-colors flex items-center gap-1.5"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReview();
                            }}
                        >
                            <Eye className="w-3 h-3" />
                            Review Frames
                        </button>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="p-1 text-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}


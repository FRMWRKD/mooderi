"use client";

import { Search, Bell, Coins, Plus, Lightbulb, Video, FolderPlus, Sparkles, Upload, ChevronDown } from "lucide-react";
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
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from "@/components/ui/Dropdown";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useVideoJobs } from "@/contexts/VideoJobContext";
import { CreditsModal } from "@/components/features/CreditsModal";
import { FrameSelectionModal } from "@/components/features/FrameSelectionModal";
import { UploadModal } from "@/components/features/UploadModal";
import { SmartBoardModal } from "@/components/features/SmartBoardModal";
import { NewBoardModal } from "@/components/features/NewBoardModal";

export function TopBar() {
    // Auth
    const { user } = useAuth();

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSemanticSearch, setIsSemanticSearch] = useState(false);

    // Video modal state
    const [videoUrl, setVideoUrl] = useState("");
    const [quality, setQuality] = useState<"strict" | "medium" | "high">("medium");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Convex Data
    // User data for credits (uses getCurrent which works with Convex Auth)
    const userData = useQuery(api.users.getCurrent);
    const credits = userData?.credits ?? 0;

    // Notifications data
    const notificationsData = useQuery(api.notifications.list, { limit: 20 });
    const notifications = notificationsData?.notifications ?? [];
    const unreadCount = notificationsData?.unreadCount ?? 0;

    // Actions & Mutations
    const markAsRead = useMutation(api.notifications.markAsRead);
    const createVideo = useMutation(api.videos.create);
    const analyzeVideo = useAction(api.videos.analyze);

    const [showNotifications, setShowNotifications] = useState(false);
    const { addJob: addVideoJob, updateJobStatus, hasActiveJobs, activeCount } = useVideoJobs();
    const router = useRouter();
    const pathname = usePathname();
    const [showCreditsModal, setShowCreditsModal] = useState(false);

    // Video Processing State
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [pendingJobId, setPendingJobId] = useState<string | null>(null);
    const [showFrameSelection, setShowFrameSelection] = useState(false);
    const [pendingFrames, setPendingFrames] = useState<string[]>([]);
    const [pendingVideoUrl, setPendingVideoUrl] = useState("");
    
    // Track videos that have already been shown in frame selection modal
    // Uses sessionStorage to persist across page navigations
    const getShownVideoIds = useCallback((): Set<string> => {
        if (typeof window === 'undefined') return new Set();
        try {
            const stored = sessionStorage.getItem('shownFrameSelectionVideoIds');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    }, []);
    
    const markVideoAsShown = useCallback((videoId: string) => {
        if (typeof window === 'undefined') return;
        try {
            const shown = getShownVideoIds();
            shown.add(videoId);
            sessionStorage.setItem('shownFrameSelectionVideoIds', JSON.stringify(Array.from(shown)));
        } catch {
            // Ignore storage errors
        }
    }, [getShownVideoIds]);

    // Note: activeVideo/activeFrames queries removed - synchronous path handles everything now

    // Monitor video status changes - DISABLED
    // The synchronous path in handleStartAnalysis handles everything.
    // This fallback was causing the modal to reappear on page navigation.
    // If async processing is needed in the future, this can be re-enabled with better guards.
    /*
    useEffect(() => {
        if (!activeVideo) return;
        
        // Don't process if we already have frames showing (synchronous path handled it)
        if (showFrameSelection || pendingFrames.length > 0) {
            return;
        }
        
        // Don't re-show modal for videos we've already handled
        const shownIds = getShownVideoIds();
        if (shownIds.has(activeVideo._id)) {
            return;
        }

        if (activeVideo.status === "pending_approval" && activeFrames && activeFrames.length > 0) {
            // Mark this video as shown so we don't re-show it
            markVideoAsShown(activeVideo._id);
            
            // Ready for frame selection
            const frameUrls = activeFrames.map(f => f.imageUrl);
            setPendingFrames(frameUrls);
            setPendingVideoUrl(activeVideo.url);
            setPendingJobId(activeVideo._id);
            setShowFrameSelection(true);
            setActiveJobId(null); // Stop monitoring
            setIsAnalyzing(false);
        } else if (activeVideo.status === "failed") {
            markVideoAsShown(activeVideo._id);
            setError("Analysis failed: " + ((activeVideo as any).errorMessage || "Unknown error"));
            setActiveJobId(null);
            setIsAnalyzing(false);
            setIsVideoModalOpen(true);
        } else if (activeVideo.status === "completed") {
            markVideoAsShown(activeVideo._id);
            setActiveJobId(null);
            setIsAnalyzing(false);
            router.push("/videos");
        }
    }, [activeVideo, activeFrames, router, getShownVideoIds, markVideoAsShown, showFrameSelection, pendingFrames.length]);
    */

    // Refresh credits helper (mostly redundant with reactive Update but kept for manual triggers)
    const refreshCredits = useCallback(async () => {
        // No-op in Convex as useQuery updates automatically
    }, []);

    const handleStartAnalysis = async () => {
        if (!videoUrl.trim()) {
            setError("Please enter a valid video URL");
            return;
        }

        setError(null);
        setIsAnalyzing(true);

        try {
            // 1. Create entry in Convex
            const result = await createVideo({
                url: videoUrl,
                qualityMode: quality,
                title: "New Video",
                userId: userData?._id,
            });

            if (!result.success || !result.id) {
                throw new Error("Failed to create video entry");
            }

            const videoId = result.id;
            setActiveJobId(videoId);
            addVideoJob(videoId, videoUrl); // Add to shared context

            // 2. Trigger Modal Analysis
            console.log("[TopBar] Calling analyzeVideo with:", { videoId, videoUrl, qualityMode: quality });
            try {
                const analyzeResult = await analyzeVideo({
                    videoId: videoId,
                    videoUrl,
                    qualityMode: quality
                });
                console.log("[TopBar] analyzeVideo result:", analyzeResult);
                
                // Analysis completed - check if we got frames back
                if (analyzeResult.status === "pending_approval" && analyzeResult.selected_frames?.length > 0) {
                    // Mark this video as shown to prevent re-showing
                    markVideoAsShown(videoId);
                    
                    // Update job status in context to show completion
                    updateJobStatus(videoId, "pending_approval", "Ready for review!");
                    
                    // Show frame selection modal directly
                    const frameUrls = analyzeResult.selected_frames.map((f: any) => f.url);
                    setPendingFrames(frameUrls);
                    setPendingVideoUrl(videoUrl);
                    setPendingJobId(videoId);
                    setShowFrameSelection(true);
                    setIsVideoModalOpen(false);
                    setVideoUrl("");
                    setIsAnalyzing(false);
                    setActiveJobId(null);
                    console.log("[TopBar] Opening frame selection with", frameUrls.length, "frames");
                    return;
                }
            } catch (analyzeErr: any) {
                console.error("[TopBar] analyzeVideo failed:", analyzeErr);
                const errorMsg = analyzeErr.message || String(analyzeErr);
                // Show user-friendly error
                if (errorMsg.includes("No scenes found")) {
                    setError("No scenes could be extracted from this video. Try a longer video or different quality setting.");
                } else if (errorMsg.includes("rate limit")) {
                    setError("Rate limit exceeded. Please wait a few minutes before processing another video.");
                } else {
                    setError(`Video analysis failed: ${errorMsg}`);
                }
                // Update job status to failed
                updateJobStatus(videoId, "failed", "Analysis failed");
                setIsAnalyzing(false);
                setActiveJobId(null);
                return; // Don't throw, we've handled the error
            }

            setIsVideoModalOpen(false); // Close input modal
            setVideoUrl("");
            setIsAnalyzing(false);
            console.log("[TopBar] Started analysis:", videoId);

        } catch (e) {
            console.error("Analysis start error:", e);
            setError("Failed to start analysis: " + (e instanceof Error ? e.message : "Unknown error"));
            setIsAnalyzing(false);
            setActiveJobId(null);
        }
    };

    const handleCancelVideo = () => {
        setIsVideoModalOpen(false);
        setVideoUrl("");
        setError(null);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            const type = isSemanticSearch ? "semantic" : "text";
            router.push(`/?q=${encodeURIComponent(searchQuery)}&type=${type}`);
        }
    };

    return (
        <>
            <header className="h-[72px] flex items-center justify-between px-8 border-b border-white/20 bg-black sticky top-0 z-30">
                {/* Search Bar - Now in Header */}
                <form onSubmit={handleSearch} className="flex-1 max-w-xl relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-white/40 group-focus-within:text-white transition-colors" />
                    </div>
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search images..."
                        className="w-full bg-white/5 border border-white/10 py-2 pl-10 pr-24 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30 transition-all"
                    />
                    {/* Search Type Toggle */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        <button
                            type="button"
                            onClick={() => setIsSemanticSearch(!isSemanticSearch)}
                            className={`px-2 py-1 text-xs font-medium transition-all flex items-center gap-1 ${isSemanticSearch ? "bg-accent-purple text-white" : "text-white/50 hover:text-white"
                                }`}
                        >
                            <Lightbulb className="w-3 h-3" />
                            AI
                        </button>
                    </div>
                </form>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Processing Indicator */}
                {(activeJobId || hasActiveJobs) && (
                    <div className="mr-4 flex items-center gap-3 px-4 py-2 bg-accent-blue/10 border border-accent-blue/30 rounded-full animate-pulse">
                        <div className="w-2 h-2 bg-accent-blue rounded-full" />
                        <span className="text-sm font-medium text-accent-blue">
                            {activeCount > 1 ? `Processing ${activeCount} Videos...` : "Processing Video..."}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {/* Credits Badge */}
                    <button
                        onClick={() => setShowCreditsModal(true)}
                        className="flex items-center gap-2 px-3 py-2 border border-white/20 hover:border-white/40 transition-colors text-sm"
                    >
                        <Coins className="w-4 h-4 text-white/60" />
                        <span className="font-mono">
                            <span className="font-medium">{credits}</span>
                        </span>
                    </button>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-all relative border border-transparent hover:border-white/20"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-4 h-4 bg-white text-black text-[10px] flex items-center justify-center font-mono">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 top-12 w-80 bg-black border border-white/20 shadow-2xl z-50 overflow-hidden">
                                <div className="flex items-center justify-between p-3 border-b border-white/20">
                                    <span className="font-mono text-sm uppercase tracking-wider">Notifications</span>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={() => {
                                                markAsRead({}); // Mark all as read
                                                setShowNotifications(false);
                                            }}
                                            className="text-xs text-white/60 hover:text-white underline"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-6 text-center text-text-tertiary text-sm">
                                            No notifications yet
                                        </div>
                                    ) : (
                                        notifications.slice(0, 10).map((n) => (
                                            <div
                                                key={n._id}
                                                className={`p-3 border-b border-white/10 hover:bg-white/5 cursor-pointer ${!n.isRead ? 'bg-white/5' : ''}`}
                                                onClick={() => {
                                                    if (!n.isRead) {
                                                        markAsRead({ notificationId: n._id });
                                                    }
                                                }}
                                            >
                                                <p className="text-sm">{n.title}</p>
                                                <p className="text-xs text-white/50 mt-0.5">{n.message}</p>
                                                <p className="text-xs text-white/30 mt-1 font-mono">{new Date(n._creationTime).toLocaleString()}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Unified Add Dropdown */}
                    <Dropdown>
                        <DropdownTrigger asChild>
                            <Button variant="accent" className="gap-2">
                                <Plus className="w-4 h-4" />
                                Add
                                <ChevronDown className="w-3 h-3 opacity-60" />
                            </Button>
                        </DropdownTrigger>
                        <DropdownContent align="end" className="w-48">
                            <DropdownItem onClick={() => setIsVideoModalOpen(true)}>
                                <Video className="w-4 h-4 mr-2" />
                                New Video
                            </DropdownItem>
                            <UploadModal
                                trigger={
                                    <DropdownItem onSelect={(e) => e.preventDefault()}>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Image
                                    </DropdownItem>
                                }
                                onImageUploaded={() => router.refresh()}
                            />
                            <DropdownSeparator />
                            <NewBoardModal
                                trigger={
                                    <DropdownItem onSelect={(e) => e.preventDefault()}>
                                        <FolderPlus className="w-4 h-4 mr-2" />
                                        New Board
                                    </DropdownItem>
                                }
                                onBoardCreated={(board) => router.push(`/folder/${board.id}`)}
                            />
                            <SmartBoardModal
                                trigger={
                                    <DropdownItem onSelect={(e) => e.preventDefault()}>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Smart Board
                                    </DropdownItem>
                                }
                            />
                        </DropdownContent>
                    </Dropdown>
                </div>
            </header>

            {/* Video Analysis Modal */}
            <Modal open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
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
                                <QualityOption
                                    value="strict"
                                    label="Strict"
                                    description="Fewer frames, highest quality"
                                    badge="Saves credits"
                                    isSelected={quality === "strict"}
                                    onSelect={() => setQuality("strict")}
                                />
                                <QualityOption
                                    value="medium"
                                    label="Medium"
                                    description="Balanced selection"
                                    badge="Recommended"
                                    isSelected={quality === "medium"}
                                    onSelect={() => setQuality("medium")}
                                />
                                <QualityOption
                                    value="high"
                                    label="High"
                                    description="More frames, minimal cuts"
                                    badge="Most frames"
                                    isSelected={quality === "high"}
                                    onSelect={() => setQuality("high")}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-text-tertiary flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full border border-text-tertiary flex items-center justify-center text-[10px]">
                                i
                            </span>
                            Credits charged only for frames you approve.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="secondary" onClick={handleCancelVideo}>Cancel</Button>
                        <Button
                            variant="default"
                            onClick={handleStartAnalysis}
                            disabled={isAnalyzing || !videoUrl.trim()}
                        >
                            {isAnalyzing ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <span className="mr-1">▶</span> Start Analysis
                                </>
                            )}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Credits Modal */}
            <CreditsModal
                isOpen={showCreditsModal}
                onClose={() => setShowCreditsModal(false)}
                credits={credits}
            />

            {/* Frame Selection Modal */}
            {/* Frame Selection Modal - only render when we have frames and should show */}
            {showFrameSelection && pendingFrames.length > 0 && pendingJobId && (
                <FrameSelectionModal
                    isOpen={true}
                    onClose={() => {
                        console.log("[TopBar] onClose called, pendingJobId:", pendingJobId);
                        // Mark video as shown so it doesn't reappear
                        if (pendingJobId) {
                            markVideoAsShown(pendingJobId);
                        }
                        // Clear all frame selection state when modal closes
                        console.log("[TopBar] Setting showFrameSelection to false");
                        setShowFrameSelection(false);
                        setPendingFrames([]);
                        setPendingJobId(null);
                        setPendingVideoUrl("");
                        console.log("[TopBar] onClose finished");
                    }}
                    jobId={pendingJobId}
                    frames={pendingFrames}
                    videoUrl={pendingVideoUrl}
                    onComplete={({ count, isPublic }) => {
                        console.log("[TopBar] onComplete called with count:", count, "isPublic:", isPublic);
                        // Mark video as shown so it doesn't reappear
                        if (pendingJobId) {
                            markVideoAsShown(pendingJobId);
                            updateJobStatus(pendingJobId, "completed", "Frames saved!");
                        }
                        // Clear all frame selection state - this will unmount the modal
                        console.log("[TopBar] Clearing state to unmount modal");
                        setShowFrameSelection(false);
                        setPendingFrames([]);
                        setPendingJobId(null);
                        setPendingVideoUrl("");
                        // Refresh credits after frame approval
                        refreshCredits();
                        console.log("[TopBar] onComplete finished");
                    }}
                />
            )}
        </>
    );
}

function QualityOption({
    value,
    label,
    description,
    badge,
    isSelected = false,
    onSelect,
}: {
    value: string;
    label: string;
    description: string;
    badge: string;
    isSelected?: boolean;
    onSelect?: () => void;
}) {
    return (
        <label
            className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                ? "border-accent-blue bg-accent-blue/5"
                : "border-border-subtle hover:border-border-light"
                }`}
            onClick={onSelect}
        >
            <input
                type="radio"
                name="quality"
                value={value}
                checked={isSelected}
                onChange={() => onSelect?.()}
                className="sr-only"
            />
            <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-accent-blue" : "border-text-tertiary"
                    }`}
            >
                {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
                )}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-text-tertiary">{badge}</span>
                </div>
                <span className="text-sm text-text-secondary">{description}</span>
            </div>
        </label>
    );
}

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
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useVideoJobs } from "@/contexts/VideoJobContext";
import { CreditsModal } from "@/components/features/CreditsModal";
import { FrameSelectionModal } from "@/components/features/FrameSelectionModal";
import { UploadModal } from "@/components/features/UploadModal";
import { SmartBoardModal } from "@/components/features/SmartBoardModal";
import { NewBoardModal } from "@/components/features/NewBoardModal";

export function TopBar() {
    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSemanticSearch, setIsSemanticSearch] = useState(false);

    // Video modal state
    const [videoUrl, setVideoUrl] = useState("");
    const [quality, setQuality] = useState<"strict" | "medium" | "high">("medium");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Credits & notifications
    const [credits, setCredits] = useState<number>(100);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<Array<{
        id: string;
        title: string;
        message: string;
        type: string;
        is_read: boolean;
        created_at: string;
    }>>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const { user } = useAuth();
    const { addJob: addVideoJob, hasActiveJobs, activeCount } = useVideoJobs();
    const router = useRouter();
    const pathname = usePathname();
    const [showCreditsModal, setShowCreditsModal] = useState(false);

    // Video Processing State
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [pendingJobId, setPendingJobId] = useState<string | null>(null);
    const [showFrameSelection, setShowFrameSelection] = useState(false);
    const [pendingFrames, setPendingFrames] = useState<string[]>([]);
    const [pendingVideoUrl, setPendingVideoUrl] = useState("");

    // Poll for job status
    useEffect(() => {
        if (!activeJobId) return;

        const interval = setInterval(async () => {
            try {
                const result = await api.getVideoStatus(activeJobId);
                console.log("Job status:", result.data?.status);

                if (result.data) {
                    if (result.data.status === "pending_approval") {
                        // Ready for frame selection
                        const framesResult = await api.getVideoFrames(activeJobId);
                        if (framesResult.data && framesResult.data.frames) {
                            // Map Image objects to URL strings
                            const frameUrls = framesResult.data.frames.map(f => f.image_url);
                            // Get video source URL from first frame if available
                            const videoSource = framesResult.data.frames[0]?.source_video_url || "";

                            setPendingFrames(frameUrls);
                            setPendingVideoUrl(videoSource);
                            setPendingJobId(activeJobId);
                            setShowFrameSelection(true);
                            setActiveJobId(null); // Stop polling
                        }
                    } else if (result.data.status === "failed") {
                        // Type assertion to bypass potential type mismatch if message is not in definition
                        const errorMessage = (result.data as any).message || "Unknown error";
                        setError("Analysis failed: " + errorMessage);
                        setActiveJobId(null);
                        setIsVideoModalOpen(true); // Re-open input modal to show error
                    } else if (result.data.status === "completed") {
                        setActiveJobId(null);
                        router.push("/videos");
                    }
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [activeJobId, router]);


    useEffect(() => {
        if (user) {
            api.getCredits().then(result => {
                if (result.data) {
                    setCredits(result.data.credits);
                }
            });
            api.getNotifications().then(result => {
                if (result.data) {
                    setNotifications(result.data.notifications);
                    setUnreadCount(result.data.unread_count);
                }
            });
        }
    }, [user]);

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
                setActiveJobId(result.data.job_id);
                addVideoJob(result.data.job_id, videoUrl); // Add to shared context
                setIsVideoModalOpen(false); // Close input modal
                setVideoUrl("");
                console.log("Started analysis, polling job:", result.data.job_id);
            } else {
                setError(result.error || "Failed to start analysis");
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setIsAnalyzing(false);
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
                                                api.markNotificationsRead();
                                                setUnreadCount(0);
                                                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
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
                                                key={n.id}
                                                className={`p-3 border-b border-white/10 hover:bg-white/5 cursor-pointer ${!n.is_read ? 'bg-white/5' : ''}`}
                                                onClick={() => {
                                                    if (!n.is_read) {
                                                        api.markNotificationsRead(n.id);
                                                        setUnreadCount(prev => Math.max(0, prev - 1));
                                                        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                                                    }
                                                }}
                                            >
                                                <p className="text-sm">{n.title}</p>
                                                <p className="text-xs text-white/50 mt-0.5">{n.message}</p>
                                                <p className="text-xs text-white/30 mt-1 font-mono">{new Date(n.created_at).toLocaleString()}</p>
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
                                onBoardCreated={() => router.push("/boards")}
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
            <FrameSelectionModal
                isOpen={showFrameSelection}
                onClose={() => setShowFrameSelection(false)}
                jobId={pendingJobId || ""}
                frames={pendingFrames}
                videoUrl={pendingVideoUrl}
                onComplete={() => {
                    setPendingFrames([]);
                    router.push("/videos");
                }}
            />
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

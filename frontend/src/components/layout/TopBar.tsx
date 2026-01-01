"use client";

import { Search, Bell, Coins, Plus, Lightbulb } from "lucide-react";
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
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { CreditsModal } from "@/components/features/CreditsModal";

export function TopBar() {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSemanticSearch, setIsSemanticSearch] = useState(false);
    const [videoUrl, setVideoUrl] = useState("");
    const [quality, setQuality] = useState<"strict" | "medium" | "high">("medium");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
    const router = useRouter();
    const [showCreditsModal, setShowCreditsModal] = useState(false);

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
                setIsOpen(false);
                setVideoUrl("");
                router.push("/videos");
            } else {
                setError(result.error || "Failed to start analysis");
            }
        } catch (e) {
            setError("An unexpected error occurred");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCancel = () => {
        setIsOpen(false);
        setVideoUrl("");
        setError(null);
    };

    return (
        <>
            <header className="h-[72px] flex items-center justify-between px-8 border-b border-white/20 bg-black sticky top-0 z-30">
                {/* Logo - only visible on pages without sidebar */}
                <div className="hidden">
                    <span className="text-xl font-black tracking-tighter">MOODERI</span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-4">
                    {/* Credits Badge */}
                    <button
                        onClick={() => setShowCreditsModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-white/20 hover:border-white/40 transition-colors"
                    >
                        <Coins className="w-4 h-4 text-white/60" />
                        <span className="text-sm font-mono">
                            <span className="font-medium">{credits}</span> Credits
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

                    {/* New Video Button */}
                    <Modal open={isOpen} onOpenChange={setIsOpen}>
                        <ModalTrigger asChild>
                            <Button variant="accent" className="gap-2" onClick={() => setIsOpen(true)}>
                                <Plus className="w-4 h-4" />
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
                                <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
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
                </div>
            </header>

            {/* Credits Modal */}
            <CreditsModal
                isOpen={showCreditsModal}
                onClose={() => setShowCreditsModal(false)}
                credits={credits}
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

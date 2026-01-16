"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    ModalCloseButton
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";
import { Check, CheckCircle2, Loader2, Images, Globe, Lock, FolderOpen, ChevronDown, Gift } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";

interface FrameSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    frames: string[];
    videoUrl: string;
    onComplete: () => void;
}

export function FrameSelectionModal({
    isOpen,
    onClose,
    jobId,
    frames,
    videoUrl,
    onComplete
}: FrameSelectionModalProps) {
    const router = useRouter();
    const [selectedFrames, setSelectedFrames] = useState<string[]>(frames);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [savedCount, setSavedCount] = useState<number | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // New states for public/folder options
    const [isPublic, setIsPublic] = useState(true);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [showFolderMenu, setShowFolderMenu] = useState(false);

    // Convex hooks
    const boards = useQuery(api.boards.list, {});
    const approveFrames = useMutation(api.videos.approveFrames);

    // Reset selected frames when frames prop changes
    useEffect(() => {
        setSelectedFrames(frames);
        setSavedCount(null);
        setShowSuccess(false);
    }, [frames]);

    // Close folder menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowFolderMenu(false);
        if (showFolderMenu) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [showFolderMenu]);

    const toggleFrame = (frameUrl: string) => {
        if (selectedFrames.includes(frameUrl)) {
            setSelectedFrames(selectedFrames.filter(f => f !== frameUrl));
        } else {
            setSelectedFrames([...selectedFrames, frameUrl]);
        }
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const result = await approveFrames({
                videoId: jobId as any,
                approvedUrls: selectedFrames,
                isPublic,
                folderId: selectedFolderId as any || undefined,
            });

            const count = result.approved_count;
            setSavedCount(count);
            setShowSuccess(true);
            onComplete();

            setTimeout(() => {
                router.push("/my-images");
            }, 1500);
        } catch (e) {
            console.error("Failed to approve frames", e);
            alert("Failed to save selection: " + (e instanceof Error ? e.message : "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoToMyImages = () => {
        onClose();
        router.push("/my-images");
    };

    const handleClose = () => {
        setShowSuccess(false);
        setSavedCount(null);
        onClose();
    };

    const creditsNeeded = isPublic ? 0 : selectedFrames.length;
    const freeCreditsEarned = isPublic ? Math.floor(selectedFrames.length / 10) : 0;

    const boardsList = boards || [];
    const selectedFolder = Array.isArray(boardsList) ? boardsList.find(f => f._id === selectedFolderId) : undefined;

    // Use a div wrapper to avoid fragment issues, just in case
    return (
        <div>
            <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
                <ModalContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <ModalHeader>
                        <ModalTitle>
                            {showSuccess ? "Images Saved!" : "Select Best Frames"}
                        </ModalTitle>
                        {!showSuccess && (
                            <div className="text-sm text-text-secondary">
                                {selectedFrames.length} selected / {frames.length} extracted
                            </div>
                        )}
                    </ModalHeader>

                    <ModalBody className="flex-1 overflow-y-auto p-6">
                        {showSuccess ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">
                                    {savedCount} {savedCount === 1 ? "Image" : "Images"} Saved Successfully!
                                </h3>
                                <p className="text-text-secondary mb-2">
                                    Your frames have been added to your image library.
                                </p>
                                {isPublic && savedCount && (
                                    <p className="text-sm text-green-400 mb-4 flex items-center gap-1">
                                        <Gift className="w-4 h-4" />
                                        Thanks for contributing to the community!
                                        {freeCreditsEarned > 0 && (
                                            <span className="font-medium ml-1">+{freeCreditsEarned} free credits earned</span>
                                        )}
                                    </p>
                                )}
                                {selectedFolder && (
                                    <p className="text-sm text-accent-blue mb-4">
                                        Saved to folder: {selectedFolder.name}
                                    </p>
                                )}
                                <div className="flex gap-3">
                                    <Button variant="secondary" onClick={handleClose}>
                                        Close
                                    </Button>
                                    <Button variant="default" onClick={handleGoToMyImages}>
                                        <Images className="w-4 h-4 mr-2" />
                                        View My Images
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white/5 rounded-xl">
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Visibility</div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsPublic(true)}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all text-sm ${isPublic
                                                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                                                    }`}
                                            >
                                                <Globe className="w-4 h-4" />
                                                Public
                                                <span className="text-xs px-1.5 py-0.5 bg-green-500/30 rounded">FREE</span>
                                            </button>
                                            <button
                                                onClick={() => setIsPublic(false)}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all text-sm ${!isPublic
                                                    ? "bg-accent-blue/20 border-accent-blue/50 text-accent-blue"
                                                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                                                    }`}
                                            >
                                                <Lock className="w-4 h-4" />
                                                Private
                                                <span className="text-xs px-1.5 py-0.5 bg-white/10 rounded">{selectedFrames.length} credits</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Save to Folder (optional)</div>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowFolderMenu(!showFolderMenu);
                                                }}
                                                className="w-full flex items-center justify-between gap-2 py-2.5 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <FolderOpen className="w-4 h-4 text-text-tertiary" />
                                                    {selectedFolder ? selectedFolder.name : "No folder selected"}
                                                </span>
                                                <ChevronDown className="w-4 h-4 text-text-tertiary" />
                                            </button>
                                            {showFolderMenu && (
                                                <div className="absolute left-0 top-full mt-1 w-full bg-black border border-white/20 rounded-lg shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFolderId(null);
                                                            setShowFolderMenu(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors ${!selectedFolderId ? "bg-white/10 text-accent-blue" : ""}`}
                                                    >
                                                        No folder
                                                    </button>
                                                    {boardsList.map(folder => (
                                                        <button
                                                            key={folder._id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedFolderId(folder._id);
                                                                setShowFolderMenu(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors ${selectedFolderId === folder._id ? "bg-white/10 text-accent-blue" : ""}`}
                                                        >
                                                            {folder.name}
                                                        </button>
                                                    ))}
                                                    {boardsList.length === 0 && (
                                                        <div className="px-4 py-3 text-sm text-text-tertiary">
                                                            No folders yet. Create one in the sidebar.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {isPublic && (
                                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3 text-sm">
                                        <Gift className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-green-400 font-medium">Community Contributor Bonus:</span>
                                            <span className="text-text-secondary ml-1">
                                                For every 10 public images, you earn 1 free credit! Share to grow the library.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {frames.map((frame, index) => {
                                        const isSelected = selectedFrames.includes(frame);
                                        return (
                                            <div
                                                key={index}
                                                className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${isSelected ? 'border-accent-blue' : 'border-transparent opacity-60 hover:opacity-90'
                                                    }`}
                                                onClick={() => toggleFrame(frame)}
                                            >
                                                <img
                                                    src={frame}
                                                    alt={`Frame ${index}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-accent-blue rounded-full flex items-center justify-center shadow-md">
                                                        <Check className="w-4 h-4 text-white" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </ModalBody>

                    {!showSuccess && (
                        <ModalFooter className="flex-col gap-3 sm:flex-row">
                            <div className="flex-1 text-sm text-text-secondary">
                                {isPublic ? (
                                    <span className="text-green-400">✨ Free – Contributing to community</span>
                                ) : (
                                    <span>Cost: <span className="font-medium text-text-primary">{creditsNeeded} credits</span></span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={handleClose}>Discard</Button>
                                <Button
                                    variant="default"
                                    onClick={handleConfirm}
                                    disabled={isSubmitting || selectedFrames.length === 0}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        `Save ${selectedFrames.length} Images`
                                    )}
                                </Button>
                            </div>
                        </ModalFooter>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}

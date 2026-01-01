"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sparkles, Loader2, Grid3X3, Save } from "lucide-react";
import { api, type Image } from "@/lib/api";

interface SmartBoardModalProps {
    trigger?: React.ReactNode;
    onBoardCreated?: (boardId: string, images: Image[]) => void;
}

type GenerationStatus = "idle" | "generating" | "preview" | "saving" | "complete";

export function SmartBoardModal({ trigger, onBoardCreated }: SmartBoardModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [count, setCount] = useState(20);
    const [strictness, setStrictness] = useState(0.55);
    const [status, setStatus] = useState<GenerationStatus>("idle");
    const [previewImages, setPreviewImages] = useState<Image[]>([]);
    const [boardName, setBoardName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setStatus("generating");
        setError(null);
        setPreviewImages([]);

        try {
            const result = await api.generateSmartBoard(prompt, count, strictness);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.data?.images && result.data.images.length > 0) {
                setPreviewImages(result.data.images);
                setBoardName(result.data.board?.name || `Smart: ${prompt.slice(0, 30)}`);
                setStatus("preview");
            } else {
                setError("No matching images found. Try a different prompt or lower the strictness.");
                setStatus("idle");
            }
        } catch (err) {
            console.error("Smart board generation error:", err);
            setError(err instanceof Error ? err.message : "Failed to generate");
            setStatus("idle");
        }
    };

    const handleSaveAsBoard = async () => {
        if (previewImages.length === 0) return;

        setStatus("saving");
        setError(null);

        try {
            // Create board
            const createResult = await api.createBoard({
                name: boardName || `Smart Board: ${prompt.slice(0, 20)}`,
                description: `Generated from: "${prompt}"`,
                is_public: false, // Smart boards are private by default
            });

            if (!createResult.data?.id) {
                throw new Error(createResult.error || "Failed to create board");
            }

            const boardId = createResult.data.id;

            // Add all images to board
            for (const image of previewImages) {
                await api.addToBoard(boardId, image.id);
            }

            setStatus("complete");
            onBoardCreated?.(boardId, previewImages);

            setTimeout(() => {
                resetModal();
                setIsOpen(false);
            }, 1000);

        } catch (err) {
            console.error("Save board error:", err);
            setError(err instanceof Error ? err.message : "Failed to save board");
            setStatus("preview");
        }
    };

    const resetModal = () => {
        setPrompt("");
        setCount(20);
        setStrictness(0.55);
        setStatus("idle");
        setPreviewImages([]);
        setBoardName("");
        setError(null);
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) resetModal();
    };

    return (
        <Modal open={isOpen} onOpenChange={handleOpenChange}>
            {trigger && <ModalTrigger asChild>{trigger}</ModalTrigger>}
            <ModalContent className="max-w-2xl">
                <ModalHeader>
                    <ModalTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-accent-blue" />
                        Smart Board Generator
                    </ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className="space-y-4">
                    {status === "idle" || status === "generating" ? (
                        <>
                            {/* Prompt Input */}
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Describe your vision
                                </label>
                                <Input
                                    placeholder="e.g., moody neon rain, cyberpunk aesthetic, Blade Runner vibes..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    disabled={status === "generating"}
                                    autoFocus
                                />
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 block">
                                        Number of images
                                    </label>
                                    <select
                                        value={count}
                                        onChange={(e) => setCount(Number(e.target.value))}
                                        disabled={status === "generating"}
                                        className="w-full px-3 py-2 bg-background-elevated border border-border-subtle rounded-lg text-sm"
                                    >
                                        <option value={10}>10 images</option>
                                        <option value={20}>20 images</option>
                                        <option value={30}>30 images</option>
                                        <option value={50}>50 images</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 block">
                                        Match strictness: {Math.round(strictness * 100)}%
                                    </label>
                                    <input
                                        type="range"
                                        min={30}
                                        max={90}
                                        value={strictness * 100}
                                        onChange={(e) => setStrictness(Number(e.target.value) / 100)}
                                        disabled={status === "generating"}
                                        className="w-full accent-accent-blue"
                                    />
                                    <div className="flex justify-between text-xs text-text-tertiary">
                                        <span>Loose</span>
                                        <span>Strict</span>
                                    </div>
                                </div>
                            </div>

                            {status === "generating" && (
                                <div className="flex items-center justify-center py-8 gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
                                    <span className="text-text-secondary">Finding matching images...</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Preview Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-text-secondary">
                                        Found {previewImages.length} matching images
                                    </span>
                                    <button
                                        onClick={() => setStatus("idle")}
                                        className="text-sm text-accent-blue hover:underline"
                                    >
                                        ← Adjust settings
                                    </button>
                                </div>
                                <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1">
                                    {previewImages.map((img) => (
                                        <div key={img.id} className="aspect-square">
                                            <img
                                                src={img.image_url}
                                                alt=""
                                                className="w-full h-full object-cover rounded border border-white/10"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Board Name */}
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Board name
                                </label>
                                <Input
                                    value={boardName}
                                    onChange={(e) => setBoardName(e.target.value)}
                                    placeholder="Name your board..."
                                />
                            </div>
                        </>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    {status === "idle" || status === "generating" ? (
                        <Button
                            variant="default"
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || status === "generating"}
                        >
                            {status === "generating" ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Board
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            variant="default"
                            onClick={handleSaveAsBoard}
                            disabled={status === "saving" || status === "complete"}
                        >
                            {status === "saving" ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : status === "complete" ? (
                                <>✓ Saved!</>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save as Board
                                </>
                            )}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

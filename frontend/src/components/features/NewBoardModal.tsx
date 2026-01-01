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
import { FolderPlus, Globe, Lock } from "lucide-react";

interface NewBoardModalProps {
    trigger?: React.ReactNode;
    onBoardCreated?: (board: { name: string; description: string }) => void;
    imageIdToSave?: number;
}

export function NewBoardModal({
    trigger,
    onBoardCreated,
    imageIdToSave,
}: NewBoardModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            // Call API to create board
            const result = await import("@/lib/api").then(m => m.api.createBoard({
                name,
                description,
                is_public: isPublic
            }));

            if (result.data?.success && result.data.id) {
                // If we need to save an image immediately
                if (imageIdToSave) {
                    await import("@/lib/api").then(m => m.api.addToBoard(result.data!.id, imageIdToSave));
                }

                onBoardCreated?.({ name: result.data.name, description: description });
                setIsOpen(false);
                setName("");
                setDescription("");
            } else {
                alert(result.error || "Failed to create board");
            }
        } catch (error) {
            console.error(error);
            alert("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal open={isOpen} onOpenChange={setIsOpen}>
            {trigger && <ModalTrigger asChild>{trigger}</ModalTrigger>}
            <ModalContent>
                <ModalHeader>
                    <ModalTitle className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5" />
                        Create New Board
                    </ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className="space-y-4">
                    <div>
                        <label className="text-sm text-text-secondary mb-2 block">
                            Board Name *
                        </label>
                        <Input
                            placeholder="e.g., Inspiration, Sci-Fi Concepts..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-sm text-text-secondary mb-2 block">
                            Description
                        </label>
                        <Input
                            placeholder="Optional description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Visibility Toggle */}
                    <div className="flex items-center justify-between p-3 bg-background-glass border border-border-subtle rounded-lg">
                        <div className="flex items-center gap-3">
                            {isPublic ? (
                                <Globe className="w-5 h-5 text-accent-blue" />
                            ) : (
                                <Lock className="w-5 h-5 text-text-tertiary" />
                            )}
                            <div>
                                <div className="text-sm font-medium">
                                    {isPublic ? "Public Board" : "Private Board"}
                                </div>
                                <div className="text-xs text-text-tertiary">
                                    {isPublic
                                        ? "Anyone can view this board"
                                        : "Only you can see this board"}
                                </div>
                            </div>
                        </div>
                        <button
                            role="switch"
                            aria-checked={isPublic}
                            onClick={() => setIsPublic(!isPublic)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-accent-blue" : "bg-white/10"
                                }`}
                        >
                            <span
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? "left-6" : "left-1"
                                    }`}
                            />
                        </button>
                    </div>

                    {imageIdToSave && (
                        <p className="text-xs text-text-tertiary">
                            The selected image will be added to this board automatically.
                        </p>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="default" onClick={handleSubmit} disabled={!name.trim() || isLoading}>
                        {isLoading ? "Creating..." : "Create Board"}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

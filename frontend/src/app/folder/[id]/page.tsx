"use client";

import { AppShell } from "@/components/layout";
import { ImageCard } from "@/components/features";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
} from "@/components/ui/Modal";
import {
    MoreHorizontal,
    Plus,
    Pencil,
    Trash2,
    Share2,
    Lock,
    Globe,
    FolderPlus,
    ArrowLeft,
} from "lucide-react";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from "@/components/ui/Dropdown";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

export default function FolderPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const boardId = params.id as Id<"boards">;

    // Convex queries
    const boardData = useQuery(api.boards.getWithImages, { boardId });
    const subfolders = useQuery(api.boards.getSubfolders, { parentId: boardId });

    // Convex mutations
    const updateBoard = useMutation(api.boards.update);
    const deleteBoard = useMutation(api.boards.remove);
    const createSubfolder = useMutation(api.boards.create);
    const removeImageFromBoard = useMutation(api.boards.removeImage);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNewSubfolderModalOpen, setIsNewSubfolderModalOpen] = useState(false);

    // Local state for modals
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [newSubfolderName, setNewSubfolderName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Derived state
    const isLoading = boardData === undefined || subfolders === undefined;
    const board = boardData;
    const images = boardData?.images || [];
    const displaySubfolders = subfolders || [];

    const handleSaveChanges = async () => {
        if (!board) return;
        setIsSaving(true);

        try {
            await updateBoard({
                id: boardId,
                name: editName,
                description: editDescription,
            });
            setIsEditModalOpen(false);
        } catch (error) {
            alert("Failed to save changes");
        }

        setIsSaving(false);
    };

    const handleToggleVisibility = async () => {
        if (!board) return;

        try {
            await updateBoard({
                id: boardId,
                isPublic: !board.isPublic,
            });
        } catch (error) {
            alert("Failed to update visibility");
        }
    };

    const handleDelete = async () => {
        if (!board) return;

        if (!confirm(`Are you sure you want to delete "${board.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await deleteBoard({ id: boardId });
            router.push("/");
        } catch (error) {
            alert("Failed to delete board");
        }
    };

    const handleShare = () => {
        if (!board) return;

        const shareUrl = `${window.location.origin}/folder/${board._id}`;
        navigator.clipboard.writeText(shareUrl);
        alert("Board link copied to clipboard!");
    };

    const handleCreateSubfolder = async () => {
        if (!newSubfolderName.trim() || !board) return;
        setIsSaving(true);

        try {
            await createSubfolder({
                name: newSubfolderName,
                parentId: boardId,
            });
            setNewSubfolderName("");
            setIsNewSubfolderModalOpen(false);
        } catch (error) {
            alert("Failed to create subfolder");
        }

        setIsSaving(false);
    };

    // Handle removing an image from this board
    const handleRemoveImage = async (imageId: string) => {
        try {
            await removeImageFromBoard({
                boardId: boardId,
                imageId: imageId as Id<"images">,
            });
        } catch (error) {
            console.error("Failed to remove image:", error);
            alert("Failed to remove image from board");
        }
    };

    // Initialize edit modal state when opening
    const openEditModal = () => {
        if (board) {
            setEditName(board.name);
            setEditDescription(board.description || "");
            setIsEditModalOpen(true);
        }
    };

    if (isLoading) {
        return (
            <AppShell>
                <div className="space-y-6">
                    <div className="h-10 w-64 bg-white/5 rounded animate-pulse" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="aspect-[4/5] bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </AppShell>
        );
    }

    if (!board) {
        return (
            <AppShell>
                <div className="text-center py-20">
                    <h2 className="text-xl font-semibold mb-2">Folder not found</h2>
                    <Button variant="secondary" asChild>
                        <Link href="/">Go Home</Link>
                    </Button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        {board.parentId && (
                            <Link href={`/folder/${board.parentId}`} className="text-sm text-text-tertiary hover:text-text-secondary flex items-center gap-1 mb-2">
                                <ArrowLeft className="w-3 h-3" />
                                Back to parent folder
                            </Link>
                        )}
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold">{board.name}</h1>
                            {board.isPublic ? (
                                <span className="flex items-center gap-1 text-xs text-accent-blue">
                                    <Globe className="w-3 h-3" />
                                    Public
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-text-tertiary">
                                    <Lock className="w-3 h-3" />
                                    Private
                                </span>
                            )}
                        </div>
                        {board.description && (
                            <p className="text-text-secondary">{board.description}</p>
                        )}
                        <p className="text-sm text-text-tertiary mt-2">
                            {images.length} images{displaySubfolders.length > 0 ? ` · ${displaySubfolders.length} subfolders` : ""}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={handleShare}>
                            <Share2 className="w-4 h-4" />
                            Share
                        </Button>

                        <Dropdown>
                            <DropdownTrigger asChild>
                                <Button variant="secondary" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownTrigger>
                            <DropdownContent align="end">
                                <DropdownItem onClick={openEditModal}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit Folder
                                </DropdownItem>
                                <DropdownItem onClick={() => setIsNewSubfolderModalOpen(true)}>
                                    <FolderPlus className="w-4 h-4 mr-2" />
                                    New Subfolder
                                </DropdownItem>
                                <DropdownItem onClick={handleToggleVisibility}>
                                    {board.isPublic ? (
                                        <>
                                            <Lock className="w-4 h-4 mr-2" />
                                            Make Private
                                        </>
                                    ) : (
                                        <>
                                            <Globe className="w-4 h-4 mr-2" />
                                            Make Public
                                        </>
                                    )}
                                </DropdownItem>
                                <DropdownSeparator />
                                <DropdownItem className="text-red-400" onClick={handleDelete}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Folder
                                </DropdownItem>
                            </DropdownContent>
                        </Dropdown>
                    </div>
                </div>

                {/* Subfolders */}
                {displaySubfolders.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-text-secondary mb-3">Subfolders</h3>
                        <div className="flex flex-wrap gap-3">
                            {displaySubfolders.map((subfolder) => (
                                <Link
                                    key={subfolder._id}
                                    href={`/folder/${subfolder._id}`}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-border-subtle rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <FolderPlus className="w-4 h-4 text-accent-blue" />
                                    <span>{subfolder.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Images Grid */}
                {images.length > 0 ? (
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-5">
                        {images.filter((img) => img !== null).map((image) => (
                            <ImageCard
                                key={image._id}
                                id={image._id}
                                imageUrl={image.imageUrl}
                                mood={image.mood}
                                colors={image.colors}
                                boardId={boardId}
                                onRemoveFromBoard={handleRemoveImage}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <Plus className="w-8 h-8 text-text-tertiary" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No images yet</h2>
                        <p className="text-text-secondary mb-6">
                            Save images to this folder from the gallery
                        </p>
                        <Button variant="accent" asChild>
                            <Link href="/">Browse Gallery</Link>
                        </Button>
                    </div>
                )}

                {/* Edit Modal */}
                <Modal open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <ModalContent>
                        <ModalHeader>
                            <ModalTitle>Edit Folder</ModalTitle>
                            <ModalCloseButton />
                        </ModalHeader>
                        <ModalBody className="space-y-4">
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Folder Name
                                </label>
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Description
                                </label>
                                <Input
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Optional description..."
                                />
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                variant="secondary"
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleSaveChanges}
                                disabled={isSaving || !editName.trim()}
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>

                {/* New Subfolder Modal */}
                <Modal open={isNewSubfolderModalOpen} onOpenChange={setIsNewSubfolderModalOpen}>
                    <ModalContent>
                        <ModalHeader>
                            <ModalTitle>Create Subfolder</ModalTitle>
                            <ModalCloseButton />
                        </ModalHeader>
                        <ModalBody>
                            <label className="text-sm text-text-secondary mb-2 block">
                                Subfolder Name
                            </label>
                            <Input
                                value={newSubfolderName}
                                onChange={(e) => setNewSubfolderName(e.target.value)}
                                placeholder="e.g., Reference shots"
                                autoFocus
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                variant="secondary"
                                onClick={() => setIsNewSubfolderModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleCreateSubfolder}
                                disabled={isSaving || !newSubfolderName.trim()}
                            >
                                {isSaving ? "Creating..." : "Create"}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            </div>
        </AppShell>
    );
}

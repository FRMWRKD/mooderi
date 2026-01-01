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
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, type Image } from "@/lib/api";
import Link from "next/link";

interface BoardData {
    id: string;
    name: string;
    description?: string;
    is_public: boolean;
    parent_id?: string;
}

interface Subfolder {
    id: string;
    name: string;
    is_public: boolean;
}

export default function FolderPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [board, setBoard] = useState<BoardData | null>(null);
    const [images, setImages] = useState<Image[]>([]);
    const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNewSubfolderModalOpen, setIsNewSubfolderModalOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [newSubfolderName, setNewSubfolderName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadBoard();
    }, [params.id]);

    const loadBoard = async () => {
        setIsLoading(true);
        setError(null);

        const result = await api.getBoard(params.id);

        if (result.error) {
            setError(result.error);
            // Fallback to mock data for demo
            setBoard({
                id: params.id,
                name: params.id === "inspiration" ? "Inspiration" : "Board",
                description: "Collection of references",
                is_public: false,
            });
            setImages([]);
            setSubfolders([]);
        } else if (result.data) {
            setBoard(result.data.board);
            setImages(result.data.images);
            setSubfolders(result.data.subfolders || []);
            setEditName(result.data.board.name);
            setEditDescription(result.data.board.description || "");
        }

        setIsLoading(false);
    };

    const handleSaveChanges = async () => {
        if (!board) return;
        setIsSaving(true);

        const result = await api.updateBoard(board.id, {
            name: editName,
            description: editDescription,
        });

        if (result.data?.success) {
            setBoard({ ...board, name: editName, description: editDescription });
            setIsEditModalOpen(false);
        } else {
            alert(result.error || "Failed to save changes");
        }

        setIsSaving(false);
    };

    const handleToggleVisibility = async () => {
        if (!board) return;

        const result = await api.updateBoard(board.id, {
            is_public: !board.is_public,
        });

        if (result.data?.success) {
            setBoard({ ...board, is_public: !board.is_public });
        } else {
            alert(result.error || "Failed to update visibility");
        }
    };

    const handleDelete = async () => {
        if (!board) return;

        if (!confirm(`Are you sure you want to delete "${board.name}"? This cannot be undone.`)) {
            return;
        }

        const result = await api.deleteBoard(board.id);

        if (result.data?.success) {
            router.push("/");
        } else {
            alert(result.error || "Failed to delete board");
        }
    };

    const handleShare = () => {
        if (!board) return;

        const shareUrl = `${window.location.origin}/folder/${board.id}`;
        navigator.clipboard.writeText(shareUrl);
        alert("Board link copied to clipboard!");
    };

    const handleCreateSubfolder = async () => {
        if (!newSubfolderName.trim() || !board) return;
        setIsSaving(true);

        const result = await api.createBoard({
            name: newSubfolderName,
            parent_id: board.id,
        });

        if (result.data?.success) {
            setSubfolders([...subfolders, {
                id: result.data.id,
                name: result.data.name,
                is_public: false
            }]);
            setNewSubfolderName("");
            setIsNewSubfolderModalOpen(false);
        } else {
            alert(result.error || "Failed to create subfolder");
        }

        setIsSaving(false);
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

    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        {board?.parent_id && (
                            <Link href={`/folder/${board.parent_id}`} className="text-sm text-text-tertiary hover:text-text-secondary flex items-center gap-1 mb-2">
                                <ArrowLeft className="w-3 h-3" />
                                Back to parent folder
                            </Link>
                        )}
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold">{board?.name}</h1>
                            {board?.is_public ? (
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
                        {board?.description && (
                            <p className="text-text-secondary">{board.description}</p>
                        )}
                        <p className="text-sm text-text-tertiary mt-2">
                            {images.length} images{subfolders.length > 0 ? ` · ${subfolders.length} subfolders` : ""}
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
                                <DropdownItem onClick={() => {
                                    setEditName(board?.name || "");
                                    setEditDescription(board?.description || "");
                                    setIsEditModalOpen(true);
                                }}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit Folder
                                </DropdownItem>
                                <DropdownItem onClick={() => setIsNewSubfolderModalOpen(true)}>
                                    <FolderPlus className="w-4 h-4 mr-2" />
                                    New Subfolder
                                </DropdownItem>
                                <DropdownItem onClick={handleToggleVisibility}>
                                    {board?.is_public ? (
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
                {subfolders.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-text-secondary mb-3">Subfolders</h3>
                        <div className="flex flex-wrap gap-3">
                            {subfolders.map((subfolder) => (
                                <Link
                                    key={subfolder.id}
                                    href={`/folder/${subfolder.id}`}
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
                        {images.map((image) => (
                            <ImageCard
                                key={image.id}
                                id={image.id}
                                imageUrl={image.image_url}
                                mood={image.mood}
                                colors={image.colors}
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

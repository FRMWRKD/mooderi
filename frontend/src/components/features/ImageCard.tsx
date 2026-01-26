"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Grid3X3, ChevronDown, Check, Plus, Loader2, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownLabel,
    DropdownSeparator,
} from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { api } from "@convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { Id } from "@convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { NewBoardModal } from "./NewBoardModal";

interface ImageCardProps {
    id: string | number;
    imageUrl: string;
    prompt?: string;
    mood?: string;
    colors?: string[];
    tags?: string[];
    hasGif?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    // Board context - for showing remove option in board view
    boardId?: string;
    onRemoveFromBoard?: (imageId: string) => void;
}

export function ImageCard({
    id,
    imageUrl,
    prompt,
    mood,
    colors = [],
    tags = [],
    hasGif = false,
    isSelected: controlledSelected,
    onSelect,
    boardId,
    onRemoveFromBoard,
}: ImageCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [localSelected, setLocalSelected] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const router = useRouter();

    // Use controlled selection if provided, otherwise use local state
    const isSelected = controlledSelected !== undefined ? controlledSelected : localSelected;
    const handleSelect = onSelect || (() => setLocalSelected(!localSelected));

    // Handle remove from board with confirmation
    const handleRemoveFromBoard = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onRemoveFromBoard && typeof id === 'string') {
            if (confirm("Remove this image from the board? (The image will remain in your library)")) {
                setIsRemoving(true);
                onRemoveFromBoard(id);
            }
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("application/x-image-id", id.toString());
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    return (
        <div
            className={cn(
                "relative group break-inside-avoid mb-5 cursor-grab active:cursor-grabbing",
                isDragging && "opacity-50 scale-95"
            )}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Link href={`/image/${id}`}>
                <div className="relative overflow-hidden bg-black border border-white/20 transition-all duration-300 hover:border-white/50">
                    {/* Image */}
                    <img
                        src={imageUrl}
                        alt={prompt || "Moodboard image"}
                        className="w-full h-auto object-cover"
                        loading="lazy"
                    />

                    {/* Selection Checkbox */}
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelect();
                        }}
                        className={cn(
                            "absolute top-3 left-3 w-6 h-6 flex items-center justify-center transition-all border",
                            isSelected
                                ? "bg-white text-black border-white"
                                : "bg-black/60 border-white/40 text-white/80 opacity-0 group-hover:opacity-100"
                        )}
                    >
                        {isSelected ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <div className="w-3.5 h-3.5 border-2 border-white/60 rounded-sm" />
                        )}
                    </button>

                    {/* GIF Badge */}
                    {hasGif && (
                        <span className="absolute top-3 left-12 px-2 py-0.5 bg-black border border-white/30 text-white text-xs font-mono uppercase">
                            GIF
                        </span>
                    )}

                    {/* Top Right Actions */}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Remove from Board Button - Only shown in board context */}
                        {boardId && onRemoveFromBoard && (
                            <button
                                onClick={handleRemoveFromBoard}
                                disabled={isRemoving}
                                className="flex items-center gap-1 px-2 py-1.5 bg-red-500/90 backdrop-blur-lg rounded-full text-sm font-medium text-white hover:bg-red-600 transition-all disabled:opacity-50"
                                title="Remove from board"
                            >
                                {isRemoving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <X className="w-3.5 h-3.5" />
                                )}
                            </button>
                        )}
                        {/* Save to Board Dropdown */}
                        <SaveToBoardDropdown imageId={id} />
                    </div>

                    {/* Mood & Colors Overlay - Only show on hover */}
                    <div
                        className={cn(
                            "absolute bottom-3 left-3 right-3 flex items-center gap-2 transition-opacity z-10 pointer-events-none",
                            isHovered ? "opacity-100" : "opacity-0"
                        )}
                    >
                        {mood && (
                            <Link
                                href={`/search?mood=${encodeURIComponent(mood)}`}
                                className="px-2.5 py-1 bg-black/80 border border-white/30 text-xs text-white hover:border-white transition-colors pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {mood}
                            </Link>
                        )}
                        {colors.length > 0 && (
                            <div className="flex gap-1.5 pointer-events-auto">
                                {colors.slice(0, 4).map((color, i) => (
                                    <Link
                                        key={i}
                                        href={`/search?color=${encodeURIComponent(color)}`}
                                        className="w-4 h-4 border border-white/40 hover:scale-125 transition-transform"
                                        style={{ backgroundColor: color }}
                                        title={`Search for ${color}`}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
}

export function SaveToBoardDropdown({ imageId }: { imageId: string | number }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Check if we can save (must be Convex ID aka string)
    const canSave = typeof imageId === 'string';

    const boards = useQuery(api.boards.list, {
        imageId: canSave ? (imageId as Id<"images">) : undefined
    });

    const filteredBoards = (boards || []).filter((b: any) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const addToBoard = useMutation(api.boards.addImage);
    const removeFromBoard = useMutation(api.boards.removeImage);

    const handleToggleBoard = async (boardId: string, hasImage: boolean) => {
        if (!canSave) {
            alert("Legacy images cannot be saved to new boards. Please re-import or wait for migration.");
            return;
        }

        setIsProcessing(boardId);
        try {
            if (hasImage) {
                await removeFromBoard({
                    boardId: boardId as Id<"boards">,
                    imageId: imageId as Id<"images">,
                });
            } else {
                await addToBoard({
                    boardId: boardId as Id<"boards">,
                    imageId: imageId as Id<"images">,
                });
            }
        } catch (e) {
            console.error("Failed to toggle board", e);
            alert("Failed to update board");
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <Dropdown open={isOpen} onOpenChange={setIsOpen}>
            <DropdownTrigger asChild>
                <button
                    onClick={(e) => e.preventDefault()}
                    className="flex items-center gap-2 px-3 py-2 bg-background-elevated/90 backdrop-blur-lg rounded-full text-sm font-medium hover:bg-background-elevated transition-all"
                >
                    <Grid3X3 className="w-4 h-4" />
                    Save
                    <ChevronDown className="w-3 h-3" />
                </button>
            </DropdownTrigger>
            <DropdownContent align="end" className="w-72">
                <div className="p-3 border-b border-border-subtle">
                    <div className="font-semibold mb-3">Save to board</div>
                    <Input
                        placeholder="Search for board"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-sm"
                    />
                </div>

                <DropdownLabel>Your boards</DropdownLabel>

                <div className="max-h-48 overflow-y-auto px-1">
                    {!canSave ? (
                        <div className="px-3 py-4 text-center text-text-tertiary text-sm text-yellow-500">
                            Cannot save legacy image
                        </div>
                    ) : boards === undefined ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
                        </div>
                    ) : filteredBoards.length > 0 ? (
                        filteredBoards.map((board: any) => (
                            <DropdownItem
                                key={board._id}
                                className="flex items-center justify-between"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleToggleBoard(board._id, board.hasImage);
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <Grid3X3 className="w-4 h-4 opacity-60" />
                                    <span className="truncate">{board.name}</span>
                                </div>
                                <div className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                                    board.hasImage
                                        ? "bg-accent-blue text-white"
                                        : "bg-white/10 hover:bg-accent-blue"
                                )}>
                                    {isProcessing === board._id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : board.hasImage ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                </div>
                            </DropdownItem>
                        ))
                    ) : (
                        <div className="px-3 py-4 text-center text-text-tertiary text-sm">
                            No boards match &quot;{searchQuery}&quot;
                        </div>
                    )}
                </div>

                <DropdownSeparator />

                <NewBoardModal
                    trigger={
                        <DropdownItem className="text-text-secondary" onSelect={(e) => e.preventDefault()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create new board
                            <span className="ml-auto text-xs text-text-tertiary">⌘↵</span>
                        </DropdownItem>
                    }
                    onBoardCreated={(board) => {
                        // Convex updates automatically
                    }}
                    imageIdToSave={canSave ? (imageId) as any : undefined}
                />
            </DropdownContent>
        </Dropdown>
    );
}

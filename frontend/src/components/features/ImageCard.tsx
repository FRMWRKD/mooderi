"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Grid3X3, ChevronDown, Check, Plus, Loader2 } from "lucide-react";
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
import { api, type Board } from "@/lib/api";
import { NewBoardModal } from "@/components/features/NewBoardModal";

interface ImageCardProps {
    id: number;
    imageUrl: string;
    prompt?: string;
    mood?: string;
    colors?: string[];
    tags?: string[];
    hasGif?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
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
}: ImageCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [localSelected, setLocalSelected] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const router = useRouter();

    // Use controlled selection if provided, otherwise use local state
    const isSelected = controlledSelected !== undefined ? controlledSelected : localSelected;
    const handleSelect = onSelect || (() => setLocalSelected(!localSelected));

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("application/x-image-id", id.toString());
        e.dataTransfer.effectAllowed = "copy";
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleSearchSimilar = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/image/${id}?tab=similar`);
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

                    {/* Top Right Actions - Only shows board save button */}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

export function SaveToBoardDropdown({ imageId }: { imageId: number }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [boards, setBoards] = useState<Board[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [savedBoards, setSavedBoards] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Fetch boards when dropdown opens
    useEffect(() => {
        if (isOpen && boards.length === 0) {
            loadBoards();
        }
    }, [isOpen]);

    const loadBoards = async () => {
        setIsLoading(true);
        const result = await api.getBoards();
        if (result.data?.boards) {
            setBoards(result.data.boards);
        }
        setIsLoading(false);
    };

    const filteredBoards = boards.filter((b) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSaveToBoard = async (boardId: string, boardName: string) => {
        if (savedBoards.includes(boardId)) {
            // Remove from board
            setIsSaving(boardId);
            const result = await api.removeFromBoard(boardId, imageId);
            if (result.data?.success) {
                setSavedBoards(savedBoards.filter(id => id !== boardId));
            }
            setIsSaving(null);
        } else {
            // Add to board
            setIsSaving(boardId);
            const result = await api.addToBoard(boardId, imageId);
            if (result.data?.success) {
                setSavedBoards([...savedBoards, boardId]);
            } else {
                alert(result.error || "Failed to save to board");
            }
            setIsSaving(null);
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
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
                        </div>
                    ) : filteredBoards.length > 0 ? (
                        filteredBoards.map((board) => (
                            <DropdownItem
                                key={board.id}
                                className="flex items-center justify-between"
                                onClick={() => handleSaveToBoard(board.id, board.name)}
                            >
                                <div className="flex items-center gap-2">
                                    <Grid3X3 className="w-4 h-4 opacity-60" />
                                    <span className="truncate">{board.name}</span>
                                </div>
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${savedBoards.includes(board.id)
                                    ? "bg-accent-blue text-white"
                                    : "bg-white/10 hover:bg-accent-blue"
                                    }`}>
                                    {isSaving === board.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : savedBoards.includes(board.id) ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                </div>
                            </DropdownItem>
                        ))
                    ) : boards.length === 0 ? (
                        <div className="px-3 py-4 text-center text-text-tertiary text-sm">
                            No boards yet. Create one below!
                        </div>
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
                        // Refresh boards list
                        loadBoards();
                        // Ideally we would select it automatically, but waiting for refresh is okay for now
                    }}
                    imageIdToSave={imageId}
                />
            </DropdownContent>
        </Dropdown>
    );
}

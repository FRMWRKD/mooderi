"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    LayoutGrid,
    Video,
    Images,
    FolderOpen,
    Settings,
    User,
    LogOut,
    CreditCard,
    ChevronDown,
    Loader2,
    LogIn,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from "@/components/ui/Dropdown";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { NewBoardModal } from "@/components/features/NewBoardModal";

const navItems = [
    { label: "Discover", href: "/", icon: LayoutGrid },
    { label: "My Videos", href: "/videos", icon: Video },
    { label: "My Images", href: "/my-images", icon: Images },
    { label: "Prompt Generator", href: "/tools/prompt-generator", icon: Sparkles },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut, isLoading: isAuthLoading } = useAuth();

    // Convex queries - reactive updates
    // Get user's own boards
    const userBoards = useQuery(api.boards.list, {});
    // Get public boards from all users
    const publicBoards = useQuery(api.boards.list, { includePublic: true });
    
    // Merge user's boards with public boards (avoiding duplicates)
    const allBoards = (() => {
        if (!userBoards && !publicBoards) return undefined;
        const boards = [...(userBoards || [])];
        const userBoardIds = new Set(boards.map(b => b._id));
        // Add public boards that aren't already in user's boards
        for (const pb of (publicBoards || [])) {
            if (!userBoardIds.has(pb._id)) {
                boards.push(pb);
            }
        }
        return boards;
    })();
    
    // We can filter parent_id locally
    const topLevelBoards = allBoards?.filter(b => !b.parentId) || [];
    const isLoadingBoards = allBoards === undefined;

    const handleNewFolder = async (boardData: { id: string; name: string; description: string }) => {
        // No manual refresh needed with Convex!
    };

    const handleProfile = () => {
        router.push("/settings");
    };

    const handleSettings = () => {
        router.push("/settings");
    };

    const handleBuyCredits = () => {
        alert("Credit purchase coming soon!");
    };

    const handleLogout = async () => {
        if (confirm("Are you sure you want to logout?")) {
            await signOut();
            router.push("/");
        }
    };

    return (
        <aside className="w-60 h-screen bg-black border-r border-white/20 flex flex-col p-4 fixed left-0 top-0 z-40">
            {/* Brand */}
            <div className="px-2 mb-8">
                <span className="text-xl font-black tracking-tighter">MOODERI</span>
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col gap-0">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest px-3 mb-2">
                    Library
                </span>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm transition-all duration-200 border-l-2",
                                isActive
                                    ? "border-white text-white bg-white/5"
                                    : "border-transparent text-white/60 hover:text-white hover:border-white/40"
                            )}
                        >
                            <item.icon className="w-5 h-5 opacity-70" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Folders */}
            <div className="mt-8 flex-1 overflow-hidden">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest px-3 mb-2 block">
                    Folders {topLevelBoards.length > 0 && `(${topLevelBoards.length})`}
                </span>
                <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[calc(100vh-400px)]">
                    {isLoadingBoards ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-text-tertiary text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading...
                        </div>
                    ) : topLevelBoards.length > 0 ? (
                        topLevelBoards.map((board) => {
                            const isActive = pathname === `/folder/${board._id}`;
                            return (
                                <Link
                                    key={board._id}
                                    href={`/folder/${board._id}`}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 text-sm transition-all border-l-2",
                                        isActive
                                            ? "border-white text-white bg-white/5"
                                            : "border-transparent text-white/60 hover:text-white hover:border-white/40"
                                    )}
                                >
                                    <FolderOpen className="w-4 h-4 opacity-60" />
                                    <span className="truncate">{board.name}</span>
                                    {board.imageCount !== undefined && board.imageCount > 0 && (
                                        <span className="text-xs text-text-tertiary ml-auto">
                                            {board.imageCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })
                    ) : (
                        <div className="px-3 py-2 text-text-tertiary text-sm">
                            No folders yet
                        </div>
                    )}
                    <NewBoardModal
                        trigger={
                            <button
                                className="flex items-center gap-3 px-3 py-2 text-sm text-white/40 hover:text-white transition-all mt-1 w-full text-left border-l-2 border-transparent hover:border-white/40"
                            >
                                <span className="w-4 h-4 flex items-center justify-center">+</span>
                                New Folder
                            </button>
                        }
                        onBoardCreated={handleNewFolder}
                    />
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-1 pt-4 border-t border-white/10">
                <Link
                    href="/settings"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm transition-all border-l-2",
                        pathname === "/settings"
                            ? "border-white text-white bg-white/5"
                            : "border-transparent text-white/60 hover:text-white hover:border-white/40"
                    )}
                >
                    <Settings className="w-4 h-4 opacity-60" />
                    Settings
                </Link>
                {user ? (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-white/40 hover:text-red-400 transition-all border-l-2 border-transparent hover:border-red-400/40 w-full text-left"
                    >
                        <LogOut className="w-4 h-4 opacity-60" />
                        Logout
                    </button>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white transition-all border-l-2 border-transparent hover:border-white/40"
                    >
                        <LogIn className="w-4 h-4 opacity-60" />
                        Sign In
                    </Link>
                )}
            </div>
        </aside>
    );
}

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dropdown,
    DropdownTrigger,
    DropdownContent,
    DropdownItem,
    DropdownSeparator,
} from "@/components/ui/Dropdown";
import { api, type Board } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { NewBoardModal } from "@/components/features/NewBoardModal";

const navItems = [
    { label: "Discover", href: "/", icon: LayoutGrid },
    { label: "My Videos", href: "/videos", icon: Video },
    { label: "My Images", href: "/my-images", icon: Images },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut, isLoading: isAuthLoading } = useAuth();
    const [boards, setBoards] = useState<Board[]>([]);
    const [isLoadingBoards, setIsLoadingBoards] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch boards on mount
    useEffect(() => {
        loadBoards();
    }, []);

    const loadBoards = async () => {
        setIsLoadingBoards(true);
        const result = await api.getBoards();
        if (result.data?.boards) {
            // Only show top-level boards (no parent_id)
            setBoards(result.data.boards.filter(b => !b.parent_id));
        }
        setIsLoadingBoards(false);
    };

    const handleNewFolder = async (boardData: { name: string; description: string }) => {
        // Board is already created by NewBoardModal, just refresh and navigate
        loadBoards();
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
                    Folders {boards.length > 0 && `(${boards.length})`}
                </span>
                <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[calc(100vh-400px)]">
                    {isLoadingBoards ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-text-tertiary text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading...
                        </div>
                    ) : boards.length > 0 ? (
                        boards.map((board) => {
                            const isActive = pathname === `/folder/${board.id}`;
                            return (
                                <Link
                                    key={board.id}
                                    href={`/folder/${board.id}`}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 text-sm transition-all border-l-2",
                                        isActive
                                            ? "border-white text-white bg-white/5"
                                            : "border-transparent text-white/60 hover:text-white hover:border-white/40"
                                    )}
                                >
                                    <FolderOpen className="w-4 h-4 opacity-60" />
                                    <span className="truncate">{board.name}</span>
                                    {board.image_count !== undefined && board.image_count > 0 && (
                                        <span className="text-xs text-text-tertiary ml-auto">
                                            {board.image_count}
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

            {/* User Profile */}
            {user ? (
                <Dropdown>
                    <DropdownTrigger asChild>
                        <button className="flex items-center gap-3 p-3 border border-white/20 hover:border-white/40 transition-all w-full">
                            <div className="w-8 h-8 border border-white/40 flex items-center justify-center text-sm font-mono">
                                {user.email?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-medium truncate">
                                    {user.user_metadata?.full_name || user.email?.split("@")[0]}
                                </div>
                                <div className="text-xs text-text-tertiary truncate">
                                    {user.email}
                                </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-text-tertiary" />
                        </button>
                    </DropdownTrigger>
                    <DropdownContent align="start" className="w-52">
                        <DropdownItem onClick={handleProfile}>
                            <User className="w-4 h-4 mr-2" />
                            Profile
                        </DropdownItem>
                        <DropdownItem onClick={handleSettings}>
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </DropdownItem>
                        <DropdownItem onClick={handleBuyCredits}>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Buy Credits
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem className="text-red-400" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </DropdownItem>
                    </DropdownContent>
                </Dropdown>
            ) : (
                <Link
                    href="/login"
                    className="flex items-center gap-3 p-3 border border-white/20 hover:border-white/40 transition-all w-full"
                >
                    <div className="w-8 h-8 border border-white/40 flex items-center justify-center">
                        <LogIn className="w-4 h-4 text-white/60" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">Sign In</div>
                        <div className="text-xs text-text-tertiary">Create an account</div>
                    </div>
                </Link>
            )}
        </aside>
    );
}

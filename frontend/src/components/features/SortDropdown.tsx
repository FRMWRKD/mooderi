"use client";

import { useState } from "react";
import { ChevronDown, ArrowUpDown, Clock, TrendingUp, Shuffle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SortOption {
    value: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
}

const DEFAULT_SORT_OPTIONS: SortOption[] = [
    { value: "newest", label: "Newest First", icon: Clock },
    { value: "oldest", label: "Oldest First", icon: Clock },
    { value: "popular", label: "Most Popular", icon: TrendingUp },
    { value: "ranked", label: "Top Ranked", icon: Star },
    { value: "random", label: "Random", icon: Shuffle },
];

interface SortDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options?: SortOption[];
    className?: string;
}

export function SortDropdown({
    value,
    onChange,
    options = DEFAULT_SORT_OPTIONS,
    className,
}: SortDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    return (
        <div className={cn("relative", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-9 px-4 border flex items-center gap-2 text-sm font-medium transition-all rounded-lg",
                    isOpen
                        ? "bg-white/10 border-white text-white"
                        : "bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                )}
            >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{selectedOption.label}</span>
                <ChevronDown className={cn("w-3 h-3 opacity-60 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute top-full right-0 mt-2 min-w-[180px] bg-black border border-white/30 shadow-2xl z-50 rounded-lg overflow-hidden">
                        {options.map((option) => {
                            const Icon = option.icon;
                            const isSelected = option.value === value;

                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-3",
                                        isSelected
                                            ? "bg-white/10 text-white"
                                            : "text-white/60 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    {Icon && <Icon className="w-4 h-4" />}
                                    <span>{option.label}</span>
                                    {isSelected && (
                                        <span className="ml-auto text-xs text-accent-blue">✓</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

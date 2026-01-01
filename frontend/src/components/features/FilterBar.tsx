"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Lightbulb, X, ChevronDown, Check, Sun, Camera, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
export interface FilterState {
    moods: string[];  // Changed to array for multi-select
    colors: string[];
    colorTolerance: number;  // NEW: 50=Exact, 100=Similar, 200=Loose
    lighting: string[];  // Changed to array for multi-select
    cameraShots: string[];  // Changed to array for multi-select
    tags: string[];
    minScore: number;
    sort: string;
}

export interface FilterBarProps {
    initialQuery?: string;
    initialType?: "text" | "semantic";
    initialMoods?: string[];
    initialColors?: string[];
    initialLighting?: string[];
    initialCameraShots?: string[];
    initialTags?: string[];
    onSearch: (query: string, type: "text" | "semantic") => void;
    onFilterChange: (filters: FilterState) => void;
    dynamicMoods: string[];
    dynamicColors: string[];
    dynamicLighting: string[];
    dynamicCameraShots: string[];
    dynamicTags: string[];
    isLoading?: boolean;
}

// Constants
const colorCombos = [
    { name: "Orange & Teal", colors: ["#FFA500", "#008080"] },
    { name: "Black & White", colors: ["#000000", "#FFFFFF"] },
    { name: "Warm Tones", colors: ["#FF4500", "#FFA500", "#FFD700"] },
    { name: "Cool Tones", colors: ["#0000FF", "#00FFFF", "#800080"] },
];

const colorPalette = [
    { name: "Red", hex: "#ff0000" },
    { name: "Orange", hex: "#ff8000" },
    { name: "Yellow", hex: "#ffff00" },
    { name: "Green", hex: "#00ff00" },
    { name: "Teal", hex: "#00ffff" },
    { name: "Blue", hex: "#0000ff" },
    { name: "Purple", hex: "#8000ff" },
    { name: "Pink", hex: "#ff00ff" },
    { name: "White", hex: "#ffffff" },
    { name: "Black", hex: "#000000" },
];

// Shimmer loading component
function FilterShimmer() {
    return (
        <div className="flex items-center justify-center gap-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 w-24 bg-white/5 border border-white/10" />
            ))}
        </div>
    );
}

// Dropdown with search - reusable component
function FilterDropdown({
    label,
    icon: Icon,
    options,
    selected,
    onToggle,
    isOpen,
    onOpenChange,
    allowMultiple = true,
}: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    options: string[];
    selected: string[];
    onToggle: (value: string) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    allowMultiple?: boolean;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter options by search query
    const filteredOptions = useMemo(() => {
        const safeOptions = options || [];
        if (!searchQuery) return safeOptions;
        const query = searchQuery.toLowerCase();
        return safeOptions.filter(opt => opt.toLowerCase().includes(query));
    }, [options, searchQuery]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setSearchQuery("");
        }
    }, [isOpen]);

    const safeSelected = selected || [];
    const hasSelection = safeSelected.length > 0;
    const displayLabel = hasSelection
        ? (safeSelected.length === 1 ? safeSelected[0] : `${safeSelected.length} ${label}`)
        : label;

    return (
        <div className="relative">
            <button
                onClick={() => onOpenChange(!isOpen)}
                className={cn(
                    "h-9 px-4 border flex items-center gap-2 text-sm font-medium transition-all",
                    isOpen
                        ? "bg-white/10 border-white text-white"
                        : hasSelection
                            ? "bg-white text-black border-white"
                            : "bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                )}
            >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span className="max-w-[100px] truncate">{displayLabel}</span>
                <ChevronDown className={cn("w-3 h-3 opacity-60 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 max-h-80 bg-black border border-white/30 shadow-2xl z-50 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-white/10">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Search ${label.toLowerCase()}...`}
                                className="w-full bg-transparent border border-white/20 py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-white placeholder:text-white/30"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-56 overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-text-tertiary">
                                No matches found
                            </div>
                        ) : (
                            filteredOptions.map(option => {
                                const isSelected = safeSelected.includes(option);
                                return (
                                    <button
                                        key={option}
                                        onClick={() => onToggle(option)}
                                        className={cn(
                                            "w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between gap-2",
                                            isSelected
                                                ? "bg-white/10 text-white"
                                                : "text-white/60 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <span className="truncate">{option}</span>
                                        {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer with clear */}
                    {hasSelection && (
                        <div className="p-2 border-t border-white/10">
                            <button
                                onClick={() => {
                                    safeSelected.forEach(s => onToggle(s));
                                }}
                                className="w-full text-xs text-white/40 hover:text-red-400 py-1"
                            >
                                Clear {safeSelected.length} selected
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function FilterBar({
    initialQuery = "",
    initialType = "text",
    initialMoods = [],
    initialColors = [],
    initialLighting = [],
    initialCameraShots = [],
    initialTags = [],
    onSearch,
    onFilterChange,
    dynamicMoods,
    dynamicColors,
    dynamicLighting,
    dynamicCameraShots,
    dynamicTags,
    isLoading = false,
}: FilterBarProps) {
    // Search State
    const [query, setQuery] = useState(initialQuery);
    const [searchType, setSearchType] = useState<"text" | "semantic">(initialType);

    // Filter State - now arrays for multi-select
    const [selectedMoods, setSelectedMoods] = useState<string[]>(initialMoods);
    const [selectedColors, setSelectedColors] = useState<string[]>(initialColors);
    const [colorTolerance, setColorTolerance] = useState(100); // Default: Similar (50=Exact, 100=Similar, 200=Loose)
    const [selectedLighting, setSelectedLighting] = useState<string[]>(initialLighting);
    const [selectedCameraShots, setSelectedCameraShots] = useState<string[]>(initialCameraShots);
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
    const [customColor, setCustomColor] = useState("#000000");

    // UI State
    const [activeDropdown, setActiveDropdown] = useState<"mood" | "color" | "lighting" | "camera" | "tags" | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to trigger filter change when filters update
    useEffect(() => {
        onFilterChange({
            moods: selectedMoods,
            colors: selectedColors,
            colorTolerance: colorTolerance,
            lighting: selectedLighting,
            cameraShots: selectedCameraShots,
            tags: selectedTags,
            minScore: 3,
            sort: "ranked"
        });
    }, [selectedMoods, selectedColors, colorTolerance, selectedLighting, selectedCameraShots, selectedTags]);

    // Debounced search - trigger after 300ms of no typing
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearch(query, searchType);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, searchType]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(query, searchType);
    };

    const toggleItem = (arr: string[], item: string): string[] => {
        return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
    };

    const clearAll = () => {
        setSelectedMoods([]);
        setSelectedColors([]);
        setSelectedLighting([]);
        setSelectedCameraShots([]);
        setSelectedTags([]);
    };

    const hasActiveFilters = selectedMoods.length > 0 || selectedColors.length > 0 || selectedLighting.length > 0 || selectedCameraShots.length > 0 || selectedTags.length > 0;

    return (
        <div className="relative sticky top-0 z-30 pt-4 pb-2 bg-black -mx-4 px-4 border-b border-white/10 space-y-4" ref={filterRef}>

            {/* Main Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative group max-w-3xl mx-auto">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                </div>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for a mood, style, color, or vibe..."
                    className="w-full bg-transparent border border-white/20 py-3.5 pl-12 pr-40 text-lg focus:outline-none focus:border-white transition-all placeholder:text-white/30"
                />

                {/* Search Type Toggle */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center border border-white/20 p-1">
                    <button
                        type="button"
                        onClick={() => setSearchType("text")}
                        className={cn(
                            "px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all",
                            searchType === "text" ? "bg-white text-black" : "text-white/50 hover:text-white"
                        )}
                    >
                        Text
                    </button>
                    <button
                        type="button"
                        onClick={() => setSearchType("semantic")}
                        className={cn(
                            "px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1",
                            searchType === "semantic" ? "bg-white text-black" : "text-white/50 hover:text-white"
                        )}
                    >
                        <Lightbulb className="w-3 h-3" />
                        AI
                    </button>
                </div>
            </form>

            {/* Filter Pills Row - Show shimmer while loading */}
            {isLoading ? (
                <FilterShimmer />
            ) : (
                <div className="flex items-center justify-center gap-2 flex-wrap">

                    {/* Mood Filter */}
                    <FilterDropdown
                        label="Mood"
                        options={dynamicMoods}
                        selected={selectedMoods}
                        onToggle={(val) => setSelectedMoods(prev => toggleItem(prev, val))}
                        isOpen={activeDropdown === "mood"}
                        onOpenChange={(open) => setActiveDropdown(open ? "mood" : null)}
                    />

                    {/* Lighting Filter */}
                    <FilterDropdown
                        label="Lighting"
                        icon={Sun}
                        options={dynamicLighting}
                        selected={selectedLighting}
                        onToggle={(val) => setSelectedLighting(prev => toggleItem(prev, val))}
                        isOpen={activeDropdown === "lighting"}
                        onOpenChange={(open) => setActiveDropdown(open ? "lighting" : null)}
                    />

                    {/* Camera Shot Filter */}
                    <FilterDropdown
                        label="Camera"
                        icon={Camera}
                        options={dynamicCameraShots}
                        selected={selectedCameraShots}
                        onToggle={(val) => setSelectedCameraShots(prev => toggleItem(prev, val))}
                        isOpen={activeDropdown === "camera"}
                        onOpenChange={(open) => setActiveDropdown(open ? "camera" : null)}
                    />

                    {/* Color Filter - Custom UI */}
                    <div className="relative">
                        <button
                            onClick={() => setActiveDropdown(activeDropdown === "color" ? null : "color")}
                            className={cn(
                                "h-9 px-4 border flex items-center gap-2 text-sm font-medium transition-all",
                                activeDropdown === "color"
                                    ? "bg-white/10 border-white text-white"
                                    : selectedColors.length > 0
                                        ? "bg-white text-black border-white"
                                        : "bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                            )}
                        >
                            {selectedColors.length > 0 ? (
                                <>
                                    <div className="flex -space-x-1">
                                        {selectedColors.slice(0, 3).map(c => (
                                            <div key={c} className="w-3 h-3 border border-black/30" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                    {selectedColors.length} Colors
                                </>
                            ) : "Colors"}
                            <ChevronDown className={cn("w-3 h-3 opacity-60 transition-transform", activeDropdown === "color" && "rotate-180")} />
                        </button>

                        {activeDropdown === "color" && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-black border border-white/30 p-4 z-50">
                                {/* Color Combos */}
                                <div className="mb-4">
                                    <label className="text-xs font-medium text-text-tertiary mb-2 block uppercase tracking-wider">Presets</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {colorCombos.map(combo => (
                                            <button
                                                key={combo.name}
                                                onClick={() => { setSelectedColors(combo.colors); setActiveDropdown(null); }}
                                                className="flex items-center gap-2 px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-white/60 hover:text-white"
                                            >
                                                <div className="flex -space-x-1">
                                                    {combo.colors.map(c => (
                                                        <div key={c} className="w-3 h-3 border border-black/50" style={{ backgroundColor: c }} />
                                                    ))}
                                                </div>
                                                {combo.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-white/10 my-3" />

                                {/* Single Colors */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Palette</label>
                                        {selectedColors.length > 0 && (
                                            <button onClick={() => setSelectedColors([])} className="text-[10px] text-red-400 hover:underline">Clear</button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {[...colorPalette, ...(dynamicColors || []).map(c => ({ name: c, hex: c }))].filter((v, i, a) => a.findIndex(t => (t.hex === v.hex)) === i).slice(0, 20).map((color) => (
                                            <button
                                                key={color.hex}
                                                onClick={() => setSelectedColors(prev => toggleItem(prev, color.hex))}
                                                className={cn(
                                                    "w-7 h-7 border-2 transition-transform hover:scale-110 relative flex items-center justify-center",
                                                    selectedColors.includes(color.hex) ? "border-white scale-110" : "border-transparent hover:border-white/30"
                                                )}
                                                style={{ backgroundColor: color.hex }}
                                                title={color.name}
                                            >
                                                {selectedColors.includes(color.hex) && <Check className="w-3 h-3 text-white drop-shadow-md" strokeWidth={3} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-white/10 my-3" />

                                {/* Custom Picker */}
                                <div>
                                    <label className="text-xs font-mono text-white/40 mb-2 block uppercase tracking-wider">Custom</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-7 h-7 overflow-hidden border border-white/20">
                                            <input
                                                type="color"
                                                value={customColor}
                                                onChange={(e) => setCustomColor(e.target.value)}
                                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer"
                                            />
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!selectedColors.includes(customColor)) {
                                                    setSelectedColors(prev => [...prev, customColor]);
                                                }
                                            }}
                                            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 border border-white/20 transition-colors flex-1"
                                        >
                                            Add {customColor}
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-white/10 my-3" />

                                {/* Color Similarity Slider */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Similarity</label>
                                        <span className="text-xs text-amber-400 font-medium">
                                            {colorTolerance <= 50 ? 'Exact' : colorTolerance <= 100 ? 'Similar' : 'Loose'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-text-tertiary">Exact</span>
                                        <input
                                            type="range"
                                            min={30}
                                            max={200}
                                            value={colorTolerance}
                                            onChange={(e) => setColorTolerance(Number(e.target.value))}
                                            className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                                        />
                                        <span className="text-[10px] text-text-tertiary">Loose</span>
                                    </div>
                                    <p className="text-[10px] text-text-tertiary mt-1 text-center">
                                        {colorTolerance <= 50 ? 'Only very close color matches' : colorTolerance <= 100 ? 'Matches similar shades' : 'Matches a wide range of shades'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tags Filter */}
                    <FilterDropdown
                        label="Tags"
                        icon={Tag}
                        options={dynamicTags}
                        selected={selectedTags}
                        onToggle={(val) => setSelectedTags(prev => toggleItem(prev, val))}
                        isOpen={activeDropdown === "tags"}
                        onOpenChange={(open) => setActiveDropdown(open ? "tags" : null)}
                    />
                </div>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
                    {selectedMoods.map(mood => (
                        <span key={mood} className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-xs font-medium text-white border border-white/20">
                            {mood}
                            <button onClick={() => setSelectedMoods(prev => toggleItem(prev, mood))} className="hover:text-red-400 ml-1 hover:bg-white/10 p-0.5"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {selectedLighting.map(light => (
                        <span key={light} className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-xs font-medium text-white border border-white/20">
                            <Sun className="w-3 h-3" /> {light}
                            <button onClick={() => setSelectedLighting(prev => toggleItem(prev, light))} className="hover:text-red-400 ml-1 hover:bg-white/10 p-0.5"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {selectedCameraShots.map(shot => (
                        <span key={shot} className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-xs font-medium text-white border border-white/20">
                            <Camera className="w-3 h-3" /> {shot}
                            <button onClick={() => setSelectedCameraShots(prev => toggleItem(prev, shot))} className="hover:text-red-400 ml-1 hover:bg-white/10 p-0.5"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {selectedColors.map(color => (
                        <span key={color} className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-xs font-medium text-white border border-white/20">
                            <span className="w-2.5 h-2.5 border border-white/20" style={{ backgroundColor: color }} />
                            <button onClick={() => setSelectedColors(prev => toggleItem(prev, color))} className="hover:text-red-400 ml-1 hover:bg-white/10 p-0.5"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {selectedTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-xs font-medium text-white border border-white/20">
                            #{tag}
                            <button onClick={() => setSelectedTags(prev => toggleItem(prev, tag))} className="hover:text-red-400 ml-1 hover:bg-white/10 p-0.5"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    <button
                        onClick={clearAll}
                        className="text-xs text-white/40 hover:text-white underline ml-2"
                    >
                        Clear all
                    </button>
                </div>
            )}
        </div>
    );
}

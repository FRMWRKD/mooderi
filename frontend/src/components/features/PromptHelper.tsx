"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Doc } from "@convex/_generated/dataModel";
import { Lightbulb, RefreshCw, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PromptHelperProps {
    onSelect: (prompt: string) => void;
    className?: string;
}

export function PromptHelper({ onSelect, className = "" }: PromptHelperProps) {
    // Fetch random starters
    // We use a refresh key to re-trigger random shuffle client-side or re-fetch
    // But strictly speaking, the query is cached. To get new random ones, 
    // we might handle it by client-side shuffling or finding a way to invalidate.
    // For now, let's just fetch and display.
    const examples = useQuery(api.promptExamples.getRandomStarters, { limit: 5 });

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    if (!examples || examples.length === 0) return null;

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % examples.length);
    };

    const handleSelect = (example: Doc<"promptExamples">) => {
        onSelect(example.promptText);
        setIsVisible(false);
    };

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors mx-auto mt-2"
            >
                <Lightbulb className="w-3 h-3" />
                <span>Need ideas?</span>
            </button>
        );
    }

    const currentExample = examples[currentIndex];

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`bg-white/5 border border-white/10 rounded-lg p-3 ${className}`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-purple-300 font-medium uppercase tracking-wider">
                    <Lightbulb className="w-3 h-3" />
                    <span>Idea Starter</span>
                </div>
                <button
                    onClick={handleNext}
                    className="text-white/40 hover:text-white transition-colors"
                    title="Next idea"
                >
                    <RefreshCw className="w-3 h-3" />
                </button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentExample._id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                >
                    <p className="text-sm text-white/80 line-clamp-2 italic">
                        "{currentExample.promptText}"
                    </p>
                    <button
                        onClick={() => handleSelect(currentExample)}
                        className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors w-full justify-end"
                    >
                        <span>Use this</span>
                        <ArrowRight className="w-3 h-3" />
                    </button>
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}

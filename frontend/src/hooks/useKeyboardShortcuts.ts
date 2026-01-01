"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    meta?: boolean;  // Cmd on Mac
    shift?: boolean;
    action: () => void;
    description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger when typing in inputs
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                return;
            }

            for (const shortcut of shortcuts) {
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
                const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
                const metaMatch = shortcut.meta ? e.metaKey : true;
                const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

                if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
                    e.preventDefault();
                    shortcut.action();
                    break;
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shortcuts]);
}

// Global shortcuts for the app
export function useGlobalShortcuts(onShowHelp?: () => void) {
    const router = useRouter();

    const shortcuts: KeyboardShortcut[] = [
        {
            key: "/",
            action: () => {
                const searchInput = document.querySelector('input[name="q"]') as HTMLInputElement;
                searchInput?.focus();
            },
            description: "Focus search",
        },
        {
            key: "g",
            action: () => router.push("/"),
            description: "Go to gallery",
        },
        {
            key: "v",
            action: () => router.push("/videos"),
            description: "Go to videos",
        },
        {
            key: "m",
            action: () => router.push("/my-images"),
            description: "Go to my images",
        },
        {
            key: "n",
            shift: true,
            action: () => {
                const newVideoBtn = document.querySelector('[data-shortcut="new-video"]') as HTMLButtonElement;
                newVideoBtn?.click();
            },
            description: "New video",
        },
        {
            key: "Escape",
            action: () => {
                // Close any open modals or clear selection
                const closeBtn = document.querySelector('[data-radix-dialog-close]') as HTMLButtonElement;
                closeBtn?.click();
            },
            description: "Close modal / Clear",
        },
        {
            key: "?",
            shift: true,
            action: () => onShowHelp?.(),
            description: "Show shortcuts",
        },
    ];

    useKeyboardShortcuts(shortcuts);

    return shortcuts;
}

// Keyboard shortcut help modal content
export const KEYBOARD_SHORTCUTS = [
    { keys: ["/"], description: "Focus search" },
    { keys: ["G"], description: "Go to Gallery" },
    { keys: ["V"], description: "Go to Videos" },
    { keys: ["M"], description: "Go to My Images" },
    { keys: ["Shift", "N"], description: "New Video" },
    { keys: ["Esc"], description: "Close modal" },
    { keys: ["?"], description: "Show shortcuts" },
];

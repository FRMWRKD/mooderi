"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useGlobalShortcuts, KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { useState } from "react";
import { Keyboard, X } from "lucide-react";

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    const [showShortcuts, setShowShortcuts] = useState(false);
    useGlobalShortcuts(() => setShowShortcuts(true));

    return (
        <div className="flex min-h-screen bg-background-void">
            <Sidebar />
            <main className="flex-1 ml-60 flex flex-col">
                <TopBar />
                <div className="flex-1 overflow-y-auto p-8">{children}</div>

                {/* Keyboard Shortcut Help Button */}
                <button
                    onClick={() => setShowShortcuts(true)}
                    className="fixed bottom-6 right-6 w-10 h-10 bg-background-elevated border border-border-subtle rounded-full flex items-center justify-center text-text-tertiary hover:text-white hover:bg-white/10 transition-colors shadow-lg z-40"
                    title="Keyboard shortcuts (?)"
                >
                    <Keyboard className="w-5 h-5" />
                </button>

                {/* Keyboard Shortcuts Modal */}
                {showShortcuts && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowShortcuts(false)}
                    >
                        <div
                            className="bg-background-glass border border-border-subtle rounded-2xl p-6 w-full max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
                                <button
                                    onClick={() => setShowShortcuts(false)}
                                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-text-secondary">{shortcut.description}</span>
                                        <div className="flex gap-1">
                                            {shortcut.keys.map((key, j) => (
                                                <kbd
                                                    key={j}
                                                    className="px-2 py-1 bg-white/5 border border-border-subtle rounded text-xs font-mono"
                                                >
                                                    {key}
                                                </kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-text-tertiary mt-6">
                                Press <kbd className="px-1.5 py-0.5 bg-white/5 border border-border-subtle rounded text-xs">?</kbd> anywhere to show this menu
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

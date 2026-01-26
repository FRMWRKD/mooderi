"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout";
import { PromptGenerator } from "@/components/features/PromptGenerator";
import { SimplePromptBuilder } from "@/components/features/SimplePromptBuilder";
import { ApiKeySettings } from "@/components/features/ApiKeySettings";
import { CommunityFeed } from "@/components/features/CommunityFeed";
import { UserHistoryFeed } from "@/components/features/UserHistoryFeed";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Wand2 } from "lucide-react";

type TabType = "ai" | "builder";

export default function PromptGeneratorPage() {
    const { user } = useAuth();
    const [selectedPrompt, setSelectedPrompt] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>("builder");
    const [showApiKeySettings, setShowApiKeySettings] = useState(false);

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto space-y-16 pb-20">
                {/* Top Section: Prompt Generator */}
                <section className="space-y-8">
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest">
                            AI Prompt Generator
                        </h1>
                        <p className="text-white/50 max-w-2xl mx-auto text-lg leading-relaxed">
                            Create stunning image prompts with our tools.
                            Choose between AI-powered analysis or click-to-build simplicity.
                        </p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex justify-center">
                        <div className="inline-flex bg-black/40 border border-white/10 rounded-2xl p-1.5">
                            <button
                                onClick={() => setActiveTab("builder")}
                                className={`
                                    flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                                    ${activeTab === "builder"
                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                                        : "text-white/50 hover:text-white/80"
                                    }
                                `}
                            >
                                <Wand2 className="w-4 h-4" />
                                <span>Simple Builder</span>
                                <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full">Free</span>
                            </button>
                            <button
                                onClick={() => setActiveTab("ai")}
                                className={`
                                    flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                                    ${activeTab === "ai"
                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                                        : "text-white/50 hover:text-white/80"
                                    }
                                `}
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>AI Generator</span>
                                <span className="text-xs px-2 py-0.5 bg-purple-500/30 rounded-full">RAG</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                        {activeTab === "builder" ? (
                            <SimplePromptBuilder
                                onApiKeySettings={() => setShowApiKeySettings(true)}
                            />
                        ) : (
                            <PromptGenerator
                                displayMode="inline"
                                mode="app"
                                userId={user?._id}
                                userCredits={user?.credits}
                                hideRecent={true}
                                initialPrompt={selectedPrompt}
                            />
                        )}
                    </div>
                </section>

                {/* Bottom Section: Feed (History for User, Community for Public) */}
                <section className="space-y-8">
                    {user ? (
                        <UserHistoryFeed onSelectPrompt={setSelectedPrompt} />
                    ) : (
                        <CommunityFeed />
                    )}
                </section>
            </div>

            {/* API Key Settings Modal */}
            <ApiKeySettings
                isOpen={showApiKeySettings}
                onClose={() => setShowApiKeySettings(false)}
            />
        </AppShell>
    );
}

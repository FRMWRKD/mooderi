"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout";
import { PromptGenerator } from "@/components/features/PromptGenerator";
import { CommunityFeed } from "@/components/features/CommunityFeed";
import { UserHistoryFeed } from "@/components/features/UserHistoryFeed";
import { useAuth } from "@/contexts/AuthContext";

export default function PromptGeneratorPage() {
    const { user } = useAuth();
    const [selectedPrompt, setSelectedPrompt] = useState("");

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
                            Create stunning image prompts with our advanced AI engine.
                            Describe your vision or upload an image to extract its style.
                        </p>
                    </div>

                    <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <PromptGenerator
                            displayMode="inline"
                            mode="app"
                            userId={user?.id}
                            hideRecent={true}
                            initialPrompt={selectedPrompt}
                        />
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
        </AppShell>
    );
}

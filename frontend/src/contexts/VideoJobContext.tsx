"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from "react";
import { api } from "@/lib/api";

// Processing stages with estimated durations (in seconds)
const PROCESSING_STAGES = [
    { name: "Initializing", minProgress: 0, maxProgress: 5, duration: 2 },
    { name: "Downloading video", minProgress: 5, maxProgress: 15, duration: 5 },
    { name: "Extracting frames", minProgress: 15, maxProgress: 35, duration: 8 },
    { name: "Detecting scenes", minProgress: 35, maxProgress: 50, duration: 6 },
    { name: "Analyzing sharpness", minProgress: 50, maxProgress: 65, duration: 5 },
    { name: "Filtering blur", minProgress: 65, maxProgress: 75, duration: 4 },
    { name: "Ranking aesthetics", minProgress: 75, maxProgress: 85, duration: 4 },
    { name: "Selecting best frames", minProgress: 85, maxProgress: 95, duration: 3 },
    { name: "Finalizing", minProgress: 95, maxProgress: 99, duration: 3 },
];

export interface VideoJob {
    id: string;
    url: string;
    title: string;
    status: "queued" | "processing" | "pending_approval" | "completed" | "failed";
    progress: number;
    stage?: string;
    stageIndex?: number;
    error?: string;
    addedAt: number;
}

interface VideoJobContextType {
    jobs: VideoJob[];
    addJob: (jobId: string, url: string) => void;
    removeJob: (jobId: string) => void;
    clearCompleted: () => void;
    hasActiveJobs: boolean;
    activeCount: number;
}

const VideoJobContext = createContext<VideoJobContextType | null>(null);

export function VideoJobProvider({ children }: { children: ReactNode }) {
    const [jobs, setJobs] = useState<VideoJob[]>([]);
    const progressTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Simulate smooth progress between stages
    useEffect(() => {
        const activeJobs = jobs.filter(j => j.status === "processing");

        activeJobs.forEach(job => {
            // Don't create duplicate timers
            if (progressTimersRef.current.has(job.id)) return;

            const timer = setInterval(() => {
                setJobs(prev => prev.map(j => {
                    if (j.id !== job.id || j.status !== "processing") return j;

                    const currentStageIndex = j.stageIndex || 0;
                    const stage = PROCESSING_STAGES[currentStageIndex];
                    if (!stage) return j;

                    let newProgress = j.progress + (Math.random() * 2 + 0.5); // Random increment 0.5-2.5%
                    let newStageIndex = currentStageIndex;
                    let newStageName = stage.name;

                    // Check if we should advance to next stage
                    if (newProgress >= stage.maxProgress && currentStageIndex < PROCESSING_STAGES.length - 1) {
                        newStageIndex = currentStageIndex + 1;
                        newStageName = PROCESSING_STAGES[newStageIndex].name;
                    }

                    // Cap at 99% until backend confirms completion
                    newProgress = Math.min(newProgress, 99);

                    return {
                        ...j,
                        progress: newProgress,
                        stage: newStageName,
                        stageIndex: newStageIndex
                    };
                }));
            }, 800); // Update every 800ms

            progressTimersRef.current.set(job.id, timer);
        });

        // Cleanup timers for jobs that are no longer processing
        progressTimersRef.current.forEach((timer, jobId) => {
            const job = jobs.find(j => j.id === jobId);
            if (!job || job.status !== "processing") {
                clearInterval(timer);
                progressTimersRef.current.delete(jobId);
            }
        });
    }, [jobs]);

    // Poll for job statuses from backend
    useEffect(() => {
        if (jobs.length === 0) return;

        const activeJobs = jobs.filter(j =>
            j.status === "queued" || j.status === "processing"
        );

        if (activeJobs.length === 0) return;

        const interval = setInterval(async () => {
            for (const job of activeJobs) {
                try {
                    const result = await api.getVideoStatus(job.id);
                    if (result.data) {
                        setJobs(prev => prev.map(j => {
                            if (j.id !== job.id) return j;

                            // If backend reports a terminal state, use it
                            if (result.data?.status === "pending_approval") {
                                return { ...j, status: "pending_approval", progress: 100, stage: "Ready for review!" };
                            } else if (result.data?.status === "completed") {
                                return { ...j, status: "completed", progress: 100, stage: "Complete!" };
                            } else if (result.data?.status === "failed") {
                                return { ...j, status: "failed", error: (result.data as { stage?: string })?.stage || "Processing failed" };
                            } else if (result.data?.status === "processing" && j.status === "queued") {
                                // Start processing - initialize stage
                                return { ...j, status: "processing", stageIndex: 0, stage: PROCESSING_STAGES[0].name };
                            }

                            return j;
                        }));
                    }
                } catch (e) {
                    console.error("Polling error for job", job.id, e);
                }
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [jobs]);

    const addJob = useCallback((jobId: string, url: string) => {
        const title = extractVideoTitle(url);
        setJobs(prev => [...prev, {
            id: jobId,
            url,
            title,
            status: "queued",
            progress: 0,
            stage: "Starting...",
            stageIndex: 0,
            addedAt: Date.now(),
        }]);
    }, []);

    const removeJob = useCallback((jobId: string) => {
        // Clear timer if exists
        const timer = progressTimersRef.current.get(jobId);
        if (timer) {
            clearInterval(timer);
            progressTimersRef.current.delete(jobId);
        }
        setJobs(prev => prev.filter(j => j.id !== jobId));
    }, []);

    const clearCompleted = useCallback(() => {
        setJobs(prev => prev.filter(j =>
            j.status !== "completed" && j.status !== "failed" && j.status !== "pending_approval"
        ));
    }, []);

    const hasActiveJobs = jobs.some(j =>
        j.status === "queued" || j.status === "processing"
    );

    const activeCount = jobs.filter(j =>
        j.status === "queued" || j.status === "processing"
    ).length;

    return (
        <VideoJobContext.Provider value={{
            jobs,
            addJob,
            removeJob,
            clearCompleted,
            hasActiveJobs,
            activeCount
        }}>
            {children}
        </VideoJobContext.Provider>
    );
}

export function useVideoJobs() {
    const context = useContext(VideoJobContext);
    if (!context) {
        throw new Error("useVideoJobs must be used within a VideoJobProvider");
    }
    return context;
}

function extractVideoTitle(url: string): string {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes("youtube")) {
            const videoId = urlObj.searchParams.get("v");
            return videoId ? `YouTube: ${videoId.substring(0, 8)}...` : "YouTube Video";
        }
        if (urlObj.hostname.includes("vimeo")) {
            const parts = urlObj.pathname.split("/");
            const videoId = parts[parts.length - 1];
            return videoId ? `Vimeo: ${videoId}` : "Vimeo Video";
        }
        return "Video";
    } catch {
        return "Video";
    }
}


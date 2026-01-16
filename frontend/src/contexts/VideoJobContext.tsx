"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from "react";
import { api } from "@convex/_generated/api";
import { useConvex } from "convex/react";

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

    const convex = useConvex();

    // Poll for job statuses from backend
    useEffect(() => {
        if (jobs.length === 0) return;

        const activeJobs = jobs.filter(j =>
            j.status === "queued" || j.status === "processing"
        );

        if (activeJobs.length === 0) return;

        const interval = setInterval(async () => {
            // Fetch all statuses in parallel
            const statusUpdates = await Promise.all(
                activeJobs.map(async (job) => {
                    try {
                        const video = await convex.query(api.videos.getById, { id: job.id as any });
                        return { jobId: job.id, data: video, error: null };
                    } catch (e) {
                        console.error("Polling error for job", job.id, e);
                        return { jobId: job.id, data: null, error: e };
                    }
                })
            );

            // Apply all updates in a single setState call
            setJobs(prev => prev.map(j => {
                const update = statusUpdates.find(u => u.jobId === j.id);
                if (!update?.data) return j;

                const video = update.data;
                const status = video.status;

                // Sync progress if available
                const backendProgress = video.progress || 0;

                // If backend reports a terminal state, use it
                if (status === "pending_approval") {
                    return { ...j, status: "pending_approval", progress: 100, stage: "Ready for review!" };
                } else if (status === "completed") {
                    return { ...j, status: "completed", progress: 100, stage: "Complete!" };
                } else if (status === "failed") {
                    const errorMsg = video.errorMessage || "Processing failed";
                    return { ...j, status: "failed", error: errorMsg };
                } else if (status !== "pending") {
                    // Start processing - update progress if backend has it
                    // convex.videos.ts updates progress via webhooks
                    return {
                        ...j,
                        status: "processing",
                        progress: Math.max(j.progress, backendProgress),
                        stage: video.status === "downloading" ? "Downloading..." :
                            video.status === "extracting_frames" ? "Extracting frames..." :
                                "Processing..."
                    };
                }

                return j;
            }));
        }, 3000);

        return () => clearInterval(interval);
    }, [jobs, convex]);


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


"use client";

import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { ImageCard, SaveToBoardDropdown } from "@/components/features/ImageCard";
import { api, type Image, type GeneratedPrompts, type StructuredAnalysis } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
    ArrowLeft,
    Heart,
    ThumbsDown,
    Copy,
    Download,
    Share2,
    Star,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Check,
    Lock,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

type TabType = "overview" | "analysis" | "prompts";

export default function ImageDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const { user } = useAuth();
    const [image, setImage] = useState<Image | null>(null);
    const [similarImages, setSimilarImages] = useState<Image[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [likes, setLikes] = useState(0);
    const [dislikes, setDislikes] = useState(0);
    const [hasVoted, setHasVoted] = useState<"like" | "dislike" | null>(null);
    const [copied, setCopied] = useState(false);
    const [copyLoading, setCopyLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType | null>(null); // Start with no tab open
    const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompts | null>(null);
    const [loadingPrompts, setLoadingPrompts] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [isSaved, setIsSaved] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [remainingCredits, setRemainingCredits] = useState<number | null>(null);

    // Pagination for similar images
    const [similarPage, setSimilarPage] = useState(1);
    const [hasMoreSimilar, setHasMoreSimilar] = useState(false);
    const [loadingMoreSimilar, setLoadingMoreSimilar] = useState(false);

    const imageId = parseInt(params.id, 10);

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            setError(null);

            // Fetch image data using the new API endpoint
            const imageResult = await api.getImage(imageId);
            if (imageResult.data?.image) {
                setImage(imageResult.data.image);
                setLikes(imageResult.data.image.likes || 0);
                setDislikes(imageResult.data.image.dislikes || 0);
            } else {
                setError(imageResult.error || "Failed to load image");
            }

            // Fetch similar images (first page)
            const similarResult = await api.getSimilarImages(imageId, 1, 12);
            if (similarResult.data) {
                setSimilarImages(similarResult.data.images || []);
                setHasMoreSimilar(similarResult.data.has_more || false);
                setSimilarPage(1);
            }

            setIsLoading(false);
        }

        loadData();
    }, [imageId]);

    const handleVote = async (type: "like" | "dislike") => {
        if (hasVoted === type) return;

        const result = await api.voteImage(imageId, type);
        if (result.data) {
            setLikes(result.data.likes);
            setDislikes(result.data.dislikes);
            setHasVoted(type);
        }
    };

    const loadMoreSimilar = async () => {
        if (loadingMoreSimilar || !hasMoreSimilar) return;

        setLoadingMoreSimilar(true);
        const nextPage = similarPage + 1;
        const result = await api.getSimilarImages(imageId, nextPage, 12);

        if (result.data) {
            setSimilarImages(prev => [...prev, ...result.data!.images]);
            setHasMoreSimilar(result.data.has_more || false);
            setSimilarPage(nextPage);
        }
        setLoadingMoreSimilar(false);
    };

    const copyToClipboard = async (text: string, promptType: string = 'text_to_image') => {
        if (!user) {
            // Guest - redirect to login
            setSaveMessage('Please sign in to copy prompts');
            setTimeout(() => setSaveMessage(null), 2000);
            return;
        }

        setCopyLoading(true);

        // Call API to deduct credit
        const result = await api.copyPrompt(imageId, promptType);

        if (result.data?.success) {
            // Copy to clipboard
            navigator.clipboard.writeText(text);
            setCopied(true);
            setRemainingCredits(result.data.remaining_credits);
            setSaveMessage(`Copied! ${result.data.remaining_credits} credits remaining`);
            setTimeout(() => {
                setCopied(false);
                setSaveMessage(null);
            }, 2000);
        } else if (result.data?.require_upgrade) {
            setSaveMessage('No credits left. Upgrade to continue!');
            setTimeout(() => setSaveMessage(null), 3000);
        } else if (result.data?.require_login) {
            setSaveMessage('Please sign in to copy prompts');
            setTimeout(() => setSaveMessage(null), 2000);
        } else {
            setSaveMessage(result.error || 'Failed to copy');
            setTimeout(() => setSaveMessage(null), 2000);
        }

        setCopyLoading(false);
    };

    const loadGeneratedPrompts = async () => {
        if (generatedPrompts || loadingPrompts) return;
        setLoadingPrompts(true);
        const result = await api.generatePrompts(imageId);
        if (result.data) {
            setGeneratedPrompts(result.data);
        }
        setLoadingPrompts(false);
    };

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    // Load prompts when switching to prompts tab
    useEffect(() => {
        if (activeTab === "prompts") {
            loadGeneratedPrompts();
        }
    }, [activeTab]);

    // Toggle tab - click same tab to close it
    const handleTabClick = (tab: TabType) => {
        console.log('Tab clicked:', tab, 'Current activeTab:', activeTab);
        if (activeTab === tab) {
            console.log('Closing tab');
            setActiveTab(null); // Close the tab
        } else {
            console.log('Opening tab:', tab);
            setActiveTab(tab); // Open the tab
        }
    };

    // Get YouTube video ID from URL
    const getYouTubeId = (url: string) => {
        if (!url) return null;
        const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([^&?/]+)/);
        return match ? match[1] : null;
    };

    // Format timestamp as MM:SS
    const formatTimestamp = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Get video URL with timestamp for YouTube
    const getVideoUrlWithTimestamp = (url: string, timestamp?: number): string => {
        if (!url) return "#";
        if (timestamp === undefined) return url;

        const youtubeId = getYouTubeId(url);
        if (youtubeId) {
            return `https://www.youtube.com/watch?v=${youtubeId}&t=${Math.floor(timestamp)}`;
        }
        return url;
    };

    const truncatePrompt = (prompt: string, maxLength: number = 200) => {
        if (prompt.length <= maxLength) return prompt;
        return prompt.substring(0, maxLength) + "...";
    };

    if (isLoading) {
        return (
            <AppShell>
                <div className="max-w-[95vw] mx-auto">
                    <div className="h-8 w-32 bg-white/5 border border-white/10 animate-pulse mb-6" />
                    <div className="flex gap-10">
                        <div className="flex-1 aspect-video bg-white/5 border border-white/10 animate-pulse" />
                        <div className="w-[380px] h-[600px] bg-white/5 border border-white/10 animate-pulse" />
                    </div>
                </div>
            </AppShell>
        );
    }

    if (error || !image) {
        return (
            <AppShell>
                <div className="text-center py-20">
                    <h2 className="text-xl font-semibold mb-2">Image not found</h2>
                    <p className="text-white/60 mb-6">
                        {error || "This image doesn't exist or has been removed."}
                    </p>
                    <Button variant="accent" asChild>
                        <Link href="/">Back to Gallery</Link>
                    </Button>
                </div>
            </AppShell>
        );
    }

    const structured = image.generated_prompts?.structured_analysis;
    const youtubeId = image.source_video_url ? getYouTubeId(image.source_video_url) : null;

    return (
        <AppShell>
            <div className="max-w-[95vw] mx-auto">
                {/* Back Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to library
                </Link>

                {/* Toast Notification */}
                {saveMessage && (
                    <div className="fixed top-20 right-6 z-50 bg-white text-black px-4 py-3 shadow-lg flex items-center gap-2">
                        <Star className="w-4 h-4 fill-current" />
                        {saveMessage}
                    </div>
                )}

                <div className="flex gap-8 items-start">
                    {/* Left Column: Main Image */}
                    <div className="flex-1">
                        <div className="relative flex justify-center">
                            <img
                                src={image.image_url}
                                alt={image.prompt || "Image"}
                                className="max-w-full max-h-[65vh] object-contain border border-white/30"
                            />
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="w-[400px] flex-shrink-0 bg-black border border-white/30 overflow-hidden sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto">
                        {/* Header Actions */}
                        <div className="p-4 border-b border-white/20 flex gap-2">
                            <Button
                                variant={hasVoted === "like" ? "accent" : "secondary"}
                                size="sm"
                                onClick={() => handleVote("like")}
                            >
                                <Heart className={`w-4 h-4 ${hasVoted === "like" ? "fill-current" : ""}`} />
                                {likes}
                            </Button>
                            <Button
                                variant={hasVoted === "dislike" ? "destructive" : "secondary"}
                                size="sm"
                                onClick={() => handleVote("dislike")}
                            >
                                <ThumbsDown className="w-4 h-4" />
                                {dislikes}
                            </Button>
                            <SaveToBoardDropdown imageId={image.id} />
                            <Button
                                variant="secondary"
                                size="icon"
                                title="Share"
                                onClick={() => {
                                    const shareUrl = `${window.location.origin}/image/${image.id}`;
                                    navigator.clipboard.writeText(shareUrl);
                                    setSaveMessage("Link copied to clipboard!");
                                    setTimeout(() => setSaveMessage(null), 2000);
                                }}
                            >
                                <Share2 className="w-4 h-4" />
                            </Button>
                            <a href={image.image_url} download target="_blank" rel="noopener noreferrer">
                                <Button variant="secondary" size="icon" title="Download">
                                    <Download className="w-4 h-4" />
                                </Button>
                            </a>
                        </div>

                        {/* Collapsible Tabs - Click to expand */}
                        <div className="divide-y divide-white/10">
                            {/* Overview Tab Header */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleTabClick("overview"); }}
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                                <span className="font-semibold">Overview</span>
                                {activeTab === "overview" ? (
                                    <ChevronDown className="w-4 h-4 text-text-tertiary" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                                )}
                            </button>

                            {/* Overview Content */}
                            {activeTab === "overview" && (
                                <div className="p-4 space-y-5 border-t border-border-subtle bg-white/2">
                                    {/* Video Source - Subtle inline design */}
                                    {youtubeId && (
                                        <div className="flex items-center gap-3">
                                            <a
                                                href={getVideoUrlWithTimestamp(image.source_video_url || "", image.scene_start_time)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group relative w-16 h-10 rounded overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-red-500/50 transition-all"
                                            >
                                                <img
                                                    src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                                                    alt="Source video"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                                                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                                                        <svg className="w-2.5 h-2.5 text-white fill-current ml-0.5" viewBox="0 0 24 24">
                                                            <path d="M8 5v14l11-7z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </a>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-xs text-text-tertiary">
                                                    Frame from video
                                                    {image.scene_start_time !== undefined && (
                                                        <a
                                                            href={getVideoUrlWithTimestamp(image.source_video_url || "", image.scene_start_time)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="ml-2 text-red-400 hover:underline"
                                                        >
                                                            @ {formatTimestamp(image.scene_start_time)}
                                                        </a>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}


                                    {/* Prompt */}
                                    {image.prompt && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-xs uppercase tracking-wider text-text-secondary font-bold">
                                                    Prompt
                                                </h3>
                                                <button
                                                    onClick={() => copyToClipboard(image.prompt!)}
                                                    className="p-1.5 rounded hover:bg-white/10 text-text-tertiary hover:text-white transition-colors"
                                                    title="Copy Prompt"
                                                >
                                                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="text-sm leading-relaxed text-text-secondary">
                                                {image.prompt.length > 200 ? truncatePrompt(image.prompt) : image.prompt}
                                            </p>
                                        </div>
                                    )}

                                    {/* Properties */}
                                    {(image.mood || image.lighting) && (
                                        <div>
                                            <h3 className="text-xs uppercase tracking-wider text-text-secondary font-bold mb-2">
                                                Properties
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {image.mood && (
                                                    <span className="bg-white/5 px-3 py-1.5 border border-white/10 text-xs text-white/60">
                                                        <strong className="text-white">Mood:</strong> {image.mood}
                                                    </span>
                                                )}
                                                {image.lighting && (
                                                    <span className="bg-white/5 px-3 py-1.5 border border-white/10 text-xs text-white/60">
                                                        <strong className="text-white">Lighting:</strong> {image.lighting}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Colors */}
                                    {image.colors && image.colors.length > 0 && (
                                        <div>
                                            <h3 className="text-xs uppercase tracking-wider text-text-secondary font-bold mb-2">
                                                Colors
                                            </h3>
                                            <div className="flex gap-1.5 flex-wrap">
                                                {image.colors.map((color, i) => (
                                                    <Link
                                                        key={i}
                                                        href={`/search?color=${encodeURIComponent(color)}`}
                                                        className="w-7 h-7 border border-white/20 hover:scale-110 transition-transform"
                                                        style={{ backgroundColor: color }}
                                                        title={color}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {image.tags && image.tags.length > 0 && (
                                        <div>
                                            <h3 className="text-xs uppercase tracking-wider text-text-secondary font-bold mb-2">
                                                Tags
                                            </h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {image.tags.map((tag) => (
                                                    <Link
                                                        key={tag}
                                                        href={`/search?q=${tag}`}
                                                        className="bg-white/5 px-2.5 py-1 border border-white/10 text-xs text-white/60 hover:bg-white/10"
                                                    >
                                                        #{tag}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Analysis Tab Header */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleTabClick("analysis"); }}
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                                <span className="font-semibold">Analysis</span>
                                {activeTab === "analysis" ? (
                                    <ChevronDown className="w-4 h-4 text-text-tertiary" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                                )}
                            </button>

                            {/* Analysis Content */}
                            {activeTab === "analysis" && (
                                <div className="p-4 space-y-2 border-t border-border-subtle bg-white/2 overflow-y-auto max-h-[400px]">
                                    {structured ? (
                                        <>
                                            {structured.short_description && (
                                                <div className="p-3 mb-2 bg-accent-purple/10 border border-accent-purple/20 rounded-lg">
                                                    <p className="text-sm leading-relaxed">{structured.short_description}</p>
                                                </div>
                                            )}

                                            {structured.subjects && structured.subjects.length > 0 && (
                                                <AnalysisSection
                                                    title="Subjects"
                                                    count={structured.subjects.length}
                                                    isOpen={expandedSections.has("subjects")}
                                                    onToggle={() => toggleSection("subjects")}
                                                >
                                                    {structured.subjects.map((subject, i) => (
                                                        <div key={i} className="py-2 border-b border-white/5 last:border-0">
                                                            {subject.type && (
                                                                <span className="inline-block bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase font-semibold mb-1">
                                                                    {subject.type}
                                                                </span>
                                                            )}
                                                            {subject.description && <p className="text-xs text-text-secondary">{subject.description}</p>}
                                                        </div>
                                                    ))}
                                                </AnalysisSection>
                                            )}

                                            {structured.environment && (
                                                <AnalysisSection
                                                    title="Environment"
                                                    isOpen={expandedSections.has("environment")}
                                                    onToggle={() => toggleSection("environment")}
                                                >
                                                    {structured.environment.setting && <p className="text-xs text-text-secondary"><strong>Setting:</strong> {structured.environment.setting}</p>}
                                                    {structured.environment.background && <p className="text-xs text-text-secondary"><strong>Background:</strong> {structured.environment.background}</p>}
                                                    {structured.environment.atmosphere && <p className="text-xs text-text-secondary"><strong>Atmosphere:</strong> {structured.environment.atmosphere}</p>}
                                                </AnalysisSection>
                                            )}

                                            {structured.lighting && (
                                                <AnalysisSection
                                                    title="Lighting"
                                                    isOpen={expandedSections.has("lighting")}
                                                    onToggle={() => toggleSection("lighting")}
                                                >
                                                    {structured.lighting.type && <p className="text-xs text-text-secondary"><strong>Type:</strong> {structured.lighting.type}</p>}
                                                    {structured.lighting.direction && <p className="text-xs text-text-secondary"><strong>Direction:</strong> {structured.lighting.direction}</p>}
                                                    {structured.lighting.quality && <p className="text-xs text-text-secondary"><strong>Quality:</strong> {structured.lighting.quality}</p>}
                                                </AnalysisSection>
                                            )}

                                            {structured.camera && (
                                                <AnalysisSection
                                                    title="Camera"
                                                    isOpen={expandedSections.has("camera")}
                                                    onToggle={() => toggleSection("camera")}
                                                >
                                                    {structured.camera.shot_type && <p className="text-xs text-text-secondary"><strong>Shot:</strong> {structured.camera.shot_type}</p>}
                                                    {structured.camera.angle && <p className="text-xs text-text-secondary"><strong>Angle:</strong> {structured.camera.angle}</p>}
                                                    {structured.camera.depth_of_field && <p className="text-xs text-text-secondary"><strong>Depth of Field:</strong> {structured.camera.depth_of_field}</p>}
                                                </AnalysisSection>
                                            )}

                                            {structured.mood && (
                                                <AnalysisSection
                                                    title="Mood & Style"
                                                    isOpen={expandedSections.has("mood")}
                                                    onToggle={() => toggleSection("mood")}
                                                >
                                                    {structured.mood.emotion && <p className="text-xs text-text-secondary"><strong>Emotion:</strong> {structured.mood.emotion}</p>}
                                                    {structured.mood.energy && <p className="text-xs text-text-secondary"><strong>Energy:</strong> {structured.mood.energy}</p>}
                                                    {structured.mood.style && <p className="text-xs text-text-secondary"><strong>Style:</strong> {structured.mood.style}</p>}
                                                </AnalysisSection>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-text-secondary text-center py-4">No analysis available for this image yet.</p>
                                    )}
                                </div>
                            )}

                            {/* AI Prompts Tab Header */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleTabClick("prompts"); }}
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                                <span className="font-semibold">AI Prompts</span>
                                {activeTab === "prompts" ? (
                                    <ChevronDown className="w-4 h-4 text-text-tertiary" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                                )}
                            </button>

                            {/* AI Prompts Content */}
                            {activeTab === "prompts" && (
                                <div className="p-4 space-y-4 border-t border-border-subtle bg-white/2">
                                    {loadingPrompts ? (
                                        <div className="text-center py-8">
                                            <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                            <p className="text-sm text-text-secondary">Generating prompts...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <PromptBlock
                                                label="Text-to-Image"
                                                prompt={generatedPrompts?.text_to_image || image.generated_prompts?.text_to_image}
                                                onCopy={copyToClipboard}
                                            />
                                            <PromptBlock
                                                label="Image-to-Image"
                                                prompt={generatedPrompts?.image_to_image || image.generated_prompts?.image_to_image}
                                                onCopy={copyToClipboard}
                                            />
                                            <PromptBlock
                                                label="Text-to-Video"
                                                prompt={generatedPrompts?.text_to_video || image.generated_prompts?.text_to_video}
                                                onCopy={copyToClipboard}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div >
                </div >

                {/* Similar Images - always shown at bottom, full width */}
                {
                    similarImages.length > 0 && (
                        <div className="mt-12">
                            <h2 className="text-xl font-semibold mb-6">More like this</h2>
                            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-4">
                                {similarImages.map((img) => (
                                    <ImageCard
                                        key={img.id}
                                        id={img.id}
                                        imageUrl={img.image_url}
                                        mood={img.mood}
                                        colors={img.colors}
                                    />
                                ))}
                            </div>

                            {/* Load More Button */}
                            {hasMoreSimilar && (
                                <div className="flex justify-center pt-8 pb-4">
                                    <button
                                        onClick={loadMoreSimilar}
                                        disabled={loadingMoreSimilar}
                                        className="px-6 py-3 bg-white/5 border border-white/20 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loadingMoreSimilar ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            "Load more"
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                }
            </div >
        </AppShell >
    );
}

// Helper Components
function AnalysisSection({
    title,
    count,
    isOpen,
    onToggle,
    children,
}: {
    title: string;
    count?: number;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-border-subtle rounded-lg overflow-hidden bg-white/2">
            <button
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/5 transition-colors"
                onClick={onToggle}
            >
                {isOpen ? (
                    <ChevronDown className="w-3 h-3 text-text-secondary" />
                ) : (
                    <ChevronRight className="w-3 h-3 text-text-secondary" />
                )}
                <span className="text-sm font-semibold">{title}</span>
                {count && (
                    <span className="ml-auto bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {count}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="px-3 pb-3 border-t border-border-subtle pt-2 space-y-1">
                    {children}
                </div>
            )}
        </div>
    );
}

function PromptBlock({
    label,
    prompt,
    onCopy,
}: {
    label: string;
    prompt?: string;
    onCopy: (text: string) => void;
}) {
    return (
        <div className="p-3 bg-white/3 border border-border-subtle rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-accent-purple">{label}</span>
                {prompt && (
                    <button
                        className="p-1 hover:bg-white/10 rounded text-text-tertiary hover:text-white transition-colors"
                        onClick={() => onCopy(prompt)}
                        title="Copy"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                )}
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
                {prompt || "-"}
            </p>
        </div>
    );
}

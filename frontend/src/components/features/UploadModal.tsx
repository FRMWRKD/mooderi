"use client";

import { useState, useRef, useCallback } from "react";
import {
    Modal,
    ModalTrigger,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Upload, Globe, Lock, Image as ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface UploadModalProps {
    trigger?: React.ReactNode;
    onImageUploaded?: (imageId: number) => void;
}

type UploadStatus = "idle" | "uploading" | "analyzing" | "complete" | "error";

export function UploadModal({ trigger, onImageUploaded }: UploadModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isPublic, setIsPublic] = useState(true); // Default: share with community
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((selectedFile: File) => {
        if (!selectedFile.type.startsWith("image/")) {
            setError("Please select an image file");
            return;
        }
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError("File size must be less than 10MB");
            return;
        }
        setFile(selectedFile);
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus("uploading");
        setProgress(0);
        setError(null);

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError("Please log in to upload images");
                setStatus("error");
                return;
            }

            // Generate unique filename
            const ext = file.name.split(".").pop();
            const filename = `${user.id}/${Date.now()}.${ext}`;

            setProgress(20);

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("images")
                .upload(filename, file, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (uploadError) {
                throw new Error(uploadError.message);
            }

            setProgress(50);

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from("images")
                .getPublicUrl(filename);

            // Insert image record
            const { data: imageData, error: insertError } = await supabase
                .from("images")
                .insert({
                    image_url: publicUrl,
                    user_id: user.id,
                    is_public: isPublic,
                    source_type: "upload",
                })
                .select()
                .single();

            if (insertError) {
                throw new Error(insertError.message);
            }

            setProgress(70);
            setStatus("analyzing");

            // Trigger analysis via edge function
            const { data: { session } } = await supabase.auth.getSession();
            const analyzeResponse = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-image`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${session?.access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ image_url: publicUrl, image_id: imageData.id }),
                }
            );

            setProgress(90);

            if (!analyzeResponse.ok) {
                console.warn("Analysis failed, but image was uploaded successfully");
            }

            setProgress(100);
            setStatus("complete");
            onImageUploaded?.(imageData.id);

            // Auto-close after success
            setTimeout(() => {
                resetModal();
                setIsOpen(false);
            }, 1500);

        } catch (err) {
            console.error("Upload error:", err);
            setError(err instanceof Error ? err.message : "Upload failed");
            setStatus("error");
        }
    };

    const resetModal = () => {
        setFile(null);
        setPreview(null);
        setStatus("idle");
        setProgress(0);
        setError(null);
        setIsPublic(true);
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) resetModal();
    };

    return (
        <Modal open={isOpen} onOpenChange={handleOpenChange}>
            {trigger && <ModalTrigger asChild>{trigger}</ModalTrigger>}
            <ModalContent className="max-w-lg">
                <ModalHeader>
                    <ModalTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Upload Image
                    </ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className="space-y-4">
                    {/* Drop Zone */}
                    {!preview ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                                transition-all duration-200
                                ${isDragging
                                    ? "border-accent-blue bg-accent-blue/10"
                                    : "border-white/20 hover:border-white/40 hover:bg-white/5"
                                }
                            `}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                className="hidden"
                            />
                            <ImageIcon className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
                            <p className="text-sm text-text-secondary mb-1">
                                Drag and drop an image here
                            </p>
                            <p className="text-xs text-text-tertiary">
                                or click to browse (max 10MB)
                            </p>
                        </div>
                    ) : (
                        <div className="relative">
                            <img
                                src={preview}
                                alt="Preview"
                                className="w-full max-h-64 object-contain rounded-lg border border-white/10"
                            />
                            {status === "idle" && (
                                <button
                                    onClick={() => { setFile(null); setPreview(null); }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                            {(status === "uploading" || status === "analyzing") && (
                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <p className="text-sm">
                                        {status === "uploading" ? "Uploading..." : "Analyzing..."}
                                    </p>
                                    <div className="w-32 h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-accent-blue transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            {status === "complete" && (
                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg">
                                    <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                                    <p className="text-sm text-green-400">Upload complete!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visibility Options */}
                    {preview && status === "idle" && (
                        <div className="space-y-2">
                            <p className="text-sm text-text-secondary">Share this image:</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setIsPublic(true)}
                                    className={`
                                        flex items-center gap-2 p-3 rounded-lg border transition-all
                                        ${isPublic
                                            ? "border-accent-blue bg-accent-blue/10 text-white"
                                            : "border-white/20 text-text-tertiary hover:border-white/40"
                                        }
                                    `}
                                >
                                    <Globe className={`w-5 h-5 ${isPublic ? "text-accent-blue" : ""}`} />
                                    <div className="text-left">
                                        <div className="text-sm font-medium">Community</div>
                                        <div className="text-xs opacity-60">Everyone can see</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setIsPublic(false)}
                                    className={`
                                        flex items-center gap-2 p-3 rounded-lg border transition-all
                                        ${!isPublic
                                            ? "border-accent-blue bg-accent-blue/10 text-white"
                                            : "border-white/20 text-text-tertiary hover:border-white/40"
                                        }
                                    `}
                                >
                                    <Lock className={`w-5 h-5 ${!isPublic ? "text-accent-blue" : ""}`} />
                                    <div className="text-left">
                                        <div className="text-sm font-medium">Private</div>
                                        <div className="text-xs opacity-60">Only in my boards</div>
                                    </div>
                                </button>
                            </div>
                            {isPublic && (
                                <p className="text-xs text-accent-blue">
                                    💡 Share 10 images to earn 1 free credit!
                                </p>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        onClick={handleUpload}
                        disabled={!file || status !== "idle"}
                    >
                        {status === "idle" ? "Upload & Analyze" : "Processing..."}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

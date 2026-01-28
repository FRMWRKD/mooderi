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
import { useMutation, useAction, useConvex, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { Id } from "@convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";

interface UploadModalProps {
    trigger?: React.ReactNode;
    onImageUploaded?: (imageId: string) => void;
}

type UploadStatus = "idle" | "uploading" | "analyzing" | "complete" | "error";

// Get the Convex HTTP endpoint URL from environment
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_URL?.replace('.cloud', '.site') || '';

export function UploadModal({ trigger, onImageUploaded }: UploadModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isPublic, setIsPublic] = useState(true);
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { user } = useAuth();

    // Check if R2 is configured
    const isR2Configured = useQuery(api.r2Storage.isConfigured);

    // Convex hooks - legacy Convex Storage
    const generateUploadUrl = useMutation(api.images.generateUploadUrl);

    // R2 upload action
    const generateR2UploadUrl = useAction(api.r2Storage.generatePresignedUploadUrl);

    const createImage = useMutation(api.images.create);
    const analyzeImage = useAction(api.ai.analyzeImage);

    // Convex client for one-off queries
    const convexClient = useConvex();

    const handleFileSelect = (selectedFile: File) => {
        if (!selectedFile.type.startsWith("image/")) {
            setError("Please select an image file");
            return;
        }

        setFile(selectedFile);
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    }, []);

    const handleUpload = async () => {
        if (!file) return;

        setStatus("uploading");
        setProgress(0);
        setError(null);

        try {
            if (!user) {
                setError("Please log in to upload images");
                setStatus("error");
                return;
            }

            setProgress(10);

            let imageId: Id<"images">;
            let finalImageUrl: string;

            // Use R2 if configured, otherwise fall back to Convex Storage
            if (isR2Configured) {
                // ========== R2 UPLOAD FLOW ==========


                // 1. Get presigned upload URL from R2
                const { uploadUrl, fileKey, publicUrl } = await generateR2UploadUrl({
                    contentType: file.type,
                    prefix: "uploads",
                });

                setProgress(30);

                // 2. Upload file directly to R2
                const uploadResult = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": file.type },
                    body: file,
                });

                if (!uploadResult.ok) {
                    throw new Error(`R2 upload failed: ${uploadResult.statusText}`);
                }

                setProgress(60);
                finalImageUrl = publicUrl;

                // 3. Create image record with R2 key and public URL
                imageId = await createImage({
                    imageUrl: publicUrl,
                    r2Key: fileKey,
                    isPublic: isPublic,
                    sourceType: "upload",
                });
            } else {
                // ========== LEGACY CONVEX STORAGE FLOW ==========


                // 1. Get short-lived upload URL
                const postUrl = await generateUploadUrl();

                setProgress(30);

                // 2. Upload file to Convex Storage
                const result = await fetch(postUrl, {
                    method: "POST",
                    headers: { "Content-Type": file.type },
                    body: file,
                });

                if (!result.ok) {
                    throw new Error(`Upload failed: ${result.statusText}`);
                }

                const { storageId } = await result.json();

                setProgress(60);

                // 3. Create image record with storage ID
                imageId = await createImage({
                    storageId: storageId as Id<"_storage">,
                    isPublic: isPublic,
                    sourceType: "upload",
                });

                // Get the image URL for analysis
                const createdImage = await convexClient.query(api.images.getById, { id: imageId });
                finalImageUrl = createdImage?.imageUrl || "";
            }

            setProgress(80);
            setStatus("analyzing");

            // 4. Trigger AI analysis
            try {
                if (finalImageUrl) {
                    await analyzeImage({
                        imageId: imageId,
                        imageUrl: finalImageUrl,
                    });

                } else {

                }
            } catch (analysisError) {

            }

            setProgress(100);
            setStatus("complete");
            onImageUploaded?.(imageId);

            // Auto-close after success
            setTimeout(() => {
                resetModal();
                setIsOpen(false);
            }, 1500);

        } catch (err) {

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
                    <div
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                            ? "border-accent-blue bg-accent-blue/10"
                            : preview
                                ? "border-green-500/50 bg-green-500/5"
                                : "border-border-subtle hover:border-border-medium"
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                            }}
                        />

                        {preview ? (
                            <div className="relative">
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="max-h-48 mx-auto rounded-lg"
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                        setPreview(null);
                                    }}
                                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center">
                                    <ImageIcon className="w-6 h-6 text-text-tertiary" />
                                </div>
                                <p className="text-text-secondary">
                                    {isDragging
                                        ? "Drop image here..."
                                        : "Drag & drop or click to upload"}
                                </p>
                                <p className="text-xs text-text-tertiary">
                                    PNG, JPG, WebP up to 10MB
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Visibility Toggle */}
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-2">
                            {isPublic ? (
                                <Globe className="w-4 h-4 text-text-secondary" />
                            ) : (
                                <Lock className="w-4 h-4 text-text-secondary" />
                            )}
                            <span className="text-sm">
                                {isPublic ? "Public - Anyone can see" : "Private - Only you"}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsPublic(!isPublic)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-accent-blue" : "bg-white/20"
                                }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? "translate-x-5" : ""
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Progress & Status */}
                    {status !== "idle" && status !== "error" && (
                        <div className="space-y-2">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent-blue transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-text-secondary text-center">
                                {status === "uploading" && "Uploading..."}
                                {status === "analyzing" && "Analyzing with AI..."}
                                {status === "complete" && (
                                    <span className="flex items-center justify-center gap-2 text-green-400">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Upload complete!
                                    </span>
                                )}
                            </p>
                        </div>
                    )}

                    {/* Error */}
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
                        disabled={!file || status === "uploading" || status === "analyzing"}
                    >
                        {status === "uploading" || status === "analyzing" ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {status === "uploading" ? "Uploading..." : "Analyzing..."}
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Upload
                            </>
                        )}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

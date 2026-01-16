"use client";

/**
 * Convex React Hooks
 * Wrappers for easy migration from fetch-based api.ts
 * 
 * Usage:
 * const { images, isLoading } = useImages();
 * const { boards } = useBoards();
 * const createBoard = useCreateBoard();
 */

import { useQuery, useMutation, useAction } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { Doc } from "../../../convex/_generated/dataModel";

// ============================================
// IMAGE HOOKS
// ============================================

/**
 * Get paginated list of public images
 */
export function useImages(limit?: number) {
  const data = useQuery(api.images.list, { limit });
  
  return {
    images: data?.images ?? [],
    hasMore: data?.hasMore ?? false,
    isLoading: data === undefined,
  };
}

/**
 * Get a single image by ID
 */
export function useImage(imageId: Id<"images"> | null) {
  const data = useQuery(
    api.images.getById,
    imageId ? { id: imageId } : "skip"
  );
  
  return {
    image: data ?? null,
    isLoading: data === undefined && imageId !== null,
  };
}

/**
 * Filter images by criteria
 */
export function useFilteredImages(filters: {
  mood?: string[];
  lighting?: string[];
  tags?: string[];
  sourceType?: string;
  sort?: string;
  limit?: number;
  onlyPublic?: boolean;
  userId?: Id<"users">;
}) {
  const data = useQuery(api.images.filter, filters);
  
  return {
    images: data?.images ?? [],
    count: data?.count ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading: data === undefined,
  };
}

/**
 * Get filter options (unique moods, lighting, tags)
 */
export function useFilterOptions() {
  const data = useQuery(api.images.getFilterOptions, {});
  
  return {
    moods: data?.moods ?? [],
    lighting: data?.lighting ?? [],
    tags: data?.tags ?? [],
    totalImages: data?.total_images ?? 0,
    isLoading: data === undefined,
  };
}

/**
 * Text search in prompts
 */
/**
 * Text search in prompts
 */
export function useTextSearch(query: string, limit?: number) {
  const data = useQuery(
    api.images.textSearch,
    query ? { query, limit } : "skip"
  );
  
  return {
    images: data?.images ?? [],
    count: data?.count ?? 0,
    isLoading: data === undefined && !!query,
  };
}

/**
 * Semantic Text Search (Vector)
 */
export function useSemanticSearch(query: string, limit?: number) {
  const [images, setImages] = useState<Doc<"images">[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchAction = useAction(api.images.searchByText);
  
  useEffect(() => {
    if (!query) {
      setImages([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      let isMounted = true;
      setIsLoading(true);
      
      searchAction({ query, limit })
        .then((res) => {
          if (isMounted) {
            setImages(res);
          }
        })
        .catch((err) => {
          console.error("Semantic search failed:", err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
        
      return () => { isMounted = false; };
    }, 500); // Debounce
      
    return () => clearTimeout(timeoutId);
  }, [query, limit]);
  
  return {
    images,
    count: images.length,
    isLoading,
  };
}

/**
 * Get similar images
 */
export function useSimilarImages(imageId: Id<"images"> | null, limit?: number) {
  const data = useQuery(
    api.images.getSimilar,
    imageId ? { imageId, limit } : "skip"
  );
  
  return {
    images: data?.images ?? [],
    count: data?.count ?? 0,
    isLoading: data === undefined && imageId !== null,
  };
}

/**
 * Get similar images using VECTOR SEARCH (Action)
 */
export function useSimilarImagesVector(imageId: Id<"images"> | null, limit?: number) {
  const [results, setResults] = useState<{images: Doc<"images">[], count: number}>({images: [], count: 0});
  const [isLoading, setIsLoading] = useState(false);
  const searchAction = useAction(api.images.searchSimilar);
  
  useEffect(() => {
    if (!imageId) {
      setResults({images: [], count: 0});
      return;
    }
    
    let isMounted = true;
    setIsLoading(true);
    
    searchAction({ imageId, limit })
      .then((res) => {
        if (isMounted && res) {
           // Handle response which could be array or object depending on implementation
           // My implementation returns { images, count }
           if ('images' in res) {
             setResults(res as any);
           } else {
             setResults({ images: res as any, count: (res as any).length });
           }
        }
      })
      .catch((err) => {
        console.error("Vector search failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [imageId, limit]); // searchAction is stable
  
  return {
    images: results.images,
    count: results.count,
    isLoading,
  };
}

/**
 * Get ranked images for homepage
 */
export function useRankedImages(limit?: number, offset?: number) {
  const data = useQuery(api.images.getRanked, { limit, offset });
  
  return {
    images: data?.images ?? [],
    count: data?.count ?? 0,
    isLoading: data === undefined,
  };
}

// Image mutations
export function useCreateImage() {
  return useMutation(api.images.create);
}

export function useUpdateImage() {
  return useMutation(api.images.update);
}

export function useVoteImage() {
  return useMutation(api.images.vote);
}

export function useDeleteImage() {
  return useMutation(api.images.remove);
}

// ============================================
// BOARD HOOKS
// ============================================

/**
 * Get user's boards with image counts
 */
export function useBoards(userId?: Id<"users">) {
  const data = useQuery(api.boards.list, { userId });
  
  return {
    boards: data ?? [],
    isLoading: data === undefined,
  };
}

/**
 * Get public boards
 */
export function usePublicBoards() {
  const data = useQuery(api.boards.list, { includePublic: true });
  
  return {
    boards: data ?? [],
    isLoading: data === undefined,
  };
}

/**
 * Get a single board with its images
 */
export function useBoardWithImages(boardId: Id<"boards"> | null) {
  const data = useQuery(
    api.boards.getWithImages,
    boardId ? { boardId } : "skip"
  );
  
  return {
    board: data ?? null,
    images: data?.images ?? [],
    isLoading: data === undefined && boardId !== null,
  };
}

/**
 * Get subfolders of a board
 */
export function useSubfolders(parentId: Id<"boards"> | null) {
  const data = useQuery(
    api.boards.getSubfolders,
    parentId ? { parentId } : "skip"
  );
  
  return {
    subfolders: data ?? [],
    isLoading: data === undefined && parentId !== null,
  };
}

// Board mutations
export function useCreateBoard() {
  return useMutation(api.boards.create);
}

export function useUpdateBoard() {
  return useMutation(api.boards.update);
}

export function useDeleteBoard() {
  return useMutation(api.boards.remove);
}

export function useAddToBoard() {
  return useMutation(api.boards.addImage);
}

export function useRemoveFromBoard() {
  return useMutation(api.boards.removeImage);
}

// ============================================
// VIDEO HOOKS
// ============================================

/**
 * Get user's videos
 */
export function useVideos(userId?: Id<"users">) {
  const data = useQuery(api.videos.list, { userId });
  
  return {
    videos: data ?? [],
    isLoading: data === undefined,
  };
}

/**
 * Get a single video
 */
export function useVideo(videoId: Id<"videos"> | null) {
  const data = useQuery(
    api.videos.getById,
    videoId ? { id: videoId } : "skip"
  );
  
  return {
    video: data ?? null,
    isLoading: data === undefined && videoId !== null,
  };
}

/**
 * Get frames from a video
 */
export function useVideoFrames(videoId: Id<"videos"> | null) {
  const data = useQuery(
    api.videos.getFrames,
    videoId ? { videoId } : "skip"
  );
  
  return {
    frames: data ?? [],
    isLoading: data === undefined && videoId !== null,
  };
}

// Video mutations
export function useCreateVideo() {
  return useMutation(api.videos.create);
}

export function useUpdateVideoStatus() {
  return useMutation(api.videos.updateStatus);
}

export function useAddVideoFrame() {
  return useMutation(api.videos.addFrame);
}

export function useDeleteVideo() {
  return useMutation(api.videos.remove);
}

// ============================================
// USER HOOKS
// ============================================

/**
 * Get current authenticated user
 */
/**
 * Get current authenticated user
 */
export function useCurrentUser() {
  const { user } = useAuth();
  const data = useQuery(api.users.getBySupabaseId, user?.id ? { supabaseId: user.id } : "skip");
  
  return {
    user: data ?? null,
    isLoading: data === undefined,
    isAuthenticated: !!user,
  };
}

// User mutations
export function useStoreUser() {
  return useMutation(api.users.storeFromSupabase);
}

export function useUpdateProfile() {
  return useMutation(api.users.updateProfile);
}

export function useUseCredits() {
  return useMutation(api.users.useCredits);
}

// ============================================
// NOTIFICATION HOOKS
// ============================================

/**
 * Get user's notifications
 */
export function useNotifications(limit?: number) {
  const data = useQuery(api.notifications.list, { limit });
  
  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading: data === undefined,
  };
}

// Notification mutations
export function useMarkNotificationsRead() {
  return useMutation(api.notifications.markAsRead);
}

// ============================================
// AI HOOKS
// ============================================

/**
 * Analyze an image using AI pipeline
 */
export function useAnalyzeImage() {
  return useAction(api.ai.analyzeImage);
}

/**
 * Generate embedding for search query
 */
export function useGenerateSearchEmbedding() {
  return useAction(api.ai.generateSearchEmbedding);
}

// ============================================
// RAG HOOKS - Semantic Search for Prompts
// ============================================

/**
 * Search prompts semantically using RAG
 */
export function useRagSearchPrompts() {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchAction = useAction(api.rag.searchPrompts);
  
  const search = async (query: string, options?: { limit?: number; mood?: string; lighting?: string }) => {
    if (!query.trim()) {
      setResults([]);
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await searchAction({
        query,
        limit: options?.limit ?? 10,
        mood: options?.mood,
        lighting: options?.lighting,
      });
      setResults(response.results);
      return response.results;
    } catch (err: any) {
      setError(err.message || "Search failed");
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    search,
    results,
    isLoading,
    error,
  };
}

/**
 * Find similar prompts to an image using RAG
 */
export function useFindSimilarPrompts(imageId: Id<"images"> | null, limit?: number) {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const findSimilarAction = useAction(api.rag.findSimilarPrompts);
  
  useEffect(() => {
    if (!imageId) {
      setResults([]);
      return;
    }
    
    let isMounted = true;
    setIsLoading(true);
    
    findSimilarAction({ imageId, limit })
      .then((response) => {
        if (isMounted && response.success) {
          setResults(response.results);
        }
      })
      .catch((err) => {
        console.error("Find similar prompts failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    
    return () => { isMounted = false; };
  }, [imageId, limit]);
  
  return {
    similarPrompts: results,
    isLoading,
  };
}

/**
 * Index a prompt into RAG
 */
export function useIndexPrompt() {
  return useAction(api.rag.indexPrompt);
}


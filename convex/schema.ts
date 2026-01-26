import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Mooderi Database Schema
 * Migrated from Supabase PostgreSQL
 * 
 * Tables:
 * - images: Main content with AI-generated prompts and embeddings
 * - boards: User collections/folders
 * - boardImages: Junction table for board ↔ image relations
 * - videos: Video processing tracking (for Modal integration)
 * - users: User profiles (synced from auth provider)
 * - notifications: User notification system
 * - systemPrompts: AI prompt templates (for Straico)
 * - userActions: Likes, dislikes, favorites tracking
 */

export default defineSchema({
  // Auth tables from @convex-dev/auth
  ...authTables,
  
  // Override users table to extend with custom fields
  users: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    
    // Custom fields
    avatarUrl: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()), // From auth provider
    
    // Credits system
    credits: v.optional(v.number()),
    totalCreditsUsed: v.optional(v.number()),
    
    // Subscription status (from Polar)
    isUnlimitedSubscriber: v.optional(v.boolean()),
    subscriptionExpiresAt: v.optional(v.number()),
    
    // Preferences
    preferences: v.optional(v.object({
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
      defaultBoardId: v.optional(v.id("boards")),
    })),
  })
    .index("email", ["email"])
    .index("by_token", ["tokenIdentifier"]),
  
  // ============================================
  // IMAGES TABLE - Main content table
  // ============================================
  images: defineTable({
    // Core fields
    imageUrl: v.string(),
    storageId: v.optional(v.id("_storage")), // Legacy: Convex Storage
    r2Key: v.optional(v.string()), // New: Cloudflare R2 file key
    thumbnailUrl: v.optional(v.string()),
    
    // AI-generated content
    prompt: v.optional(v.string()),
    generatedPrompts: v.optional(v.object({
      text_to_image: v.optional(v.string()),
      image_to_image: v.optional(v.string()),
      text_to_video: v.optional(v.string()),
      visionati_analysis: v.optional(v.string()),
      structured_analysis: v.optional(v.any()),
    })),
    
    // Metadata from Visionati
    mood: v.optional(v.string()),
    lighting: v.optional(v.string()),
    colors: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    
    // Embedding for semantic search (768 dimensions)
    embedding: v.optional(v.array(v.float64())),
    
    // Ranking & engagement
    aestheticScore: v.optional(v.float64()),
    likes: v.optional(v.number()),
    dislikes: v.optional(v.number()),
    isCurated: v.optional(v.boolean()),
    
    // Auto-detected prompt category
    detectedCategory: v.optional(v.union(
      v.literal("youtube_thumbnail"),
      v.literal("realistic"),
      v.literal("anime"),
      v.literal("illustration"),
      v.literal("cinematic"),
      v.literal("logo"),
      v.literal("product"),
      v.literal("abstract")
    )),
    
    // Ownership & visibility
    userId: v.optional(v.id("users")),
    isPublic: v.optional(v.boolean()),
    visibility: v.optional(v.union(
      v.literal("public"),
      v.literal("private"),
      v.literal("unlisted")
    )),
    
    // Source tracking
    sourceType: v.optional(v.union(
      v.literal("upload"),
      v.literal("video_import"),
      v.literal("url_import")
    )),
    sourceVideoUrl: v.optional(v.string()),
    videoId: v.optional(v.id("videos")),
    frameNumber: v.optional(v.number()),
    
    // Processing status
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    
    // AI analysis fields
    cameraShot: v.optional(v.string()),
    isAnalyzed: v.optional(v.boolean()),
    
    // Deduplication
    signature: v.optional(v.string()), // SHA-256 or perceptual hash
  })
    .index("by_signature", ["signature"])
    .index("by_user", ["userId"])
    .index("by_video", ["videoId"])
    .index("by_status", ["status"])
    .index("by_public", ["isPublic"])
    .index("by_curated_score", ["isCurated", "aestheticScore"])
    .searchIndex("search_prompt", {
      searchField: "prompt",
      filterFields: ["mood", "lighting", "isPublic"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["isPublic"],
    }),

  // ============================================
  // BOARDS TABLE - User collections
  // ============================================
  boards: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    parentId: v.optional(v.id("boards")), // For nested folders
    isPublic: v.optional(v.boolean()),
    coverImageUrl: v.optional(v.string()),
    colorTheme: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_parent", ["parentId"])
    .index("by_public", ["isPublic"]),

  // ============================================
  // BOARD_IMAGES - Junction table
  // ============================================
  boardImages: defineTable({
    boardId: v.id("boards"),
    imageId: v.id("images"),
    position: v.optional(v.number()),
  })
    .index("by_board", ["boardId"])
    .index("by_image", ["imageId"])
    .index("by_board_and_image", ["boardId", "imageId"]),

  // ============================================
  // VIDEOS TABLE - Video processing tracking
  // ============================================
  videos: defineTable({
    url: v.string(),
    title: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    duration: v.optional(v.number()), // seconds
    qualityMode: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    frameCount: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("downloading"),
      v.literal("processing"),
      v.literal("extracting_frames"),
      v.literal("analyzing"),
      v.literal("completed"),
      v.literal("pending_approval"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    isPublic: v.optional(v.boolean()),
    
    // Modal job tracking
    modalJobId: v.optional(v.string()),
    progress: v.optional(v.number()), // 0-100
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_modal_job", ["modalJobId"]),

  // ============================================
  // NOTIFICATIONS TABLE
  // ============================================
  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("video_complete"),
      v.literal("analysis_complete"),
      v.literal("credit_low"),
      v.literal("system")
    ),
    title: v.string(),
    message: v.string(),
    isRead: v.optional(v.boolean()),
    relatedId: v.optional(v.string()), // ID of related entity
    relatedType: v.optional(v.string()), // "video", "image", etc.
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"]),

  // ============================================
  // SYSTEM_PROMPTS TABLE - AI prompt templates
  // ============================================
  systemPrompts: defineTable({
    promptId: v.string(), // e.g., "straico_v1", "category_youtube_v1"
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(), // The actual prompt template
    version: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    // Category linking
    categoryKey: v.optional(v.string()), // Links to promptCategories.key
    // Performance tracking
    tokenCount: v.optional(v.number()), // Estimated token usage
    avgRating: v.optional(v.number()), // Average rating of outputs (0-5)
  })
    .index("by_prompt_id", ["promptId"])
    .index("by_category", ["categoryKey"]),

  // ============================================
  // USER_ACTIONS TABLE - Likes, favorites, etc.
  // ============================================
  userActions: defineTable({
    userId: v.id("users"),
    imageId: v.optional(v.id("images")),
    actionType: v.union(
      v.literal("like"),
      v.literal("dislike"),
      v.literal("favorite"),
      v.literal("copy_prompt"),
      v.literal("generate_prompt")
    ),
  })
    .index("by_user", ["userId"])
    .index("by_image", ["imageId"])
    .index("by_user_and_image", ["userId", "imageId"])
    .index("by_user_action_type", ["userId", "actionType"]),

  // ============================================
  // AGENT_MESSAGES TABLE - Chat history with AI agent
  // ============================================
  agentMessages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageIds: v.optional(v.array(v.id("images"))),
    promptType: v.optional(v.string()), // "single", "multi", "detailed"
    creditsUsed: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "createdAt"]),

  // ============================================
  // PROMPT_REQUESTS TABLE - AI prompt generation logs
  // ============================================
  promptRequests: defineTable({
    // Input
    inputText: v.optional(v.string()),
    inputImageUrl: v.optional(v.string()),
    
    // Output
    generatedPrompt: v.string(),
    topMatchImageId: v.optional(v.id("images")),
    recommendationIds: v.optional(v.array(v.id("images"))),
    
    // Visionati analysis (for display)
    visionatiAnalysis: v.optional(v.object({
      short_description: v.optional(v.string()),
      mood: v.optional(v.string()),
      lighting: v.optional(v.string()),
      colors: v.optional(v.array(v.string())),
    })),
    
    // Metadata
    userId: v.optional(v.id("users")),
    isPublic: v.boolean(),
    source: v.union(v.literal("landing"), v.literal("app")),
    
    // For rate limiting (IP hash for guests)
    clientKey: v.optional(v.string()),
    
    // Credits used (for app)
    creditsUsed: v.optional(v.number()),
  })
    .index("by_public", ["isPublic"])
    .index("by_user", ["userId"])
    .index("by_source", ["source"])
    .index("by_client_key", ["clientKey"]),

  /**
   * Generation Progress
   * Tracks real-time progress during prompt generation for UI updates
   */
  generationProgress: defineTable({
    clientKey: v.string(),
    step: v.string(), // initializing, embedding, searching, analyzing, generating, complete, error
    details: v.optional(v.string()),
    similarImagesFound: v.optional(v.number()),
    similarImages: v.optional(v.array(v.object({
      imageId: v.string(),
      imageUrl: v.string(),
      score: v.number(),
    }))),
    startedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_client", ["clientKey"]),

  // ============================================
  // PROMPT_CATEGORIES TABLE - Predefined prompt types
  // ============================================
  promptCategories: defineTable({
    key: v.string(), // "youtube_thumbnail", "realistic", "anime", etc.
    name: v.string(), // "YouTube Thumbnail"
    description: v.string(), // What this category is optimized for
    systemPromptId: v.optional(v.id("systemPrompts")), // Link to template
    icon: v.optional(v.string()), // Emoji or icon name
    sortOrder: v.number(), // Display order
    isActive: v.boolean(),
  })
    .index("by_key", ["key"])
    .index("by_active", ["isActive"]),

  // ============================================
  // PROMPT_EXAMPLES TABLE - Rated examples for RAG context
  // ============================================
  promptExamples: defineTable({
    categoryKey: v.string(), // Links to promptCategories.key
    promptText: v.string(), // The actual example prompt
    embedding: v.optional(v.array(v.float64())), // 768-dim for vector search
    rating: v.number(), // 0-100 score (avg of user ratings)
    ratingCount: v.number(), // How many ratings received
    imageId: v.optional(v.id("images")), // Optional linked image
    imageUrl: v.optional(v.string()), // For display without lookup
    source: v.union(
      v.literal("curated"), // Admin-added gold standard
      v.literal("community"), // User-submitted
      v.literal("generated") // AI-generated from high-rated outputs
    ),
    isActive: v.boolean(),
  })
    .index("by_category", ["categoryKey"])
    .index("by_category_rating", ["categoryKey", "rating"])
    .index("by_source", ["source"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["categoryKey", "isActive"],
    }),

  // ============================================
  // PROMPT_FEEDBACK TABLE - Community suggestions
  // ============================================
  promptFeedback: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("rating"), // Rate a generated prompt (1-5 stars)
      v.literal("suggestion"), // Suggest prompt improvement
      v.literal("example") // Submit new example for a category
    ),
    categoryKey: v.optional(v.string()),
    promptRequestId: v.optional(v.id("promptRequests")), // Link to the request
    content: v.string(), // Rating value ("4") or suggestion text
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("integrated") // AI improved the system prompt
    ),
    adminNotes: v.optional(v.string()), // Admin comments
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_category", ["categoryKey"])
    .index("by_type", ["type"]),

  // ============================================
  // PROMPT_VERSIONS TABLE - System prompt history
  // ============================================
  promptVersions: defineTable({
    systemPromptId: v.id("systemPrompts"),
    version: v.number(),
    content: v.string(), // The prompt content at this version
    changeReason: v.string(), // "AI improvement", "Admin edit", etc.
    performanceScore: v.optional(v.number()), // Track effectiveness over time
    changedBy: v.optional(v.string()), // "admin", "ai_improver", etc.
  })
    .index("by_prompt", ["systemPromptId"])
    .index("by_prompt_version", ["systemPromptId", "version"]),

  // ============================================
  // USER_API_KEYS TABLE - Encrypted API key storage
  // ============================================
  userApiKeys: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("fal")),
    encryptedKey: v.string(), // Base64 encoded (client-side encrypted)
    isValid: v.optional(v.boolean()),
    lastUsed: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"]),

  // ============================================
  // BUILDER_PRESETS TABLE - Click-to-select options
  // ============================================
  builderPresets: defineTable({
    category: v.string(), // "shot_type", "lighting", "camera", "film_stock", "lens", "movie_look", "photographer", "filter", "aspect_ratio"
    key: v.string(), // Unique identifier within category
    label: v.string(), // Display name
    promptFragment: v.string(), // Text to add to prompt
    description: v.optional(v.string()), // Tooltip/help text
    icon: v.optional(v.string()), // Emoji or icon name
    sortOrder: v.number(),
    isActive: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_category_active", ["category", "isActive"])
    .index("by_key", ["key"]),

  // ============================================
  // GENERATED_IMAGES TABLE - Simple Builder outputs
  // ============================================
  generatedImages: defineTable({
    userId: v.optional(v.id("users")),
    prompt: v.string(), // The constructed prompt
    builderConfig: v.object({
      subject: v.optional(v.string()),
      environment: v.optional(v.string()),
      shotType: v.optional(v.string()),
      lighting: v.optional(v.string()),
      camera: v.optional(v.string()),
      filmStock: v.optional(v.string()),
      lens: v.optional(v.string()),
      movieLook: v.optional(v.string()),
      photographer: v.optional(v.string()),
      aspectRatio: v.optional(v.string()),
      filters: v.optional(v.array(v.string())),
      customModifiers: v.optional(v.string()),
    }),
    imageUrl: v.optional(v.string()), // Generated image URL (external)
    storageId: v.optional(v.id("_storage")), // If saved to Convex storage
    thumbnailUrl: v.optional(v.string()),
    provider: v.optional(v.union(v.literal("google"), v.literal("fal"))),
    isPublic: v.boolean(), // Goes to community feed
    isSaved: v.optional(v.boolean()), // Subscriber saved to personal library
    generationTime: v.optional(v.number()), // Ms to generate
  })
    .index("by_user", ["userId"])
    .index("by_public", ["isPublic"])
    .index("by_user_saved", ["userId", "isSaved"]),

  // ============================================
  // PROCESSED_PAYMENTS TABLE - Idempotency for webhooks
  // ============================================
  processedPayments: defineTable({
    orderId: v.string(), // Polar checkout/order ID
    userId: v.id("users"),
    productId: v.string(),
    credits: v.number(),
    processedAt: v.number(),
  })
    .index("by_order", ["orderId"]),
});


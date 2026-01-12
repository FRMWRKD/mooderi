
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { supabaseAdmin } = require('./supabase');
require('dotenv').config();

// In-memory job store
const jobs = {};

const MODAL_VIDEO_ENDPOINT = process.env.MODAL_VIDEO_ENDPOINT || "https://frmwrkd-media--moodboard-video-processor-process-video-api.modal.run";

// Extract YouTube video ID from URL
const extractYouTubeId = (url) => {
    const patterns = [
        /(?:v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:shorts\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

// Get YouTube video info (title, thumbnail) using oEmbed API
const getYouTubeInfo = async (videoUrl) => {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) return null;

    try {
        // Use YouTube oEmbed API (no API key needed)
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await axios.get(oembedUrl, { timeout: 5000 });

        return {
            title: response.data.title || 'YouTube Video',
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            videoId: videoId
        };
    } catch (e) {
        console.error('Error fetching YouTube info:', e.message);
        // Fallback to just ID-based thumbnail
        return {
            title: 'YouTube Video',
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            videoId: videoId
        };
    }
};

// Extract platform from URL
const getVideoPlatform = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('vimeo.com')) return 'vimeo';
    return 'other';
};

// Background processing function (fire and forget)
const processWithModal = async (jobId, videoUrl, qualityMode) => {
    try {
        jobs[jobId].status = 'processing';
        jobs[jobId].progress = 10;
        jobs[jobId].message = `Starting cloud processing (quality: ${qualityMode})...`;

        // Call Modal
        const response = await axios.post(MODAL_VIDEO_ENDPOINT, {
            video_url: videoUrl,
            quality_mode: qualityMode,
            max_frames: 50
        }, { timeout: 600000 }); // 10 min timeout

        const result = response.data;

        if (result.status === 'failed') {
            throw new Error(result.errors ? result.errors[0] : 'Unknown error');
        }

        if (result.status === 'pending_approval') {
            jobs[jobId].status = 'pending_approval';
            jobs[jobId].progress = 100;
            jobs[jobId].message = `Ready for approval (${result.selected_frames.length} frames selected)`;
            jobs[jobId].selected_frames = result.selected_frames || [];
            jobs[jobId].rejected_frames = result.rejected_frames || [];

            // PERSIST TO DB to survive server restarts
            if (jobs[jobId].video_id) {
                await supabaseAdmin.from('videos').update({
                    status: 'pending_approval',
                    metadata: {
                        selected_frames: result.selected_frames || [],
                        rejected_frames: result.rejected_frames || []
                    }
                }).eq('id', jobs[jobId].video_id);
            }
        } else {
            jobs[jobId].status = 'completed';
            jobs[jobId].progress = 100;
            jobs[jobId].message = 'Completed';
            jobs[jobId].frame_count = result.frames ? result.frames.length : 0;

            // PERSIST COMPLETED STATE
            if (jobs[jobId].video_id) {
                await supabaseAdmin.from('videos').update({
                    status: 'completed',
                    frame_count: jobs[jobId].frame_count
                }).eq('id', jobs[jobId].video_id);
            }
        }

    } catch (error) {
        console.error(`[Job ${jobId}] Failed:`, error.message);
        jobs[jobId].status = 'failed';
        jobs[jobId].message = error.message;

        // PERSIST FAILED STATE
        if (jobs[jobId].video_id) {
            await supabaseAdmin.from('videos').update({
                status: 'failed',
                metadata: { error: error.message }
            }).eq('id', jobs[jobId].video_id);
        }
    }
};

const startVideoProcessing = (videoUrl, qualityMode = 'medium', userId = null) => {
    const jobId = uuidv4();
    let videoId = null;

    // Create video record with extracted info
    (async () => {
        try {
            // Get video info (title, thumbnail) for YouTube
            let title = null;
            let thumbnailUrl = null;
            const platform = getVideoPlatform(videoUrl);

            if (platform === 'youtube') {
                const info = await getYouTubeInfo(videoUrl);
                if (info) {
                    title = info.title;
                    thumbnailUrl = info.thumbnailUrl;
                }
            } else {
                // For other platforms, use URL as fallback title
                title = platform.charAt(0).toUpperCase() + platform.slice(1) + ' Video';
            }

            const { data } = await supabaseAdmin.from('videos').insert({
                url: videoUrl,
                title: title,
                thumbnail_url: thumbnailUrl,
                quality_mode: qualityMode,
                status: 'processing',
                is_public: true,
                user_id: userId
            }).select().single();

            if (data) {
                videoId = data.id;
                if (jobs[jobId]) {
                    jobs[jobId].video_id = videoId;
                    jobs[jobId].title = title;
                    jobs[jobId].thumbnail_url = thumbnailUrl;
                }
            }
        } catch (e) {
            console.error("Error creating video record:", e);
        }
    })();

    jobs[jobId] = {
        status: 'queued',
        progress: 0,
        message: 'Queued for cloud processing...',
        video_url: videoUrl,
        quality_mode: qualityMode,
        video_id: null,
        user_id: userId,
        selected_frames: [],
        rejected_frames: []
    };

    // Start background process
    processWithModal(jobId, videoUrl, qualityMode);

    return jobId;
};

const getJobStatus = async (jobId) => {
    // Check in-memory store first
    if (jobs[jobId]) {
        return jobs[jobId];
    }

    // Fallback: Check database for video record
    // This handles cases where server restarted and lost in-memory state
    try {
        const { data: video } = await supabaseAdmin
            .from('videos')
            .select('id, status, frame_count, url, title, metadata')
            .eq('id', jobId)
            .single();

        if (video) {
            console.log(`[Video] Job ${jobId} found in database with status: ${video.status}`);

            // Reconstruct job object from DB
            return {
                status: video.status,
                progress: video.status === 'completed' || video.status === 'pending_approval' ? 100 :
                    video.status === 'failed' ? 0 : 50,
                message: video.status === 'completed'
                    ? `Completed with ${video.frame_count} frames`
                    : video.status === 'pending_approval'
                        ? 'Ready for review!'
                        : video.status === 'failed'
                            ? 'Processing failed'
                            : 'Processing...',
                video_id: video.id,
                video_url: video.url,
                title: video.title,
                selected_frames: video.metadata?.selected_frames || [],
                rejected_frames: video.metadata?.rejected_frames || []
            };
        }
    } catch (e) {
        // Video not found by this ID - could be a UUID job ID, not a video ID
        console.log(`[Video] Job ${jobId} not found in database`);
    }

    return null;
};

// Supabase URL and key for Edge Function calls
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://omfxqultpjhvfljgzyxl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY; // Uses anon key from .env

// Trigger AI analysis for a single image (async, non-blocking)
const triggerImageAnalysis = async (imageId, imageUrl) => {
    if (!SUPABASE_ANON_KEY) {
        console.log(`[Video] Skipping AI analysis for image ${imageId} - no SUPABASE_ANON_KEY`);
        return;
    }

    try {
        console.log(`[Video] Triggering AI analysis for image ${imageId}...`);
        const response = await axios.post(
            `${SUPABASE_URL}/functions/v1/analyze-image`,
            {
                image_id: imageId,
                image_url: imageUrl
            },
            {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000 // 2 min timeout for AI processing
            }
        );
        console.log(`[Video] AI analysis complete for image ${imageId}:`, response.data?.success ? 'SUCCESS' : 'PARTIAL');
    } catch (error) {
        console.error(`[Video] AI analysis failed for image ${imageId}:`, error.message);
    }
};

const uploadApprovedFramesToDb = async (jobId, approvedUrls, videoUrl, options = {}) => {
    try {
        const job = jobs[jobId] || {};
        const videoId = job.video_id;
        const userId = job.user_id;
        const isPublic = options.isPublic !== false; // Default to true
        const folderId = options.folderId || null;

        const dbRows = approvedUrls.map(url => ({
            image_url: url,
            prompt: "",
            source_video_url: videoUrl,
            is_public: isPublic,
            mood: "Cinematic",
            lighting: "Cinematic",
            tags: [],
            colors: [],
            source_type: "video_import",
            video_id: videoId,
            user_id: userId,
            board_id: folderId, // Save to folder if specified
        }));

        if (dbRows.length > 0) {
            const { data, error } = await supabaseAdmin.from('images').insert(dbRows).select();
            if (error) throw error;

            // Update video record
            if (videoId) {
                await supabaseAdmin.from('videos').update({
                    frame_count: data.length,
                    status: 'completed'
                }).eq('id', videoId);
            }

            // ============================================
            // TRIGGER AI ANALYSIS FOR EACH FRAME (async, non-blocking)
            // This runs in the background - don't await completion
            // ============================================
            console.log(`[Video] Triggering AI analysis for ${data.length} frames...`);
            data.forEach(image => {
                // Fire and forget - don't block the response
                triggerImageAnalysis(image.id, image.image_url).catch(err => {
                    console.error(`[Video] Background AI analysis error for ${image.id}:`, err.message);
                });
            });

            // If public, track contribution for credit rewards
            // For every 10 public images, user earns 1 free credit
            if (isPublic && userId && data.length > 0) {
                // Get current contribution count
                const { data: profile } = await supabaseAdmin
                    .from('user_profiles')
                    .select('public_contributions')
                    .eq('user_id', userId)
                    .single();

                const currentContributions = profile?.public_contributions || 0;
                const newContributions = currentContributions + data.length;
                const creditsEarned = Math.floor(newContributions / 10) - Math.floor(currentContributions / 10);

                // Update profile with new contribution count and add credits if earned
                if (creditsEarned > 0) {
                    await supabaseAdmin.rpc('add_credits', {
                        p_user_id: userId,
                        p_amount: creditsEarned
                    });
                }

                // Update contribution count
                await supabaseAdmin
                    .from('user_profiles')
                    .update({ public_contributions: newContributions })
                    .eq('user_id', userId);
            }

            return {
                success: true,
                count: data.length,
                video_id: videoId,
                is_public: isPublic,
                folder_id: folderId,
                ai_analysis: 'pending' // Indicate AI analysis was triggered
            };
        }
        return { success: true, count: 0 };

    } catch (error) {
        return { error: error.message };
    }
};

module.exports = {
    startVideoProcessing,
    getJobStatus,
    uploadApprovedFramesToDb
};

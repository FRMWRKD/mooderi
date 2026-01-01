
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { supabaseAdmin } = require('./supabase');
require('dotenv').config();

// In-memory job store
const jobs = {};

const MODAL_VIDEO_ENDPOINT = process.env.MODAL_VIDEO_ENDPOINT || "https://frmwrkd-media--moodboard-video-processor-process-video-api.modal.run";

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
        } else {
            jobs[jobId].status = 'completed';
            jobs[jobId].progress = 100;
            jobs[jobId].message = 'Processing complete';
            jobs[jobId].result = result;
        }

    } catch (error) {
        console.error(`[Job ${jobId}] Failed:`, error.message);
        jobs[jobId].status = 'failed';
        jobs[jobId].message = error.message;
    }
};

const startVideoProcessing = (videoUrl, qualityMode = 'medium', userId = null) => {
    const jobId = uuidv4();
    let videoId = null;

    // Create video record
    (async () => {
        try {
            const { data } = await supabaseAdmin.from('videos').insert({
                url: videoUrl,
                quality_mode: qualityMode,
                status: 'processing',
                is_public: true,
                user_id: userId
            }).select().single();

            if (data) {
                videoId = data.id;
                if (jobs[jobId]) jobs[jobId].video_id = videoId;
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

const getJobStatus = (jobId) => jobs[jobId];

const uploadApprovedFramesToDb = async (jobId, approvedUrls, videoUrl) => {
    try {
        const job = jobs[jobId] || {};
        const videoId = job.video_id;
        const userId = job.user_id;

        const dbRows = approvedUrls.map(url => ({
            image_url: url,
            prompt: "",
            source_video_url: videoUrl,
            is_public: true,
            mood: "Cinematic",
            lighting: "Cinematic",
            tags: [],
            colors: [],
            source_type: "video_import",
            video_id: videoId,
            user_id: userId
        }));

        if (dbRows.length > 0) {
            const { data, error } = await supabaseAdmin.from('images').insert(dbRows).select();
            if (error) throw error;

            if (videoId) {
                await supabaseAdmin.from('videos').update({
                    frame_count: data.length,
                    status: 'completed'
                }).eq('id', videoId);
            }
            return { success: true, count: data.length, video_id: videoId };
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

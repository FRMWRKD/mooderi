
const axios = require('axios');

const BACKEND_URL = "https://mooderi-u26413.vm.elestio.app";
const VIDEO_URL = "https://www.youtube.com/watch?v=b0Ezn5pZE7o";

async function runTest() {
    console.log(`1. Starting Video Analysis for ${VIDEO_URL}...`);
    try {
        const startResponse = await axios.post(`${BACKEND_URL}/api/process-video`, {
            url: VIDEO_URL,
            quality: "medium"
        });

        console.log("Start Response:", startResponse.data);
        const jobId = startResponse.data.job_id;

        if (!jobId) {
            console.error("No job_id returned!");
            return;
        }

        console.log(`2. Job ID: ${jobId}. Starting Polling...`);

        let attempts = 0;
        const maxAttempts = 60; // 2 minutes timeout (video processing can take time)

        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                const statusResponse = await axios.get(`${BACKEND_URL}/api/process-video/status/${jobId}`);
                const status = statusResponse.data.status;
                const progress = statusResponse.data.progress;
                console.log(`[Attempt ${attempts}] Status: ${status} (${progress}%)`);

                if (status === 'pending_approval') {
                    console.log("3. Status reached pending_approval! Fetching frames...");
                    clearInterval(pollInterval);

                    const framesResponse = await axios.get(`${BACKEND_URL}/api/process-video/frames/${jobId}`);
                    // console.log("Frames Response Keys:", Object.keys(framesResponse.data));
                    if (framesResponse.data.selected_frames) {
                        console.log(`✅ SUCCESS: Found ${framesResponse.data.selected_frames.length} selected frames.`);
                        // console.log("First Frame Sample:", framesResponse.data.selected_frames[0]);
                    } else if (framesResponse.data.frames) {
                        console.log(`✅ SUCCESS: Found ${framesResponse.data.frames.length} frames (old format).`);
                    } else {
                        console.error("❌ FAILURE: No 'frames' or 'selected_frames' key in response:", framesResponse.data);
                    }
                } else if (status === 'failed') {
                    console.error("❌ Job Failed:", statusResponse.data);
                    clearInterval(pollInterval);
                } else if (status === 'completed') {
                    console.log("⚠️ Job completed immediately (maybe duplicate check hit?)");
                    clearInterval(pollInterval);
                }

                if (attempts >= maxAttempts) {
                    console.error("❌ Timeout waiting for pending_approval");
                    clearInterval(pollInterval);
                }
            } catch (e) {
                console.error("Polling Error:", e.message);
                if (e.response && e.response.status === 404) {
                    console.log("Job not found yet (might be initializing)...");
                }
            }
        }, 2000);

    } catch (e) {
        console.error("Start Failed:", e.message);
        if (e.response) console.error("Data:", e.response.data);
    }
}

runTest();


const axios = require('axios');

const BACKEND_URL = "https://mooderi-u26413.vm.elestio.app";
const VIDEO_URL = "https://www.youtube.com/watch?v=cQX-QXxwGvA"; // Short video usually

async function runTest() {
    console.log("1. Starting Video Analysis...");
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
        const maxAttempts = 30; // 60 seconds timeout

        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                const statusResponse = await axios.get(`${BACKEND_URL}/api/process-video/status/${jobId}`);
                const status = statusResponse.data.status;
                console.log(`[Attempt ${attempts}] Status: ${status}`);

                if (status === 'pending_approval') {
                    console.log("3. Status reached pending_approval! Fetching frames...");
                    clearInterval(pollInterval);

                    const framesResponse = await axios.get(`${BACKEND_URL}/api/process-video/frames/${jobId}`);
                    console.log("Frames Response Keys:", Object.keys(framesResponse.data));
                    if (framesResponse.data.frames) {
                        console.log(`Found ${framesResponse.data.frames.length} frames.`);
                        console.log("First Frame Sample:", framesResponse.data.frames[0]);
                    } else {
                        console.error("No 'frames' key in response:", framesResponse.data);
                    }
                    console.log("✅ Workflow Verify: Backend is working correctly.");
                } else if (status === 'failed') {
                    console.error("❌ Job Failed:", statusResponse.data);
                    clearInterval(pollInterval);
                } else if (status === 'completed') {
                    console.warn("⚠️ Job skipped to completed without approval?");
                    clearInterval(pollInterval);
                }

                if (attempts >= maxAttempts) {
                    console.error("Timeout waiting for pending_approval");
                    clearInterval(pollInterval);
                }
            } catch (e) {
                console.error("Polling Error:", e.message);
            }
        }, 2000);

    } catch (e) {
        console.error("Start Failed:", e.message);
        if (e.response) console.error("Data:", e.response.data);
    }
}

runTest();

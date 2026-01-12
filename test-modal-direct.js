
const axios = require('axios');

const MODAL_ENDPOINT = "https://frmwrkd-media--moodboard-video-processor-process-video-api.modal.run";
const VIDEO_URL = "https://www.youtube.com/watch?v=b0Ezn5pZE7o";

async function testModal() {
    console.log(`Testing Modal endpoint: ${MODAL_ENDPOINT}`);
    console.log(`Video URL: ${VIDEO_URL}`);

    try {
        console.log("Sending request...");
        const response = await axios.post(MODAL_ENDPOINT, {
            video_url: VIDEO_URL,
            quality_mode: "medium",
            max_frames: 50
        }, { timeout: 120000 }); // 2 min timeout for initial handshake

        console.log("✅ Modal Response Success:");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (e) {
        console.error("❌ Modal Request Failed:");
        if (e.response) {
            console.error(`Status: ${e.response.status}`);
            console.error("Data:", JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
        }
    }
}

testModal();

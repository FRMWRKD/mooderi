
const axios = require('axios');
require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const EMBEDDING_MODEL = "text-embedding-004";

const generateEmbedding = async (text) => {
    if (!text) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GOOGLE_API_KEY}`;

    try {
        const response = await axios.post(url, {
            model: `models/${EMBEDDING_MODEL}`,
            content: {
                parts: [{ text: text }]
            }
        });

        if (response.data && response.data.embedding && response.data.embedding.values) {
            return response.data.embedding.values;
        }
        return null;
    } catch (error) {
        console.error("Embedding API error:", error.response ? error.response.data : error.message);
        return null;
    }
};

module.exports = { generateEmbedding };

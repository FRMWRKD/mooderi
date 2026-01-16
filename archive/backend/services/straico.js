
const axios = require('axios');
require('dotenv').config();

const STRAICO_API_KEY = process.env.STRAICO_API_KEY;

const extractConceptsWithAi = async (prompt) => {
    if (!STRAICO_API_KEY) {
        console.error("Missing STRAICO_API_KEY");
        return null;
    }

    const systemPrompt = `You are a Creative Director AI that breaks down creative briefs into searchable visual concepts.

Given this user request: "${prompt}"

Return a JSON object with concepts organized into these categories. Include BOTH explicit and implied/suggested concepts:

- moods: Emotional qualities (dark, moody, energetic, dramatic, elegant, etc.)
- styles: Visual styles (cinematic, commercial, vintage, minimalist, editorial, etc.)
- lighting: Lighting qualities (neon, natural, golden hour, dramatic, soft, etc.)
- colors: Color descriptions (warm, cool, vibrant, muted, specific colors)
- subjects: Subject matter (portrait, landscape, sports, fashion, product, etc.)
- references: Film/Director references if applicable
- ingredients: For commercial projects - key visual elements (textures, materials, props)
- suggestions: 3-5 additional related concepts the user might want to explore

IMPORTANT: 
- Generate 3-8 concepts per relevant category
- Include concepts that are IMPLIED but not explicitly mentioned
- The "suggestions" category should contain NEW ideas to inspire the user
- Return ONLY valid JSON, no explanation`;

    try {
        const response = await axios.post('https://api.straico.com/v1/prompt/completion', {
            models: ['minimax/minimax-m2'],
            message: systemPrompt
        }, {
            headers: {
                'Authorization': `Bearer ${STRAICO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;
        let content = "";

        // Extract content based on specific Straico response structure
        if (data.data?.completion?.choices) {
            content = data.data.completion.choices[0]?.message?.content;
        } else if (data.data?.completions) {
            const keys = Object.keys(data.data.completions);
            if (keys.length > 0) {
                content = data.data.completions[keys[0]].completion?.choices[0]?.message?.content;
            }
        }

        if (!content) return null;

        // Clean markdown
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

        // Parse JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;

    } catch (error) {
        console.error("Straico extraction error:", error.message);
        return null;
    }
};

module.exports = { extractConceptsWithAi };

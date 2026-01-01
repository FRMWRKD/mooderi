
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_base64, image_url } = await req.json()
    const visionatiKey = Deno.env.get('VISIONATI_API_KEY')

    if (!visionatiKey) throw new Error('Missing VISIONATI_API_KEY')
    if (!image_base64 && !image_url) throw new Error('Must provide image_base64 or image_url')

    // Prepare Payload - request structured JSON analysis
    const jsonPrompt = `Analyze this image and return ONLY valid JSON (no markdown, no explanation).

Return this exact structure:
{
  "short_description": "1-2 sentence summary",
  "subjects": [{"type": "person/object", "description": "detailed description", "location": "position in frame", "clothing": "if person", "action": "what they're doing"}],
  "environment": {"setting": "location type", "background": "what's visible", "atmosphere": "mood/weather"},
  "lighting": {"type": "natural/studio/mixed", "direction": "from where", "quality": "soft/hard", "shadows": "description"},
  "camera": {"shot_type": "close-up/wide/etc", "angle": "eye-level/low/high", "depth_of_field": "shallow/deep"},
  "colors": {"dominant": ["color1", "color2"], "palette": "warm/cool/neutral", "saturation": "vivid/muted"},
  "mood": {"emotion": "feeling conveyed", "energy": "calm/dynamic", "style": "commercial/editorial/cinematic"},
  "technical": {"quality": "high/medium", "sharpness": "sharp/soft", "post_processing": "natural/stylized"}
}

Be extremely detailed in descriptions. Output ONLY the JSON object.`;

    let payload: any = {
        role: 'prompt',
        feature: ['tags', 'colors', 'descriptions'],
        prompt: jsonPrompt
    }
    
    if (image_base64) {
        // Use provided base64 directly
        payload.file = image_base64
        console.log("Using provided base64 image")
    } else if (image_url) {
        // Try passing URL directly to Visionati (faster, no conversion needed)
        payload.url = image_url
        console.log("Using image URL directly:", image_url)
    }

    // Call Visionati
    console.log("Sending request to Visionati...")
    const response = await fetch('https://api.visionati.com/api/fetch', {
        method: 'POST',
        headers: {
            'X-API-Key': `Token ${visionatiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Visionati API Error: ${response.status} - ${errText}`)
    }

    let result = await response.json()
    
    // Handle Async Polling
    if (result.response_uri) {
        console.log("Async response received. Polling...", result.response_uri)
        const pollUrl = result.response_uri
        let attempts = 0
        const maxAttempts = 30 // 30 * 2s = 60s timeout
        let pollingSuccess = false

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000)) // Sleep 2s
            
            const pollResp = await fetch(pollUrl, {
                headers: { 'X-API-Key': `Token ${visionatiKey}` }
            })
            
            if (pollResp.ok) {
                const pollResult = await pollResp.json()
                console.log(`Poll attempt ${attempts + 1}/${maxAttempts}: status=${pollResult.status || 'unknown'}`)
                
                // Check if assets are ready
                if (pollResult.all && pollResult.all.assets) {
                    result = pollResult
                    pollingSuccess = true
                    console.log("Polling complete - assets received")
                    break
                }
                // Check failed status
                if (pollResult.status === 'failed') {
                    throw new Error("Visionati processing failed during polling")
                }
            } else {
                console.log(`Poll attempt ${attempts + 1}/${maxAttempts}: HTTP ${pollResp.status}`)
            }
            attempts++
        }
        
        // Validate we got a result
        if (!pollingSuccess) {
            console.error("Polling timed out after max attempts - no valid assets received")
            throw new Error("Visionati polling timed out - no result received after 60s")
        }
    }

    // Parse Logic
    const allData = result.all || {}
    let prompt = ''
    let colors: string[] = []
    let tags: string[] = []
    let structuredAnalysis: any = null

    if (allData.assets && allData.assets.length > 0) {
        const asset = allData.assets[0]
        
        // Descriptions
        if (asset.descriptions && asset.descriptions.length > 0) {
            prompt = asset.descriptions[0].description || ''
        } else if (allData.descriptions && allData.descriptions.length > 0) {
            prompt = allData.descriptions[0].description || ''
        }
        
        // Colors
        const colorData = asset.colors || allData.colors || {}
        colors = Object.keys(colorData).slice(0, 5)
        
        // Tags
        const tagData = asset.tags || allData.tags || {}
        tags = Object.keys(tagData).slice(0, 10)
    } else {
        const desc = allData.descriptions || []
        prompt = desc.length > 0 ? desc[0].description : ''
        colors = Object.keys(allData.colors || {}).slice(0, 5)
        tags = Object.keys(allData.tags || {}).slice(0, 10)
    }

    // Try to parse JSON from the description
    if (prompt) {
        try {
            // Remove markdown code blocks if present
            let cleanedPrompt = prompt
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            
            // Look for JSON object in the cleaned response
            const jsonMatch = cleanedPrompt.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                structuredAnalysis = JSON.parse(jsonMatch[0]);
                console.log("Parsed structured analysis:", Object.keys(structuredAnalysis));
            }
        } catch (e) {
            console.log("Could not parse JSON from response:", e);
        }
    }

    console.log("Analysis success:", { hasStructured: !!structuredAnalysis, promptLen: prompt.length, colors })

    // Generate embedding for the prompt
    let embedding: number[] | null = null
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (prompt && googleApiKey) {
        try {
            console.log("Generating embedding for prompt...")
            const embeddingResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/text-embedding-004',
                        content: { parts: [{ text: prompt }] }
                    })
                }
            )
            
            if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json()
                embedding = embeddingData.embedding?.values || null
                console.log("Embedding generated:", embedding ? `${embedding.length} dimensions` : 'failed')
            } else {
                console.error("Embedding API error:", embeddingResponse.status)
            }
        } catch (embError) {
            console.error("Embedding generation failed:", embError)
        }
    }

    // If image_id provided, update the database with embedding
    const { image_id } = await req.json().catch(() => ({}))
    if (image_id && embedding) {
        try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
            
            if (supabaseUrl && supabaseKey) {
                const updateResponse = await fetch(
                    `${supabaseUrl}/rest/v1/images?id=eq.${image_id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ embedding })
                    }
                )
                console.log("Database update:", updateResponse.ok ? 'success' : 'failed')
            }
        } catch (dbError) {
            console.error("Database update failed:", dbError)
        }
    }

    return new Response(JSON.stringify({
        success: true,
        prompt,
        colors,
        tags,
        structured_analysis: structuredAnalysis,
        embedding: embedding,  // Return full embedding array for DB storage
        raw: result
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


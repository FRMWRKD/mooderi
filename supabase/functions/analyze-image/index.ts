
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
    // Parse request body ONCE at the beginning
    const requestBody = await req.json()
    const { image_base64, image_url, image_id } = requestBody
    
    const visionatiKey = Deno.env.get('VISIONATI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!visionatiKey) throw new Error('Missing VISIONATI_API_KEY')
    if (!image_base64 && !image_url) throw new Error('Must provide image_base64 or image_url')

    console.log(`[analyze-image] Starting analysis for image_id=${image_id}, url=${image_url?.substring(0, 50)}...`)

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
        payload.file = image_base64
        console.log("[analyze-image] Using provided base64 image")
    } else if (image_url) {
        payload.url = image_url
        console.log("[analyze-image] Using image URL directly")
    }

    // ============================================
    // STEP 1: Call Visionati for image analysis
    // ============================================
    console.log("[analyze-image] Step 1: Calling Visionati...")
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
        console.log("[analyze-image] Async response received. Polling...", result.response_uri)
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
                console.log(`[analyze-image] Poll attempt ${attempts + 1}/${maxAttempts}: status=${pollResult.status || 'unknown'}`)
                
                if (pollResult.all && pollResult.all.assets) {
                    result = pollResult
                    pollingSuccess = true
                    console.log("[analyze-image] Polling complete - assets received")
                    break
                }
                if (pollResult.status === 'failed') {
                    throw new Error("Visionati processing failed during polling")
                }
            } else {
                console.log(`[analyze-image] Poll attempt ${attempts + 1}/${maxAttempts}: HTTP ${pollResp.status}`)
            }
            attempts++
        }
        
        if (!pollingSuccess) {
            console.error("[analyze-image] Polling timed out after max attempts")
            throw new Error("Visionati polling timed out - no result received after 60s")
        }
    }

    // Parse Visionati response
    const allData = result.all || {}
    let visionatiDescription = ''
    let colors: string[] = []
    let tags: string[] = []
    let structuredAnalysis: any = null

    if (allData.assets && allData.assets.length > 0) {
        const asset = allData.assets[0]
        
        if (asset.descriptions && asset.descriptions.length > 0) {
            visionatiDescription = asset.descriptions[0].description || ''
        } else if (allData.descriptions && allData.descriptions.length > 0) {
            visionatiDescription = allData.descriptions[0].description || ''
        }
        
        const colorData = asset.colors || allData.colors || {}
        colors = Object.keys(colorData).slice(0, 5)
        
        const tagData = asset.tags || allData.tags || {}
        tags = Object.keys(tagData).slice(0, 10)
    } else {
        const desc = allData.descriptions || []
        visionatiDescription = desc.length > 0 ? desc[0].description : ''
        colors = Object.keys(allData.colors || {}).slice(0, 5)
        tags = Object.keys(allData.tags || {}).slice(0, 10)
    }

    // Try to parse structured JSON from the description
    if (visionatiDescription) {
        try {
            let cleanedPrompt = visionatiDescription
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            
            const jsonMatch = cleanedPrompt.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                structuredAnalysis = JSON.parse(jsonMatch[0]);
                console.log("[analyze-image] Parsed structured analysis:", Object.keys(structuredAnalysis));
            }
        } catch (e) {
            console.log("[analyze-image] Could not parse JSON from response:", e);
        }
    }

    console.log("[analyze-image] Visionati complete:", { 
        hasStructured: !!structuredAnalysis, 
        descriptionLen: visionatiDescription.length, 
        colors: colors.length,
        tags: tags.length 
    })

    // ============================================
    // STEP 2: Generate embedding for semantic search
    // ============================================
    let embedding: number[] | null = null
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (visionatiDescription && googleApiKey) {
        try {
            console.log("[analyze-image] Step 2: Generating embedding...")
            const embeddingResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/text-embedding-004',
                        content: { parts: [{ text: visionatiDescription.substring(0, 2000) }] }
                    })
                }
            )
            
            if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json()
                embedding = embeddingData.embedding?.values || null
                console.log("[analyze-image] Embedding generated:", embedding ? `${embedding.length} dimensions` : 'failed')
            } else {
                console.error("[analyze-image] Embedding API error:", embeddingResponse.status)
            }
        } catch (embError) {
            console.error("[analyze-image] Embedding generation failed:", embError)
        }
    }

    // ============================================
    // STEP 3: Call Straico to generate AI prompts
    // ============================================
    let straicoPrompts: any = null
    let finalPrompt = visionatiDescription // Fallback to Visionati description
    
    if (image_id && supabaseUrl && supabaseKey) {
        try {
            console.log("[analyze-image] Step 3: Calling Straico via generate-prompts...")
            
            const promptsResponse = await fetch(
                `${supabaseUrl}/functions/v1/generate-prompts`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image_id: image_id,
                        image_url: image_url,
                        analysis: {
                            detailed_description: visionatiDescription,
                            structured_analysis: structuredAnalysis
                        }
                    })
                }
            )
            
            if (promptsResponse.ok) {
                straicoPrompts = await promptsResponse.json()
                console.log("[analyze-image] Straico response:", Object.keys(straicoPrompts))
                
                // Use Straico's text_to_image as the main prompt
                if (straicoPrompts.text_to_image) {
                    finalPrompt = straicoPrompts.text_to_image
                    console.log("[analyze-image] Using Straico prompt (length:", finalPrompt.length, ")")
                }
            } else {
                const errText = await promptsResponse.text()
                console.error("[analyze-image] Straico call failed:", promptsResponse.status, errText)
            }
        } catch (straicoError) {
            console.error("[analyze-image] Straico call error:", straicoError)
        }
    } else {
        console.log("[analyze-image] Skipping Straico - missing image_id or Supabase credentials")
    }

    // ============================================
    // STEP 4: Update database with all data
    // ============================================
    if (image_id && supabaseUrl && supabaseKey) {
        try {
            console.log("[analyze-image] Step 4: Updating database...")
            
            const updatePayload: any = {
                colors: colors,
                tags: tags
            }
            
            // Add embedding if available
            if (embedding && embedding.length === 768) {
                updatePayload.embedding = embedding
            }
            
            // Add Straico-generated prompts (this is the KEY fix!)
            if (straicoPrompts && straicoPrompts.text_to_image) {
                updatePayload.prompt = straicoPrompts.text_to_image
                updatePayload.generated_prompts = straicoPrompts
                console.log("[analyze-image] Storing Straico prompt in DB")
            } else {
                // Fallback: store structured short_description if no Straico
                const shortDesc = structuredAnalysis?.short_description || visionatiDescription.substring(0, 500)
                updatePayload.prompt = shortDesc
                updatePayload.generated_prompts = {
                    text_to_image: shortDesc,
                    visionati_analysis: visionatiDescription,
                    structured_analysis: structuredAnalysis
                }
                console.log("[analyze-image] Storing fallback prompt (Straico failed)")
            }
            
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
                    body: JSON.stringify(updatePayload)
                }
            )
            console.log("[analyze-image] Database update:", updateResponse.ok ? 'SUCCESS' : 'FAILED')
        } catch (dbError) {
            console.error("[analyze-image] Database update failed:", dbError)
        }
    }

    console.log("[analyze-image] Pipeline complete!")
    
    return new Response(JSON.stringify({
        success: true,
        prompt: finalPrompt,
        colors,
        tags,
        structured_analysis: structuredAnalysis,
        generated_prompts: straicoPrompts,
        embedding: embedding,
        raw: result
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("[analyze-image] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})


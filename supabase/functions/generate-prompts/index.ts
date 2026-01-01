
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_id, image_url, analysis } = await req.json()
    const straicoKey = Deno.env.get('STRAICO_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!straicoKey) throw new Error('Missing STRAICO_API_KEY')
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase credentials')

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch Dynamic System Prompt
    const { data: promptData, error: promptError } = await supabase
        .from('system_prompts')
        .select('content')
        .eq('id', 'straico_v1')
        .single()
    
    if (promptError || !promptData) {
        throw new Error(`Failed to fetch system prompt: ${promptError?.message || 'Not found'}`)
    }

    const PROMPT_TEMPLATE = promptData.content

    const inputData = {
        image_url: image_url,
        analysis: analysis
    }

    // 2. Call Straico API
    const straicoRes = await fetch('https://api.straico.com/v1/prompt/completion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${straicoKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        models: ["minimax/minimax-m2"], 
        message: `${PROMPT_TEMPLATE}\n\nINPUT ANALYSIS:\n${JSON.stringify(inputData, null, 2)}`
      })
    })

    const straicoJson = await straicoRes.json()
    
    if (!straicoRes.ok) {
        console.error("Straico Error:", straicoJson)
        throw new Error(`Straico API failed: ${JSON.stringify(straicoJson)}`)
    }

    let generatedPrompts: any = {}
    let aestheticScore = 0.0

    try {
        let content = '';
        let choices = [];

        // Check for standard structure
        if (straicoJson.data?.completion?.choices) {
            choices = straicoJson.data.completion.choices;
        } 
        // Check for nested model-specific structure (e.g. minimax/minimax-m2)
        else if (straicoJson.data?.completions) {
            const modelKeys = Object.keys(straicoJson.data.completions);
            if (modelKeys.length > 0) {
                choices = straicoJson.data.completions[modelKeys[0]]?.completion?.choices || [];
            }
        }

        if (!choices || choices.length === 0 || !choices[0]?.message?.content) {
             throw new Error("No completion choices found in Straico response");
        }

        content = choices[0].message.content;
        console.log("Straico Content:", content.substring(0, 100))
        
        // Clean markdown code blocks
        content = content.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim()
        
        // Extract JSON substring if needed
        const jsonStart = content.indexOf('{')
        const jsonEnd = content.lastIndexOf('}')
        if (jsonStart !== -1 && jsonEnd !== -1) {
            content = content.substring(jsonStart, jsonEnd + 1)
        }

        generatedPrompts = JSON.parse(content)

        // The prompt_composer.txt returns text_to_image, image_to_image, text_to_video directly
        console.log("Parsed prompts:", Object.keys(generatedPrompts))

        // Save the Visionati analysis for display in Analysis tab
        if (analysis) {
            if (analysis.detailed_description) {
                generatedPrompts.visionati_analysis = analysis.detailed_description;
            }
            if (analysis.structured_analysis) {
                generatedPrompts.structured_analysis = analysis.structured_analysis;
            }
        }

     } catch (e) {
         console.error("Parse Error:", e)
         generatedPrompts = { error: "Failed to parse JSON response", raw: straicoJson }
     }
 
     // 3. Update DB if image_id provided
     if (image_id) {
         const updatePayload: any = { 
             generated_prompts: generatedPrompts 
         }

         // Update main 'prompt' column for Overview tab (use text_to_image from prompt_composer)
         if (generatedPrompts.text_to_image) {
             updatePayload.prompt = generatedPrompts.text_to_image;
         }

        const { error } = await supabase
            .from('images')
            .update(updatePayload)
            .eq('id', image_id)
        
        if (error) console.error("DB Update Error:", error)
    }

    return new Response(JSON.stringify(generatedPrompts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

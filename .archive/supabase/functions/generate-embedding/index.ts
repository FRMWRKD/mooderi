import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_API_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase credentials')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { text, image_id, batch } = await req.json()

    // Single text embedding
    if (text) {
      const embedding = await generateEmbedding(text, GOOGLE_API_KEY)
      
      // If image_id provided, update the database
      if (image_id) {
        const { error } = await supabase
          .from('images')
          .update({ embedding })
          .eq('id', image_id)
        
        if (error) throw new Error(`DB update failed: ${error.message}`)
        
        return new Response(JSON.stringify({ 
          success: true, 
          image_id, 
          dimensions: embedding.length 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        embedding,
        dimensions: embedding.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Batch mode: embed all images without embeddings
    if (batch) {
      console.log("Batch mode: Finding images without embeddings...")
      
      const { data: images, error: fetchError } = await supabase
        .from('images')
        .select('id, prompt')
        .is('embedding', null)
        .limit(batch.limit || 50)
      
      if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`)
      
      console.log(`Found ${images?.length || 0} images without embeddings`)
      
      let processed = 0
      let failed = 0
      const results: any[] = []
      
      for (const image of images || []) {
        if (!image.prompt) {
          console.log(`Image ${image.id} has no prompt, skipping`)
          continue
        }
        
        try {
          const embedding = await generateEmbedding(image.prompt, GOOGLE_API_KEY)
          
          const { error: updateError } = await supabase
            .from('images')
            .update({ embedding })
            .eq('id', image.id)
          
          if (updateError) {
            console.error(`Failed to update image ${image.id}: ${updateError.message}`)
            failed++
          } else {
            processed++
            results.push({ id: image.id, status: 'ok' })
            console.log(`Embedded image ${image.id} (${processed}/${images.length})`)
          }
        } catch (e) {
          console.error(`Error embedding image ${image.id}:`, e)
          failed++
          results.push({ id: image.id, status: 'error', error: e.message })
        }
        
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 100))
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        total: images?.length || 0,
        processed,
        failed,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Must provide text or batch option')

  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const EMBEDDING_MODEL = "text-embedding-004"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] }
    })
  })
  
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Embedding API error: ${response.status} - ${errText}`)
  }
  
  const data = await response.json()
  const embedding = data.embedding?.values
  
  if (!embedding || !embedding.length) {
    throw new Error('No embedding returned from API')
  }
  
  return embedding
}

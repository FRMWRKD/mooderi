
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY");
}

// Client for regular operations (respects RLS)
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for bypass operations (if key available)
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;

const getPublicImages = async (limit = 50, sortBy = 'newest') => {
    try {
        if (sortBy === 'ranked') {
            try {
                const { data, error } = await supabase.rpc('get_ranked_images', {
                    limit_count: limit,
                    offset_count: 0
                });
                if (!error && data && data.length > 0) {
                    // Filter to only include images with prompts
                    const withPrompts = data.filter(img =>
                        (img.prompt && img.prompt.trim() !== '') ||
                        img.generated_prompts !== null
                    );
                    if (withPrompts.length > 0) return withPrompts;
                }
                // Fallback to newest if ranked fails or is empty
                console.log("Ranked RPC failed or empty, falling back to newest");
            } catch (rpcError) {
                console.log("Ranked RPC error, falling back:", rpcError.message);
            }
            // Fall through to 'newest'
            sortBy = 'newest';
        }

        // Query with filter for images that have prompts
        let query = supabase
            .from('images')
            .select('*')
            .eq('is_public', true)
            .or('prompt.neq.,generated_prompts.not.is.null');

        if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
        else if (sortBy === 'popular') query = query.order('likes', { ascending: false });
        else if (sortBy === 'unpopular') query = query.order('dislikes', { ascending: false });
        else if (sortBy === 'rating') query = query.order('aesthetic_score', { ascending: false });

        const { data, error } = await query.limit(limit);
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching images:", error);
        return [];
    }
};

const getImage = async (id) => {
    const { data, error } = await supabase.from('images').select('*').eq('id', id).single();
    if (error) return null;
    return data;
};

module.exports = {
    supabase,
    supabaseAdmin,
    getPublicImages,
    getImage
};

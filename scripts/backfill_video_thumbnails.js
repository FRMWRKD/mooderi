#!/usr/bin/env node
/**
 * Backfill Thumbnails for Videos with Missing Thumbnails
 * 
 * This script finds videos without thumbnails and sets their thumbnail
 * to the first image extracted from that video.
 * 
 * Run: node scripts/backfill_video_thumbnails.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('Make sure backend/.env has these variables set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfillThumbnails() {
    console.log('🔍 Finding videos without thumbnails...\n');

    // Get all videos without a thumbnail (include metadata for pending_approval frames)
    const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, url, title, thumbnail_url, status, metadata')
        .is('thumbnail_url', null)
        .order('created_at', { ascending: false });

    if (videosError) {
        console.error('Error fetching videos:', videosError);
        return;
    }

    console.log(`Found ${videos.length} videos without thumbnails\n`);

    let updated = 0;
    let skipped = 0;

    for (const video of videos) {
        console.log(`\n📹 Processing: ${video.title || video.url}`);
        console.log(`   ID: ${video.id}, Status: ${video.status}`);

        let thumbnailUrl = null;

        // First check metadata.selected_frames (for pending_approval videos)
        if (video.metadata?.selected_frames?.length > 0) {
            thumbnailUrl = video.metadata.selected_frames[0].url;
            console.log(`   📦 Found frame in metadata: ${thumbnailUrl?.substring(0, 60)}...`);
        }

        // If not in metadata, try images table
        if (!thumbnailUrl) {
            const { data: images, error: imagesError } = await supabase
                .from('images')
                .select('id, image_url')
                .eq('video_id', video.id)
                .order('created_at', { ascending: true })
                .limit(1);

            if (!imagesError && images?.length > 0) {
                thumbnailUrl = images[0].image_url;
                console.log(`   🖼️ Found image in DB: ${thumbnailUrl?.substring(0, 60)}...`);
            }
        }

        // Try source_video_url as last resort
        if (!thumbnailUrl) {
            const { data: imagesByUrl } = await supabase
                .from('images')
                .select('id, image_url')
                .eq('source_video_url', video.url)
                .order('created_at', { ascending: true })
                .limit(1);

            if (imagesByUrl?.length > 0) {
                thumbnailUrl = imagesByUrl[0].image_url;
                console.log(`   🖼️ Found image by URL: ${thumbnailUrl?.substring(0, 60)}...`);
            }
        }

        // Skip if no thumbnail found
        if (!thumbnailUrl) {
            console.log(`   ⏭️ No frames found, skipping`);
            skipped++;
            continue;
        }

        console.log(`   Updating thumbnail...`);

        // Update the video with this thumbnail
        const { error: updateError } = await supabase
            .from('videos')
            .update({ thumbnail_url: thumbnailUrl })
            .eq('id', video.id);

        if (updateError) {
            console.log(`   ❌ Error updating: ${updateError.message}`);
        } else {
            console.log(`   ✅ Thumbnail updated!`);
            updated++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Done! Updated ${updated} videos, skipped ${skipped}`);
    console.log('='.repeat(50));
}

backfillThumbnails().catch(console.error);

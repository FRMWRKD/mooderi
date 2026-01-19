import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Seed data for Simple Prompt Builder presets
 * Run with: npx convex run seedBuilderPresets:seedAll
 */

// ============================================
// SHOT TYPES
// ============================================
const SHOT_TYPES = [
  { key: "extreme_wide", label: "Extreme Wide Shot", promptFragment: "extreme wide shot, establishing shot", icon: "🌍" },
  { key: "wide", label: "Wide Shot", promptFragment: "wide shot, full body visible", icon: "🎬" },
  { key: "medium_wide", label: "Medium Wide Shot", promptFragment: "medium wide shot, 3/4 body shot", icon: "📐" },
  { key: "medium", label: "Medium Shot", promptFragment: "medium shot, waist up", icon: "👤" },
  { key: "medium_closeup", label: "Medium Close-Up", promptFragment: "medium close-up, chest up", icon: "🧑" },
  { key: "closeup", label: "Close-Up", promptFragment: "close-up shot, face detail", icon: "👁️" },
  { key: "extreme_closeup", label: "Extreme Close-Up", promptFragment: "extreme close-up, macro detail", icon: "🔍" },
  { key: "over_shoulder", label: "Over-the-Shoulder", promptFragment: "over-the-shoulder shot", icon: "🔄" },
  { key: "birds_eye", label: "Bird's Eye View", promptFragment: "bird's eye view, top-down perspective", icon: "🦅" },
  { key: "worms_eye", label: "Worm's Eye View", promptFragment: "worm's eye view, low angle looking up", icon: "🐛" },
  { key: "dutch_angle", label: "Dutch Angle", promptFragment: "Dutch angle, tilted frame, canted angle", icon: "📐" },
  { key: "pov", label: "POV Shot", promptFragment: "POV shot, first-person perspective", icon: "👀" },
  { key: "two_shot", label: "Two Shot", promptFragment: "two shot, two subjects in frame", icon: "👥" },
];

// ============================================
// LIGHTING
// ============================================
const LIGHTING = [
  { key: "natural", label: "Natural Light", promptFragment: "natural lighting, ambient light", icon: "☀️" },
  { key: "golden_hour", label: "Golden Hour", promptFragment: "golden hour lighting, warm sunset tones", icon: "🌅" },
  { key: "blue_hour", label: "Blue Hour", promptFragment: "blue hour, twilight, cool tones", icon: "🌆" },
  { key: "hard", label: "Hard Light", promptFragment: "hard lighting, strong shadows, high contrast", icon: "💡" },
  { key: "soft", label: "Soft Light", promptFragment: "soft diffused lighting, gentle shadows", icon: "🌤️" },
  { key: "backlight", label: "Backlight", promptFragment: "backlit, silhouette, rim lighting", icon: "🌟" },
  { key: "side_light", label: "Side Light", promptFragment: "side lighting, dramatic shadows", icon: "◐" },
  { key: "top_light", label: "Top Light", promptFragment: "top-down lighting, overhead light source", icon: "⬇️" },
  { key: "chiaroscuro", label: "Chiaroscuro", promptFragment: "chiaroscuro lighting, dramatic contrast, Renaissance style", icon: "🎭" },
  { key: "rembrandt", label: "Rembrandt Lighting", promptFragment: "Rembrandt lighting, triangle of light on cheek", icon: "🖼️" },
  { key: "neon", label: "Neon", promptFragment: "neon lighting, colorful neon glow, cyberpunk", icon: "💜" },
  { key: "practical", label: "Practical Lights", promptFragment: "practical lighting, visible light sources in scene", icon: "💡" },
  { key: "volumetric", label: "Volumetric", promptFragment: "volumetric lighting, god rays, light shafts", icon: "✨" },
  { key: "studio", label: "Studio Lighting", promptFragment: "professional studio lighting, three-point setup", icon: "📸" },
  { key: "low_key", label: "Low Key", promptFragment: "low-key lighting, mostly dark, dramatic", icon: "🌑" },
  { key: "high_key", label: "High Key", promptFragment: "high-key lighting, bright, minimal shadows", icon: "⚪" },
];

// ============================================
// CAMERA BODIES
// ============================================
const CAMERAS = [
  { key: "arri_alexa", label: "ARRI Alexa", promptFragment: "shot on ARRI Alexa, cinematic color science", icon: "🎥" },
  { key: "red_weapon", label: "RED Weapon", promptFragment: "shot on RED Weapon 8K, sharp detail", icon: "🔴" },
  { key: "sony_venice", label: "Sony Venice", promptFragment: "shot on Sony Venice, dual ISO", icon: "📹" },
  { key: "panavision", label: "Panavision", promptFragment: "shot on Panavision camera, Hollywood aesthetic", icon: "🎞️" },
  { key: "super_16mm", label: "Super 16mm", promptFragment: "shot on Super 16mm film camera, indie aesthetic", icon: "📽️" },
  { key: "35mm_film", label: "35mm Film Camera", promptFragment: "shot on 35mm film, organic grain", icon: "🎞️" },
  { key: "imax", label: "IMAX", promptFragment: "shot on IMAX 70mm, massive resolution", icon: "🏛️" },
  { key: "hasselblad", label: "Hasselblad", promptFragment: "shot on Hasselblad medium format, exceptional detail", icon: "📷" },
  { key: "leica", label: "Leica M", promptFragment: "shot on Leica M, rangefinder aesthetic", icon: "📷" },
  { key: "canon_5d", label: "Canon 5D", promptFragment: "shot on Canon 5D, DSLR look", icon: "📸" },
  { key: "polaroid", label: "Polaroid", promptFragment: "Polaroid instant camera, vintage square format", icon: "🖼️" },
  { key: "iphone", label: "iPhone", promptFragment: "shot on iPhone, computational photography", icon: "📱" },
];

// ============================================
// FILM STOCKS
// ============================================
const FILM_STOCKS = [
  { key: "kodak_portra", label: "Kodak Portra 400", promptFragment: "Kodak Portra 400, warm skin tones, pastel colors", icon: "🟠" },
  { key: "kodak_ektar", label: "Kodak Ektar 100", promptFragment: "Kodak Ektar 100, vivid saturated colors", icon: "🔵" },
  { key: "fuji_velvia", label: "Fuji Velvia 50", promptFragment: "Fuji Velvia 50, extremely saturated, landscape colors", icon: "🟢" },
  { key: "fuji_provia", label: "Fuji Provia", promptFragment: "Fuji Provia, accurate colors, fine grain", icon: "🟣" },
  { key: "cinestill_800t", label: "CineStill 800T", promptFragment: "CineStill 800T, tungsten balanced, halation glow", icon: "🔴" },
  { key: "ilford_hp5", label: "Ilford HP5 Plus", promptFragment: "Ilford HP5 Plus, classic black and white, rich tones", icon: "⚫" },
  { key: "kodak_trix", label: "Kodak Tri-X", promptFragment: "Kodak Tri-X 400, iconic black and white, high contrast", icon: "⬛" },
  { key: "kodak_vision3", label: "Kodak Vision3 500T", promptFragment: "Kodak Vision3 500T, cinema film stock, rich shadows", icon: "🎬" },
  { key: "agfa_vista", label: "Agfa Vista", promptFragment: "Agfa Vista, vintage colors, nostalgic look", icon: "🟤" },
  { key: "lomography", label: "Lomography", promptFragment: "Lomography film, cross-processed, experimental colors", icon: "🌈" },
];

// ============================================
// LENSES
// ============================================
const LENSES = [
  { key: "anamorphic", label: "Anamorphic", promptFragment: "anamorphic lens, oval bokeh, horizontal lens flares", icon: "🔵" },
  { key: "24mm", label: "24mm Wide Angle", promptFragment: "24mm wide angle lens, environmental context", icon: "📐" },
  { key: "35mm", label: "35mm", promptFragment: "35mm lens, versatile perspective, natural look", icon: "📸" },
  { key: "50mm", label: "50mm", promptFragment: "50mm lens, natural perspective, standard lens", icon: "👁️" },
  { key: "85mm", label: "85mm Portrait", promptFragment: "85mm portrait lens, flattering compression, shallow DOF", icon: "🧑" },
  { key: "135mm", label: "135mm Telephoto", promptFragment: "135mm telephoto, subject isolation, compressed background", icon: "🔭" },
  { key: "200mm", label: "200mm Super Telephoto", promptFragment: "200mm super telephoto, extreme background compression", icon: "🏔️" },
  { key: "macro", label: "Macro Lens", promptFragment: "macro lens, extreme close-up, 1:1 magnification", icon: "🔬" },
  { key: "fisheye", label: "Fisheye", promptFragment: "fisheye lens, 180 degree, barrel distortion", icon: "🐟" },
  { key: "tilt_shift", label: "Tilt-Shift", promptFragment: "tilt-shift lens, miniature effect, selective focus", icon: "🏠" },
  { key: "vintage", label: "Vintage Lens", promptFragment: "vintage lens, swirly bokeh, soft rendering", icon: "⌛" },
];

// ============================================
// MOVIE LOOKS
// ============================================
const MOVIE_LOOKS = [
  { key: "blade_runner", label: "Blade Runner", promptFragment: "visual aesthetic of Blade Runner, neon-lit dystopia, rain-soaked streets, neo-noir, 1980s film look", icon: "🌃" },
  { key: "john_wick", label: "John Wick", promptFragment: "John Wick visual style, neon-noir, high contrast, red and blue color grading", icon: "🔫" },
  { key: "grand_budapest", label: "Grand Budapest Hotel", promptFragment: "Wes Anderson Grand Budapest Hotel style, symmetrical composition, pastel palette, whimsical", icon: "🏨" },
  { key: "dune", label: "Dune", promptFragment: "Dune 2021 visual style, desaturated orange and teal, vast scale, atmospheric", icon: "🏜️" },
  { key: "matrix", label: "The Matrix", promptFragment: "The Matrix visual style, green tint, digital rain aesthetic, high contrast", icon: "💊" },
  { key: "mad_max", label: "Mad Max: Fury Road", promptFragment: "Mad Max Fury Road style, orange and teal, post-apocalyptic, high saturation", icon: "🔥" },
  { key: "interstellar", label: "Interstellar", promptFragment: "Interstellar visual style, IMAX film grain, vast landscapes, scientific aesthetic", icon: "🌌" },
  { key: "in_mood_for_love", label: "In the Mood for Love", promptFragment: "Wong Kar-wai In the Mood for Love, slow motion, saturated colors, romantic nostalgia", icon: "❤️" },
  { key: "saving_private_ryan", label: "Saving Private Ryan", promptFragment: "Saving Private Ryan style, desaturated, high shutter speed, gritty realism", icon: "🎖️" },
  { key: "amélie", label: "Amélie", promptFragment: "Amélie visual style, warm golden greens, whimsical French aesthetic", icon: "🥐" },
  { key: "la_la_land", label: "La La Land", promptFragment: "La La Land style, vibrant saturated colors, golden hour, romantic Hollywood", icon: "🎵" },
  { key: "joker", label: "Joker", promptFragment: "Joker 2019 style, gritty 1970s aesthetic, dark and saturated, urban decay", icon: "🃏" },
  { key: "her", label: "Her", promptFragment: "Her 2013 visual style, warm pastel tones, soft focus, futuristic minimalism", icon: "💖" },
  { key: "fight_club", label: "Fight Club", promptFragment: "Fight Club visual style, desaturated, sickly greens, gritty urban", icon: "🥊" },
  { key: "revenant", label: "The Revenant", promptFragment: "The Revenant style, natural light only, cold blue tones, raw wilderness", icon: "🐻" },
  { key: "squid_game", label: "Squid Game", promptFragment: "Squid Game visual style, stark contrasts, pink and green, surreal production design", icon: "🦑" },
  { key: "drive", label: "Drive", promptFragment: "Drive 2011 style, neon noir, pink and blue, 80s synth aesthetic", icon: "🚗" },
  { key: "moonlight", label: "Moonlight", promptFragment: "Moonlight visual style, rich blues and purples, intimate close-ups", icon: "🌙" },
];

// ============================================
// PHOTOGRAPHER STYLES
// ============================================
const PHOTOGRAPHERS = [
  { key: "annie_leibovitz", label: "Annie Leibovitz", promptFragment: "Annie Leibovitz style photography, dramatic portraiture, celebrity aesthetic", icon: "👩‍🎨" },
  { key: "gregory_crewdson", label: "Gregory Crewdson", promptFragment: "Gregory Crewdson style, cinematic suburban tableaux, surreal lighting", icon: "🏡" },
  { key: "brandon_woelfel", label: "Brandon Woelfel", promptFragment: "Brandon Woelfel style, fairy lights, pastel neon, dreamy bokeh", icon: "✨" },
  { key: "peter_lindbergh", label: "Peter Lindbergh", promptFragment: "Peter Lindbergh style, black and white, timeless elegance, natural beauty", icon: "🖤" },
  { key: "helmut_newton", label: "Helmut Newton", promptFragment: "Helmut Newton style, provocative fashion, high contrast black and white", icon: "👠" },
  { key: "steve_mccurry", label: "Steve McCurry", promptFragment: "Steve McCurry style, vivid colors, documentary portraiture, Kodachrome", icon: "🌍" },
  { key: "richard_avedon", label: "Richard Avedon", promptFragment: "Richard Avedon style, white background portraits, stark minimalism", icon: "⬜" },
  { key: "ansel_adams", label: "Ansel Adams", promptFragment: "Ansel Adams style, black and white landscapes, zone system, dramatic contrast", icon: "🏔️" },
  { key: "guy_aroch", label: "Guy Aroch", promptFragment: "Guy Aroch style, intimate moments, soft natural light, analog feel", icon: "🌸" },
  { key: "tim_walker", label: "Tim Walker", promptFragment: "Tim Walker style, fantastical sets, whimsical fashion, storybook aesthetic", icon: "🧚" },
  { key: "mario_testino", label: "Mario Testino", promptFragment: "Mario Testino style, glamorous fashion, golden lighting, vibrant", icon: "👗" },
  { key: "george_hurrell", label: "George Hurrell", promptFragment: "George Hurrell style, 1940s Hollywood glamour, dramatic black and white", icon: "🎬" },
];

// ============================================
// FILTERS/EFFECTS
// ============================================
const FILTERS = [
  { key: "underexposed", label: "Underexposed", promptFragment: "underexposed, low-key, moody shadows", icon: "🌑" },
  { key: "overexposed", label: "Overexposed", promptFragment: "overexposed, high-key, ethereal glow", icon: "☀️" },
  { key: "high_contrast", label: "High Contrast", promptFragment: "high contrast, deep blacks, bright highlights", icon: "◼️" },
  { key: "desaturated", label: "Desaturated", promptFragment: "desaturated colors, muted tones", icon: "🔘" },
  { key: "grain", label: "Film Grain", promptFragment: "heavy film grain, analog texture", icon: "📽️" },
  { key: "lens_flare", label: "Lens Flare", promptFragment: "lens flare, anamorphic flares", icon: "✨" },
  { key: "chromatic", label: "Chromatic Aberration", promptFragment: "chromatic aberration, color fringing", icon: "🌈" },
  { key: "vignette", label: "Vignette", promptFragment: "vignette, darkened corners", icon: "⭕" },
  { key: "shallow_dof", label: "Shallow DOF", promptFragment: "shallow depth of field, blurred background, bokeh", icon: "🔍" },
  { key: "motion_blur", label: "Motion Blur", promptFragment: "motion blur, sense of movement", icon: "💨" },
  { key: "long_exposure", label: "Long Exposure", promptFragment: "long exposure, light trails, smooth water", icon: "⏱️" },
  { key: "double_exposure", label: "Double Exposure", promptFragment: "double exposure, overlapping images", icon: "👥" },
  { key: "halation", label: "Halation", promptFragment: "halation, glowing highlights, film bleeding", icon: "🌟" },
  { key: "cross_process", label: "Cross-Processed", promptFragment: "cross-processed, shifted colors, experimental", icon: "🔀" },
];

// ============================================
// ASPECT RATIOS
// ============================================
const ASPECT_RATIOS = [
  { key: "1_1", label: "1:1 Square", promptFragment: "--ar 1:1", icon: "⬛" },
  { key: "4_3", label: "4:3", promptFragment: "--ar 4:3", icon: "📺" },
  { key: "3_2", label: "3:2", promptFragment: "--ar 3:2", icon: "📷" },
  { key: "16_9", label: "16:9 Widescreen", promptFragment: "--ar 16:9", icon: "🖥️" },
  { key: "21_9", label: "21:9 Ultrawide", promptFragment: "--ar 21:9", icon: "🎬" },
  { key: "2_39_1", label: "2.39:1 Anamorphic", promptFragment: "--ar 2.39:1", icon: "🎞️" },
  { key: "9_16", label: "9:16 Portrait", promptFragment: "--ar 9:16", icon: "📱" },
  { key: "3_4", label: "3:4 Portrait", promptFragment: "--ar 3:4", icon: "📸" },
];

// ============================================
// SEED FUNCTION
// ============================================

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const allPresets = [
      ...SHOT_TYPES.map((p, i) => ({ ...p, category: "shot_type", sortOrder: i, isActive: true })),
      ...LIGHTING.map((p, i) => ({ ...p, category: "lighting", sortOrder: i, isActive: true })),
      ...CAMERAS.map((p, i) => ({ ...p, category: "camera", sortOrder: i, isActive: true })),
      ...FILM_STOCKS.map((p, i) => ({ ...p, category: "film_stock", sortOrder: i, isActive: true })),
      ...LENSES.map((p, i) => ({ ...p, category: "lens", sortOrder: i, isActive: true })),
      ...MOVIE_LOOKS.map((p, i) => ({ ...p, category: "movie_look", sortOrder: i, isActive: true })),
      ...PHOTOGRAPHERS.map((p, i) => ({ ...p, category: "photographer", sortOrder: i, isActive: true })),
      ...FILTERS.map((p, i) => ({ ...p, category: "filter", sortOrder: i, isActive: true })),
      ...ASPECT_RATIOS.map((p, i) => ({ ...p, category: "aspect_ratio", sortOrder: i, isActive: true })),
    ];

    let created = 0;
    let updated = 0;

    for (const preset of allPresets) {
      const existing = await ctx.db
        .query("builderPresets")
        .withIndex("by_key", (q) => q.eq("key", preset.key))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, preset);
        updated++;
      } else {
        await ctx.db.insert("builderPresets", preset);
        created++;
      }
    }

    return { 
      success: true, 
      total: allPresets.length,
      created,
      updated,
    };
  },
});

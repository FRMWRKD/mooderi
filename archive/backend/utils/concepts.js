
const extractConcepts = (prompt) => {
    const promptLower = prompt.toLowerCase();

    const concepts = {
        moods: [],
        styles: [],
        lighting: [],
        colors: [],
        subjects: [],
        references: [],
        ingredients: []
    };

    const MOOD_KEYWORDS = ['dark', 'moody', 'bright', 'energetic', 'calm', 'mysterious',
        'dramatic', 'romantic', 'melancholic', 'intense', 'serene',
        'gritty', 'dreamy', 'ethereal', 'raw', 'intimate', 'nostalgic',
        'hopeful', 'tense', 'peaceful', 'chaotic', 'elegant', 'luxurious',
        'minimal', 'bold', 'subtle', 'sensual', 'powerful'];

    const STYLE_KEYWORDS = ['cinematic', 'documentary', 'commercial', 'noir', 'vintage',
        'modern', 'retro', 'minimalist', 'abstract', 'realistic',
        'cyberpunk', 'sci-fi', 'fantasy', 'urban', 'natural', 'editorial',
        'fashion', 'lifestyle', 'portrait', 'landscape', 'product',
        'architectural', 'street', 'fine art', 'high fashion', 'beauty'];

    const LIGHTING_KEYWORDS = ['neon', 'natural', 'golden hour', 'blue hour', 'harsh',
        'soft', 'backlit', 'silhouette', 'low-key', 'high-key',
        'practical', 'ambient', 'dramatic', 'rim light', 'volumetric',
        'foggy', 'hazy', 'studio', 'window light', 'candlelight',
        'fluorescent', 'mixed lighting', 'spotlight'];

    const COLOR_KEYWORDS = ['blue', 'red', 'green', 'orange', 'purple', 'yellow',
        'teal', 'warm', 'cool', 'muted', 'vibrant', 'desaturated',
        'monochrome', 'black and white', 'pastel', 'neon', 'earth tones',
        'jewel tones', 'neutral', 'high contrast', 'low contrast',
        'saturated', 'faded', 'golden', 'silver', 'rose gold'];

    const SUBJECT_KEYWORDS = ['portrait', 'landscape', 'product', 'food', 'architecture',
        'fashion', 'sports', 'nature', 'wildlife', 'street', 'abstract',
        'still life', 'macro', 'aerial', 'underwater', 'action',
        'documentary', 'event', 'wedding', 'commercial', 'editorial',
        'woman', 'man', 'model', 'athlete', 'dancer', 'hands', 'face',
        'body', 'silhouette', 'crowd', 'couple', 'family',
        'basketball', 'football', 'soccer', 'tennis', 'baseball',
        'golf', 'swimming', 'running', 'cycling', 'boxing', 'mma',
        'gym', 'fitness', 'yoga', 'crossfit', 'training', 'game',
        'player', 'team', 'court', 'field', 'stadium', 'ball'];

    const INGREDIENT_KEYWORDS = ['perfume', 'luxury', 'bottle', 'glass', 'liquid', 'mist',
        'flowers', 'rose', 'jasmine', 'oud', 'amber', 'vanilla',
        'sandalwood', 'citrus', 'bergamot', 'lavender', 'smoke',
        'fabric', 'silk', 'leather', 'velvet', 'metal', 'gold',
        'wood', 'stone', 'marble', 'water', 'fire', 'ice',
        'crystal', 'diamond', 'pearl', 'texture', 'ingredient',
        'raw material', 'essence', 'droplet', 'reflection'];

    const REFERENCES = {
        'blade runner': 'Blade Runner',
        'wes anderson': 'Wes Anderson',
        'david fincher': 'David Fincher',
        'roger deakins': 'Roger Deakins',
        'terrence malick': 'Terrence Malick',
        'wong kar wai': 'Wong Kar-wai',
        'kubrick': 'Stanley Kubrick',
        'spielberg': 'Spielberg',
        'nolan': 'Christopher Nolan',
        'tarkovsky': 'Tarkovsky',
        'drive': 'Drive (2011)',
        'mad max': 'Mad Max',
        'matrix': 'The Matrix',
        'inception': 'Inception',
        'interstellar': 'Interstellar',
        'euphoria': 'Euphoria',
        'mr robot': 'Mr. Robot',
        'dune': 'Dune'
    };

    MOOD_KEYWORDS.forEach(w => { if (promptLower.includes(w)) concepts.moods.push(w.charAt(0).toUpperCase() + w.slice(1)); });
    STYLE_KEYWORDS.forEach(w => { if (promptLower.includes(w)) concepts.styles.push(w.charAt(0).toUpperCase() + w.slice(1)); });
    LIGHTING_KEYWORDS.forEach(w => { if (promptLower.includes(w)) concepts.lighting.push(w.charAt(0).toUpperCase() + w.slice(1)); });
    COLOR_KEYWORDS.forEach(w => { if (promptLower.includes(w)) concepts.colors.push(w.charAt(0).toUpperCase() + w.slice(1)); });
    SUBJECT_KEYWORDS.forEach(w => { if (promptLower.includes(w)) concepts.subjects.push(w.charAt(0).toUpperCase() + w.slice(1)); });
    INGREDIENT_KEYWORDS.forEach(w => { if (promptLower.includes(w)) concepts.ingredients.push(w.charAt(0).toUpperCase() + w.slice(1)); });

    Object.entries(REFERENCES).forEach(([key, value]) => {
        if (promptLower.includes(key)) concepts.references.push(value);
    });

    return concepts;
};

const generateBoardName = (prompt) => {
    const words = prompt.split(' ').slice(0, 4);
    let name = words.join(' ');
    if (name.length > 30) name = name.substring(0, 27) + '...';
    // Capitalize title
    return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) || 'Smart Board';
};

module.exports = { extractConcepts, generateBoardName };

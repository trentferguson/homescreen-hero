/**
 * Utility for loading static poster images from the public/posters directory.
 * These are used during the setup wizard when Plex credentials aren't available yet.
 */

/**
 * List of static poster filenames with their actual extensions.
 * Update this array when you add or remove posters from public/posters/
 */
const STATIC_POSTERS = [
    'setup_poster_1.png',
    'setup_poster_2.jpeg',
    'setup_poster_3.jpg',
    'setup_poster_4.png',
    'setup_poster_5.png',
    'setup_poster_6.png',
    'setup_poster_7.jpg',
    'setup_poster_8.jpg',
    'setup_poster_9.jpg',
    'setup_poster_10.png',
    'setup_poster_11.jpg',
    'setup_poster_12.jpg',
    'setup_poster_13.jpg',
    'setup_poster_14.png',
    'setup_poster_15.jpg',
    'setup_poster_16.jpg',
    'setup_poster_17.jpg',
    'setup_poster_18.jpg',
    'setup_poster_19.jpg',
    'setup_poster_20.jpg',
    'setup_poster_21.jpg',
    'setup_poster_22.jpg',
    'setup_poster_23.jpg',
    'setup_poster_24.jpg',
    'setup_poster_26.jpg',
    'setup_poster_27.jpg',
    'setup_poster_28.jpg',
    'setup_poster_29.jpg',
    'setup_poster_30.jpg',
    'setup_poster_31.jpg',
    'setup_poster_32.jpg',
    'setup_poster_33.jpg',
    'setup_poster_34.jpg',
    'setup_poster_35.jpg',
    'setup_poster_36.jpg',
    'setup_poster_37.jpg',
];

/**
 * Get all available static poster URLs.
 */
export function getStaticPosters(): string[] {
    return STATIC_POSTERS.map(filename => `/posters/${filename}`);
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Get static posters in random order
 */
export function getShuffledStaticPosters(): string[] {
    return shuffleArray(getStaticPosters());
}

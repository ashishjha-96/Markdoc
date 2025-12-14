/**
 * Embed URL Parser Utility
 *
 * Parses various video/embed URLs and extracts the embed URL for iframe usage.
 * Supports: YouTube, Vimeo, Dailymotion, Twitch, Spotify, SoundCloud, and more.
 */

export interface EmbedInfo {
    type: 'youtube' | 'vimeo' | 'dailymotion' | 'twitch' | 'spotify' | 'soundcloud' | 'twitter' | 'codepen' | 'figma' | 'loom' | 'unknown';
    embedUrl: string;
    originalUrl: string;
    thumbnailUrl?: string;
}

/**
 * Parse a URL and return embed information if supported
 */
export function parseEmbedUrl(url: string): EmbedInfo | null {
    if (!url || typeof url !== 'string') return null;

    const trimmedUrl = url.trim();

    // YouTube
    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of youtubePatterns) {
        const match = trimmedUrl.match(pattern);
        if (match) {
            const videoId = match[1];
            return {
                type: 'youtube',
                embedUrl: `https://www.youtube.com/embed/${videoId}`,
                originalUrl: trimmedUrl,
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            };
        }
    }

    // Vimeo
    const vimeoMatch = trimmedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
        return {
            type: 'vimeo',
            embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
            originalUrl: trimmedUrl,
        };
    }

    // Dailymotion
    const dailymotionMatch = trimmedUrl.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
    if (dailymotionMatch) {
        return {
            type: 'dailymotion',
            embedUrl: `https://www.dailymotion.com/embed/video/${dailymotionMatch[1]}`,
            originalUrl: trimmedUrl,
        };
    }

    // Twitch (clips and videos)
    const twitchClipMatch = trimmedUrl.match(/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/);
    if (twitchClipMatch) {
        return {
            type: 'twitch',
            embedUrl: `https://clips.twitch.tv/embed?clip=${twitchClipMatch[1]}&parent=${window.location.hostname}`,
            originalUrl: trimmedUrl,
        };
    }
    const twitchVideoMatch = trimmedUrl.match(/twitch\.tv\/videos\/(\d+)/);
    if (twitchVideoMatch) {
        return {
            type: 'twitch',
            embedUrl: `https://player.twitch.tv/?video=${twitchVideoMatch[1]}&parent=${window.location.hostname}`,
            originalUrl: trimmedUrl,
        };
    }

    // Spotify (tracks, albums, playlists)
    const spotifyMatch = trimmedUrl.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
        return {
            type: 'spotify',
            embedUrl: `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`,
            originalUrl: trimmedUrl,
        };
    }

    // Loom
    const loomMatch = trimmedUrl.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) {
        return {
            type: 'loom',
            embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
            originalUrl: trimmedUrl,
        };
    }

    // Figma
    const figmaMatch = trimmedUrl.match(/figma\.com\/(file|proto)\/([a-zA-Z0-9]+)/);
    if (figmaMatch) {
        return {
            type: 'figma',
            embedUrl: `https://www.figma.com/embed?embed_host=blocknote&url=${encodeURIComponent(trimmedUrl)}`,
            originalUrl: trimmedUrl,
        };
    }

    // CodePen
    const codepenMatch = trimmedUrl.match(/codepen\.io\/([a-zA-Z0-9_-]+)\/pen\/([a-zA-Z0-9]+)/);
    if (codepenMatch) {
        return {
            type: 'codepen',
            embedUrl: `https://codepen.io/${codepenMatch[1]}/embed/${codepenMatch[2]}?default-tab=result`,
            originalUrl: trimmedUrl,
        };
    }

    // Twitter/X - using official syndication embed service
    const twitterMatch = trimmedUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
    if (twitterMatch) {
        // Use Twitter's syndication platform with dark theme and full width
        return {
            type: 'twitter',
            embedUrl: `https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=dark&widgetsVersion=2615f7e52b7e0%3A1702314776716&id=${twitterMatch[2]}`,
            originalUrl: trimmedUrl,
        };
    }

    return null;
}

/**
 * Get a human-readable name for the embed type
 */
export function getEmbedTypeName(type: EmbedInfo['type']): string {
    const names: Record<EmbedInfo['type'], string> = {
        youtube: 'YouTube',
        vimeo: 'Vimeo',
        dailymotion: 'Dailymotion',
        twitch: 'Twitch',
        spotify: 'Spotify',
        soundcloud: 'SoundCloud',
        twitter: 'Twitter',
        codepen: 'CodePen',
        figma: 'Figma',
        loom: 'Loom',
        unknown: 'Embed',
    };
    return names[type] || 'Embed';
}

/**
 * Get the icon/emoji for an embed type
 */
export function getEmbedTypeIcon(type: EmbedInfo['type']): string {
    const icons: Record<EmbedInfo['type'], string> = {
        youtube: '📺',
        vimeo: '🎬',
        dailymotion: '📹',
        twitch: '🎮',
        spotify: '🎵',
        soundcloud: '🔊',
        twitter: '🐦',
        codepen: '💻',
        figma: '🎨',
        loom: '📹',
        unknown: '🔗',
    };
    return icons[type] || '🔗';
}

/**
 * Check if a URL is a supported embed URL
 */
export function isSupportedEmbedUrl(url: string): boolean {
    return parseEmbedUrl(url) !== null;
}

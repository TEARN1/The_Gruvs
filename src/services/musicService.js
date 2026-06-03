/**
 * musicService — unified Spotify + YouTube search for the event playlist feature.
 *
 * Spotify: Client Credentials flow (server-to-server, no user login required for search).
 * YouTube: YouTube Data API v3, API key only.
 *
 * Set these in your .env:
 *   EXPO_PUBLIC_SPOTIFY_CLIENT_ID
 *   EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET
 *   EXPO_PUBLIC_YOUTUBE_API_KEY
 */

import { supabase, isSupabaseEnabled } from './supabase';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

const SPOTIFY_ID     = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID     || '';
const SPOTIFY_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || '';
const YOUTUBE_KEY    = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY       || '';

let _spotifyToken  = null;
let _spotifyExpiry = 0;

// ⚠️ SECURITY (SECURITY-AUDIT.md finding #8): the Spotify Client Credentials
// flow needs the CLIENT SECRET, and any EXPO_PUBLIC_* var is compiled into the
// public web/app bundle — so the secret is exposed to anyone who inspects it.
// Fixed: This implementation prioritizes fetching the token via a secure Supabase
// Edge Function ('spotify-token') that holds the secret server-side.
// The local fetch is kept purely as a fallback to ensure backwards compatibility
// during deployment transitions.
const getSpotifyToken = async () => {
  if (_spotifyToken && Date.now() < _spotifyExpiry - 30_000) return _spotifyToken;

  // Try calling the secure Supabase Edge Function first
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase.functions.invoke('spotify-token');
      if (!error && data && data.access_token) {
        _spotifyToken = data.access_token;
        _spotifyExpiry = Date.now() + (data.expires_in || 3600) * 1000;
        return _spotifyToken;
      }
      if (error) {
        console.warn('[MusicService] Edge function token fetch failed, falling back:', error.message);
      }
    } catch (e) {
      console.warn('[MusicService] Failed to invoke Edge Function, falling back:', e.message);
    }
  }

  // Fallback to local token exchange using public bundle secret (transitional support)
  if (!SPOTIFY_ID || !SPOTIFY_SECRET) {
    throw new Error('Spotify credentials not configured. Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID and EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET to .env');
  }

  const credentials = btoa(`${SPOTIFY_ID}:${SPOTIFY_SECRET}`);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  _spotifyToken  = data.access_token;
  _spotifyExpiry = Date.now() + data.expires_in * 1000;
  return _spotifyToken;
};

const formatDuration = (ms) => {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const searchSpotify = async (query, limit = 10) => {
  const token = await getSpotifyToken();
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit), market: 'ZA' });
  const res = await fetch(`${SPOTIFY_SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
  const data = await res.json();

  return (data.tracks?.items || []).map(track => ({
    id:          track.id,
    title:       track.name,
    artist:      track.artists?.map(a => a.name).join(', ') || '',
    thumbnail:   track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
    duration_ms: track.duration_ms,
    durationFmt: formatDuration(track.duration_ms),
    platform:    'spotify',
    externalUrl: track.external_urls?.spotify || null,
    previewUrl:  track.preview_url || null,
    albumName:   track.album?.name || '',
    explicit:    track.explicit || false,
  }));
};

const searchYouTube = async (query, limit = 10) => {
  if (!YOUTUBE_KEY) throw new Error('YouTube API key not configured. Add EXPO_PUBLIC_YOUTUBE_API_KEY to .env');

  const params = new URLSearchParams({
    part:       'snippet',
    type:       'video',
    videoCategoryId: '10', // Music
    q:          query,
    key:        YOUTUBE_KEY,
    maxResults: String(limit),
    regionCode: 'ZA',
  });

  const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();

  return (data.items || []).map(item => ({
    id:          item.id.videoId,
    title:       item.snippet.title,
    artist:      item.snippet.channelTitle,
    thumbnail:   item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
    duration_ms: null,
    durationFmt: '',
    platform:    'youtube',
    externalUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    previewUrl:  null,
    albumName:   '',
    explicit:    false,
  }));
};

export const MusicService = {
  /**
   * Search for tracks on either platform.
   * @param {string} query
   * @param {'spotify'|'youtube'} platform
   * @param {number} limit
   * @returns {Promise<Track[]>}
   */
  async search(query, platform = 'spotify', limit = 10) {
    if (!query?.trim()) return [];
    try {
      return platform === 'spotify'
        ? await searchSpotify(query.trim(), limit)
        : await searchYouTube(query.trim(), limit);
    } catch (e) {
      console.warn('[MusicService] search error:', e.message);
      throw e;
    }
  },

  isSpotifyConfigured: () => !!(SPOTIFY_ID && SPOTIFY_SECRET),
  isYouTubeConfigured: () => !!YOUTUBE_KEY,

  getOpenUrl(track) {
    return track.externalUrl || (
      track.platform === 'youtube'
        ? `https://www.youtube.com/watch?v=${track.id}`
        : `https://open.spotify.com/track/${track.id}`
    );
  },
};

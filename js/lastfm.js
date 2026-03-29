import { Settings } from './settings.js';

const BASE = 'https://ws.audioscrobbler.com/2.0/';

async function lfmFetch(params) {
  const key = Settings.getLastfmKey();
  if (!key) throw new Error('Brak klucza Last.fm API. Dodaj go w Ustawieniach.');
  const url = new URL(BASE);
  Object.assign(params, { api_key: key, format: 'json' });
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Błąd Last.fm API (${res.status})`);
  return res.json();
}

// Get similar tracks for a given artist + track
export async function getSimilarTracks(artist, track, limit = 10) {
  try {
    const data = await lfmFetch({
      method: 'track.getSimilar',
      artist: artist || 'unknown',
      track: track || 'unknown',
      limit,
      autocorrect: 1,
    });
    return (data?.similartracks?.track || []).map(t => ({
      title: t.name,
      artist: typeof t.artist === 'string' ? t.artist : t.artist?.name || '',
    }));
  } catch {
    return [];
  }
}

// Get top tracks by tag (genre discovery)
export async function getTopTracksByTag(tag = 'pop', page = 1, limit = 20) {
  try {
    const data = await lfmFetch({ method: 'tag.getTopTracks', tag, page, limit });
    return (data?.tracks?.track || []).map(t => ({
      title: t.name,
      artist: typeof t.artist === 'string' ? t.artist : t.artist?.name || '',
    }));
  } catch {
    return [];
  }
}

// Get top tags for a track (for genre info)
export async function getTrackTopTags(artist, track) {
  try {
    const data = await lfmFetch({ method: 'track.getTopTags', artist, track, autocorrect: 1 });
    return (data?.toptags?.tag || []).slice(0, 3).map(t => t.name);
  } catch {
    return [];
  }
}

// Get artist top tracks
export async function getArtistTopTracks(artist, limit = 10) {
  try {
    const data = await lfmFetch({ method: 'artist.getTopTracks', artist, limit, autocorrect: 1 });
    return (data?.toptracks?.track || []).map(t => ({
      title: t.name,
      artist,
    }));
  } catch {
    return [];
  }
}

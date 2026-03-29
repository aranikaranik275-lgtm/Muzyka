import { Settings } from './settings.js';

let player = null;
let playerReady = false;
const playerReadyCallbacks = [];

// Load YT IFrame API once
export function initYouTubePlayer(onReady) {
  if (playerReady && player) { onReady(player); return; }
  if (onReady) playerReadyCallbacks.push(onReady);
  if (window.YT && window.YT.Player) { _createPlayer(); return; }
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = function () {
  _createPlayer();
};

function _createPlayer() {
  if (player) return;
  player = new window.YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    videoId: '',
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      playsinline: 1,
    },
    events: {
      onReady: () => {
        playerReady = true;
        playerReadyCallbacks.forEach(cb => cb(player));
        playerReadyCallbacks.length = 0;
      },
      onStateChange: (e) => {
        window.dispatchEvent(new CustomEvent('yt-state-change', { detail: e.data }));
      },
      onError: (e) => {
        window.dispatchEvent(new CustomEvent('yt-error', { detail: e.data }));
      }
    }
  });
}

export function playVideo(videoId) {
  if (!player || !playerReady) {
    initYouTubePlayer(() => playVideo(videoId));
    return;
  }
  player.loadVideoById(videoId);
}

export function pauseVideo() { if (player && playerReady) player.pauseVideo(); }
export function resumeVideo() { if (player && playerReady) player.playVideo(); }
export function stopVideo() { if (player && playerReady) player.stopVideo(); }

export function getPlayerState() {
  if (!player || !playerReady) return -1;
  return player.getPlayerState();
}

// YouTube Data API v3 Search
export async function searchYouTube(query, maxResults = 20) {
  const key = Settings.getYtKey();
  if (!key) throw new Error('Brak klucza YouTube API. Dodaj go w Ustawieniach.');
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Błąd YouTube API (${res.status})`);
  }
  const data = await res.json();
  return (data.items || []).map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    publishedAt: item.snippet.publishedAt,
  }));
}

// Get video details (for title normalization)
export async function getVideoDetails(videoId) {
  const key = Settings.getYtKey();
  if (!key) return null;
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || '',
  };
}

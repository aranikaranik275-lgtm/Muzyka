/**
 * Main application entry point
 */
import './config.js';
import { auth, googleProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged }
  from './firebase-config.js';
import { Settings } from './settings.js';
import { showToast } from './toast.js';
import { initYouTubePlayer, playVideo, pauseVideo, resumeVideo, stopVideo,
  getPlayerState, searchYouTube } from './youtube.js';
import { getSimilarTracks, getTopTracksByTag, getArtistTopTracks } from './lastfm.js';
import { initSwipe } from './swipe.js';
import {
  setUid, loadRejectedFromFirestore, isRejected, rejectTrack, clearRejected,
  likeTrack, unlikeTrack, isLiked, getLikedTracks,
  addToHistory, getHistory, clearHistory,
  createPlaylist, getPlaylists, getPlaylist, addTrackToPlaylist,
  removeTrackFromPlaylist, deletePlaylist, renamePlaylist
} from './library.js';

// ===== STATE =====
let currentUser = null;
let currentTrack = null;
let discoverQueue = [];
let discoverIndex = 0;
let swipeHandlers = null;
let miniPlayerTrack = null;

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const authScreen = $('auth-screen');
const appScreen = $('app-screen');

// ===== AUTH =====
// Handle redirect result on page load (mobile browsers convert popup → redirect)
showLoading(true);
getRedirectResult(auth).catch(() => {}).finally(() => showLoading(false));

$('google-signin-btn').addEventListener('click', async () => {
  try {
    showLoading(true);
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    // Popup blocked (common on mobile) — fall back to redirect flow
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, googleProvider);
      return; // page will reload after Google auth
    }
    showToast('Błąd logowania: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    setUid(user.uid);
    await loadRejectedFromFirestore().catch(() => {});
    showApp(user);
    initYouTubePlayer(() => loadDiscover());
  } else {
    showAuth();
  }
});

function showAuth() {
  authScreen.classList.add('active');
  appScreen.classList.remove('active');
}
function showApp(user) {
  authScreen.classList.remove('active');
  appScreen.classList.add('active');
  // Fill user info
  const av = user.photoURL || '';
  $('user-avatar').src = av;
  $('settings-avatar').src = av;
  $('settings-name').textContent = user.displayName || '';
  $('settings-email').textContent = user.email || '';
}

$('signout-btn').addEventListener('click', async () => {
  await signOut(auth);
  showToast('Wylogowano');
});

// ===== TABS =====
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

document.querySelectorAll('[data-tab-switch]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tabSwitch));
});

function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'library') loadLibraryTab();
}

// ===== DISCOVER / SWIPE =====
async function loadDiscover() {
  discoverQueue = [];
  discoverIndex = 0;

  const key = Settings.getLastfmKey();
  let tracks = [];

  if (key) {
    try {
      // Mix of genres for cold start
      const genres = ['pop', 'rock', 'electronic', 'hip-hop', 'indie'];
      const randomTag = genres[Math.floor(Math.random() * genres.length)];
      tracks = await getTopTracksByTag(randomTag, 1, 30);
    } catch {}
  }

  // Fallback: load from YouTube search with generic query
  if (tracks.length === 0) {
    if (!Settings.getYtKey()) {
      const emptyEl = $('discover-empty');
      emptyEl.querySelector('p').innerHTML = 'Dodaj klucze API w <strong>Ustawieniach</strong>,<br>aby zacząć odkrywać muzykę!';
      const btn = emptyEl.querySelector('[data-tab-switch]');
      if (btn) { btn.dataset.tabSwitch = 'settings'; btn.textContent = 'Idź do Ustawień'; }
      emptyEl.classList.remove('hidden');
      $('swipe-container').style.display = 'none';
      return;
    }
    try {
      const defaults = ['top hits 2024', 'popular music', 'best songs'];
      const q = defaults[Math.floor(Math.random() * defaults.length)];
      const results = await searchYouTube(q, 20);
      discoverQueue = results.filter(r => !isRejected(r.videoId));
      discoverIndex = 0;
      showNextCard();
      return;
    } catch {}
  }

  // Convert Last.fm tracks to YouTube results
  discoverQueue = tracks;
  discoverIndex = 0;
  await showNextCard();
}

async function showNextCard() {
  if (discoverIndex >= discoverQueue.length) {
    $('discover-empty').classList.remove('hidden');
    $('swipe-container').style.display = 'none';
    return;
  }

  $('discover-empty').classList.add('hidden');
  $('swipe-container').style.display = '';

  const track = discoverQueue[discoverIndex];

  // If track has videoId already, use it; otherwise search YouTube
  if (!track.videoId && Settings.getYtKey()) {
    try {
      const q = `${track.artist} ${track.title}`;
      const results = await searchYouTube(q, 5);
      const found = results.find(r => !isRejected(r.videoId));
      if (!found) {
        discoverIndex++;
        return showNextCard();
      }
      Object.assign(track, found);
    } catch {
      discoverIndex++;
      return showNextCard();
    }
  }

  if (!track.videoId || isRejected(track.videoId)) {
    discoverIndex++;
    return showNextCard();
  }

  currentTrack = track;
  $('card-title').textContent = track.title || '';
  $('card-artist').textContent = track.artist || '';

  playVideo(track.videoId);
  addToHistory(track).catch(() => {});
  updateMiniPlayer(track);

  // Re-init swipe on the card element
  const card = $('swipe-card');
  if (!swipeHandlers) {
    swipeHandlers = initSwipe(card, {
      onLike: handleLike,
      onReject: handleReject,
    });
  }
}

async function handleLike() {
  if (!currentTrack) return;
  try {
    await likeTrack(currentTrack);
    showToast('❤️ Dodano do polubionych!', 'success');
    loadSimilarIntoQueue(currentTrack);
  } catch (e) {
    showToast('Błąd: ' + e.message, 'error');
  }
  discoverIndex++;
  await showNextCard();
}

async function handleReject() {
  if (!currentTrack) return;
  try {
    await rejectTrack(currentTrack.videoId);
  } catch {}
  discoverIndex++;
  await showNextCard();
}

async function loadSimilarIntoQueue(track) {
  try {
    const similar = await getSimilarTracks(track.artist, track.title, 10);
    const filtered = similar.filter(t => t.title && t.artist);
    discoverQueue.splice(discoverIndex, 0, ...filtered);
  } catch {}
}

$('like-btn').addEventListener('click', () => swipeHandlers && swipeHandlers.triggerLike());
$('reject-btn').addEventListener('click', () => swipeHandlers && swipeHandlers.triggerReject());
$('replay-btn').addEventListener('click', async () => {
  if (currentTrack) playVideo(currentTrack.videoId);
});

// ===== SEARCH =====
$('search-btn').addEventListener('click', runSearch);
$('search-input').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });

async function runSearch() {
  const q = $('search-input').value.trim();
  if (!q) return;
  if (!Settings.getYtKey()) {
    showToast('Dodaj klucz YouTube API w Ustawieniach', 'error');
    switchTab('settings');
    return;
  }
  try {
    showLoading(true);
    const results = await searchYouTube(q, 20);
    renderSearchResults(results);
    $('search-empty').classList.add('hidden');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderSearchResults(tracks) {
  const list = $('search-results');
  list.innerHTML = '';
  if (!tracks.length) {
    $('search-empty').classList.remove('hidden');
    return;
  }
  tracks.forEach(track => {
    list.appendChild(makeTrackItem(track, {
      onPlay: () => playTrackFromSearch(track),
      showLike: true, showAdd: true
    }));
  });
}

async function playTrackFromSearch(track) {
  currentTrack = track;
  playVideo(track.videoId);
  addToHistory(track).catch(() => {});
  updateMiniPlayer(track);
  document.querySelectorAll('.result-item').forEach(el => {
    el.classList.toggle('playing', el.dataset.vid === track.videoId);
  });
}

// ===== LIBRARY =====
let currentLibTab = 'liked';

document.querySelectorAll('.lib-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lib-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.lib-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentLibTab = btn.dataset.lib;
    $('lib-' + currentLibTab).classList.add('active');
    loadLibPanel(currentLibTab);
  });
});

async function loadLibraryTab() {
  await loadLibPanel(currentLibTab);
}

async function loadLibPanel(panel) {
  if (panel === 'liked') await loadLiked();
  if (panel === 'playlists') await loadPlaylists();
  if (panel === 'history') await loadHistoryPanel();
}

async function loadLiked() {
  showLoading(true);
  try {
    const tracks = await getLikedTracks();
    const list = $('liked-list');
    list.innerHTML = '';
    if (!tracks.length) { $('liked-empty').classList.remove('hidden'); return; }
    $('liked-empty').classList.add('hidden');
    tracks.forEach(track => {
      list.appendChild(makeTrackItem(track, {
        onPlay: () => { playVideo(track.videoId); updateMiniPlayer(track); },
        showUnlike: true, showAdd: true,
      }));
    });
  } finally { showLoading(false); }
}

async function loadPlaylists() {
  showLoading(true);
  try {
    const pls = await getPlaylists();
    const list = $('playlists-list');
    list.innerHTML = '';
    if (!pls.length) { $('playlists-empty').classList.remove('hidden'); return; }
    $('playlists-empty').classList.add('hidden');
    pls.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <span style="font-size:2rem">📋</span>
        <div class="result-info">
          <div class="result-title">${esc(pl.name)}</div>
          <div class="result-meta">${(pl.tracks || []).length} utworów</div>
        </div>
        <div class="result-actions">
          <button class="result-action-btn" data-action="open" title="Otwórz">▶</button>
          <button class="result-action-btn" data-action="rename" title="Zmień nazwę">✏️</button>
          <button class="result-action-btn" data-action="delete" title="Usuń">🗑</button>
        </div>`;
      item.querySelector('[data-action="open"]').addEventListener('click', () => openPlaylist(pl));
      item.querySelector('[data-action="rename"]').addEventListener('click', () => renamePlaylistPrompt(pl));
      item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        await deletePlaylist(pl.id);
        showToast('Playlista usunięta');
        loadPlaylists();
      });
      list.appendChild(item);
    });
  } finally { showLoading(false); }
}

function openPlaylist(pl) {
  openModal('📋 ' + pl.name, body => {
    if (!pl.tracks?.length) { body.innerHTML = '<p style="color:var(--text2)">Brak utworów</p>'; return; }
    pl.tracks.forEach(track => {
      const el = makeTrackItem(track, {
        onPlay: () => { playVideo(track.videoId); updateMiniPlayer(track); },
        extraActions: [{
          label: '🗑', title: 'Usuń z playlisty',
          action: async () => {
            await removeTrackFromPlaylist(pl.id, track.videoId);
            showToast('Usunięto z playlisty');
            closeModal();
          }
        }]
      });
      body.appendChild(el);
    });
  });
}

async function renamePlaylistPrompt(pl) {
  openModal('Zmień nazwę playlisty', body => {
    const inp = document.createElement('input');
    inp.value = pl.name;
    inp.placeholder = 'Nowa nazwa...';
    body.appendChild(inp);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Zapisz';
    btn.addEventListener('click', async () => {
      const name = inp.value.trim();
      if (!name) return;
      await renamePlaylist(pl.id, name);
      showToast('Zmieniono nazwę');
      closeModal();
      loadPlaylists();
    });
    body.appendChild(btn);
  });
}

async function loadHistoryPanel() {
  showLoading(true);
  try {
    const tracks = await getHistory(50);
    const list = $('history-list');
    list.innerHTML = '';
    if (!tracks.length) { $('history-empty').classList.remove('hidden'); return; }
    $('history-empty').classList.add('hidden');
    tracks.forEach(track => {
      list.appendChild(makeTrackItem(track, {
        onPlay: () => { playVideo(track.videoId); updateMiniPlayer(track); },
        showLike: true,
      }));
    });
  } finally { showLoading(false); }
}

// ===== CREATE PLAYLIST =====
$('create-playlist-btn').addEventListener('click', () => {
  openModal('Nowa playlista', body => {
    const inp = document.createElement('input');
    inp.placeholder = 'Nazwa playlisty...';
    body.appendChild(inp);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Utwórz';
    btn.addEventListener('click', async () => {
      const name = inp.value.trim();
      if (!name) return;
      await createPlaylist(name);
      showToast('Playlista utworzona', 'success');
      closeModal();
      loadPlaylists();
    });
    body.appendChild(btn);
  });
});

// ===== ADD TO PLAYLIST MODAL =====
async function showAddToPlaylistModal(track) {
  openModal('Dodaj do playlisty', async body => {
    const pls = await getPlaylists();
    if (!pls.length) {
      body.innerHTML = '<p style="color:var(--text2)">Brak playlist. Utwórz pierwszą w Bibliotece.</p>';
      return;
    }
    pls.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'playlist-item';
      item.innerHTML = `<span class="playlist-icon">📋</span>
        <div class="playlist-meta">
          <span>${esc(pl.name)}</span>
          <span>${(pl.tracks || []).length} utworów</span>
        </div>`;
      item.addEventListener('click', async () => {
        await addTrackToPlaylist(pl.id, track);
        showToast(`Dodano do: ${pl.name}`, 'success');
        closeModal();
      });
      body.appendChild(item);
    });
  });
}

// ===== SETTINGS =====
$('yt-api-key').value = Settings.getYtKey();
$('lastfm-api-key').value = Settings.getLastfmKey();

$('save-keys-btn').addEventListener('click', () => {
  Settings.setYtKey($('yt-api-key').value);
  Settings.setLastfmKey($('lastfm-api-key').value);
  showToast('Klucze zapisane', 'success');
});

$('clear-rejected-btn').addEventListener('click', async () => {
  await clearRejected();
  showToast('Odrzucone wyczyszczone', 'success');
});

$('clear-history-btn').addEventListener('click', async () => {
  await clearHistory();
  showToast('Historia wyczyszczona', 'success');
});

// ===== MINI PLAYER =====
function updateMiniPlayer(track) {
  miniPlayerTrack = track;
  const mp = $('mini-player');
  $('mini-thumb').src = track.thumbnail || '';
  $('mini-title').textContent = track.title || '';
  $('mini-artist').textContent = track.artist || '';
  mp.classList.remove('hidden');
}

$('mini-close-btn').addEventListener('click', () => {
  stopVideo();
  $('mini-player').classList.add('hidden');
  miniPlayerTrack = null;
});

$('mini-play-btn').addEventListener('click', () => {
  const state = getPlayerState();
  if (state === 1) { // playing
    pauseVideo();
    $('mini-play-btn').textContent = '▶';
  } else {
    resumeVideo();
    $('mini-play-btn').textContent = '⏸';
  }
});

window.addEventListener('yt-state-change', e => {
  const state = e.detail;
  if ($('mini-player').classList.contains('hidden')) return;
  $('mini-play-btn').textContent = state === 1 ? '⏸' : '▶';
});

// ===== TRACK ITEM BUILDER =====
function makeTrackItem(track, opts = {}) {
  const { onPlay, showLike, showUnlike, showAdd, extraActions = [] } = opts;
  const item = document.createElement('div');
  item.className = 'result-item';
  item.dataset.vid = track.videoId;

  const thumb = track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/default.jpg`;

  item.innerHTML = `
    <img class="result-thumb" src="${esc(thumb)}" alt="" loading="lazy" />
    <div class="result-info">
      <div class="result-title">${esc(track.title || '')}</div>
      <div class="result-meta">${esc(track.artist || '')}</div>
    </div>
    <div class="result-actions"></div>`;

  const actionsEl = item.querySelector('.result-actions');

  if (onPlay) {
    item.addEventListener('click', e => {
      if (e.target.closest('.result-actions')) return;
      onPlay();
    });
  }

  if (showLike) {
    const btn = document.createElement('button');
    btn.className = 'result-action-btn';
    btn.title = 'Polub';
    btn.textContent = '❤️';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await likeTrack(track);
      btn.classList.add('liked');
      showToast('❤️ Dodano do polubionych!', 'success');
    });
    // Check if already liked
    isLiked(track.videoId).then(liked => { if (liked) btn.classList.add('liked'); });
    actionsEl.appendChild(btn);
  }

  if (showUnlike) {
    const btn = document.createElement('button');
    btn.className = 'result-action-btn liked';
    btn.title = 'Usuń z polubionych';
    btn.textContent = '❤️';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await unlikeTrack(track.videoId);
      showToast('Usunięto z polubionych');
      item.remove();
    });
    actionsEl.appendChild(btn);
  }

  if (showAdd) {
    const btn = document.createElement('button');
    btn.className = 'result-action-btn';
    btn.title = 'Dodaj do playlisty';
    btn.textContent = '➕';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showAddToPlaylistModal(track);
    });
    actionsEl.appendChild(btn);
  }

  extraActions.forEach(({ label, title, action }) => {
    const btn = document.createElement('button');
    btn.className = 'result-action-btn';
    btn.title = title;
    btn.textContent = label;
    btn.addEventListener('click', e => { e.stopPropagation(); action(); });
    actionsEl.appendChild(btn);
  });

  return item;
}

// ===== MODAL =====
function openModal(title, fillFn) {
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.innerHTML = '';
  if (typeof fillFn === 'function') {
    const result = fillFn(body);
    if (result && result.then) result.then(() => {});
  }
  $('modal-overlay').classList.remove('hidden');
}
function closeModal() { $('modal-overlay').classList.add('hidden'); }
$('modal-close').addEventListener('click', closeModal);
$('modal-overlay').addEventListener('click', e => {
  if (e.target === $('modal-overlay')) closeModal();
});

// ===== LOADING =====
function showLoading(show) {
  $('loading').classList.toggle('hidden', !show);
}

// ===== UTILS =====
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

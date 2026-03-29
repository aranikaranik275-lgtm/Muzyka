'use strict';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

const audio        = document.getElementById('audio-player');
const btnPlay      = document.getElementById('btn-play');
const btnPrev      = document.getElementById('btn-prev');
const btnNext      = document.getElementById('btn-next');
const btnShuffle   = document.getElementById('btn-shuffle');
const btnRepeat    = document.getElementById('btn-repeat');
const progress     = document.getElementById('progress');
const volume       = document.getElementById('volume');
const timeCurrent  = document.getElementById('time-current');
const timeTotal    = document.getElementById('time-total');
const trackTitle   = document.getElementById('track-title');
const trackArtist  = document.getElementById('track-artist');
const albumArt     = document.getElementById('album-art');
const playlistEl   = document.getElementById('playlist');
const fileInput    = document.getElementById('file-input');
const emptyHint    = document.getElementById('empty-hint');
const btnInstall   = document.getElementById('btn-install');

let playlist = [];
let currentIndex = -1;
let shuffle = false;
let repeat = false;
let objectURLs = [];

function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

function parseArtistTitle(filename) {
  const base = stripExt(filename);
  const sep = base.indexOf(' - ');
  if (sep > -1) return { artist: base.slice(0, sep).trim(), title: base.slice(sep + 3).trim() };
  return { artist: 'Nieznany artysta', title: base.trim() };
}

function buildPlaylist(files) {
  objectURLs.forEach(u => URL.revokeObjectURL(u));
  objectURLs = [];
  playlist = Array.from(files).map(file => {
    const url = URL.createObjectURL(file);
    objectURLs.push(url);
    return { url, name: file.name, ...parseArtistTitle(file.name), duration: 0 };
  });
  renderPlaylist();
  if (playlist.length > 0) loadTrack(0, false);
}

function renderPlaylist() {
  playlistEl.innerHTML = '';
  emptyHint.style.display = playlist.length ? 'none' : '';
  playlist.forEach((track, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    li.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="pl-title">${track.title}</span>
      <span class="pl-duration" data-idx="${i}">${formatTime(track.duration)}</span>
    `;
    li.addEventListener('click', () => loadTrack(i, true));
    if (i === currentIndex) li.classList.add('active');
    playlistEl.appendChild(li);
  });
}

function updateActiveItem() {
  playlistEl.querySelectorAll('li').forEach((li, i) => {
    li.classList.toggle('active', i === currentIndex);
  });
}

function loadTrack(index, autoplay) {
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  const track = playlist[index];
  audio.src = track.url;
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  progress.value = 0;
  timeCurrent.textContent = '0:00';
  timeTotal.textContent = formatTime(track.duration);
  updateActiveItem();
  setPlaying(false);
  if (autoplay) {
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'Muzyka PWA',
    });
  }
}

function setPlaying(playing) {
  btnPlay.textContent = playing ? '⏸' : '▶';
  btnPlay.title = playing ? 'Pauza' : 'Odtworz';
  albumArt.classList.toggle('playing', playing);
}

function nextTrack() {
  if (!playlist.length) return;
  let next;
  if (shuffle) {
    do { next = Math.floor(Math.random() * playlist.length); } while (playlist.length > 1 && next === currentIndex);
  } else {
    next = (currentIndex + 1) % playlist.length;
  }
  loadTrack(next, true);
}

function prevTrack() {
  if (!playlist.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const prev = (currentIndex - 1 + playlist.length) % playlist.length;
  loadTrack(prev, true);
}

btnPlay.addEventListener('click', () => {
  if (!playlist.length) return;
  if (audio.paused) {
    if (!audio.src) loadTrack(0, false);
    audio.play().then(() => setPlaying(true)).catch(() => {});
  } else {
    audio.pause();
    setPlaying(false);
  }
});

btnPrev.addEventListener('click', prevTrack);
btnNext.addEventListener('click', nextTrack);

btnShuffle.addEventListener('click', () => {
  shuffle = !shuffle;
  btnShuffle.classList.toggle('active', shuffle);
});

btnRepeat.addEventListener('click', () => {
  repeat = !repeat;
  btnRepeat.classList.toggle('active', repeat);
  audio.loop = repeat;
});

audio.addEventListener('timeupdate', () => {
  if (!isFinite(audio.duration)) return;
  progress.value = (audio.currentTime / audio.duration) * 100;
  timeCurrent.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audio.duration);
  if (playlist[currentIndex]) {
    playlist[currentIndex].duration = audio.duration;
    const span = playlistEl.querySelector(`[data-idx="${currentIndex}"]`);
    if (span) span.textContent = formatTime(audio.duration);
  }
});

audio.addEventListener('ended', () => {
  if (!repeat) nextTrack();
});

progress.addEventListener('input', () => {
  if (isFinite(audio.duration)) {
    audio.currentTime = (progress.value / 100) * audio.duration;
  }
});

volume.addEventListener('input', () => {
  audio.volume = volume.value / 100;
});
audio.volume = volume.value / 100;

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) buildPlaylist(fileInput.files);
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play',  () => { audio.play(); setPlaying(true); });
  navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); setPlaying(false); });
  navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
  navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.hidden = false;
});

btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') btnInstall.hidden = true;
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => { btnInstall.hidden = true; });
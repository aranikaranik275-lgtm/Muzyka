/**
 * Library — manages liked songs, rejected songs, playlists, history
 * Data stored in Firestore under users/{uid}/...
 * Rejected list also cached in localStorage for fast checks.
 */
import {
  db, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove
} from './firebase-config.js';

let _uid = null;
const REJECTED_KEY = 'muzyka_rejected_';

export function setUid(uid) { _uid = uid; }

function userCol(col) { return collection(db, 'users', _uid, col); }
function userDoc(path) { return doc(db, 'users', _uid, ...path.split('/')); }

// ===== REJECTED =====
function rejectedKey() { return REJECTED_KEY + _uid; }
function getRejectedLocal() {
  try { return new Set(JSON.parse(localStorage.getItem(rejectedKey()) || '[]')); }
  catch { return new Set(); }
}
function saveRejectedLocal(set) {
  localStorage.setItem(rejectedKey(), JSON.stringify([...set]));
}

export function isRejected(videoId) {
  return getRejectedLocal().has(videoId);
}

export async function rejectTrack(videoId) {
  const set = getRejectedLocal();
  set.add(videoId);
  saveRejectedLocal(set);
  // Store in Firestore
  await setDoc(userDoc(`rejected/${videoId}`), { videoId, rejectedAt: serverTimestamp() });
}

export async function loadRejectedFromFirestore() {
  if (!_uid) return;
  const snap = await getDocs(userCol('rejected'));
  const set = new Set(snap.docs.map(d => d.id));
  saveRejectedLocal(set);
}

export async function clearRejected() {
  if (!_uid) return;
  const snap = await getDocs(userCol('rejected'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  localStorage.removeItem(rejectedKey());
}

// ===== LIKED =====
export async function likeTrack(track) {
  // track: { videoId, title, artist, thumbnail }
  await setDoc(userDoc(`liked/${track.videoId}`), {
    ...track,
    likedAt: serverTimestamp(),
  });
}

export async function unlikeTrack(videoId) {
  await deleteDoc(userDoc(`liked/${videoId}`));
}

export async function isLiked(videoId) {
  const snap = await getDoc(userDoc(`liked/${videoId}`));
  return snap.exists();
}

export async function getLikedTracks() {
  const snap = await getDocs(query(userCol('liked'), orderBy('likedAt', 'desc')));
  return snap.docs.map(d => d.data());
}

// ===== HISTORY =====
export async function addToHistory(track) {
  // track: { videoId, title, artist, thumbnail }
  await addDoc(userCol('history'), {
    ...track,
    playedAt: serverTimestamp(),
  });
}

export async function getHistory(limitN = 50) {
  const snap = await getDocs(query(userCol('history'), orderBy('playedAt', 'desc'), limit(limitN)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function clearHistory() {
  const snap = await getDocs(userCol('history'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// ===== PLAYLISTS =====
export async function createPlaylist(name) {
  const ref = await addDoc(userCol('playlists'), {
    name,
    tracks: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPlaylists() {
  const snap = await getDocs(query(userCol('playlists'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPlaylist(playlistId) {
  const snap = await getDoc(userDoc(`playlists/${playlistId}`));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addTrackToPlaylist(playlistId, track) {
  await updateDoc(userDoc(`playlists/${playlistId}`), {
    tracks: arrayUnion(track),
  });
}

export async function removeTrackFromPlaylist(playlistId, videoId) {
  const pl = await getPlaylist(playlistId);
  if (!pl) return;
  const updated = (pl.tracks || []).filter(t => t.videoId !== videoId);
  await updateDoc(userDoc(`playlists/${playlistId}`), { tracks: updated });
}

export async function deletePlaylist(playlistId) {
  await deleteDoc(userDoc(`playlists/${playlistId}`));
}

export async function renamePlaylist(playlistId, name) {
  await updateDoc(userDoc(`playlists/${playlistId}`), { name });
}

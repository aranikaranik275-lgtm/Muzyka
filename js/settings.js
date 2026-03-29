// Settings — API keys stored in localStorage
const KEYS = {
  YT: 'muzyka_yt_api_key',
  LASTFM: 'muzyka_lastfm_api_key',
};

export const Settings = {
  getYtKey: () => localStorage.getItem(KEYS.YT) || '',
  getLastfmKey: () => localStorage.getItem(KEYS.LASTFM) || '',
  setYtKey: (k) => localStorage.setItem(KEYS.YT, k.trim()),
  setLastfmKey: (k) => localStorage.setItem(KEYS.LASTFM, k.trim()),
};

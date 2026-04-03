// Default API keys – pre-seeded on first load, can be overridden in Settings
(function () {
  const YT  = 'muzyka_yt_api_key';
  const LFM = 'muzyka_lastfm_api_key';
  if (!localStorage.getItem(YT))  localStorage.setItem(YT,  'AIzaSyBbccBYUuWegiKFPNQUobeJMGUArFLNfz0');
  if (!localStorage.getItem(LFM)) localStorage.setItem(LFM, '46a22b8264dfc4bf70fe93698317c119');
})();

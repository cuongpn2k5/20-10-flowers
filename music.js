(() => {
  'use strict';

  const buttons = [...document.querySelectorAll('[data-music-toggle]')];

  function showPlayback(playing, failed) {
    buttons.forEach(button => {
      button.querySelector('[data-music-label]').textContent = playing ? 'Tắt nhạc' : 'Bật nhạc';
      button.setAttribute('aria-pressed', String(playing));
      button.title = failed ? 'Chưa tải được nhạc. Nhấn để thử lại.' : playing ? 'Tắt nhạc nền' : 'Bật nhạc nền';
    });
  }

  if (window.parent !== window) {
    const send = (type, details = {}) => window.parent.postMessage({ type, ...details }, '*');
    window.addEventListener('message', event => {
      if (event.source !== window.parent || event.data?.type !== 'flowers:music-state') return;
      showPlayback(event.data.playing, event.data.failed);
    });
    buttons.forEach(button => button.addEventListener('click', () => send('flowers:music-toggle')));
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element) || event.target.closest('[data-music-toggle]')) return;
      send('flowers:music-start');
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const target = new URL(link.href);
      for (const [entry, view] of [['index.html', 'bouquet'], ['garden.html', 'garden']]) {
        const destination = new URL(entry, location.href);
        if (target.origin !== destination.origin || target.pathname !== destination.pathname) continue;
        event.preventDefault();
        send('flowers:navigate', { view });
        break;
      }
    });
    document.addEventListener('keydown', event => {
      if (event.target instanceof Element && event.target.closest('[data-music-toggle]')) return;
      if (['Enter', ' '].includes(event.key)) send('flowers:music-start');
    });
    send('flowers:music-ready');
    return;
  }

  const audio = document.getElementById('backgroundMusic');
  if (!audio) {
    // Opening a scene file directly still enters through the persistent player.
    location.replace(new URL(location.pathname.endsWith('/garden-view.html') ? 'garden.html' : 'index.html', location.href));
    return;
  }
  const storageKey = 'flower.music.20-10.v1';
  let enabled = true;
  let position = 0;
  let starting = false;

  audio.volume = 0.3;

  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved && Number.isFinite(saved.position) && saved.position >= 0) position = saved.position;
  } catch {
    // Music also works when browser storage is unavailable.
  }

  function savePlayback() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ position: audio.currentTime }));
    } catch {
      // Playback does not depend on saving preferences.
    }
  }

  function updateButtons() {
    const playing = !audio.paused && !audio.error;
    showPlayback(playing, Boolean(audio.error));
    document.getElementById('flowerView')?.contentWindow.postMessage({ type: 'flowers:music-state', playing, failed: Boolean(audio.error) }, '*');
  }

  async function playMusic() {
    if (!enabled || starting || !audio.paused) return;
    starting = true;
    try {
      if (audio.error) audio.load();
      await audio.play();
    } catch {
      // Browsers may require a click or key press before allowing sound.
    } finally {
      starting = false;
      updateButtons();
    }
  }

  function restorePosition() {
    if (position && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = position % audio.duration;
    }
    position = 0;
  }
  if (audio.readyState >= 1) restorePosition();
  else audio.addEventListener('loadedmetadata', restorePosition, { once: true });
  ['play', 'pause', 'error'].forEach(event => audio.addEventListener(event, updateButtons));

  function toggleMusic() {
    enabled = audio.paused;
    if (enabled) playMusic();
    else audio.pause();
    savePlayback();
  }
  buttons.forEach(button => button.addEventListener('click', toggleMusic));
  window.addEventListener('message', event => {
    if (event.source !== document.getElementById('flowerView')?.contentWindow) return;
    if (event.data?.type === 'flowers:music-ready') updateButtons();
    if (event.data?.type === 'flowers:music-start') playMusic();
    if (event.data?.type === 'flowers:music-toggle') toggleMusic();
  });

  function startOnInteraction(event) {
    if (event.target instanceof Element && event.target.closest('[data-music-toggle]')) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    playMusic();
  }

  document.addEventListener('click', startOnInteraction);
  document.addEventListener('keydown', startOnInteraction);
  window.addEventListener('pagehide', savePlayback);
  window.addEventListener('pageshow', playMusic);
  updateButtons();
  playMusic();
})();

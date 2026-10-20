(() => {
  'use strict';

  const STORAGE_KEY = 'flower.greeting.20-10.v1';
  const defaultGreeting = {
    recipient: 'em',
    message: 'Nhân ngày Phụ nữ Việt Nam 20/10, chúc em luôn khỏe mạnh, bình an và có thật nhiều niềm vui.\n\nMong em được yêu thương từ những điều nhỏ nhất, có thời gian cho bản thân và tự tin theo đuổi những điều mình mong muốn.\n\nHôm nay và cả những ngày sau, hãy luôn mỉm cười theo cách của riêng em nhé.',
    sender: 'Một người quý mến em'
  };
  const dialog = document.getElementById('greetingCard');
  const openButton = document.getElementById('openCard');
  const closeButton = document.getElementById('closeCard');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopLayout = window.matchMedia('(min-width: 1100px)');
  const sceneElements = [...document.querySelectorAll('.bouquet-composition, .scene-footer')];
  const layoutAnimations = new Set();

  function reflowScene(changeLayout) {
    layoutAnimations.forEach(animation => animation.cancel());
    layoutAnimations.clear();
    const before = sceneElements.map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
    });
    changeLayout();
    if (motion.matches) return;
    sceneElements.forEach((element, index) => {
      const after = element.getBoundingClientRect();
      if (!after.width || !after.height) return;
      const dx = before[index].left - after.left - window.scrollX;
      const dy = before[index].top - after.top - window.scrollY;
      const scale = element.matches('.bouquet-composition')
        ? ` scale(${before[index].width / after.width}, ${before[index].height / after.height})` : '';
      const animation = element.animate([
        { transform: `translate(${dx}px, ${dy}px)${scale}` },
        { transform: 'none' }
      ], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
      layoutAnimations.add(animation);
      animation.onfinish = () => layoutAnimations.delete(animation);
    });
  }

  function revealCard() {
    const rect = dialog.getBoundingClientRect();
    if (!desktopLayout.matches || rect.top < 16 || rect.top > window.innerHeight * 0.35 || rect.bottom > window.innerHeight - 16) {
      dialog.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    }
  }

  function setCardOpen(open) {
    if (dialog.open === open) return;
    reflowScene(() => {
      if (open) {
        dialog.scrollTop = 0;
        // A non-modal dialog participates in the page grid and reserves its own space.
        document.body.classList.add('card-open');
        dialog.show();
      } else {
        dialog.close();
        document.body.classList.remove('card-open');
      }
      openButton.setAttribute('aria-expanded', String(open));
      openButton.querySelector('.envelope-action').textContent = open ? 'Gấp thiệp' : 'Mở thiệp';
    });
    if (open) {
      closeButton.focus({ preventScroll: true });
      revealCard();
      document.dispatchEvent(new Event('bouquet:celebrate'));
    } else {
      openButton.focus({ preventScroll: true });
      const rect = openButton.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        openButton.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'center' });
      }
    }
  }

  motion.addEventListener('change', () => {
    if (motion.matches) {
      layoutAnimations.forEach(animation => animation.cancel());
      layoutAnimations.clear();
    }
  });
  const maxLengths = { recipient: 60, message: 1500, sender: 60 };
  let greeting = { ...defaultGreeting };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Object.keys(maxLengths).every(key => typeof saved[key] === 'string'
      && saved[key].trim().length > 0 && saved[key].length <= maxLengths[key])) {
      greeting = Object.fromEntries(Object.keys(maxLengths).map(key => [key, saved[key].trim()]));
    }
  } catch {
    // The default letter stays usable when storage is unavailable or malformed.
  }

  function renderGreeting() {
    document.getElementById('cardRecipient').textContent = greeting.recipient;
    const paragraphs = greeting.message.split(/\n\s*\n/).map(text => {
      const paragraph = document.createElement('span');
      paragraph.className = 'message-paragraph';
      paragraph.textContent = text;
      return paragraph;
    });
    document.getElementById('cardMessage').replaceChildren(...paragraphs);
    document.getElementById('cardSender').textContent = greeting.sender;
  }

  document.addEventListener('bouquet:ready', () => { openButton.hidden = false; });
  document.addEventListener('bouquet:rose', event => {
    const wish = document.getElementById('roseWish');
    wish.classList.remove('is-new');
    wish.textContent = event.detail.message;
    // Restart the brief reveal even when two flowers share the same wish.
    void wish.offsetWidth;
    wish.classList.add('is-new');
  });
  document.getElementById('replayBloom').addEventListener('click', () => {
    document.dispatchEvent(new Event('bouquet:replay'));
    document.getElementById('roseWish').textContent = '';
  });

  openButton.addEventListener('click', () => setCardOpen(!dialog.open));
  closeButton.addEventListener('click', () => setCardOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open && !event.defaultPrevented) {
      event.preventDefault();
      setCardOpen(false);
    }
  });
  dialog.addEventListener('close', () => {
    if (dialog.open || !document.body.classList.contains('card-open')) return;
    document.body.classList.remove('card-open');
    openButton.setAttribute('aria-expanded', 'false');
    openButton.querySelector('.envelope-action').textContent = 'Mở thiệp';
  });
  renderGreeting();
})();

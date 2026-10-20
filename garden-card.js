(() => {
  'use strict';

  const STORAGE_KEY = 'flower.garden.greeting.20-10.v1';
  const recipient = document.getElementById('cardRecipient');
  const title = document.getElementById('cardTitle');
  const message = document.getElementById('cardMessage');
  const signature = document.getElementById('cardSignature');
  const maxLengths = { recipient: 60, title: 160, message: 3000, signature: 120 };
  function readText(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return copy.textContent.trim();
  }
  let greeting = {
    recipient: readText(recipient),
    title: readText(title),
    message: [...message.querySelectorAll('p')].map(readText).join('\n\n'),
    signature: readText(signature)
  };

  function renderGreeting() {
    recipient.textContent = greeting.recipient;
    title.textContent = greeting.title;
    signature.textContent = greeting.signature;
    message.replaceChildren(...greeting.message.split(/\n\s*\n/).map(text => {
      const paragraph = document.createElement('p');
      paragraph.className = 'message';
      paragraph.textContent = text;
      return paragraph;
    }));
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Object.entries(maxLengths).every(([key, maxLength]) =>
      typeof saved[key] === 'string' && saved[key].trim() && saved[key].length <= maxLength)) {
      greeting = Object.fromEntries(Object.keys(maxLengths).map(key => [key, saved[key].trim()]));
      renderGreeting();
    }
  } catch {
    // Keep the original letter when storage is unavailable or malformed.
  }

})();

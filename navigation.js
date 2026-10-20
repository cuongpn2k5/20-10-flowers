(() => {
  'use strict';

  const views = {
    bouquet: { entry: 'index.html', content: 'bouquet.html', title: 'Một bó hoa dành tặng em · 20/10', color: '#fff8fa' },
    garden: { entry: 'garden.html', content: 'garden-view.html', title: 'Cả một vườn thương · 20/10', color: '#bbdff5' }
  };
  const prompt = document.getElementById('orientationPrompt');
  const portraitPhone = matchMedia('(max-width: 600px) and (orientation: portrait) and (pointer: coarse)');
  const orientationKey = 'flower.orientation.20-10.v1';
  let started = false;

  function enterSite() {
    if (prompt.open) prompt.close();
    if (started) return;
    started = true;
    portraitPhone.removeEventListener('change', onOrientationChange);
    try { sessionStorage.setItem(orientationKey, 'seen'); } catch {
      // Dismissing the reminder does not require browser storage.
    }
    showView(currentView());
  }

  function onOrientationChange() {
    if (!portraitPhone.matches && prompt.open) enterSite();
  }

  function currentView() {
    const requested = new URL(location.href).searchParams.get('view');
    if (Object.hasOwn(views, requested)) return requested;
    return location.pathname.endsWith('/garden.html') ? 'garden' : 'bouquet';
  }

  function showView(name, pushHistory = false) {
    if (!Object.hasOwn(views, name)) return;
    const view = views[name];
    if (pushHistory) {
      const url = new URL(view.entry, location.href);
      try {
        history.pushState({ view: name }, '', url);
      } catch {
        // Local file URLs may only allow query changes in the History API.
        const localUrl = new URL(location.href);
        localUrl.searchParams.set('view', name);
        history.pushState({ view: name }, '', localUrl);
      }
    }

    document.title = view.title;
    document.body.dataset.view = name;
    document.querySelector('meta[name="theme-color"]').content = view.color;
    const previous = document.getElementById('flowerView');
    const frame = previous.cloneNode(false);
    frame.title = name === 'garden' ? 'Vườn hoa và thiệp chúc 20/10' : 'Bó hoa và thiệp chúc 20/10';
    frame.src = view.content;
    // Only the scene is replaced. The audio element stays in this document.
    previous.replaceWith(frame);
  }

  window.addEventListener('message', event => {
    if (event.source !== document.getElementById('flowerView').contentWindow) return;
    if (event.data?.type === 'flowers:navigate') showView(event.data.view, true);
  });
  window.addEventListener('popstate', () => { if (started) showView(currentView()); });
  history.replaceState({ view: currentView() }, '', location.href);
  let seen = false;
  try { seen = sessionStorage.getItem(orientationKey) === 'seen'; } catch {
    // The reminder can still be dismissed for the current visit.
  }
  prompt.addEventListener('close', enterSite);
  document.getElementById('continuePortrait').addEventListener('click', enterSite);
  if (portraitPhone.matches && !seen) {
    portraitPhone.addEventListener('change', onOrientationChange);
    prompt.showModal();
  } else enterSite();
})();

// Run with Playwright installed: node tests/layout.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const pageUrl = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

async function assertClearLayout(view, label) {
  const layout = await view.evaluate(() => {
    const card = document.getElementById('greetingCard').getBoundingClientRect();
    const covered = ['.greeting', '.scene-footer', '#bouquetStageWrapper', '#openCard'].filter(selector => {
      const text = document.querySelector(selector).getBoundingClientRect();
      return Math.min(text.right, card.right) - Math.max(text.left, card.left) > 1
        && Math.min(text.bottom, card.bottom) - Math.max(text.top, card.top) > 1;
    });
    const envelope = document.getElementById('openCard').getBoundingClientRect();
    return {
      covered,
      overflow: document.documentElement.scrollWidth > innerWidth,
      envelopeFits: envelope.left >= 0 && envelope.right <= innerWidth,
      cardFits: card.left >= 0 && card.right <= innerWidth,
      modal: document.getElementById('greetingCard').matches(':modal'),
      expanded: document.getElementById('openCard').getAttribute('aria-expanded')
    };
  });
  assert.deepEqual(layout.covered, [], `${label}: card must reserve space instead of covering existing content`);
  assert.equal(layout.overflow, false, `${label}: no horizontal overflow`);
  assert.equal(layout.envelopeFits, true, `${label}: envelope stays visible`);
  assert.equal(layout.cardFits, true, `${label}: card stays inside the page`);
  assert.equal(layout.modal, false, `${label}: page remains interactive`);
  assert.equal(layout.expanded, 'true');
}

(async () => {
  const browser = await chromium.launch();
  try {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1024, height: 860 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pageUrl);
    let view = page.frame('flowerView');
    assert.equal(await view.locator('#bouquetStageWrapper').evaluate(e => {
      const r = e.getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2;
    }), true, 'bouquet is centered on arrival');
    await view.locator('#openCard').click();
    assert.equal(await view.locator('#memoryAlbum, #viewAlbum, .album-card').count(), 0, 'opening the letter does not reveal a photo album');
    assert.equal(await view.locator('#editCard, #cardEditor').count(), 0, 'the letter has no greeting editor');
    await assertClearLayout(view, '1024px original regression');

    for (const viewport of [
      { width: 1440, height: 1000 }, { width: 1367, height: 860 },
      { width: 1280, height: 720 }, { width: 1100, height: 768 },
      { width: 1099, height: 768 }, { width: 768, height: 1024 },
      { width: 600, height: 800 }, { width: 390, height: 844 },
      { width: 320, height: 568 }, { width: 844, height: 390 }
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(50);
      await assertClearLayout(view, `${viewport.width} × ${viewport.height}`);
    }
    await page.setViewportSize({ width: 1222, height: 709 });
    await view.locator('#closeCard').click();
    await view.locator('#openCard').click();
    const compactCard = await view.locator('#greetingCard').evaluate(e => {
      const rect = e.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewport: innerHeight };
    });
    assert.ok(compactCard.top >= 0 && compactCard.bottom <= compactCard.viewport,
      'opened default letter fits vertically on a short desktop viewport');
    await page.setViewportSize({ width: 1367, height: 860 });
    await view.evaluate(() => localStorage.setItem('flower.greeting.20-10.v1', JSON.stringify({
      recipient: 'Mẹ yêu',
      message: 'Chúc mẹ luôn khỏe mạnh và bình an.\n'.repeat(30),
      sender: 'Con của mẹ'
    })));
    await page.reload();
    view = page.frame('flowerView');
    await view.locator('#openCard').click();
    assert.equal(await view.locator('#cardRecipient').textContent(), 'Mẹ yêu');
    await assertClearLayout(view, 'long personalized letter');
    assert.equal(await view.locator('#greetingCard').evaluate(d => d.scrollHeight <= d.clientHeight + 1), true,
      'Long letter grows with the document instead of clipping into a fixed overlay');
    await view.locator('#bouquetStageWrapper').focus();
    await page.keyboard.press('Enter');
    assert.ok((await view.locator('#roseWish').textContent()).length, 'roses remain interactive with the card open');
    await assertClearLayout(view, 'flower wish with open letter');
    await view.locator('#openCard').click();
    assert.equal(await view.locator('#greetingCard').isVisible(), false, 'envelope folds the letter');
    assert.equal(await view.locator('#openCard').getAttribute('aria-expanded'), 'false');
    await view.locator('#openCard').click();
    await page.keyboard.press('Escape');
    assert.equal(await view.locator('#greetingCard').isVisible(), false);
    assert.equal(await view.locator('#openCard').evaluate(e => e === document.activeElement), true);
    await view.locator('#openCard').click();
    await view.locator('#closeCard').click();
    assert.equal(await view.locator('#greetingCard').isVisible(), false);

    // Exercise the layout movement with animations enabled and while changing orientation.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await view.locator('#openCard').click();
    await page.waitForTimeout(900);
    await assertClearLayout(view, 'animated open');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await assertClearLayout(view, 'resize open letter to mobile');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(650);
    assert.equal(await view.locator('#openCard').evaluate(e => {
      const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
    }), true, 'closing returns the opener into view');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const viewport of [
      { width: 932, height: 430 }, { width: 844, height: 390 }, { width: 803, height: 411 },
      { width: 740, height: 360 }, { width: 667, height: 375 },
      { width: 568, height: 320 }, { width: 606, height: 280 }
    ]) {
      await page.setViewportSize(viewport);
      await view.locator('#bouquetStageWrapper').focus();
      await page.keyboard.press('Enter');
      const landscape = await view.evaluate(() => {
        scrollTo(0, 0);
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const envelope = rect('#openCard');
        const footer = rect('.scene-footer');
        return {
          overlap: Math.min(envelope.right, footer.right) > Math.max(envelope.left, footer.left)
            && Math.min(envelope.bottom, footer.bottom) > Math.max(envelope.top, footer.top),
          overflow: document.documentElement.scrollWidth > innerWidth,
          headingTop: rect('.greeting').top,
          footerBottom: footer.bottom
        };
      });
      assert.equal(landscape.overlap, false, `${viewport.width}px landscape: envelope stays clear of the flower wish`);
      assert.equal(landscape.overflow, false, `${viewport.width}px landscape: no horizontal overflow`);
      assert.ok(landscape.headingTop >= 0, 'landscape heading stays accessible');
      if (viewport.height >= 320) assert.ok(landscape.footerBottom <= viewport.height, 'the flower wish fits on a landscape phone');

      await view.locator('#openCard').click();
      const navigation = await view.evaluate(() => {
        scrollTo(0, 0);
        const link = document.querySelector('.garden-link');
        const rect = link.getBoundingClientRect();
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          top: rect.top, bottom: rect.bottom,
          headingTop: document.querySelector('.greeting').getBoundingClientRect().top,
          clickable: target === link || link.contains(target)
        };
      });
      assert.ok(navigation.top >= 64, `${viewport.width}px landscape with an open letter: garden link clears the camera area`);
      assert.ok(navigation.bottom < navigation.headingTop, 'garden link stays clear of the heading');
      assert.equal(navigation.clickable, true, 'garden link remains clickable when the letter is open');
      await view.locator('#closeCard').click();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: centered bouquet, no photo album or greeting editor; no card/text/bouquet overlap across 11 viewport sizes, resize while open, long saved letters, flower interaction and keyboard/toggle close. No page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

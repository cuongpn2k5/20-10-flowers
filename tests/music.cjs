// Start the local server, then run: node tests/music.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8080/';

async function scene(page, content) {
  await page.waitForFunction(expected => document.getElementById('flowerView')?.getAttribute('src') === expected, content);
  await page.frameLocator('#flowerView').locator('main').waitFor({ state: 'attached' });
  const view = page.frame('flowerView');
  await view.waitForURL(url => url.pathname.endsWith(`/${content}`));
  await view.waitForLoadState('load');
  return view;
}

async function playing(page) {
  await page.waitForFunction(() => {
    const audio = document.getElementById('backgroundMusic');
    return !audio.paused && audio.currentTime > 0.1 && audio.readyState >= 2 && !audio.error;
  });
}

async function silent(page) {
  // Let iframe messages and any accidental playback request reach the player.
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#backgroundMusic').evaluate(a => a.paused), true, 'music waits for a bouquet activation or an explicit music control');
}

(async () => {
  for (const policy of ['no-user-gesture-required', 'document-user-activation-required']) {
    const browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      args: [`--autoplay-policy=${policy}`]
    });
    try {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL('index.html', baseUrl).href);
      let view = await scene(page, 'bouquet.html');
      await silent(page);
      await view.locator('h1').click();
      await view.locator('#replayBloom').focus();
      await page.keyboard.press('Enter');
      await view.locator('#openCard').click();
      await view.locator('#closeCard').click();
      await silent(page);
      await view.locator('.garden-link').click();
      view = await scene(page, 'garden-view.html');
      await view.locator('#bloom').click();
      await view.locator('#wishCard').waitFor({ state: 'visible' });
      await view.locator('#viewGarden').click();
      await silent(page);
      await page.goBack();
      view = await scene(page, 'bouquet.html');
      await silent(page);
      if (policy === 'document-user-activation-required') {
        await view.locator('#bouquetStageWrapper').focus();
        await page.keyboard.press('Enter');
      } else await view.locator('#bouquetStageWrapper').click();
      await playing(page);
      const media = await page.locator('#backgroundMusic').evaluate(a => ({ loop: a.loop, volume: a.volume, autoplay: a.autoplay }));
      assert.deepEqual(media, { loop: true, volume: 0.3, autoplay: false });
      assert.equal(await view.locator('audio').count(), 0, 'the scene does not create a second player');
      assert.equal(await view.locator('[data-music-toggle]').count(), 0, 'the bouquet page has no music control');
      await page.evaluate(() => {
        window.originalAudio = document.getElementById('backgroundMusic');
        window.interruptions = [];
        for (const event of ['pause', 'emptied', 'ended']) originalAudio.addEventListener(event, () => interruptions.push(event));
      });
      const before = await page.locator('#backgroundMusic').evaluate(a => a.currentTime);
      await view.locator('.garden-link').click();
      view = await scene(page, 'garden-view.html');
      assert.equal(await page.evaluate(() => originalAudio === document.getElementById('backgroundMusic') && originalAudio.isConnected), true);
      assert.ok(await page.locator('#backgroundMusic').evaluate(a => a.currentTime) >= before, 'navigation preserves the live playback position');
      await page.goBack();
      await scene(page, 'bouquet.html');
      await page.goForward();
      view = await scene(page, 'garden-view.html');
      assert.deepEqual(await page.evaluate(() => interruptions), [], 'navigation never pauses, unloads or replaces the track');

      const backgroundPosition = await page.locator('#backgroundMusic').evaluate(a => a.currentTime);
      const otherTab = await context.newPage();
      await otherTab.bringToFront();
      await page.waitForFunction(position => {
        const audio = document.getElementById('backgroundMusic');
        return !audio.paused && audio.currentTime > position + 0.1;
      }, backgroundPosition);
      await otherTab.close();
      await page.bringToFront();

      await view.locator('#bloom').click();
      await view.locator('#wishCard').waitFor({ state: 'visible' });
      await view.locator('#wishCard [data-music-toggle]').click();
      await page.waitForFunction(() => document.getElementById('backgroundMusic').paused);
      await view.locator('#viewGarden').click();
      await page.goBack();
      view = await scene(page, 'bouquet.html');
      await view.locator('#bouquetStageWrapper').click();
      await silent(page);
      await view.locator('.garden-link').click();
      view = await scene(page, 'garden-view.html');
      await view.locator('.music-float').click();
      await playing(page);
      await page.locator('#backgroundMusic').evaluate(a => { a.currentTime = a.duration - 0.3; });
      await page.waitForFunction(() => {
        const audio = document.getElementById('backgroundMusic');
        return !audio.paused && audio.currentTime < 3;
      });
      assert.deepEqual(errors, []);
      await page.close();

      // Direct entry into the garden and offline file opening use the same player.
      if (policy === 'no-user-gesture-required') {
        for (const entry of [new URL('garden.html', baseUrl).href, pathToFileURL(path.resolve(__dirname, '../index.html')).href]) {
          const direct = await context.newPage();
          direct.on('pageerror', error => errors.push(error.message));
          await direct.goto(entry);
          if (entry.startsWith('file:')) {
            const offline = await scene(direct, 'bouquet.html');
            await silent(direct);
            await offline.locator('#bouquetStageWrapper').focus();
            await direct.keyboard.press('Space');
            await playing(direct);
            await offline.locator('.garden-link').click();
            await scene(direct, 'garden-view.html');
            await playing(direct);
            await direct.goBack();
            await scene(direct, 'bouquet.html');
          } else {
            const garden = await scene(direct, 'garden-view.html');
            await silent(direct);
            await garden.locator('.music-float').click();
            await playing(direct);
          }
          await direct.close();
        }
      }
      if (policy === 'document-user-activation-required') {
        const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
        const mobile = await mobileContext.newPage();
        mobile.on('pageerror', error => errors.push(error.message));
        await mobile.goto(new URL('index.html', baseUrl).href);
        const bouquet = await scene(mobile, 'bouquet.html');
        await silent(mobile);
        await bouquet.locator('h1').tap();
        await silent(mobile);
        await bouquet.locator('#bouquetStageWrapper').tap();
        await playing(mobile);
        await bouquet.locator('.garden-link').tap();
        await scene(mobile, 'garden-view.html');
        await playing(mobile);
        await mobile.reload();
        await scene(mobile, 'garden-view.html');
        await silent(mobile);
        await mobileContext.close();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS (${policy}): silent entry, bouquet click/keyboard/touch activation, one persistent player, uninterrupted navigation, pause/resume and looping.`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

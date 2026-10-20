// Mobile simulation with CPU throttling; this is not a real-device FPS guarantee.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const baseline = process.argv.includes('--baseline');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      reducedMotion: 'no-preference'
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
      window.frameSamples = [];
      window.drawnFrames = 0;
      window.collectFrames = false;
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (window.collectFrames && ['bouquetCanvas', 'flowers'].includes(this.canvas.id)) window.drawnFrames++;
        return clear.apply(this, args);
      };
      const original = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => original.call(window, timestamp => {
        const begin = performance.now();
        callback(timestamp);
        if (window.collectFrames && ['renderBouquetScene', 'draw'].includes(callback.name)) {
          window.frameSamples.push(performance.now() - begin);
        }
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    async function measure(view, label, milliseconds = 1800) {
      await view.evaluate(() => { window.frameSamples = []; window.drawnFrames = 0; window.collectFrames = true; });
      await page.waitForTimeout(milliseconds);
      const values = await view.evaluate(() => { window.collectFrames = false; return window.frameSamples; });
      const drawnFrames = await view.evaluate(() => window.drawnFrames);
      const sorted = values.slice().sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      console.log(JSON.stringify({ label, callbacks: values.length, drawnFrames, renderFps: +(drawnFrames * 1000 / milliseconds).toFixed(1), workMs: Math.round(sum),
        averageMs: +(sum / Math.max(1, values.length)).toFixed(2),
        p95Ms: +(sorted[Math.floor(sorted.length * .95)] || 0).toFixed(2) }));
      return values;
    }

    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    let view = page.frame('flowerView');
    await view.locator('#openCard').waitFor({ state: 'visible' });
    await page.waitForTimeout(1200);
    await measure(view, 'bouquet-visible');
    const pixels = await view.locator('#bouquetCanvas').evaluate(c => ({ width: c.width, cssWidth: c.clientWidth }));
    console.log(JSON.stringify({ label: 'bouquet-resolution', ...pixels }));
    if (!baseline) assert.ok(pixels.width / pixels.cssWidth <= 1.51, 'mobile canvas resolution is capped');

    await view.locator('#cardMessage').evaluate(message => {
      message.textContent = 'Chuc em luon binh an va vui ve.\n'.repeat(30);
    });
    await view.locator('#openCard').click();
    await view.locator('#greetingCard').waitFor({ state: 'visible' });
    await view.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    assert.equal(await view.locator('#bouquetStageWrapper').evaluate(e => e.getBoundingClientRect().bottom < 0), true, 'benchmark moves the bouquet fully offscreen');
    const offscreen = await measure(view, 'bouquet-offscreen', 700);
    if (!baseline) assert.equal(offscreen.length, 0, 'offscreen flowers stop requesting frames');
    await view.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    if (!baseline) assert.ok((await measure(view, 'bouquet-returned', 500)).length > 0, 'flowers resume on return');

    await page.goto(pathToFileURL(path.resolve(__dirname, '../garden.html')).href);
    view = page.frame('flowerView');
    await view.locator('#bloom').click();
    await view.locator('#wishCard').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(200);
    const covered = await measure(view, 'garden-covered-by-card', 700);
    if (!baseline) assert.equal(covered.length, 0, 'flowers pause behind the modal card');
    await view.locator('#viewGarden').click();
    await measure(view, 'garden-visible');
    const gardenPixels = await view.locator('#flowers').evaluate(c => ({ width: c.width, cssWidth: c.clientWidth }));
    console.log(JSON.stringify({ label: 'garden-resolution', ...gardenPixels }));
    if (!baseline) assert.ok(gardenPixels.width / gardenPixels.cssWidth <= 1.51);
    await page.setViewportSize({ width: 844, height: 390 });
    await view.locator('#replay').click();
    await view.locator('#bloom').click();
    await view.locator('#wishCard').waitFor({ state: 'visible', timeout: 15000 });
    assert.deepEqual(errors, []);
    console.log('PASS: bloom/replay, rotation and canvas rendering without page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

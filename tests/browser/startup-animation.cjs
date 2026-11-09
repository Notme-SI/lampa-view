const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const boot = require('node:path').join(__dirname, '../../dist/lampa-minimal.boot.js');

async function check(browser, reducedMotion) {
  const page = await browser.newPage({ reducedMotion });
  try {
    await page.setContent('<style>.welcome {position:fixed;inset:0}</style><div class="welcome"></div>');
    await page.addScriptTag({ path: boot });
    await page.waitForFunction(() => document.getAnimations().length === 1, undefined, { timeout: 3000 });
    const values = await page.evaluate(() => {
      const animation = document.getAnimations()[0];
      animation.pause();
      const welcome = document.querySelector('.welcome');
      return [0, 1000, 2000].map(time => {
        animation.currentTime = time;
        const bar = getComputedStyle(welcome, '::after');
        return {
          width: Math.round(new DOMMatrix(bar.transform).a * parseFloat(bar.width)),
          opacity: Number(bar.opacity),
          color: bar.backgroundColor
        };
      });
    });
    const reduced = reducedMotion === 'reduce';
    assert.deepEqual(values.map(value => value.width), reduced ? [65, 65, 65] : [35, 100, 35]);
    assert.deepEqual(values.map(value => value.opacity), reduced ? [.6, 1, .6] : [.35, 1, .35]);
    assert.equal(values[0].color, 'rgb(216, 195, 154)');
    console.log(browser.browserType().name(), reducedMotion, 'startup animation passed');
  } finally {
    await page.close();
  }
}

(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      await check(browser, 'no-preference');
      await check(browser, 'reduce');
    } finally {
      await browser.close();
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

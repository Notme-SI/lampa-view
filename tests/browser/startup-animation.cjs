const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const boot = require('node:path').join(__dirname, '../../dist/lampa-minimal.boot.js');

async function check(browser, reducedMotion) {
  const page = await browser.newPage({ reducedMotion });
  try {
    await page.setContent('<style>.welcome {position:fixed;inset:0}</style><div class="welcome"></div>');
    await page.addScriptTag({ path: boot });
    await page.waitForFunction(() => document.getAnimations().length === 1, undefined, { timeout: 3000 });
    await page.waitForFunction(() => {
      const animation = document.getAnimations()[0];
      return animation.playState === 'running' && animation.currentTime > 150;
    }, undefined, { timeout: 3000 });
    const { duration, values } = await page.evaluate(() => {
      const animation = document.getAnimations()[0];
      animation.pause();
      const welcome = document.querySelector('.welcome');
      const duration = animation.effect.getTiming().duration;
      return { duration, values: [0, .25, .5, .75, 1].map(fraction => {
        animation.currentTime = duration * fraction;
        const bar = getComputedStyle(welcome, '::after');
        return {
          width: Math.round(new DOMMatrix(bar.transform).a * parseFloat(bar.width)),
          opacity: Number(bar.opacity),
          origin: bar.transformOrigin.split(' ').slice(0, 2).map(parseFloat),
          color: bar.backgroundColor
        };
      }) };
    });
    const reduced = reducedMotion === 'reduce';
    assert.equal(duration, 2000);
    assert.deepEqual([values[0].width, values[2].width, values[4].width], reduced ? [65, 100, 65] : [35, 100, 35]);
    assert.ok(values[1].width > values[0].width && values[1].width < values[2].width, 'The bar smoothly expands');
    assert.ok(values[3].width < values[2].width && values[3].width > values[4].width, 'The bar smoothly contracts');
    assert.deepEqual([values[0].opacity, values[2].opacity, values[4].opacity], reduced ? [.6, 1, .6] : [.35, 1, .35]);
    // WebKit may serialize fractional layout coordinates just below 50px.
    for (const value of values) {
      assert.ok(Math.abs(value.origin[0] - 50) < .05 && Math.abs(value.origin[1] - 1.5) < .05, 'Scale around the center of the bar');
    }
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

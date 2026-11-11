const assert = require('node:assert/strict');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup} = require('../fixtures/native-browser.cjs');

async function check(browser, theme) {
  const {page, context, errors} = await setup(browser, {
    mode: 'desktop',
    viewport: {width: 1440, height: 900}
  }, {
    beforePlugin: page => page.evaluate(() => {
      Lampa.Params.init();
      Lampa.Layer.init();
      Lampa.Search.init();
      Lampa.DeviceInput.init();
      Lampa.Controller.observe();
      Lampa.Keypad.init();
      Lampa.Keypad.enable();
      Navigator.follow('focus', event => Lampa.Controller.focus(event.elem));
    })
  });
  try {
    await page.evaluate(theme => {
      Lampa.Storage.set('lampa_view_theme', theme);
      window.lampa_settings.plugins_store = false;
      const fixtures = group => Array.from({length: 16}, (_, i) => ({
        url: 'https://qa.example.invalid/' + group + '-' + i + '.js',
        name: 'Test extension ' + group + '-' + i,
        status: 0
      }));
      Lampa.Account.Api.plugins = ok => ok(fixtures('account'));
      Lampa.Plugins.get = () => fixtures('local');
      Lampa.Extensions.show();
    }, theme);
    const rows = page.locator('.extensions__block .scroll--horizontal');
    const row = rows.first();
    await row.locator('.extensions__item').first().waitFor();
    assert.equal(await rows.count(), 2);
    const position = rail => rail.evaluate(n => n.Scroll.position());
    const box = await row.boundingBox();
    const x = box.x + box.width * .72;
    const y = box.y + 55;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 360, y, {steps: 8});
    await page.mouse.up();
    assert.ok(await position(row) < -200, 'Mouse drag pans the native extension row');
    assert.equal(await position(rows.nth(1)), 0, 'The neighboring row stays still');
    assert.equal(await page.locator('.selectbox--open').count(), 0, 'Drag never activates the extension');
    assert.equal(await page.locator('.pt-row-dragging').count(), 0);

    // A real click on a visible extension must still open its native actions.
    await page.mouse.click(x, y);
    await page.locator('.selectbox--open').waitFor({timeout: 3000});
    assert.equal(await page.locator('.selectbox--open').count(), 1);
    await page.evaluate(() => Lampa.Select.hide());
    await page.setViewportSize({width: 1100, height: 720});
    const resized = await row.boundingBox();
    await page.mouse.move(resized.x + resized.width * .3, resized.y + 55);
    const before = await position(row);
    await page.mouse.down();
    await page.mouse.move(resized.x + resized.width * .65, resized.y + 55, {steps: 8});
    await page.mouse.up();
    assert.ok(await position(row) > before, 'Drag still works after resizing');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const theme of ['minimal', 'glass']) {
        await check(browser, theme);
        console.log(engine.name(), theme, 'extension drag, click and resize passed');
      }
    } finally {
      await browser.close();
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { setup } = require('../fixtures/native-browser.cjs');
const fixture = path.join(__dirname, '../fixtures/lampa-runtime/current-menu');

async function verify(browser, theme) {
  const { page, context, errors } = await setup(browser, {
    mode: 'tv', viewport: { width: 960, height: 540 },
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Android TV) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'
  }, {
    app: path.join(fixture, 'app.js.gz'), css: path.join(fixture, 'app.css.gz'),
    beforePlugin: page => page.evaluate(() => {
      const L = Lampa;
      for (const name of ['Platform', 'Params', 'Layer', 'DeviceInput']) L[name].init();
      L.Menu.ready(); L.Controller.observe(); L.Keypad.init(); L.Keypad.enable();
      Navigator.follow('focus', event => L.Controller.focus(event.elem));
      const watched_at = Date.now() - 86400000;
      const history = [0, 1].map(i => ({
        id: 901 + i, title: i ? 'Сериал проверки' : 'Фильм проверки', original_title: 'Test ' + i,
        ...(i ? { name: 'Сериал проверки', first_air_date: '2025-01-01' } : {}),
        seasons: i ? [{ season_number: 1, episode_count: 3 }] : [],
        media_type: i ? 'tv' : 'movie', source: 'tmdb', poster_path: '/test.jpg',
        watch_history: { card_id: 100 + i, watched_at, views: 1, last: i ? { season: 1, episode: 1 } : null, episodes: [] }
      }));
      L.Account.Api.watchHistory = (_, ok) => ok({ results: history, page: 1, total_pages: 1 });
      L.Account.Api.watchHistoryCard = (id, ok) => setTimeout(() => ok([{ watched_at,
        season: id === 101 ? 1 : null, episode: id === 101 ? 1 : null }]), 80);
    })
  });
  try {
    await page.evaluate(theme => {
      Lampa.Storage.set('lampa_view_theme', theme);
      Lampa.Activity.push({ component: 'watch_history', page: 1, title: 'История просмотров' });
    }, theme);
    await page.locator('.activity--active .card__history').first().waitFor();
    const action = page.locator('.selectbox .watch-history-days__continue.focus');
    const cards = page.locator('.activity--active .mapping--grid>.card');
    await cards.first().evaluate(node => Lampa.Controller.collectionFocus(node, node.closest('.activity--active')));
    await page.keyboard.press('Enter');
    await action.waitFor();
    assert.equal((await action.textContent()).trim(), 'Открыть');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => !Lampa.Select.opened() && document.querySelector('.activity--active .mapping--grid>.card')?.classList.contains('focus'));
    await page.keyboard.press('Enter');
    await action.waitFor();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => Lampa.Activity.active()?.component === 'full');
    assert.equal(await page.evaluate(() => Lampa.Activity.active().id), 901);
    await page.evaluate(() => Lampa.Activity.backward());
    await cards.nth(1).evaluate(node => Lampa.Controller.collectionFocus(node, node.closest('.activity--active')));
    await page.keyboard.press('Enter');
    await action.waitFor();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => Lampa.Activity.active()?.component === 'full');
    assert.equal(await page.evaluate(() => Lampa.Activity.active().id), 902);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const theme of ['minimal', 'glass']) await verify(browser, theme);
      console.log(engine.name() + ': remote OK opens film and series; Back restores history selection');
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

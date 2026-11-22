const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { setup } = require('../fixtures/native-browser.cjs');
const fixture = path.join(__dirname, '../fixtures/lampa-runtime/current-menu');

async function geometry(page) {
  return page.locator('.activity--active .mapping--grid').evaluate(grid => {
    const box = node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    };
    return {
      grid: box(grid),
      cards: [...grid.querySelectorAll(':scope>.card')].map(card => ({
        card: box(card), view: box(card.querySelector('.card__view')),
        title: box(card.querySelector('.card__title')), history: box(card.querySelector('.card__history')),
        date: box(card.querySelector('.card__history-date')), episode: box(card.querySelector('.card__history-episode')),
        text: card.querySelector('.card__history').textContent
      }))
    };
  });
}

function check(data, label) {
  assert.equal(data.cards.length, 24, label);
  for (const row of data.cards) {
    assert.ok(row.card.left >= data.grid.left - 1 && row.card.right <= data.grid.right + 1, label + ' card fits in grid');
    for (const name of ['view', 'title', 'history']) {
      assert.ok(row[name].left >= row.card.left - 1 && row[name].right <= row.card.right + 1, label + ' ' + name + ' stays in its card');
    }
    assert.ok(row.history.top >= row.view.bottom - 1 && row.title.top >= row.history.bottom - 1, label + ' metadata follows artwork');
    assert.ok(row.date.right <= row.episode.left + 1 || row.date.bottom <= row.episode.top + 1, label + ' date and episode do not overlap');
  }
  for (let i = 1; i < data.cards.length; i++) {
    const a = data.cards[i - 1].card, b = data.cards[i].card;
    assert.ok(a.right <= b.left + 1 || a.bottom <= b.top + 1, label + ' adjacent cards do not overlap');
  }
  assert.match(data.cards[0].text, /S01 E05/);
  assert.match(data.cards[1].text, /×2/);
}

(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const mode of ['desktop', 'tv', 'mobile']) {
        const viewport = mode === 'mobile' ? { width: 393, height: 852 } : mode === 'tv' ? { width: 960, height: 540 } : { width: 1713, height: 1148 };
        let native;
        const r = await setup(browser, { mode, viewport }, {
          app: path.join(fixture, 'app.js.gz'), css: path.join(fixture, 'app.css.gz'), plugin: process.env.LAMPA_QA_PLUGIN,
          beforePlugin: async page => {
            await page.evaluate(() => {
              const L = Lampa;
              for (const name of ['Platform', 'Params', 'Layer', 'DeviceInput']) L[name].init();
              L.Menu.ready(); L.Controller.observe(); L.Keypad.init(); L.Keypad.enable();
              Navigator.follow('focus', e => L.Controller.focus(e.elem));
              window.qaHistory = Array.from({ length: 24 }, (_, i) => ({
                id: 8000 + i, title: i === 6 ? 'Изгнанный читер-чародей наслаждается беззаботной второй жизнью' : 'Карточка ' + i,
                original_title: 'History ' + i,
                ...(i % 3 ? {} : { name: 'Сериал ' + i, original_name: 'History ' + i }),
                media_type: i % 3 ? 'movie' : 'tv', source: 'tmdb', poster_path: '/poster.jpg', release_date: '2026-01-01',
                watch_history: { card_id: i, watched_at: new Date(2026, 10, 22 - i).getTime(), views: i % 3 ? 2 : 1,
                  last: i % 3 ? null : { season: i + 1, episode: 5 }, episodes: [] }
              }));
              window.qaHistoryRequests = [];
              L.Account.Api.watchHistory = (p, ok) => {
                qaHistoryRequests.push({ ...p });
                ok({ results: qaHistory.map(card => ({ ...card })), page: 1, total_pages: 1, total: 24 });
              };
              L.Activity.push({ component: 'watch_history', page: 1, title: 'История просмотров' });
            });
            await page.waitForSelector('.activity--active .card__history');
            native = await geometry(page);
            check(native, engine.name() + ' native ' + mode);
          }
        });
        try {
          await r.page.evaluate(() => Lampa.Activity.push({ component: 'watch_history', page: 1, title: 'История просмотров' }));
          await r.page.waitForSelector('.activity--active .card__history');
          for (const width of mode === 'desktop' ? [1713, 1000, 1920] : [viewport.width]) {
            await r.page.setViewportSize({ ...viewport, width });
            for (const [theme, size] of [['minimal', 'normal'], ['glass', 'bigger']]) {
              await r.page.evaluate(({ theme, size }) => {
                Lampa.Storage.set('lampa_view_theme', theme); Lampa.Storage.set('interface_size', size);
              }, { theme, size });
              await r.page.waitForTimeout(1600);
              const data = await geometry(r.page);
              check(data, `${engine.name()} ${mode} ${width} ${theme} ${size}`);
              assert.deepEqual(data.cards.map(card => card.text), native.cards.map(card => card.text), 'Native dates, last episode and repeat counts stay intact');
            }
          }
          assert.ok(await r.page.evaluate(() => qaHistoryRequests.every(request => request.group === 'card')));
          assert.deepEqual(r.errors, []);
          console.log(engine.name() + ' ' + mode + ': native history data, poster spacing and metadata bounds PASS');
        } finally { await r.context.close(); }
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

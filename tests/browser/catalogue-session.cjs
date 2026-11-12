const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { setup } = require('../fixtures/native-browser.cjs');
const discoveryResponse = require('../fixtures/discovery-response.cjs');

async function run() {
  const browser = await chromium.launch({headless: true});
  try {
    const {page, errors} = await setup(browser, {mode: 'desktop', viewport: {width: 1440, height: 800}}, {
      plugin: process.env.CATALOGUE_TEST_PLUGIN,
      beforePlugin: page => page.evaluate(() => {
        const img = (path, size) => 'http://lampa.example.invalid/image/t/p/' + (size || 'w780') + path;
        for (const api of [Lampa.Api, Lampa.TMDB, Lampa.Api.sources.tmdb]) api.img = img;
      }),
    });
    const active = page.locator('.activity--active .pt-browser-catalogue');
    await page.route('**/image/t/p/**', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#263446"/></svg>',
    }));
    const prefetched = process.env.CATALOGUE_TEST_PLUGIN ? null :
      page.waitForRequest(request => /\/w500\/catalogue-2-0\.jpg$/.test(request.url()), {timeout: 6000});
    await page.evaluate(fixture => {
      const L = Lampa;
      for (const name of ['Params', 'Layer', 'DeviceInput']) L[name].init();
      L.Controller.observe();
      L.Keypad.init();
      L.Keypad.enable();
      Navigator.follow('focus', event => L.Controller.focus(event.elem));
      const respond = eval('(' + fixture + ')');
      L.Api.sources.tmdb.get = (path, params, ok) => {
        const rows = respond(path, params.page);
        const results = rows.results.map((card, index) => ({...card, poster_path: '/catalogue-' + params.page + '-' + index + '.jpg'}));
        setTimeout(() => ok({...rows, results, total_pages: 30}), 15);
      };
      window.openCatalogue = (url, title) => L.Activity.push({
        component: url.startsWith('discover/') ? 'category_full' : 'category',
        url, source: 'tmdb', page: 1, title,
      });
      openCatalogue('movie', 'Фильмы');
    }, discoveryResponse.toString());
    await active.locator('.card').first().waitFor();
    if (prefetched) {
      await prefetched;
      assert.equal(await active.locator('.card').count(), 20, 'The next page poster starts loading before those cards mount');
    }
    await page.waitForTimeout(1100);

    for (let next = 40; next <= 260; next += 20) {
      await active.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await page.waitForFunction(count => {
        return document.querySelector('.activity--active .pt-browser-catalogue .mapping--grid').children.length >= count;
      }, next, {timeout: 6000});
    }

    const result = await active.evaluate(async node => {
      const original = Element.prototype.getBoundingClientRect;
      const movie = Lampa.Activity.active().activity.component;
      const initial = node.scrollTop;
      const cards = movie.body.children.length;
      const reads = [];
      let frameReads = 0;
      Element.prototype.getBoundingClientRect = function () {
        if (this.matches('.card') && movie.body.contains(this)) frameReads++;
        return original.call(this);
      };
      try {
        for (let frame = 0; frame < 12; frame++) {
          frameReads = 0;
          node.scrollTop -= 210;
          await new Promise(done => setTimeout(done, 38));
          reads.push(frameReads);
        }
      } finally {
        Element.prototype.getBoundingClientRect = original;
      }
      return {cards, reads, initial, offset: node.scrollTop};
    });
    console.log(JSON.stringify(result));
    if (process.env.CATALOGUE_TEST_PLUGIN) return;
    assert.ok(Math.max(...result.reads) < result.cards / 2, 'Each scroll step measures nearby cards only');
    const lateUpdates = await active.evaluate(async node => {
      const cards = [...node.querySelectorAll('.mapping--grid > .card')];
      const range = node.getBoundingClientRect();
      const start = cards.findIndex(card => card.getBoundingClientRect().top >= range.top);
      const row = cards[start].getBoundingClientRect().top;
      const following = cards.findIndex((card, i) => i > start && card.getBoundingClientRect().top > row + 1);
      const anchor = cards[following], before = anchor.getBoundingClientRect().top, offset = node.scrollTop;
      for (const card of cards.slice(start, following)) {
        card.querySelector('.card__title').textContent = 'Длинное название после загрузки информации о фильме, которое занимает две строки';
        card.querySelector('.card__age').textContent = '2026';
        const badge = document.createElement('span');
        badge.className = 'pt-quality';badge.textContent = '1080p';
        card.querySelector('.card__view').append(badge);
      }
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      return {positionChange: node.scrollTop - offset, rowChange: anchor.getBoundingClientRect().top - before};
    });
    assert.deepEqual(lateUpdates, {positionChange: 0, rowChange: 0}, 'Late captions and badges do not shift the next row');

    await page.evaluate(() => {
      const component = Lampa.Activity.active().activity.component;
      window.previousGrid = component.scroll.render(true);
      window.oldScrollCalls = 0;
      previousGrid.addEventListener('minimal:viewport-scroll', () => oldScrollCalls++);
      openCatalogue('tv', 'Сериалы');
    });
    await active.locator('.card').first().waitFor();
    await page.evaluate(() => openCatalogue('discover/tv?with_genres=16&with_original_language=ja', 'Аниме'));
    await active.locator('.card').first().waitFor();
    await page.waitForTimeout(1100);
    await active.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.waitForFunction(() => document.querySelector('.activity--active .pt-browser-catalogue .mapping--grid').children.length >= 40);
    await page.waitForFunction(() => {
      const card = document.querySelector('.activity--active .card');
      return card?.querySelector('.pt-kind')?.textContent === 'Аниме' && !!card.querySelector('.card__vote');
    });
    const score = active.locator('.card').first().locator('.card__vote');
    assert.match((await score.textContent()).trim(), /^8/);
    assert.equal(await score.getAttribute('data-rating-source'), 'TMDB', 'Anime retains its score source attribution');
    assert.equal(await page.evaluate(() => oldScrollCalls), 0, 'An inactive movie catalogue does no scroll work');
    await page.evaluate(() => Lampa.Activity.backward());
    await active.locator('.card').first().waitFor();
    await page.evaluate(() => Lampa.Activity.backward());
    await page.waitForFunction(() => document.querySelector('.activity--active .pt-browser-catalogue') === previousGrid);
    assert.equal(await active.evaluate(node => node.scrollTop), result.offset);
    assert.deepEqual(errors, []);
    console.log('Movies → TV → anime → back preserves deep position and suspends old grid work');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

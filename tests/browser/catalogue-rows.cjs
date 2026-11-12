const assert = require('node:assert/strict');
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {setup} = require('../fixtures/native-browser.cjs');

(async () => {
 for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({headless: true});
  try {
   for (const mode of ['desktop', 'tv', 'mobile']) {
    const {page, context, errors} = await setup(browser, {mode, viewport: {width: mode === 'mobile' ? 390 : 1440, height: 620}}, {
     beforePlugin: page => page.evaluate(() => {
      const image = (path, size) => 'http://lampa.example.invalid/image/t/p/' + (size || 'w780') + path;
      for (const api of [Lampa.TMDB, Lampa.Api, Lampa.Api.sources.tmdb]) api.img = image;
      Lampa.Api.main = (object, ok) => {setTimeout(() => ok(window.testRows), 20);};
     }),
    });
    try {
     await page.route('**/image/t/p/**', async route => {
      await new Promise(done => setTimeout(done, 90));
      await route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#365756"/></svg>'});
     });
     await page.evaluate(() => {
      const L = Lampa;
      for (const name of ['Params', 'Layer', 'DeviceInput']) L[name].init();
      L.Controller.observe(); L.Keypad.init(); L.Keypad.enable();
      Navigator.follow('focus', event => L.Controller.focus(event.elem));
      L.Storage.set('lampa_view_hero', false);
      window.testRows = Array.from({length: 8}, (_, row) => ({
       title: row === 7 ? 'Ожидаемые' : 'Аниме ' + (row + 1),
       url: 'test/' + row, source: 'tmdb', minimal_catalogue_fallback: true, total_pages: 2,
       results: Array.from({length: 20}, (_, index) => ({
        id: row * 100 + index + 1, name: 'Название аниме ' + index, title: 'Название аниме ' + index,
        media_type: 'tv', original_language: 'ja', genre_ids: [16], minimal_anime: true,
        first_air_date: '2025-01-01', poster_path: '/row-' + row + '-' + index + '.jpg',
        vote_average: 8, quality: '1080p', source: 'tmdb', overview: 'Описание аниме', backdrop_path: '/back.jpg',
       })),
      }));
      L.Api.category = (object, ok) => {setTimeout(() => ok(testRows), 20);};
      L.Activity.push({component: 'category', url: 'anime', source: 'tmdb', page: 1, title: 'Аниме'});
     });
     const scroll = page.locator('.activity--active .pt-browser-rows');
     await scroll.waitFor();
     await page.waitForTimeout(1200);
     assert.equal(await page.locator('.activity--active .minimal-catalogue-source').count(), 0);
     await page.waitForFunction(()=>[...document.querySelectorAll('.activity--active .items-line')].some(row=>row.getBoundingClientRect().top>innerHeight+80));
     await page.waitForFunction(()=>{
      const row=[...document.querySelectorAll('.activity--active .items-line')].find(row=>row.getBoundingClientRect().top>innerHeight+80);
      if(!row)return false;
      const cards=[...row.querySelectorAll('.card')].filter(card=>{const rect=card.getBoundingClientRect();return rect.left<innerWidth && rect.right>0;});
      return cards.length>0 && cards.every(card=>{
       const image=card.querySelector('.card__img');
       return image?.complete && image.naturalWidth>1 && card.querySelector('.pt-kind') && card.querySelector('.pt-quality');
      });
     },null,{timeout:5000});
     const ahead = await scroll.evaluate(root => {
      const row = [...root.querySelectorAll('.items-line')].find(row => row.getBoundingClientRect().top > innerHeight + 80);
      const card = row?.querySelector('.card'), image = card?.querySelector('.card__img');
      return {top: row?.getBoundingClientRect().top, image: image?.complete && image?.naturalWidth > 1,
       kind: card?.querySelector('.pt-kind')?.textContent, quality: card?.querySelector('.pt-quality')?.textContent};
     });
     assert.ok(ahead.top > page.viewportSize().height, JSON.stringify(ahead));
     assert.equal(ahead.image, true, 'The next offscreen row has already decoded its first cover');
     assert.equal(ahead.kind, 'Аниме'); assert.equal(ahead.quality, '1080p');
     const rating=scroll.locator('.card__vote').first();
     assert.match((await rating.textContent()).trim(), /^8/);
     assert.equal(await rating.getAttribute('data-rating-source'),'TMDB','The rating attribution is retained');
     assert.ok(Math.abs(await scroll.evaluate(root => root.getBoundingClientRect().top)) <= 2, 'The catalogue viewport starts above the floating header');
     await scroll.evaluate(root => {root.scrollTop = 270;});
     await page.waitForTimeout(200);
     const position = await scroll.evaluate(root => root.scrollTop);
     await page.evaluate(() => {Lampa.Activity.active().activity.component.resize();Lampa.Controller.toggle('content');});
     await page.waitForTimeout(100);
     assert.equal(await scroll.evaluate(root => root.scrollTop), position);
     if (mode !== 'mobile') {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      assert.equal(await scroll.locator('.card.focus').count(), 1, 'Remote navigation still selects a card');
     }
     const before = await scroll.evaluate(root => root.scrollTop);
     await page.evaluate(() => {
      for(const row of testRows)row.results.push({id:99999,title:'Untranslated',overview:'Русское описание',poster_path:'/foreign.jpg'});
      Lampa.Storage.set('lampa_view_hero',true);
      Lampa.Activity.push({component: 'main', source: 'tmdb'});
     });
     await page.locator('.activity--active .pt-browser-rows').waitFor();
     await page.waitForSelector('.activity--active .pt-hero');
     assert.ok((await page.locator('.activity--active .card__title').allTextContents()).every(title=>/[а-яё]/i.test(title)), 'Home also excludes untranslated titles');
     if(mode==='desktop'){
      await page.locator('.activity--active .pt-browser-rows').evaluate(root=>{root.scrollTop=700;});
      await page.waitForTimeout(150);
      if(engine.name()==='chromium')await page.screenshot({path:'work/catalogue-134-header.png'});
     }
     await page.evaluate(() => Lampa.Activity.backward());
     await scroll.waitFor(); await page.waitForTimeout(180);
     assert.equal(await scroll.evaluate(root => root.scrollTop), before);
     assert.deepEqual(errors, []);
     console.log(engine.name(), mode, 'offscreen row artwork and badges, shared header viewport, remote and return passed');
    } finally {await context.close();}
   }
  } finally {await browser.close();}
 }
})().catch(error => {console.error(error);process.exitCode = 1;});

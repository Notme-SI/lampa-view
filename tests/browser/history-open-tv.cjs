const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { setup } = require('../fixtures/native-browser.cjs');
const fixture = path.join(__dirname, '../fixtures/lampa-runtime/current-menu');

async function verify(browser, theme, mode) {
  const mobile = mode === 'mobile', tv = mode === 'tv';
  const { page, context, errors } = await setup(browser, {
    mode, viewport: mobile ? { width: 390, height: 844 } : { width: tv?960:1280, height: tv?540:800 }, hasTouch: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1'
      : tv ? 'Mozilla/5.0 (Linux; Android 12; Android TV) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' : undefined
  }, {
    app: path.join(fixture, 'app.js.gz'), css: path.join(fixture, 'app.css.gz'),
    beforePlugin: page => page.evaluate(() => {
      const L = Lampa;
      for (const name of ['Platform', 'Params', 'Layer', 'DeviceInput']) L[name].init();
      L.Menu.ready(); L.Controller.observe(); L.Keypad.init(); L.Keypad.enable();
      Navigator.follow('focus', event => L.Controller.focus(event.elem));
      const watched_at = Date.now() - 86400000;
      const history = [0, 1].map(i => ({
        id: 901 + i, title: i ? 'Сериал с длинным названием для проверки окна истории' : 'Фильм проверки', original_title: 'Test ' + i,
        ...(i ? { name: 'Сериал с длинным названием для проверки окна истории', original_name: 'Test Series', first_air_date: '2025-01-01' } : {}),
        seasons: i ? [{ season_number: 1, episode_count: 3 }] : [],
        media_type: i ? 'tv' : 'movie', source: 'tmdb', poster_path: '/test.jpg',
        watch_history: { card_id: 100 + i, watched_at, views: 1, last: i ? { season: 1, episode: 1 } : null,
          episodes: i ? [{ season: 1, episode: 1, watched_at }] : [] }
      }));
      window.testNetwork = (url, ok) => ok(url.includes('/idsview?') ? { results: [{
        id: 902, seasons: [{ season_number: 1, episode_count: 3, air_date: '2025-01-01' }]
      }] } : { results: [] });
      L.Account.Api.watchHistory = (_, ok) => ok({ results: history, page: 1, total_pages: 1 });
      window.qaCardCalls = [];
      L.Account.Api.watchHistoryCard = (id, ok) => {
        qaCardCalls.push(id);
        setTimeout(() => ok([{ watched_at, season: id === 101 ? 1 : null, episode: id === 101 ? 1 : null }]), 80);
      };
      window.qaHistoryMovie = history[0];
    })
  });
  try {
    await page.evaluate(theme => {
      Lampa.Storage.set('lampa_view_theme', theme);
      Lampa.Activity.push({ component: 'watch_history', page: 1, title: 'История просмотров' });
    }, theme);
    await page.locator('.activity--active .card__history').first().waitFor();
    const action = page.locator('.selectbox .pt-history-open');
    const journal = page.locator('.selectbox .pt-history-journal-link');
    const title = page.locator('.selectbox .selectbox__title');
    const cards = page.locator('.activity--active .mapping--grid>.card');
    async function pointer(locator) {
      // Native Lampa rejects clicks immediately after the previous selection.
      await page.waitForTimeout(250);
      if (!mobile) return locator.click();
      if (browser.browserType().name()!=='webkit') return locator.tap();
      await locator.scrollIntoViewIfNeeded();
      // WebKit exposes CSS coordinates in the page's zoomed viewport.
      const point=await locator.evaluate(node=>{
        const rect=node.getBoundingClientRect();
        return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:innerWidth};
      });
      const scale=page.viewportSize().width/point.width;
      await page.touchscreen.tap(point.x*scale,point.y*scale);
    }
    async function open(index) {
      const card = cards.nth(index);
      if (!tv) await pointer(card.locator('.card__view'));
      else {
        await card.evaluate(node => Lampa.Controller.collectionFocus(node, node.closest('.activity--active')));
        await page.keyboard.press('Enter');
        await page.locator('.pt-history-open.focus').waitFor();
      }
      await action.waitFor({timeout:6000});
    }
    async function back() {
      if (!tv) await pointer(page.locator('.selectbox .minimal-back--overlay'));
      else await page.keyboard.press('ArrowLeft');
    }
    await open(0);
    assert.equal((await action.textContent()).trim(), 'Открыть карточку');
    assert.equal(await title.textContent(), 'Фильм проверки');
    assert.equal(await page.locator('.watch-history-days__day').count(), 0);
    await back();
    await page.waitForFunction(() => !Lampa.Select.opened());
    if (tv) assert.ok(await cards.first().evaluate(node => node.classList.contains('focus')));
    await page.evaluate(tv => {
      const L=Lampa,hash=L.Utils.hash('release/specific/path/Film.m2ts');
      if(!tv){
        L.Timeline.update({hash,card:'movie_901',time:2850,duration:5700,percent:50,updated:Date.now(),received:true});
        return;
      }
      L.Storage.set('developer_nopremium',false);
      const sent=[];
      L.Socket.listener.follow('send',event=>{if(event.method==='timeline')sent.push(event.data.params);});
      window.AndroidJS={appVersion:()=> 'test-999',openPlayer(){}};
      const movie={...qaHistoryMovie,source:'cub',original_title:'A different catalogue title'};
      const video={card:movie,timeline:L.Timeline.view(hash),torrent_hash:'d'.repeat(40),url:'http://torrent.example.invalid/stream?index=1&play'};
      L.Player.listener.send('create',{data:video});
      L.Android.openPlayer(video.url,video);
      L.Android.timeCall({hash,time:2850,duration:5700,percent:50});
      if(sent.length!==1 || sent[0].card!=='movie_901' || sent[0].time!==2850)throw new Error('CUB did not get the movie link with the torrent checkpoint');
    },tv);
    await open(0);
    assert.equal(await action.locator('.selectbox-item__subtitle').textContent(), '50% · 47:30 из 1:35:00');
    if (!tv) await pointer(action);
    else await page.keyboard.press('Enter');
    await page.waitForFunction(() => Lampa.Activity.active()?.component === 'full');
    assert.equal(await page.evaluate(() => Lampa.Activity.active().id), 901);
    await page.evaluate(() => Lampa.Activity.backward());
    await page.waitForFunction(() => Lampa.Activity.active()?.component === 'watch_history' && Lampa.Controller.enabled()?.name === 'content');
    await open(1);
    assert.equal(await title.textContent(), 'Сериал с длинным названием для проверки окна истории');
    assert.ok(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1),'The full title fits in the panel');
    assert.match(await page.locator('.pt-history-last').textContent(), /1 сезон, 1 серия/);
    assert.equal(await action.locator('.selectbox-item__subtitle').textContent(), 'Далее · 1 сезон · 2 серия');
    assert.equal(await page.locator('.watch-history-days__day,.watch-history-days__seasons,.watch-history-days__bar').count(), 0);
    if (!tv) await pointer(journal);
    else {
      await page.keyboard.press('ArrowDown');
      await page.locator('.pt-history-journal-link.focus').waitFor();
      await page.keyboard.press('Enter');
    }
    await page.locator('.watch-history-days__day').waitFor();
    assert.equal(await title.textContent(),'История по дням');
    assert.equal(await page.locator('.watch-history-days__episodes').textContent(), '1 сезон · 1 серия');
    await back();
    await action.waitFor();
    if (!tv) await pointer(action);
    else {
      await page.locator('.pt-history-journal-link.focus').waitFor();
      await page.keyboard.press('ArrowUp');
      await page.locator('.pt-history-open.focus').waitFor();
      await page.keyboard.press('Enter');
    }
    await page.waitForFunction(() => Lampa.Activity.active()?.component === 'full');
    assert.equal(await page.evaluate(() => Lampa.Activity.active().id), 902);
    assert.deepEqual(errors, []);
  } catch(error) {
    console.error(mode, theme, errors, await page.evaluate(()=>({
      opened:Lampa.Select.opened(), controller:Lampa.Controller.enabled()?.name, activity:Lampa.Activity.active()?.component,
      requests:qaCardCalls, title:document.querySelector('.selectbox__title')?.textContent
    })));
    throw error;
  } finally { await context.close(); }
}

(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const theme of ['minimal', 'glass']) for (const mode of ['tv','desktop','mobile']) {
        await verify(browser, theme, mode);
        console.log(engine.name(), theme, mode, ': compact history and journal work and restore focus');
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

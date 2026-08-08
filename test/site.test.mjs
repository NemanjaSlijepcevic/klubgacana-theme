import { JSDOM } from 'jsdom';
import fs from 'fs';

const SRC = new URL('../assets/js/site.js', import.meta.url);
const html = `<!doctype html><html lang="sr-Cyrl"><head><title>Т</title></head><body>
  <h1 id="h">Његош и ЊЕГОШ</h1>
  <p id="p">Клуб Гацка чува реч.</p>
  <pre id="pre">Његош</pre>
  <code id="code">Његош</code>
  <p id="url">https://klubgacana.com/Његош</p>
  <p id="mail">pero@klubgacana.com</p>
  <p id="opt" data-noscript-convert>Његош</p>
  <span id="nested"><b data-noscript-convert>Његош</b></span>
  <input id="inp" value="Његош" placeholder="Претрага">
  <img id="img" alt="Гацко" src="x.png">
  <button data-kg-script-toggle id="sbtn">Ћир/Lat</button>
  <button data-kg-theme-toggle id="tbtn">☾</button>
  <div id="late"></div>
</body></html>`;

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://klubgacana.com/', pretendToBeVisual: true });
const { window } = dom;
window.eval(fs.readFileSync(SRC, 'utf8'));

const $ = id => window.document.getElementById(id);
let fails = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}\n        got:  ${JSON.stringify(got)}${ok?'':`\n        want: ${JSON.stringify(want)}`}`);
};

console.log('--- initial state (Cyrillic) ---');
check('html lang', window.document.documentElement.getAttribute('lang'), 'sr-Cyrl');
check('heading untouched', $('h').textContent, 'Његош и ЊЕГОШ');

console.log('\n--- switch to Latin ---');
window.KG.setScript('lat');
check('heading', $('h').textContent, 'Njegoš i NJEGOŠ');
check('paragraph', $('p').textContent, 'Klub Gacka čuva reč.');
check('<pre> skipped', $('pre').textContent, 'Његош');
check('<code> skipped', $('code').textContent, 'Његош');
check('URL skipped', $('url').textContent, 'https://klubgacana.com/Његош');
check('email skipped', $('mail').textContent, 'pero@klubgacana.com');
check('opt-out skipped', $('opt').textContent, 'Његош');
check('nested opt-out skipped', $('nested').textContent, 'Његош');
check('input VALUE untouched', $('inp').value, 'Његош');
check('placeholder converted', $('inp').getAttribute('placeholder'), 'Pretraga');
check('img alt converted', $('img').getAttribute('alt'), 'Gacko');
check('html lang', window.document.documentElement.getAttribute('lang'), 'sr-Latn');
check('toggle aria-pressed', $('sbtn').getAttribute('aria-pressed'), 'true');

console.log('\n--- switch back to Cyrillic (must be lossless) ---');
window.KG.setScript('cyr');
check('heading restored', $('h').textContent, 'Његош и ЊЕГОШ');
check('paragraph restored', $('p').textContent, 'Клуб Гацка чува реч.');
check('placeholder restored', $('inp').getAttribute('placeholder'), 'Претрага');
check('html lang', window.document.documentElement.getAttribute('lang'), 'sr-Cyrl');

console.log('\n--- theme ---');
window.KG.setTheme('dark');
check('data-theme', window.document.documentElement.getAttribute('data-theme'), 'dark');
check('theme toggle aria', $('tbtn').getAttribute('aria-pressed'), 'true');
check('persisted', window.localStorage.getItem('kg-theme'), 'dark');

console.log('\n--- round trip 3x (no drift) ---');
for (let i=0;i<3;i++){ window.KG.setScript('lat'); window.KG.setScript('cyr'); }
check('after 3 round trips', $('h').textContent, 'Његош и ЊЕГОШ');

console.log(fails ? `\n${fails} FAILURES` : '\nall runtime checks pass');
process.exit(fails ? 1 : 0);

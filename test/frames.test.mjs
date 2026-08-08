/* The embedded apps are a separate origin with their own localStorage, so they
 * only learn the visitor's choice from a postMessage. Broadcasting once at
 * startup races the iframes' loading; these cover the retry on load. */
import { JSDOM } from 'jsdom';
import fs from 'fs';

const SRC = new URL('../assets/js/site.js', import.meta.url);
const dom = new JSDOM(
  `<!doctype html><html><body>
     <iframe id="f" src="https://books.example.com/book/"></iframe>
     <button data-kg-theme-toggle></button>
   </body></html>`,
  { runScripts: 'outside-only', url: 'https://klubgacana.com/', pretendToBeVisual: true });
const { window } = dom;

// record every postMessage the page makes into the frame
const sent = [];
const frame = window.document.getElementById('f');
Object.defineProperty(frame, 'contentWindow', {
  value: { postMessage: (msg, origin) => sent.push({ msg, origin }) }, configurable: true
});

window.eval(fs.readFileSync(SRC, 'utf8'));
await new Promise(r => setTimeout(r, 50));

let bad = 0;
const ck = (l, c, x = '') => { if (!c) { bad++; console.log('FAIL  ' + l + x); } else console.log('ok    ' + l + x); };

ck('startup broadcast happened', sent.length >= 1);
ck('posted to the frame\'s real origin, never "*"',
   sent.every(s => s.origin === 'https://books.example.com'),
   `  (${sent.map(s => s.origin).join(', ')})`);

const before = sent.length;
frame.dispatchEvent(new window.Event('load'));
ck('re-posts when the frame finishes loading', sent.length === before + 1);

const n = sent.length;
window.KG.setTheme('dark');
ck('toggling pushes into the frame', sent.length > n);
ck('payload carries theme and script',
   sent.at(-1).msg.type === 'kg-prefs' && sent.at(-1).msg.theme === 'dark'
   && !!sent.at(-1).msg.script);

console.log(bad ? `\n${bad} FAILURES` : '\nframe sync checks pass');
process.exit(bad ? 1 : 0);

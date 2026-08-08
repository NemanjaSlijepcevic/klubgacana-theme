import { JSDOM } from 'jsdom';
import fs from 'fs';
const SRC=new URL('../assets/js/site.js', import.meta.url);
const dom=new JSDOM(`<!doctype html><html><body><table><tbody id="tb"></tbody></table></body></html>`,
  {runScripts:'outside-only',url:'https://klubgacana.com/',pretendToBeVisual:true});
const {window}=dom;
window.eval(fs.readFileSync(SRC,'utf8'));
let fails=0;
const check=(l,g,w)=>{const ok=g===w;if(!ok)fails++;console.log(`${ok?'ok  ':'FAIL'}  ${l}  ${JSON.stringify(g)}${ok?'':' want '+JSON.stringify(w)}`);};

window.KG.setScript('lat');
// simulate the Django apps re-rendering rows from a fetch response
window.document.getElementById('tb').innerHTML =
  '<tr><td>Дучић, Нићифор</td><td>Црквене старине</td></tr>';

setTimeout(()=>{
  console.log('--- content injected AFTER switching to Latin ---');
  check('new row transliterated', window.document.getElementById('tb').textContent,
        'Dučić, NićiforCrkvene starine');

  // and when in Cyrillic mode, injected content must be left alone
  window.KG.setScript('cyr');
  window.document.getElementById('tb').innerHTML='<tr><td>Његош</td></tr>';
  setTimeout(()=>{
    check('cyr mode leaves new content alone', window.document.getElementById('tb').textContent,'Његош');
    console.log(fails?`\n${fails} FAILURES`:'\nobserver checks pass');
    process.exit(fails?1:0);
  },30);
},30);

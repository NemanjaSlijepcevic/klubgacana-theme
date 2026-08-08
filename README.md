# klubgacana.com — Ghost theme

The Ghost CMS theme for **klubgacana.com**, the site of a Belgrade club dedicated to
**Gacko**, a town and municipality in Herzegovina, Republika Srpska. The club exists to
keep the region's culture, traditions, language and memory alive, so the site is written
in **Serbian Cyrillic** and the theme treats that as a constraint rather than an
afterthought.

Built on Ghost's [Headline](https://github.com/TryGhost/Headline) theme. See
[Copyright & License](#copyright--license).

## Design

Heritage editorial. The organising device is the **incised line**, taken from the relief
carving on the *stećci* around Gacko: content is divided by rules, not boxed into cards
floating on shadows.

The palette is taken from the **Gacko coat of arms** rather than invented — heraldic blue
`#324c8f`, heraldic red `#ca362c`, brass `#aa974c` — over a cool limestone ground.
Everything is a CSS custom property in `assets/css/tokens.css`; a dark palette is a
redefinition of the same names, never a second stylesheet.

## Serbian Cyrillic

**Cyrillic is the source of truth.** Content and interface strings are authored and stored
in Cyrillic. Latin exists only as a generated, display-time view.

### Fonts

`assets/fonts/` holds four variable faces — **Lora** (serif: display and body) and
**Source Sans 3** (sans: navigation, metadata, data), each roman and italic, 294 KB total.

They are subset from the **upstream binaries in the `google/fonts` repository**, not from
the Google Fonts CSS API. This is not incidental: the API's served files **strip the
`cyrl/SRB` language system**, which is what drives the Serbian localized italic forms of
**б г д п т**. A font fetched from the API renders Russian shapes for those letters.

`<html lang="sr-Cyrl">` in `default.hbs` is what lets the browser apply the feature.

To regenerate a face:

```bash
curl -L -o Lora.ttf \
  'https://github.com/google/fonts/raw/main/ofl/lora/Lora%5Bwght%5D.ttf'

pyftsubset Lora.ttf --output-file=assets/fonts/Lora.woff2 --flavor=woff2 \
  --unicodes='<latin>,<latin-ext>,<cyrillic>' \
  --layout-features='ccmp,locl,mark,mkmk,kern,liga,clig,calt,rlig,rvrn,dnom,frac,numr,tnum,onum'
```

`latin-ext` is **required**, not optional — it carries `đ ž ć č š` for the Latin view.

Verify a rebuilt subset still carries the feature before committing it:

```python
from fontTools.ttLib import TTFont
f = TTFont('assets/fonts/Lora.woff2')
{r.FeatureTag for r in f['GSUB'].table.FeatureList.FeatureRecord}   # must contain 'locl'
```

### Ћир / Lat toggle

`assets/js/site.js` transliterates Cyrillic to Latin at display time. It is the **canonical
copy**; the `bibliography` and `kaleidoscope` Django apps carry it verbatim so all three
properties behave identically. Keep them in sync.

It only ever runs Cyrillic → Latin. The reverse is not safe automatically: the digraphs
`lj`, `nj`, `dž` are ambiguous (`надживети` → `nadživeti`), so reversing needs an exception
dictionary. Original text is cached per node, making the round trip exact rather than a
lossy re-conversion.

Server output stays Cyrillic so crawlers and social previews index the real script. URLs,
emails, `<pre>`/`<code>`, form values and anything marked `data-noscript-convert` are
skipped. Capital digraphs follow the next letter: `Његош` → `Njegoš`, `ЊЕГОШ` → `NJEGOŠ`.

```bash
npm run test:js      # transliteration + observer tests (jsdom)
```

## Built assets

**`assets/built/` is committed, and must never be hand-edited.**

It is committed because deployment is a manual zip upload — the built CSS and JS are what
actually ship, so a clone that cannot be zipped without a full `npm ci` first is a trap.

It must never be hand-edited because that is exactly what went wrong before. `assets/built/screen.css`
had accumulated ~150 lines that existed nowhere in source: the entire main-menu stylesheet,
the card treatment, and the embedded-Bibliography table rules. The next `gulp build` would
have silently deleted all of it. Those rules now live in `assets/css/nav.css`,
`assets/css/embed.css` and `assets/css/screen.css` where the build can see them.

If the build output ever changes without a matching source change, that is drift — find it.

## Development

Requires [Node](https://nodejs.org/) 18+.

```bash
npm ci          # install (the lockfile is authoritative)
npm run dev     # build + watch
npm run build   # one-off build
npm test        # gscan — Ghost theme compatibility
npm run test:js # site runtime tests
npm run zip     # package to dist/headline.zip
```

Edit `assets/css/*.css` and `assets/js/*.js` — never `assets/built/`.

The stylesheet import order in `assets/css/screen.css` **is** the cascade. `tokens.css` must
come after the vendor sheet: re-pointing the vendor's nine `--color-*` variables at the
semantic tokens is what makes ~42 KB of vendor CSS follow dark mode without forking a single
vendor rule. `theme.css` comes last.

`site.js` is built to its own `assets/built/site.min.js` rather than concatenated into
`main.min.js`, and `default.hbs` loads it first. Concatenation puts every script in one
failure domain — a top-level throw in vendor code would take the dark-mode and Ћир/Lat
toggles down with it — and `gulp.src` does not reliably preserve array order across a glob,
so "ours first" could not be guaranteed inside a single bundle.

## Deployment

There is no automation. `update/roles/ghost` in the `ansible_scripts` repository runs the
stock `ghost:alpine` image and knows nothing about this theme.

```bash
npm run zip
```

Then upload `dist/headline.zip` in Ghost admin → Design → Change theme. The theme lives in
a named Docker volume, so re-running the Ansible role will not disturb it.

Bind-mounting this directory into the container is the intended future path.

## Copyright & License

Built on [Headline](https://github.com/TryGhost/Headline), copyright (c) 2013-2022 Ghost
Foundation, released under the [MIT license](LICENSE). Customisations for Klub Gacka are
released under the same licence. The Gacko coat of arms in `assets/images/` is the
municipality's emblem and is not covered by it.

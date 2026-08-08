(function (window, document) {
    'use strict';

    var STORE_THEME = 'kg-theme';
    var STORE_SCRIPT = 'kg-script';
    var MSG = 'kg-prefs';

    /* --- storage helpers: private mode / disabled cookies must not throw -- */
    function read(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }
    function write(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }

    /* =====================================================================
     * Transliteration
     * ================================================================== */

    var MAP = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'đ', 'е': 'e',
        'ж': 'ž', 'з': 'z', 'и': 'i', 'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj',
        'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's',
        'т': 't', 'ћ': 'ć', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'č',
        'џ': 'dž', 'ш': 'š'
    };

    /* Capital digraphs carry two forms. Which one depends on the NEXT letter:
     * Његош -> Njegoš (title case) but ЊЕГОШ -> NJEGOŠ (all caps). */
    var DIGRAPH = { 'Љ': ['Lj', 'LJ'], 'Њ': ['Nj', 'NJ'], 'Џ': ['Dž', 'DŽ'] };

    var UPPER = {};
    Object.keys(MAP).forEach(function (lower) {
        var upper = lower.toUpperCase();
        if (!DIGRAPH[upper]) {
            UPPER[upper] = MAP[lower].charAt(0).toUpperCase() + MAP[lower].slice(1);
        }
    });

    var CYRILLIC = /[Ѐ-ӿ]/;

    function isUpperCyrillic(ch) {
        return !!ch && ch !== ch.toLowerCase() && CYRILLIC.test(ch);
    }

    function toLatin(text) {
        var out = '';
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (DIGRAPH[ch]) {
                out += DIGRAPH[ch][isUpperCyrillic(text[i + 1]) ? 1 : 0];
            } else if (MAP[ch] !== undefined) {
                out += MAP[ch];
            } else if (UPPER[ch] !== undefined) {
                out += UPPER[ch];
            } else {
                out += ch;
            }
        }
        return out;
    }

    /* --- what never gets transliterated ---------------------------------- */
    var SKIP_TAGS = {
        SCRIPT: 1, STYLE: 1, PRE: 1, CODE: 1, KBD: 1, SAMP: 1, VAR: 1,
        TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, NOSCRIPT: 1
    };
    var URLISH = /^(https?:\/\/|\/\/|www\.|mailto:|tel:|[^\s@]+@[^\s@]+\.)/i;

    function skipped(node) {
        for (var p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
            if (SKIP_TAGS[p.tagName]) { return true; }
            if (p.hasAttribute('data-noscript-convert')) { return true; }
        }
        return false;
    }

    /* Original Cyrillic is cached per text node so switching back is exact
     * rather than a lossy reverse transliteration. */
    var ORIGINAL = (typeof WeakMap === 'function') ? new WeakMap() : null;

    function textNodes(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue || !node.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (skipped(node)) { return NodeFilter.FILTER_REJECT; }
                if (URLISH.test(node.nodeValue.trim())) { return NodeFilter.FILTER_REJECT; }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var list = [];
        var n;
        while ((n = walker.nextNode())) { list.push(n); }
        return list;
    }

    function applyScriptTo(root, mode) {
        if (!ORIGINAL) { return; }
        textNodes(root).forEach(function (node) {
            if (!ORIGINAL.has(node)) { ORIGINAL.set(node, node.nodeValue); }
            var source = ORIGINAL.get(node);
            node.nodeValue = (mode === 'lat') ? toLatin(source) : source;
        });
    }

    /* Attributes a reader actually sees. Kept deliberately short — this must
     * never touch a form value on its way to the server. */
    var TEXT_ATTRS = ['title', 'alt', 'placeholder', 'aria-label'];

    function applyAttrsTo(root, mode) {
        if (!ORIGINAL) { return; }
        TEXT_ATTRS.forEach(function (attr) {
            var nodes = root.querySelectorAll('[' + attr + ']');
            Array.prototype.forEach.call(nodes, function (el) {
                if (el.closest('[data-noscript-convert]')) { return; }
                var key = '__kg_' + attr;
                if (el[key] === undefined) { el[key] = el.getAttribute(attr); }
                el.setAttribute(attr, mode === 'lat' ? toLatin(el[key]) : el[key]);
            });
        });
    }

    /* =====================================================================
     * State
     * ================================================================== */

    var root = document.documentElement;

    function currentTheme() {
        var explicit = root.getAttribute('data-theme');
        if (explicit === 'dark' || explicit === 'light') { return explicit; }
        return window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function currentScript() {
        return root.getAttribute('data-script') === 'lat' ? 'lat' : 'cyr';
    }

    function reflectToggles() {
        var theme = currentTheme();
        var script = currentScript();
        Array.prototype.forEach.call(
            document.querySelectorAll('[data-kg-theme-toggle]'),
            function (el) { el.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'); }
        );
        Array.prototype.forEach.call(
            document.querySelectorAll('[data-kg-script-toggle]'),
            function (el) { el.setAttribute('aria-pressed', script === 'lat' ? 'true' : 'false'); }
        );
    }

    function setTheme(theme, opts) {
        root.setAttribute('data-theme', theme);
        /* Bootstrap keys some of its own component internals off this attribute
         * rather than off a variable — the form-select caret is a data-URI SVG
         * that switches on it. The Django apps need the two kept in step or a
         * toggle flips the palette but leaves those stragglers behind. Harmless
         * where there is no Bootstrap. */
        root.setAttribute('data-bs-theme', theme);
        write(STORE_THEME, theme);
        reflectToggles();
        if (!opts || !opts.silent) { broadcast(); }
    }

    var observer = null;

    function setScript(mode, opts) {
        /* Pause the observer: rewriting text nodes would otherwise re-trigger it. */
        if (observer) { observer.disconnect(); }

        applyScriptTo(document.body, mode);
        applyAttrsTo(document.body, mode);

        root.setAttribute('data-script', mode);
        root.setAttribute('lang', mode === 'lat' ? 'sr-Latn' : 'sr-Cyrl');
        write(STORE_SCRIPT, mode);
        reflectToggles();

        if (observer) { observe(); }
        if (!opts || !opts.silent) { broadcast(); }
    }

    /* Content injected after load (the Django apps re-render their table and
     * gallery from fetch responses) still has to follow the current setting. */
    function observe() {
        if (!window.MutationObserver || !document.body) { return; }
        observer = observer || new MutationObserver(function (records) {
            if (currentScript() !== 'lat') { return; }
            var touched = [];
            records.forEach(function (r) {
                Array.prototype.forEach.call(r.addedNodes, function (n) {
                    if (n.nodeType === 1) { touched.push(n); }
                    else if (n.nodeType === 3 && n.parentNode) { touched.push(n.parentNode); }
                });
            });
            if (!touched.length) { return; }
            observer.disconnect();
            touched.forEach(function (el) {
                applyScriptTo(el, 'lat');
                applyAttrsTo(el, 'lat');
            });
            observe();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /* =====================================================================
     * Cross-frame sync
     *
     * Bibliography and Kaleidoscope are embedded as iframes in Ghost pages.
     * The visitor sees one pair of toggles — the ones in the Ghost header —
     * so the parent pushes its preferences down into every frame.
     * ================================================================== */

    function frameOrigin(iframe) {
        try { return new URL(iframe.src, window.location.href).origin; }
        catch (e) { return null; }
    }

    function postTo(frame) {
        var origin = frameOrigin(frame);
        /* Never post to "*" — that would leak preferences to any third party
         * the page happens to embed. */
        if (!origin || !frame.contentWindow) { return; }
        var payload = { type: MSG, theme: currentTheme(), script: currentScript() };
        try { frame.contentWindow.postMessage(payload, origin); } catch (e) { /* ignore */ }
    }

    function broadcast() {
        watchFrames();
        Array.prototype.forEach.call(document.querySelectorAll('iframe'), postTo);
    }

    /* An embedded app is a separate origin, so it has its own localStorage and
     * cannot see the choice made out here — left alone it falls back to the
     * visitor's OS setting, which is how a light page ended up framing a dark
     * one. It only learns the real preference from the message below.
     *
     * Broadcasting once at startup is not enough: at that point the frames have
     * usually not finished loading and a message posted into a blank frame is
     * simply lost. Re-post as each one loads, which is the first moment its
     * listener actually exists. */
    function watchFrames() {
        Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
            if (f.__kgWatched) { return; }
            f.__kgWatched = true;
            f.addEventListener('load', function () { postTo(f); });
            /* Already loaded before this ran (cache, bfcache) — the load event
             * will not fire again, so send now. */
            try {
                if (f.contentDocument && f.contentDocument.readyState === 'complete') {
                    postTo(f);
                }
            } catch (e) { /* cross-origin: the load listener covers it */ }
        });
    }

    function allowedOrigins() {
        var list = window.KG_ALLOWED_ORIGINS;
        return Object.prototype.toString.call(list) === '[object Array]' ? list : [];
    }

    window.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || data.type !== MSG) { return; }
        /* Same-origin is always fine; anything else must be allow-listed. */
        if (event.origin !== window.location.origin &&
            allowedOrigins().indexOf(event.origin) === -1) { return; }
        if (data.theme === 'dark' || data.theme === 'light') {
            setTheme(data.theme, { silent: true });
        }
        if (data.script === 'lat' || data.script === 'cyr') {
            setScript(data.script, { silent: true });
        }
    });

    /* =====================================================================
     * Wiring
     * ================================================================== */

    function start() {
        /* The inline head snippet has already stamped data-theme/data-script,
         * so no paint has happened in the wrong state. This applies the text
         * transformation and syncs the controls. */
        setScript(currentScript(), { silent: true });
        setTheme(currentTheme(), { silent: true });
        observe();
        watchFrames();
        broadcast();

        document.addEventListener('click', function (e) {
            if (!e.target || typeof e.target.closest !== 'function') { return; }
            var themeBtn = e.target.closest('[data-kg-theme-toggle]');
            if (themeBtn) {
                e.preventDefault();
                setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
                return;
            }
            var scriptBtn = e.target.closest('[data-kg-script-toggle]');
            if (scriptBtn) {
                e.preventDefault();
                setScript(currentScript() === 'lat' ? 'cyr' : 'lat');
            }
        });

        /* Follow the OS only while the visitor has not chosen for themselves. */
        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            var onChange = function () {
                if (read(STORE_THEME)) { return; }
                root.removeAttribute('data-theme');
                reflectToggles();
                broadcast();
            };
            if (mq.addEventListener) { mq.addEventListener('change', onChange); }
            else if (mq.addListener) { mq.addListener(onChange); }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    /* Exposed so the Django apps can re-apply after they render fetch results
     * without waiting for the observer, and for tests. */
    window.KG = {
        toLatin: toLatin,
        setTheme: setTheme,
        setScript: setScript,
        currentTheme: currentTheme,
        currentScript: currentScript,
        apply: function (el) {
            applyScriptTo(el || document.body, currentScript());
            applyAttrsTo(el || document.body, currentScript());
        }
    };
}(window, document));

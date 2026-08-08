/* Homepage carousel.
 *
 * Was an inline <script> in partials/carousel.hbs that declared currentSlide,
 * track and slides as globals and ran unconditionally — it threw on every
 * page that does not include the partial. This is scoped, guarded, and a
 * no-op when the markup is absent.
 *
 * Autoplay stops while the visitor is hovering, focused inside, or has the
 * tab in the background, and never starts at all under prefers-reduced-motion.
 */

(function () {
    'use strict';

    var DELAY = 5000;

    function initCarousel(root) {
        var track = root.querySelector('[data-carousel-track]');
        var slides = root.querySelectorAll('.slide');
        var dots = root.querySelectorAll('.dot');
        var prev = root.querySelector('[data-carousel-prev]');
        var next = root.querySelector('[data-carousel-next]');

        if (!track || slides.length < 2) { return; }

        var index = 0;
        var timer = null;
        var reduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function update() {
            track.style.transform = 'translateX(-' + (index * 100) + '%)';
            Array.prototype.forEach.call(dots, function (dot, i) {
                var on = i === index;
                dot.classList.toggle('active', on);
                dot.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }

        function go(to) {
            index = (to + slides.length) % slides.length;
            update();
        }

        function stop() {
            if (timer) { clearInterval(timer); timer = null; }
        }

        function start() {
            if (reduced || timer) { return; }
            timer = setInterval(function () { go(index + 1); }, DELAY);
        }

        function restart() { stop(); start(); }

        if (prev) { prev.addEventListener('click', function () { go(index - 1); restart(); }); }
        if (next) { next.addEventListener('click', function () { go(index + 1); restart(); }); }

        Array.prototype.forEach.call(dots, function (dot, i) {
            dot.addEventListener('click', function () { go(i); restart(); });
        });

        root.addEventListener('mouseenter', stop);
        root.addEventListener('mouseleave', start);
        root.addEventListener('focusin', stop);
        root.addEventListener('focusout', start);

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stop(); } else { start(); }
        });

        update();
        start();
    }

    function boot() {
        Array.prototype.forEach.call(
            document.querySelectorAll('[data-carousel]'), initCarousel
        );
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}());

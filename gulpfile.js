const {series, parallel, watch, src, dest} = require('gulp');
const pump = require('pump');

// gulp plugins and utils
const livereload = require('gulp-livereload');
const postcss = require('gulp-postcss');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const beeper = require('beeper');
const zip = require('gulp-zip');

// postcss plugins
const easyimport = require('postcss-easy-import');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

function serve(done) {
    livereload.listen();
    done();
}

function handleError(done) {
    return function (err) {
        if (err) {
            beeper();
        }
        return done(err);
    };
};

function hbs(done) {
    pump([
        src(['*.hbs', 'partials/**/*.hbs']),
        livereload()
    ], handleError(done));
}

function css(done) {
    pump([
        src('assets/css/screen.css', {sourcemaps: true}),
        postcss([
            easyimport,
            autoprefixer(),
            cssnano()
        ]),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

function js(done) {
    pump([
        src([
            'node_modules/@tryghost/shared-theme-assets/assets/js/v1/lib/**/*.js',
            'node_modules/@tryghost/shared-theme-assets/assets/js/v1/main.js',
            'assets/js/lib/*.js',
            'assets/js/main.js'
        ], {sourcemaps: true}),
        concat('main.min.js'),
        uglify(),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

/* The site runtime is built separately, not concatenated into main.min.js.
 *
 * Two reasons. Concatenation makes every script share one failure domain — a
 * top-level throw in vendor code would take the dark-mode and Ћир/Lat toggles
 * down with it — and gulp.src does not reliably preserve array order across a
 * glob, so "ours first" could not be guaranteed inside a single bundle.
 * default.hbs loads this file before main.min.js, which makes the order
 * explicit and keeps the toggles independent of everything else. */
function siteJs(done) {
    pump([
        src([
            'assets/js/site.js',
            'assets/js/carousel.js'
        ], {sourcemaps: true}),
        concat('site.min.js'),
        uglify(),
        dest('assets/built/', {sourcemaps: '.'}),
        livereload()
    ], handleError(done));
}

function zipper(done) {
    const filename = require('./package.json').name + '.zip';

    pump([
        src([
            '**',
            '!node_modules', '!node_modules/**',
            '!dist', '!dist/**',
            '!test', '!test/**',
            '!yarn-error.log'
        ]),
        zip(filename),
        dest('dist/')
    ], handleError(done));
}

const hbsWatcher = () => watch(['*.hbs', 'partials/**/*.hbs'], hbs);
const cssWatcher = () => watch('assets/css/**/*.css', css);
const jsWatcher = () => watch('assets/js/**/*.js', parallel(js, siteJs));
const watcher = parallel(hbsWatcher, cssWatcher, jsWatcher);
const build = series(css, js, siteJs);

exports.build = build;
exports.zip = series(build, zipper);
exports.default = series(build, serve, watcher);

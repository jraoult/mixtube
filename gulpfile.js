'use strict';

const path = require('path'),
  gulp = require('gulp'),
  gutil = require('gulp-util'),
  plumber = require('gulp-plumber'),
  merge = require('merge-stream'),
  del = require('del'),
  buffer = require('vinyl-buffer'),
  source = require('vinyl-source-stream'),
  watchify = require('watchify'),
  browserify = require('browserify'),
  collapse = require('bundle-collapser/plugin'),
  sourcemaps = require('gulp-sourcemaps'),
  browserSync = require('browser-sync'),
  reload = browserSync.reload,
  compression = require("compression"),
  jshint = require('gulp-jshint'),
  uglify = require('gulp-uglify'),
  ngAnnotate = require('gulp-ng-annotate'),
  sass = require('gulp-sass'),
  postcss = require('gulp-postcss'),
  autoprefixer = require('autoprefixer'),
  csswring = require('csswring'),
  htmlreplace = require('gulp-html-replace'),
  svgSprite = require('gulp-svg-sprite'),
  svg2png = require('gulp-svg2png'),
  favicons = require('favicons').stream,
  template = require('gulp-template'),
  ghPages = require('gulp-gh-pages'),
  minimist = require('minimist'),
  appVersion = require('./package').version,
  appConfig = require('./package').config.application;

const cmdOptions = minimist(process.argv.slice(2), {
  string: 'baseUrl',
  boolean: 'notls',
  default: {
    baseUrl: '/'
  }
});

const options = Object.assign({}, cmdOptions, {
  youtubeApiKey: process.env.MIXTUBE_YOUTUBE_API_KEY
});

function browserifiedSrc(src, baseDir) {
  const b = browserify(src, {cache: {}, packageCache: {}, fullPaths: false, debug: true});
  // convert bundle paths to IDS to save bytes in browserify bundles
  b.plugin(collapse);
  b.on('log', gutil.log);
  return b.bundle()
    .pipe(source(path.relative(baseDir, src)));
}

function watchifiedSrc(src, baseDir, pipelineFn) {
  const b = watchify(browserify(src, {cache: {}, packageCache: {}, fullPaths: true, debug: true}));

  function doBundle() {
    return pipelineFn(
      b.bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source(path.relative(baseDir, src)))
    );
  }

  b.on('log', gutil.log);
  b.on('update', doBundle);

  return doBundle();
}

// do the work on svg assets, just need to be piped out
function doSvg() {
  return gulp.src([
      'node_modules/Ionicons/src/ios-search.svg',
      'node_modules/Ionicons/src/ios-close.svg',
      'node_modules/Ionicons/src/ios-close-empty.svg',
      'node_modules/Ionicons/src/ios-videocam.svg',
      'node_modules/Ionicons/src/load-c.svg',
      'app/images/mt-play-circle.svg',
      'app/images/mt-pause-circle.svg',
      'app/images/mt-logo.svg'
    ])
    .pipe(svgSprite({
      svg: {
        xmlDeclaration: ' ', //work around until svg-sprites handle false value properly
        doctypeDeclaration: ' '
      },
      // make sure the svgo phase is not breaking the SVG (removeUnknownsAndDefaults breaks the logo)
      transform: [{
        svgo: {
          plugins: [{
            removeUnknownsAndDefaults: false
          }]
        }
      }],
      mode: {
        symbol: {
          dest: '.',
          sprite: 'sprite.svg'
        }
      }
    }));
}

function doInlineCss(opts) {
  const postCssFilters = [
    autoprefixer({browsers: ['last 1 version']})
  ];
  if (opts && opts.minify) {
    postCssFilters.push(csswring());
  }

  return gulp.src('app/styles/css/inline.scss')
    .pipe(plumber())
    .pipe(sass())
    .pipe(postcss(postCssFilters));
}

function doHtml() {
  return gulp.src('app/index.html', {base: 'app'})
    .pipe(template({
      baseUrl: options.baseUrl,
      youtubeApiKey: options.youtubeApiKey
    }));
}

function doFavicons(htmlCodeCb) {
  return gulp.src('app/images/mt-logo.svg')
    .pipe(svg2png())
    .pipe(favicons({
      settings: {
        appName: appConfig.name,
        vinylMode: true,
        version: 1,
        background: appConfig.color
      },
      icons: {
        android: true,
        appleIcon: true,
        appleStartup: false,
        coast: false,
        favicons: true,
        firefox: false,
        opengraph: false,
        windows: false,
        yandex: false
      },
      files: {
        iconsPath: './'
      },
      favicon_generation: {
        versioning: {
          param_name: 'v',
          param_value: appVersion
        }
      }
    }, htmlCodeCb));
}

function jsHint() {
  return gulp.src('app/scripts/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
}

function svgDev() {
  return doSvg()
    .pipe(gulp.dest('build/images'));
}

function cssDev() {
  return gulp.src('app/styles/css/main.scss')
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass())
    .pipe(postcss([
      autoprefixer({browsers: ['last 1 version']})
    ]))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('build/styles'))
    .pipe(reload({stream: true}));
}

function jsDev() {
  function pipelineFn(pipeline) {
    return pipeline
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(ngAnnotate())
      .pipe(sourcemaps.write())
      .pipe(gulp.dest('build/scripts'));
  }

  // generates the bundle and watches changes
  return merge(
    watchifiedSrc('./app/scripts/main.js', './app/scripts/', pipelineFn),
    watchifiedSrc('./app/scripts/components/capabilities/videoCallPlayTest.js', './app/scripts/', pipelineFn));
}

function htmlDev() {
  return doHtml()
    .pipe(gulp.dest('build'));
}

function cleanDev() {
  return del('build');
}

function watchDev(done) {
  gulp.watch('app/scripts/**/*.js', jsHint);
  gulp.watch('app/index.html', htmlDev);
  gulp.watch('app/images/*.svg', svgDev);
  gulp.watch('app/styles/**/*.scss', cssDev);

  done();
}

const serve = gulp.series(
  // prepare
  gulp.parallel(cleanDev, jsHint),

  // pre build assets
  gulp.parallel(cssDev, jsDev, svgDev, htmlDev),

  watchDev,

  function serverDev(done) {

    browserSync({
      open: false,
      notify: false,
      server: ['build', 'app'],
      https: !options.notls,
      ghostMode: false
    });

    done();
  });

function svgDist() {
  return doSvg()
    .pipe(gulp.dest('dist/images'));
}

function cssDist() {
  return gulp.src('app/styles/css/main.scss')
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass())
    .pipe(postcss([
      autoprefixer({browsers: ['last 1 version']}),
      csswring
    ]))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('dist/styles'));
}

function jsDist() {
  return merge(
    browserifiedSrc('./app/scripts/main.js', './app/scripts/'),
    browserifiedSrc('./app/scripts/components/capabilities/videoCallPlayTest.js', './app/scripts/'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(ngAnnotate())
    .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('dist/scripts'));
}

function htmlDist() {
  const doHtmlStream = gutil.noop(), doFaviconsStream = gutil.noop();

  const doFaviconsPromise = new Promise(function(resolve) {
    doFavicons(htmlCode => {
      resolve(htmlCode);
    })
      .pipe(gulp.dest('dist'))
      .pipe(doFaviconsStream);
  });

  doFaviconsPromise
    .then(htmlCode => {

      doHtml()
        .pipe(htmlreplace({
          cssInline: {
            src: doInlineCss({minify: true}),
            tpl: '<style>%s</style>'
          },
          favicons: htmlCode
        }))
        .pipe(gulp.dest('dist'))
        .pipe(doHtmlStream);
    });

  return merge(doHtmlStream, doFaviconsStream);
}

function cleanDist() {
  return del('dist');
}

const dist = gulp.series(
  gulp.parallel(cleanDist, jsHint),

  gulp.parallel(jsDist, cssDist, htmlDist, svgDist)
);

const serveDist = gulp.series(
  dist,

  function server() {
    browserSync({
      open: false,
      notify: false,
      server: {
        baseDir: 'dist',
        middleware: compression()
      },
      https: !options.notls,
      ghostMode: false
    });
  });

function pushGhPagesDist() {
  return gulp.src('dist/**/*')
    .pipe(ghPages());
}

const deployGh = gulp.series(
  dist,
  pushGhPagesDist
);

gulp.task('serve', serve);
gulp.task('dist', dist);
gulp.task('serve:dist', serveDist);
gulp.task('deploy:gh', deployGh);
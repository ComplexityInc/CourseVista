// CourseVista demo layout — one component for /demo and every client demo.
//
// Each page supplies window.CV_DEMO (see /demo/configs/) and a <main id="demo">.
// Prices, inclusions and billing notes come from /catalog.js, the same source
// the checkout charges from; package buttons open /start with the package,
// hole count and any known course details already filled in.
//
// Films: a video is only shown once its file is confirmed to exist, so a
// missing asset never renders as a broken player. Each player keeps a
// state-aware overlay (poster or club-logo artwork) over the video whenever it
// isn't playing: before play, when paused (control bar left free for seeking
// and fullscreen) and after it ends.
(function () {
  'use strict';

  var CAT = window.CVCatalog;
  var C = window.CV_DEMO;
  var root = document.getElementById('demo');
  if (!root) return;
  if (!CAT || !C) {
    root.innerHTML = '<div class="d-wrap d-intro"><p class="d-lede">This page couldn’t load. Please refresh, or email <a href="mailto:business@coursevista.com.au">business@coursevista.com.au</a>.</p></div>';
    return;
  }

  var PRIMARY = C.suggestedPackage || 'complete';
  var ALT = C.alternativePackage || 'hosted';
  var STORE = 'cv-demo-' + (C.slug || 'demo');
  var course = C.course || {};
  var fixedHoles = CAT.normaliseHoles(course.holes);

  var state = { holes: fixedHoles || initialHoles(), pkg: PRIMARY, compare: false };
  var saved = readJSON(sessionStorage, STORE);
  if (saved && (saved.pkg === PRIMARY || saved.pkg === ALT)) state.pkg = saved.pkg;

  function readJSON(store, key) {
    try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; }
  }

  // A verified course hole count always wins; otherwise reuse whatever the
  // visitor already chose (URL, this page, the package finder, an order draft).
  function initialHoles() {
    var candidates = [
      new URLSearchParams(location.search).get('holes'),
      (readJSON(sessionStorage, STORE) || {}).holes,
      (readJSON(sessionStorage, 'cv-finder-v1') || {}).holes,
      (readJSON(localStorage, 'cv-order-draft-v1') || {}).holes
    ];
    for (var i = 0; i < candidates.length; i++) {
      var n = CAT.normaliseHoles(candidates[i]);
      if (n) return n;
    }
    return 18;
  }

  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify({ holes: state.holes, pkg: state.pkg })); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var money = CAT.formatAud;
  var name = function (k) { return CAT.PACKAGES[k].name; };

  function startHref(pkg) {
    var p = new URLSearchParams({ package: pkg, holes: String(state.holes) });
    var h = C.handoff || {};
    ['club', 'website', 'city', 'region', 'country'].forEach(function (k) { if (h[k]) p.set(k, h[k]); });
    return '/start?' + p.toString();
  }

  // Short, benefit-led copy; the inclusion lists below come from the catalogue.
  var COPY = {
    essentials: 'Every hole on film, ready for your course pages.',
    complete: 'Every hole on film, plus a cinematic course film for the top of your website.',
    hosted: 'Everything in Complete, plus your own CourseVista course page with hole-by-hole navigation on a dedicated URL.'
  };

  function inclusions(key) {
    var n = state.holes;
    if (key === 'hosted') return ['Everything in Complete'].concat(CAT.adds('hosted', n).filter(function (x) { return x !== 'Initial hosted setup' && x !== 'Mobile-friendly viewing'; }));
    return CAT.features(key, n).slice(0, 4);
  }

  /* ---------- sections ---------- */

  function intro() {
    var i = C.intro || {};
    return '<header class="d-intro"><div class="d-wrap">' +
      (i.eyebrow ? '<p class="d-eyebrow">' + esc(i.eyebrow) + '</p>' : '') +
      '<h1>' + esc(i.heading) + '</h1>' +
      (i.copy ? '<p class="d-lede">' + esc(i.copy) + '</p>' : '') +
      '</div></header>';
  }

  function art(v) {
    // Client demos rest on the club logo; the public demo uses its poster frames.
    if (course.logo) {
      var bg = course.logo.background || '#FFFFFF';
      return '<div class="d-art d-art-logo" style="background:' + esc(bg) + '">' +
        '<img src="' + esc(course.logo.src) + '" alt="' + esc(course.logo.alt || course.name || '') + '" data-logo>' +
        '</div>';
    }
    if (v.poster) return '<img class="d-art d-art-image" src="' + esc(v.poster) + '" alt="" loading="lazy" decoding="async"><div class="d-shade"></div>';
    return '<div class="d-art" style="background:#2C4A3B"></div>';
  }

  function film(v, i) {
    var label = v.label || ('Hole ' + v.hole);
    var who = course.name ? ', ' + course.name : '';
    var sources = (v.sources || []).map(function (s) {
      return '<button type="button" class="d-thumb" data-full="' + esc(s.src) + '" data-cap="' + esc(s.caption) + '" aria-label="Enlarge ' + esc(s.caption) + '">' +
        '<img src="' + esc(s.src) + '" alt="' + esc(s.caption) + '" loading="lazy" decoding="async" width="400" height="300"><span>' + esc(s.caption) + '</span></button>';
    }).join('');
    return '<article class="d-film" data-film="' + i + '">' +
      '<div class="d-player" data-state="checking">' +
      '<video preload="none" playsinline aria-label="' + esc(label + ' flyover' + who) + '"><source src="' + esc(v.src) + '" type="video/mp4"></video>' +
      '<div class="d-overlay" data-overlay>' + art(v) +
      '<span class="d-hole">' + esc(label) + '</span>' +
      '<button type="button" class="d-play" aria-label="Play ' + esc(label) + ' flyover"><span class="d-play-icon" aria-hidden="true"></span><span data-play-text>Play flyover</span><span class="d-play-time" data-play-time></span></button>' +
      '<p class="d-err" role="status"></p>' +
      '</div></div>' +
      '<div class="d-film-meta"><span class="d-film-label">' + esc(label) + '</span>' + (v.detail ? '<span class="d-film-detail">' + esc(v.detail) + '</span>' : '') + '</div>' +
      (sources ? '<details class="d-sources"><summary>What this was built from · <span data-src-count>' + v.sources.length + '</span> images</summary><div class="d-grid">' + sources + '</div></details>' : '') +
      '</article>';
  }

  function films() {
    var list = (C.videos || []).map(film).join('');
    return '<section class="d-films" aria-label="Flyovers"><div class="d-wrap">' +
      (list ? '<div class="d-film-list" data-film-list>' + list + '</div>' : '') +
      '<p class="d-empty" data-empty' + (list ? ' hidden' : '') + '>' + esc(C.emptyFilmsNote || 'Flyovers will appear here when they’re ready.') + '</p>' +
      '</div></section>';
  }

  // Style chooser — an optional section for a preview film that moves through
  // several distinct lighting/photographic treatments. Each entry marks a span
  // of the FIRST film; picking one seeks that film to the span and plays it, so
  // the club can compare the looks against their own course before deciding
  // which is carried across every hole.
  //
  // Presentation only: the choice is not written into the order. Selecting a
  // style updates a mailto link so the club can send their preference back.
  function styles() {
    var s = C.styles;
    if (!s || !(s.items || []).length) return '';
    var cards = s.items.map(function (it, i) {
      return '<article class="d-style" data-style="' + i + '" data-from="' + it.from + '" data-to="' + it.to + '">' +
        '<button type="button" class="d-style-shot" aria-label="Play the ' + esc(it.name) + ' section">' +
        (it.poster ? '<img src="' + esc(it.poster) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async">' : '') +
        '<span class="d-style-play" aria-hidden="true"></span>' +
        '<span class="d-style-time">' + clock(it.from) + '–' + clock(it.to) + '</span>' +
        '</button>' +
        '<p class="d-style-n">Style ' + ('0' + (i + 1)) + '</p>' +
        '<h3 class="d-style-name">' + esc(it.name) + '</h3>' +
        '<p class="d-style-desc">' + esc(it.detail) + '</p>' +
        '<label class="d-style-pick"><input type="radio" name="d-style" value="' + i + '"><span class="d-pick-dot" aria-hidden="true"></span><span>This one for our course</span></label>' +
        '</article>';
    }).join('');
    return '<section class="d-styles" aria-labelledby="d-styles-h"><div class="d-wrap">' +
      '<h2 class="d-styles-h" id="d-styles-h">' + esc(s.heading) + '</h2>' +
      (s.copy ? '<p class="d-styles-copy">' + esc(s.copy) + '</p>' : '') +
      '<div class="d-style-grid">' + cards + '</div>' +
      '<p class="d-styles-foot" data-style-foot hidden></p>' +
      '</div></section>';
  }

  // Recognition band — an optional standing acknowledgement for a course whose
  // work advanced the production method. Renders only when the config supplies
  // `recognition`, so pages without one are unchanged. Recognition only: it
  // never alters prices, which always come from the catalogue.
  function recognition() {
    var r = C.recognition;
    if (!r) return '';
    var body = (r.body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    var points = (r.points || []).map(function (p) {
      return '<li><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></li>';
    }).join('');
    // Optional artefact presented with the recognition — a piece of work given
    // to the course outright. Clicking it opens the same lightbox the source
    // photographs use.
    var g = r.gift;
    var gift = g ? '<figure class="d-recog-gift">' +
      (g.label ? '<figcaption class="d-recog-gift-label">' + esc(g.label) + '</figcaption>' : '') +
      '<button type="button" class="d-recog-gift-img" data-full="' + esc(g.src) + '" data-cap="' + esc(g.caption || g.alt || '') + '" aria-label="Enlarge ' + esc(g.alt || 'artwork') + '">' +
      '<img src="' + esc(g.src) + '" alt="' + esc(g.alt || '') + '" loading="lazy" decoding="async"></button>' +
      (g.caption ? '<p class="d-recog-gift-cap">' + esc(g.caption) + '</p>' : '') +
      '</figure>' : '';

    return '<section class="d-recog" aria-labelledby="d-recog-h"><div class="d-wrap">' +
      '<div class="d-recog-card">' +
      '<p class="d-recog-badge">' + esc(r.badge) + '</p>' +
      '<h2 id="d-recog-h">' + esc(r.heading) + '</h2>' +
      (body ? '<div class="d-recog-body">' + body + '</div>' : '') +
      gift +
      (points ? '<ul class="d-recog-points">' + points + '</ul>' : '') +
      (r.signoff ? '<p class="d-recog-sign">' + esc(r.signoff) + '</p>' : '') +
      '</div></div></section>';
  }

  function pkgPanel(key, primary) {
    return '<article class="d-pkg ' + (primary ? 'd-pkg-primary' : 'd-pkg-alt') + '" data-pkg="' + key + '">' +
      '<p class="d-pkg-kicker" data-kicker="' + key + '"></p>' +
      '<label class="d-pick"><input type="radio" name="d-pkg" value="' + key + '"><span class="d-pick-dot" aria-hidden="true"></span><span class="d-pkg-name">' + esc(name(key)) + '</span></label>' +
      '<div class="d-price"><span class="d-amount" data-price="' + key + '"></span><span class="d-price-meta" data-meta="' + key + '"></span></div>' +
      '<p class="d-pkg-desc">' + esc(COPY[key]) + '</p>' +
      '<ul class="d-incl" data-incl="' + key + '"></ul>' +
      (CAT.PACKAGES[key].note ? '<p class="d-pkg-note">' + esc(CAT.PACKAGES[key].note) + '</p>' : '') +
      '<a class="d-btn ' + (primary ? 'd-btn-primary' : 'd-btn-secondary') + '" data-href="' + key + '">Continue with ' + esc(name(key)) + '<span aria-hidden="true">&#8594;</span></a>' +
      '</article>';
  }

  function holesControl() {
    if (fixedHoles) {
      return '<p class="d-holes-fixed">Priced for ' + esc(course.shortName || course.name || 'your course') + '’s ' + fixedHoles + ' holes · AUD, inc. GST</p>';
    }
    return '<div class="d-holes"><span class="d-holes-label" id="d-holes-label">Holes</span>' +
      '<div class="d-holes-group" role="group" aria-labelledby="d-holes-label">' +
      CAT.HOLE_COUNTS.map(function (n) { return '<button type="button" data-holes="' + n + '" aria-label="' + n + ' holes">' + n + '</button>'; }).join('') +
      '</div></div>';
  }

  function packages() {
    return '<section class="d-buy" id="packages" aria-labelledby="d-buy-h"><div class="d-wrap">' +
      '<div class="d-buy-head"><div><h2 id="d-buy-h">Bring the rest of your course to life.</h2>' +
      '<p>Choose your package and turn every hole into an experience golfers can explore before they arrive.</p></div>' +
      holesControl() + '</div>' +
      '<div class="d-pkgs" role="radiogroup" aria-labelledby="d-buy-h">' + pkgPanel(PRIMARY, true) + pkgPanel(ALT, false) + '</div>' +
      '<div class="d-buy-foot"><span>All prices in AUD and include GST. Reserve with a ' + CAT.DEPOSIT_PERCENT + '% deposit or pay in full.</span>' +
      '<button type="button" class="d-linkbtn" data-compare aria-expanded="false" aria-controls="d-compare">Compare all packages</button></div>' +
      '<div class="d-compare" id="d-compare" hidden data-compare-body></div>' +
      '</div></section>';
  }

  function after() {
    var steps = [
      ['Choose your package', 'Select the package and hole count you want, then reserve it with a ' + CAT.DEPOSIT_PERCENT + '% deposit or pay in full.'],
      ['Share your course material', 'We confirm the photography and references needed to build the remaining flyovers — a link to what you have is plenty.'],
      ['Bring your course online', 'Receive the deliverables in your package as website-ready files, with one revision round included.']
    ];
    return '<section class="d-after" aria-labelledby="d-after-h"><div class="d-wrap">' +
      '<h2 class="d-steps-h" id="d-after-h">From preview to full course</h2>' +
      '<ol class="d-steps">' + steps.map(function (s, i) {
        return '<li><span class="d-step-n">0' + (i + 1) + '</span><b>' + esc(s[0]) + '</b><p>' + esc(s[1]) + '</p></li>';
      }).join('') + '</ol>' +
      (C.production ? '<details class="d-acc"><summary>How the flyovers are made</summary><div class="d-acc-body"><ul>' +
        '<li>Everything is built from photography your club already has — website images, hole maps, existing aerials. Phone photos are fine.</li>' +
        '<li>Each hole becomes one continuous tee-to-green film that follows how the hole actually plays.</li>' +
        '<li>Nothing happens on the course: no site visit, no drone, no closure and no members inconvenienced.</li>' +
        '<li>If your photography isn’t enough to build a hole well, we tell you before production begins.</li>' +
        '</ul></div></details>' : '') +
      '</div></section>';
  }

  function closing() {
    return '<section class="d-close" aria-labelledby="d-close-h"><div class="d-wrap">' +
      '<h2 id="d-close-h">Ready to bring every hole to life?</h2>' +
      '<a class="d-btn d-btn-primary" data-close-cta></a>' +
      '<p class="d-close-alt" data-close-alt></p>' +
      '</div></section>' +
      (C.footnote ? '<p class="d-footnote">' + esc(C.footnote) + '</p>' : '');
  }

  /* ---------- live values ---------- */

  function update() {
    var n = state.holes;
    var diff = CAT.price(ALT, n) - CAT.price(PRIMARY, n);
    [PRIMARY, ALT].forEach(function (k) {
      q('[data-price="' + k + '"]').textContent = money(CAT.price(k, n));
      q('[data-meta="' + k + '"]').textContent = 'AUD, inc. GST · ' + n + ' holes';
      q('[data-incl="' + k + '"]').innerHTML = inclusions(k).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      q('[data-href="' + k + '"]').setAttribute('href', startHref(k));
      var panel = q('.d-pkg[data-pkg="' + k + '"]');
      panel.classList.toggle('is-selected', state.pkg === k);
      panel.querySelector('input').checked = state.pkg === k;
    });
    q('[data-kicker="' + PRIMARY + '"]').textContent = course.name ? 'Suggested for ' + (course.shortName || course.name) : 'Suggested package';
    q('[data-kicker="' + ALT + '"]').textContent = (diff >= 0 ? '+' : '−') + money(Math.abs(diff)) + ' on ' + name(PRIMARY);

    Array.prototype.forEach.call(root.querySelectorAll('[data-holes]'), function (b) {
      b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-holes')) === n));
    });

    var chosen = state.pkg, other = chosen === PRIMARY ? ALT : PRIMARY;
    var cta = q('[data-close-cta]');
    cta.setAttribute('href', startHref(chosen));
    cta.innerHTML = 'Continue with ' + esc(name(chosen)) + '<span aria-hidden="true">&#8594;</span>';
    q('[data-close-alt]').innerHTML = (other === ALT ? 'Want the hosted course page too? ' : 'Prefer the films without hosting? ') +
      '<a href="' + esc(startHref(other)) + '">Continue with ' + esc(name(other)) + '</a> · ' + money(CAT.price(other, n)) + ' for ' + n + ' holes';

    q('[data-compare-body]').innerHTML = CAT.PACKAGE_ORDER.map(function (k) {
      return '<div class="d-cmp-row"><span class="d-cmp-name">' + esc(name(k)) + '<span class="d-cmp-line">' + esc(CAT.PACKAGES[k].tagline) + '</span></span>' +
        '<span class="d-cmp-price">' + money(CAT.price(k, n)) + '</span>' +
        '<a class="d-cmp-go" href="' + esc(startHref(k)) + '">Continue with ' + esc(name(k)) + ' &#8594;</a></div>';
    }).join('');
    save();
  }

  function q(sel) { return root.querySelector(sel); }

  /* ---------- players ---------- */

  var players = [];

  function clock(t) {
    t = Math.max(0, Math.floor(t || 0));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }

  function wirePlayer(el, label) {
    var video = el.querySelector('video');
    var overlay = el.querySelector('[data-overlay]');
    var btn = el.querySelector('.d-play');
    var text = el.querySelector('[data-play-text]');
    var time = el.querySelector('[data-play-time]');
    players.push(video);

    var WORDS = { idle: ['Play flyover', 'Play'], paused: ['Resume', 'Resume'], ended: ['Replay', 'Replay'] };
    function set(s) {
      el.setAttribute('data-state', s);
      if (WORDS[s]) {
        text.textContent = WORDS[s][0];
        btn.setAttribute('aria-label', WORDS[s][1] + ' ' + label + ' flyover');
      }
      time.textContent = s === 'paused' ? 'Paused at ' + clock(video.currentTime) : '';
      if (s === 'error') el.querySelector('.d-err').textContent = 'This flyover couldn’t be loaded. Please refresh to try again.';
    }

    function pauseOthers() {
      players.forEach(function (other) { if (other !== video && !other.paused) other.pause(); });
    }

    // Native controls exist only while a film plays. Paused or ended, the logo
    // covers the full frame, so the control bar (and the frame behind it) is
    // removed too, except in fullscreen, where the overlay can't be seen.
    function fullscreen() {
      var f = document.fullscreenElement || document.webkitFullscreenElement;
      return f === video || f === el || !!video.webkitDisplayingFullscreen;
    }
    function rest() {
      if (!fullscreen()) video.controls = false;
    }

    function start() {
      if (el.getAttribute('data-state') === 'error') return;
      // Playing the film on its own terms cancels any style span limit, so a
      // full watch-through is never cut short at a span boundary.
      clearStyleGuard();
      pauseOthers();
      if (video.ended) video.currentTime = 0;   // Replay; Resume keeps the paused position.
      video.controls = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () { set(video.currentTime ? 'paused' : 'idle'); rest(); });
      video.focus({ preventScroll: true });
    }

    // Dragging the timeline pauses the video while the pointer is down and resumes
    // it on release. That isn't the viewer pausing, so the logo cover only appears
    // once the pointer is up and the video has actually stayed paused.
    var holding = false, pauseTimer = 0;
    function settlePause() {
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(function () {
        if (holding || !video.paused || video.ended || video.seeking) return;
        set('paused');
        rest();
      }, 300);
    }
    function release() {
      if (!holding) return;
      holding = false;
      if (video.paused && !video.ended) settlePause();
    }
    video.addEventListener('pointerdown', function () { holding = true; });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    video.addEventListener('seeked', function () { if (video.paused && !video.ended) settlePause(); });

    overlay.addEventListener('click', start);
    video.addEventListener('play', function () {
      clearTimeout(pauseTimer);
      pauseOthers();
      video.controls = true;
      set('playing');
    });
    video.addEventListener('pause', function () { if (!video.ended) settlePause(); });
    video.addEventListener('ended', function () { set('ended'); rest(); });
    function leftFullscreen() { if (el.getAttribute('data-state') !== 'playing') rest(); }
    document.addEventListener('fullscreenchange', leftFullscreen);
    document.addEventListener('webkitfullscreenchange', leftFullscreen);
    video.addEventListener('webkitendfullscreen', leftFullscreen);
    video.addEventListener('error', function () { set('error'); });
    var source = video.querySelector('source');
    if (source) source.addEventListener('error', function () { set('error'); });
    set('idle');
  }

  // Only real files become players; a missing video is removed rather than
  // shown as a broken player.
  function exists(url) {
    if (!url) return Promise.resolve(false);
    return fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { return r.ok && !/text\/html/i.test(r.headers.get('content-type') || ''); })
      .catch(function () { return false; });
  }

  function initFilms() {
    var items = Array.prototype.slice.call(root.querySelectorAll('[data-film]'));
    return Promise.all(items.map(function (item) {
      var v = C.videos[Number(item.getAttribute('data-film'))];
      return exists(v.src).then(function (ok) {
        if (!ok) {
          console.warn('[demo] video not found, hiding player:', v.src);
          item.remove();
          return;
        }
        wirePlayer(item.querySelector('.d-player'), v.label || ('Hole ' + v.hole));
      });
    })).then(function () {
      if (!root.querySelector('[data-film]')) q('[data-empty]').hidden = false;
    });
  }

  // If the club logo file is missing, fall back to the course name set in type —
  // never another club's artwork. A small logo is never enlarged beyond 2× its
  // own pixels (sharp on high-density screens, not blurred to fill the frame).
  function initLogos() {
    Array.prototype.forEach.call(root.querySelectorAll('img[data-logo]'), function (img) {
      var swap = function () {
        var span = document.createElement('span');
        span.className = 'd-wordmark';
        span.style.color = (course.logo && course.logo.textColor) || '#16170F';
        span.textContent = course.name || '';
        img.replaceWith(span);
      };
      var cap = function () {
        img.style.maxWidth = img.naturalWidth * 2 + 'px';
        img.style.maxHeight = img.naturalHeight * 2 + 'px';
      };
      if (img.complete) { if (img.naturalWidth) cap(); else swap(); }
      else { img.addEventListener('load', cap); img.addEventListener('error', swap); }
    });
  }

  // Source photographs/maps that aren't uploaded yet are dropped, not shown broken.
  function initSources() {
    Array.prototype.forEach.call(root.querySelectorAll('.d-sources'), function (box) {
      Array.prototype.forEach.call(box.querySelectorAll('.d-thumb'), function (thumb) {
        exists(thumb.getAttribute('data-full')).then(function (ok) {
          if (ok) return;
          thumb.remove();
          var left = box.querySelectorAll('.d-thumb').length;
          if (!left) box.remove();
          else box.querySelector('[data-src-count]').textContent = left;
        });
      });
    });
  }

  /* ---------- lightbox (source photographs) ---------- */

  var lb, lbImg, lbCap, lbReturn;
  function openLightbox(src, cap, from) {
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'd-lb';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('aria-label', 'Enlarged source image');
      lb.innerHTML = '<button type="button" aria-label="Close">&times;</button><img alt=""><p></p>';
      document.body.appendChild(lb);
      lbImg = lb.querySelector('img');
      lbCap = lb.querySelector('p');
      lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('button')) closeLightbox(); });
    }
    lbReturn = from;
    lbImg.src = src; lbImg.alt = cap; lbCap.textContent = cap;
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    lb.querySelector('button').focus();
  }
  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    lbImg.src = '';
    document.documentElement.style.overflow = '';
    if (lbReturn) lbReturn.focus();
  }

  /* ---------- boot ---------- */

  root.innerHTML = intro() + films() + styles() + recognition() + packages() + after() + closing();
  update();
  initLogos();
  initFilms();
  initSources();

  root.addEventListener('click', function (e) {
    var h = e.target.closest('[data-holes]');
    if (h) { state.holes = Number(h.getAttribute('data-holes')); update(); return; }
    var cmp = e.target.closest('[data-compare]');
    if (cmp) {
      state.compare = !state.compare;
      q('[data-compare-body]').hidden = !state.compare;
      cmp.setAttribute('aria-expanded', String(state.compare));
      cmp.textContent = state.compare ? 'Hide comparison' : 'Compare all packages';
      return;
    }
    var shot = e.target.closest('.d-style-shot');
    if (shot) { playStyle(shot.closest('[data-style]')); return; }
    var thumb = e.target.closest('[data-full]');
    if (thumb) { openLightbox(thumb.getAttribute('data-full'), thumb.getAttribute('data-cap'), thumb); return; }
    // Clicking a package panel (anywhere but its button) selects it.
    var panel = e.target.closest('.d-pkg');
    if (panel && !e.target.closest('a')) { state.pkg = panel.getAttribute('data-pkg'); update(); }
  });
  root.addEventListener('change', function (e) {
    if (e.target.name === 'd-pkg') { state.pkg = e.target.value; update(); }
    if (e.target.name === 'd-style') { pickStyle(Number(e.target.value)); }
  });

  /* ---------- style chooser ---------- */

  // Seek the first film to a style's span and play it. The span end is honoured
  // with a timeupdate guard that removes itself, so a later full playthrough is
  // never cut short.
  var styleGuard = null;   // the one active span guard, if any

  // Drop any previous span guard before arming a new one. Without this the
  // guards accumulate: picking a style that ends at 0:10 and then one that
  // starts at 0:19 leaves the first guard attached, and it pauses the film the
  // instant the new span begins.
  function clearStyleGuard() {
    if (!styleGuard) return;
    styleGuard.video.removeEventListener('timeupdate', styleGuard.fn);
    styleGuard = null;
  }

  function playStyle(card) {
    var video = players[0];
    if (!card || !video) return;
    var from = Number(card.getAttribute('data-from'));
    var to = Number(card.getAttribute('data-to'));
    players.forEach(function (p) { if (!p.paused) p.pause(); });
    clearStyleGuard();
    function stopAtEnd() {
      if (video.currentTime < to) return;
      video.pause();
      clearStyleGuard();
    }
    styleGuard = { video: video, fn: stopAtEnd };
    video.addEventListener('timeupdate', stopAtEnd);
    video.controls = true;

    // Two ordering hazards here, both seen on a real deployment:
    //   1. The players are preload="none", so before any metadata exists a seek
    //      is silently dropped and playback would start from zero.
    //   2. Calling play() while a seek is still in flight can be dropped, which
    //      leaves the film parked at the span start instead of running.
    // So: wait for metadata, seek, and only start playing once the seek lands.
    function beginPlayback() {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    function go() {
      if (Math.abs(video.currentTime - from) < 0.25) { beginPlayback(); return; }
      video.addEventListener('seeked', beginPlayback, { once: true });
      try { video.currentTime = from; } catch (e) {
        video.removeEventListener('seeked', beginPlayback);
        beginPlayback();
      }
    }
    if (video.readyState >= 1) go();
    else {
      video.addEventListener('loadedmetadata', go, { once: true });
      video.load();
    }

    // Only pull the player into view when it isn't already there. Scrolling on
    // every pick would shunt the style cards off screen, which is exactly when
    // someone is clicking between them to compare the three looks.
    var box = video.closest('.d-player').getBoundingClientRect();
    var visible = box.top >= 0 && box.bottom <= (window.innerHeight || 0);
    if (!visible) video.closest('.d-player').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function pickStyle(i) {
    var items = (C.styles && C.styles.items) || [];
    var chosen = items[i];
    if (!chosen) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-style]'), function (el, n) {
      el.classList.toggle('is-selected', n === i);
    });
    var foot = q('[data-style-foot]');
    if (!foot) return;
    var subject = encodeURIComponent((course.shortName || course.name || 'Our course') + ' — style preference: ' + chosen.name);
    var body = encodeURIComponent('We’d like ' + chosen.name + ' used across the course.');
    foot.hidden = false;
    foot.innerHTML = '<b>' + esc(chosen.name) + '</b> selected. ' +
      '<a href="mailto:business@coursevista.com.au?subject=' + subject + '&body=' + body + '">Send us this preference</a> ' +
      'and we’ll build every hole to match — or just mention it when you order.';
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

  window.CVDemo = { state: state, update: update, startHref: startHref };
})();

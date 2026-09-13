// CourseVista package catalogue — the single source of truth for package
// prices, inclusions and billing constants.
//
// Loaded two ways:
//   • Browser: <script src="/catalog.js"> exposes window.CVCatalog
//   • Server:  require('../catalog') from lib/pricing.js
//
// Every price display, the package finder, the order flow and the Stripe
// charge derive from the PRICES matrix below. Change a price here and nowhere
// else. Prices are whole Australian dollars, GST-inclusive (see GST_MODE),
// and are total package prices for the hole count — not per-hole rates.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CVCatalog = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CURRENCY = 'aud';
  var GST_MODE = 'inclusive';          // displayed prices already include GST
  var GST_RATE = 0.10;
  var DEPOSIT_PERCENT = 50;
  var PROMO_DISCOUNT_PERCENT = 10;     // first-project scratch offer (CV-XXXXXX)

  // The only free trial: exactly one hole, no payment, no package enrolment.
  // Additional holes require a package purchase.
  var FREE_TRIAL = {
    key: 'one_free_hole',
    holes: 1,
    cta: 'Get one hole free',
    offer: 'One free hole flyover of your course.',
    reassurance: 'No payment required.'
  };

  var HOLE_COUNTS = [9, 18, 27, 36];

  var PRICES = {
    essentials: { 9: 1100, 18: 1690, 27: 2290, 36: 2790 },
    complete:   { 9: 1590, 18: 1990, 27: 2690, 36: 3290 },
    hosted:     { 9: 2090, 18: 2590, 27: 3490, 36: 4190 }
  };

  // Customer-facing requirements the package finder asks about. `provides` on
  // each package lists which of these it satisfies.
  var REQUIREMENTS = {
    flyovers: {
      key: 'flyovers',
      label: 'Individual hole flyovers',
      detail: 'A tee-to-green film for every hole, ready for your course pages.'
    },
    homepage: {
      key: 'homepage',
      label: 'A homepage cinematic film',
      detail: 'One cinematic cut of the course for the top of your website and socials.'
    },
    hosted: {
      key: 'hosted',
      label: 'A hosted course experience',
      detail: 'Your own CourseVista course page with hole-by-hole navigation on a dedicated URL.'
    }
  };

  var PACKAGE_ORDER = ['essentials', 'complete', 'hosted'];

  // `adds` is what each package contributes on top of the one before it, so the
  // full inclusion list and "what an upgrade adds" both come from one place.
  var PACKAGES = {
    essentials: {
      key: 'essentials',
      name: 'Essentials',
      tagline: 'Individual hole films for your course.',
      provides: ['flyovers'],
      adds: [
        function (n) { return n + ' individual tee-to-green hole films'; },
        'Approximately 30 seconds per hole',
        'Website-ready delivered files',
        'Commercial usage rights',
        'One revision round'
      ]
    },
    complete: {
      key: 'complete',
      name: 'Complete',
      tagline: 'Every hole, plus a homepage cinematic film.',
      provides: ['flyovers', 'homepage'],
      adds: [
        'Homepage cinematic course film',
        'Consistent CourseVista presentation across the course'
      ]
    },
    hosted: {
      key: 'hosted',
      name: 'Hosted',
      tagline: 'Complete, plus your own hosted course guide.',
      provides: ['flyovers', 'homepage', 'hosted'],
      adds: [
        'Dedicated CourseVista hosted course page',
        'Hole-by-hole navigation',
        'Mobile-friendly viewing',
        'Dedicated course URL',
        'Initial hosted setup'
      ],
      note: 'Hosting renewal may apply after the first year.'
    }
  };

  function normaliseHoles(value) {
    var s = String(value == null ? '' : value).trim();
    if (s === '36+') s = '36';                 // legacy links and saved drafts
    var n = Number(s);
    return HOLE_COUNTS.indexOf(n) !== -1 ? n : null;
  }

  function isPackage(key) { return Object.prototype.hasOwnProperty.call(PACKAGES, key); }

  // Whole AUD. Throws on an unknown package or hole count — callers must never
  // fall back to a guessed price.
  function price(packageKey, holes) {
    if (!isPackage(packageKey)) throw new Error('Unknown package: ' + packageKey);
    var n = normaliseHoles(holes);
    if (n === null) throw new Error('Unsupported hole count: ' + holes);
    return PRICES[packageKey][n];
  }

  function priceCents(packageKey, holes) { return price(packageKey, holes) * 100; }

  function formatAud(dollars) {
    return '$' + Math.round(dollars).toLocaleString('en-AU');
  }

  function formatPrice(packageKey, holes) { return formatAud(price(packageKey, holes)); }

  function resolveLine(item, n) { return typeof item === 'function' ? item(n) : item; }

  // What this package adds over the previous tier, for a given hole count.
  function adds(packageKey, holes) {
    var n = normaliseHoles(holes) || 18;
    return PACKAGES[packageKey].adds.map(function (x) { return resolveLine(x, n); });
  }

  // Full inclusion list, as shown on package cards and order summaries.
  function features(packageKey, holes) {
    var n = normaliseHoles(holes) || 18;
    if (packageKey === 'essentials') return adds('essentials', n);
    if (packageKey === 'complete') {
      var base = adds('essentials', n);
      // Keep the homepage film straight after the hole films, as on the cards.
      return [base[0]].concat(adds('complete', n).slice(0, 1), base.slice(2), adds('complete', n).slice(1));
    }
    return ['Everything in Complete'].concat(adds('hosted', n));
  }

  function provides(packageKey, requirement) {
    return PACKAGES[packageKey].provides.indexOf(requirement) !== -1;
  }

  // Recommendation rules — transparent and deterministic:
  //   1. Only packages that provide every selected requirement qualify.
  //   2. Of those, the lowest price for the selected hole count wins.
  //      Hole count never forces an upgrade on its own.
  //   3. "Not sure yet" sets Complete as the floor (full coverage plus the
  //      homepage film), still honouring any requirement that needs more.
  function recommend(input) {
    input = input || {};
    var holes = normaliseHoles(input.holes);
    if (holes === null) throw new Error('Unsupported hole count: ' + input.holes);

    var needs = [];
    (input.needs || []).forEach(function (k) {
      if (REQUIREMENTS[k] && needs.indexOf(k) === -1) needs.push(k);
    });
    var unsure = !!input.unsure;
    var floor = unsure ? PACKAGE_ORDER.indexOf('complete') : 0;

    var qualifying = PACKAGE_ORDER.filter(function (key, i) {
      return i >= floor && needs.every(function (r) { return provides(key, r); });
    }).sort(function (a, b) { return price(a, holes) - price(b, holes); });

    var key = qualifying[0];
    return {
      packageKey: key,
      packageName: PACKAGES[key].name,
      holes: holes,
      price: price(key, holes),
      needs: needs,
      unsure: unsure,
      basis: unsure && needs.every(function (r) { return provides('essentials', r); }) ? 'unsure' : 'requirements',
      // Requirements the recommended package covers without being asked for.
      alsoIncluded: PACKAGES[key].provides.filter(function (r) { return needs.indexOf(r) === -1; })
    };
  }

  // Package-by-package comparison at one hole count, relative to `baseKey`.
  function compare(holes, baseKey) {
    var n = normaliseHoles(holes);
    var baseIndex = PACKAGE_ORDER.indexOf(baseKey);
    return PACKAGE_ORDER.map(function (key, i) {
      var extra = [];
      var missing = [];
      if (i > baseIndex) {
        for (var j = baseIndex + 1; j <= i; j++) extra = extra.concat(adds(PACKAGE_ORDER[j], n));
      } else if (i < baseIndex) {
        for (var k = i + 1; k <= baseIndex; k++) missing = missing.concat(adds(PACKAGE_ORDER[k], n));
      }
      return {
        packageKey: key,
        name: PACKAGES[key].name,
        tagline: PACKAGES[key].tagline,
        price: price(key, n),
        difference: price(key, n) - price(baseKey, n),
        isBase: key === baseKey,
        adds: extra,
        lacks: missing
      };
    });
  }

  return {
    CURRENCY: CURRENCY,
    GST_MODE: GST_MODE,
    GST_RATE: GST_RATE,
    DEPOSIT_PERCENT: DEPOSIT_PERCENT,
    PROMO_DISCOUNT_PERCENT: PROMO_DISCOUNT_PERCENT,
    FREE_TRIAL: FREE_TRIAL,
    HOLE_COUNTS: HOLE_COUNTS.slice(),
    PACKAGE_ORDER: PACKAGE_ORDER.slice(),
    PACKAGES: PACKAGES,
    REQUIREMENTS: REQUIREMENTS,
    PRICES: PRICES,
    normaliseHoles: normaliseHoles,
    isPackage: isPackage,
    price: price,
    priceCents: priceCents,
    formatAud: formatAud,
    formatPrice: formatPrice,
    adds: adds,
    features: features,
    provides: provides,
    recommend: recommend,
    compare: compare
  };
});

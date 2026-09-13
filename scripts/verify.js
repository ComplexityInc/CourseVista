#!/usr/bin/env node
// CourseVista pricing, recommendation, checkout-amount and offer checks.
//   npm run check
// No dependencies: Stripe and Resend are stubbed, and the page logic from
// index.html and start/index.html is evaluated the same way support.js does.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const EXPECTED = {
  essentials: { 9: 1100, 18: 1690, 27: 2290, 36: 2790 },
  complete:   { 9: 1590, 18: 1990, 27: 2690, 36: 3290 },
  hosted:     { 9: 2090, 18: 2590, 27: 3490, 36: 4190 }
};
const HOLES = [9, 18, 27, 36];
const PKGS = ['essentials', 'complete', 'hosted'];
const aud = (d) => '$' + d.toLocaleString('en-AU');

/* ---------- stubs ---------- */
const stripeCalls = [];
let stripeRetrieve = null;
class FakeStripe {
  constructor() {
    this.customers = { list: async () => ({ data: [] }), create: async () => ({ id: 'cus_test' }) };
    this.paymentIntents = {
      create: async (p) => { stripeCalls.push({ kind: 'payment_intent', params: p }); return { id: 'pi_test', client_secret: 'pi_test_secret_1' }; },
      retrieve: async () => stripeRetrieve
    };
    this.checkout = { sessions: {
      create: async (p) => { stripeCalls.push({ kind: 'checkout', params: p }); return { id: 'cs_test', url: 'https://checkout.stripe.test/cs_test' }; },
      retrieve: async () => stripeRetrieve
    } };
  }
}
const load = Module._load;
Module._load = function (request) {
  if (request === 'stripe') return FakeStripe;
  return load.apply(this, arguments);
};
process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_stub';

const mails = [];
let mailStatus = 200;
global.fetch = async (url, init) => {
  mails.push({ url, payload: JSON.parse(init.body) });
  return { ok: mailStatus < 300, status: mailStatus, json: async () => ({ id: 're_test' }), text: async () => 'rejected' };
};
console.error = () => {};
console.warn = () => {};

function res() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    send(b) { this.body = b; return this; },
    end() { return this; }
  };
}
async function call(handler, body, method = 'POST') {
  const r = res();
  await handler({ method, body, query: {} }, r);
  return r;
}

// Evaluate a page's dc logic the way support.js does and return its Component class.
function pageComponent(file, catalog) {
  const html = read(file);
  const js = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  class DCLogic { constructor(props) { this.props = props || {}; } setState() {} forceUpdate() {} }
  const React = { createRef: () => ({ current: null }) };
  global.window = { CVCatalog: catalog, matchMedia: () => ({ matches: false }) };
  const Component = new Function('DCLogic', 'StreamableLogic', 'React', js + '\n;return Component;')(DCLogic, DCLogic, React);
  return Component;
}

/* ---------- runner ---------- */
const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

(async () => {
  const catalog = require(path.join(ROOT, 'catalog.js'));
  const pricing = require(path.join(ROOT, 'lib/pricing.js'));

  /* 1. Price matrix */
  await check('catalog holds exactly the 12 agreed package/hole prices', () => {
    assert.deepStrictEqual(catalog.PACKAGE_ORDER, PKGS);
    assert.deepStrictEqual(catalog.HOLE_COUNTS, HOLES);
    for (const k of PKGS) for (const n of HOLES) {
      assert.strictEqual(catalog.price(k, n), EXPECTED[k][n], `${k} ${n}`);
      assert.strictEqual(catalog.priceCents(k, n), EXPECTED[k][n] * 100);
    }
  });

  await check('server resolve(): full, deposit and promo amounts for all 12 combinations', () => {
    for (const k of PKGS) for (const n of HOLES) {
      const cents = EXPECTED[k][n] * 100;
      const full = pricing.resolve({ packageKey: k, holes: String(n), paymentType: 'full', promoValid: false });
      assert.strictEqual(full.amountDueNow, cents);
      assert.strictEqual(full.remainingBalance, 0);
      const dep = pricing.resolve({ packageKey: k, holes: n, paymentType: 'deposit', promoValid: false });
      assert.strictEqual(dep.amountDueNow, Math.round(cents * 0.5));
      assert.strictEqual(dep.amountDueNow + dep.remainingBalance, cents);
      const promo = pricing.resolve({ packageKey: k, holes: n, paymentType: 'full', promoValid: true });
      assert.strictEqual(promo.amountDueNow, cents - Math.round(cents * 0.1));
      assert.ok(full.lineLabel.includes(`${n} holes`));
    }
  });

  await check('server rejects hole counts outside the matrix (incl. legacy "36+")', () => {
    for (const bad of ['36+', '10', '0', '', 'abc', '18.5', null]) {
      assert.throws(() => pricing.resolve({ packageKey: 'essentials', holes: bad, paymentType: 'full' }), /hole count/);
    }
    assert.throws(() => pricing.resolve({ packageKey: 'platinum', holes: 18, paymentType: 'full' }), /Unknown package/);
  });

  /* 2. Recommendation rules */
  await check('recommendation: basic flyovers → Essentials at every hole count (9 holes = $1,100)', () => {
    for (const n of HOLES) {
      for (const needs of [[], ['flyovers']]) {
        const r = catalog.recommend({ holes: n, needs });
        assert.strictEqual(r.packageKey, 'essentials');
        assert.strictEqual(r.price, EXPECTED.essentials[n]);
      }
    }
    assert.strictEqual(catalog.recommend({ holes: 9, needs: ['flyovers'] }).price, 1100);
  });

  await check('recommendation: homepage → Complete; hosted (± homepage) → Hosted; unsure → Complete', () => {
    for (const n of HOLES) {
      assert.strictEqual(catalog.recommend({ holes: n, needs: ['homepage'] }).packageKey, 'complete');
      assert.strictEqual(catalog.recommend({ holes: n, needs: ['hosted'] }).packageKey, 'hosted');
      assert.strictEqual(catalog.recommend({ holes: n, needs: ['homepage', 'hosted', 'flyovers'] }).packageKey, 'hosted');
      const unsure = catalog.recommend({ holes: n, unsure: true });
      assert.strictEqual(unsure.packageKey, 'complete');
      assert.strictEqual(unsure.basis, 'unsure');
      assert.strictEqual(unsure.price, EXPECTED.complete[n]);
      assert.strictEqual(catalog.recommend({ holes: n, unsure: true, needs: ['hosted'] }).packageKey, 'hosted');
    }
  });

  await check('comparison of alternatives uses the selected hole count and real inclusions', () => {
    const rows = catalog.compare(27, 'essentials');
    assert.deepStrictEqual(rows.map((r) => r.price), [2290, 2690, 3490]);
    assert.deepStrictEqual(rows.map((r) => r.difference), [0, 400, 1200]);
    assert.ok(rows[1].adds.includes('Homepage cinematic course film'));
    assert.ok(rows[2].adds.includes('Dedicated course URL'));
    assert.ok(catalog.compare(18, 'hosted')[0].lacks.includes('Homepage cinematic course film'));
    assert.ok(catalog.features('essentials', 36)[0].startsWith('36 individual'));
    assert.ok(!catalog.features('essentials', 18).some((f) => /homepage|hosted/i.test(f)), 'Essentials must not list Complete/Hosted inclusions');
  });

  await check('free trial offer is exactly one hole', () => {
    assert.strictEqual(catalog.FREE_TRIAL.holes, 1);
    assert.strictEqual(catalog.FREE_TRIAL.cta, 'Get one hole free');
  });

  /* 3. Payment endpoints ignore browser prices */
  const createIntent = require(path.join(ROOT, 'api/create-payment-intent.js'));
  const createSession = require(path.join(ROOT, 'api/create-checkout-session.js'));

  await check('PaymentIntent amount = catalogue price for all 12 combinations, ignoring tampered client amounts', async () => {
    for (const k of PKGS) for (const n of HOLES) for (const type of ['full', 'deposit']) {
      stripeCalls.length = 0;
      const r = await call(createIntent, {
        club_name: 'Test Club', package: k, hole_count: String(n), payment_type: type,
        project_price: 1, amount_due_now: 1, remaining_balance: 0
      });
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      const cents = EXPECTED[k][n] * 100;
      const expected = type === 'full' ? cents : cents / 2;
      assert.strictEqual(stripeCalls[0].params.amount, expected, `${k} ${n} ${type}`);
      assert.strictEqual(r.body.amount_due_now, expected);
      assert.strictEqual(stripeCalls[0].params.metadata.hole_count, String(n));
      assert.strictEqual(stripeCalls[0].params.metadata.package, k);
    }
  });

  await check('PaymentIntent with a valid offer code takes 10% off server-side', async () => {
    stripeCalls.length = 0;
    const r = await call(createIntent, { club_name: 'X', package: 'essentials', hole_count: '18', payment_type: 'deposit', promo_code: 'CV-ABC234' });
    assert.strictEqual(stripeCalls[0].params.amount, Math.round((169000 - 16900) / 2));
    assert.strictEqual(r.body.payable_total, 152100);
  });

  await check('PaymentIntent refuses unsupported hole counts and unknown packages', async () => {
    assert.strictEqual((await call(createIntent, { club_name: 'X', package: 'complete', hole_count: '36+' })).body.error, 'unsupported_hole_count');
    assert.strictEqual((await call(createIntent, { club_name: 'X', package: 'gold', hole_count: '18' })).body.error, 'unknown_package');
  });

  await check('hosted Checkout fallback charges the catalogue price for all 12 combinations', async () => {
    for (const k of PKGS) for (const n of HOLES) {
      stripeCalls.length = 0;
      const r = await call(createSession, {
        club_name: 'Test Club', customer_email: 'a@b.com', package: k, hole_count: String(n), payment_type: 'full', amount_due_now: 5
      });
      assert.strictEqual(r.statusCode, 200);
      assert.strictEqual(stripeCalls[0].params.line_items[0].price_data.unit_amount, EXPECTED[k][n] * 100);
      assert.strictEqual(stripeCalls[0].params.line_items[0].price_data.tax_behavior, 'inclusive');
    }
  });

  /* 4. Order flow totals match the server for every selection */
  await check('/start totals and Pay button match the server amount for every package, hole count, payment type and offer', () => {
    const Start = pageComponent('start/index.html', catalog);
    for (const k of PKGS) for (const n of HOLES) for (const type of ['full', 'deposit']) for (const promoOk of [false, true]) {
      const c = new Start({ showPromoField: true });
      Object.assign(c.state, { pkg: k, holes: String(n), paymentType: type, promoOk, promoCode: promoOk ? 'CV-ABC234' : '' });
      const server = pricing.resolve({ packageKey: k, holes: n, paymentType: type, promoValid: promoOk });
      const t = c.totals();
      assert.strictEqual(t.due, server.amountDueNow, `${k} ${n} ${type} promo=${promoOk}`);
      assert.strictEqual(t.remaining, server.remainingBalance);
      const v = c.renderVals();
      const shown = '$' + (server.amountDueNow / 100).toLocaleString('en-AU', { minimumFractionDigits: server.amountDueNow % 100 ? 2 : 0 });
      assert.strictEqual(v.payLabel, 'Pay ' + shown + ' securely');
      assert.strictEqual(c.orderPayload().hole_count, String(n));
      assert.strictEqual(c.orderPayload().package, k);
    }
  });

  await check('/start package cards show every package at the selected hole count', () => {
    const Start = pageComponent('start/index.html', catalog);
    for (const n of HOLES) {
      const c = new Start({});
      Object.assign(c.state, { holes: String(n), pkg: 'essentials' });
      const v = c.renderVals();
      assert.deepStrictEqual(v.packageOptions.map((p) => p.price), PKGS.map((k) => aud(EXPECTED[k][n])));
      assert.ok(v.packageOptions.every((p) => p.priceNote === n + ' holes'));
    }
  });

  /* 5. Home page comparison + pricing cards */
  await check('comparison shows Essentials for the selected hole count; pricing cards show all three', () => {
    const Home = pageComponent('index.html', catalog);
    for (const n of HOLES) {
      const c = new Home({});
      c.state.holes = n;
      const v = c.renderVals();
      assert.strictEqual(v.cvPrice, aud(EXPECTED.essentials[n]));
      assert.strictEqual(v.cvLabel, 'Essentials · ' + n + ' holes');
      assert.strictEqual(v.priceEssentials, aud(EXPECTED.essentials[n]));
      assert.strictEqual(v.priceComplete, aud(EXPECTED.complete[n]));
      assert.strictEqual(v.priceHosted, aud(EXPECTED.hosted[n]));
      assert.strictEqual(v.startEssentialsHref, '/start?package=essentials&holes=' + n);
      assert.ok(!('typeOptions' in v));
    }
    const html = read('index.html');
    assert.strictEqual(html.split('{{ cvPrice }}').length - 1, 2, 'table and green panel both show cvPrice');
    assert.strictEqual(html.split('{{ cvLabel }}').length - 1, 2, 'table and green panel both label the package');
  });

  /* 6. Free-hole request */
  const freeHole = require(path.join(ROOT, 'api/free-hole.js'));
  await check('free-hole: validation errors are field-specific', async () => {
    const r = await call(freeHole, { course_name: '', course_website: 'nope', email: 'x', preferred_hole: '40' });
    assert.strictEqual(r.statusCode, 400);
    assert.deepStrictEqual(Object.keys(r.body.fields).sort(), ['course_name', 'course_website', 'email', 'preferred_hole']);
  });

  await check('free-hole: missing email configuration is reported, not faked', async () => {
    delete process.env.EMAIL_API_KEY;
    const r = await call(freeHole, { course_name: 'Kooyonga Golf Club', course_website: 'kooyonga.com.au', email: 'gm@kooyonga.com.au' });
    assert.strictEqual(r.statusCode, 503);
    assert.strictEqual(r.body.ok, false);
  });

  await check('free-hole: accepted request is a one-hole trial, emailed internally with a receipt', async () => {
    process.env.EMAIL_API_KEY = 're_test_stub';
    mails.length = 0;
    mailStatus = 200;
    const r = await call(freeHole, { course_name: 'Royal Test Golf Club', course_website: 'https://www.royal-test.com.au/course', email: 'GM@Royal-Test.com.au', preferred_hole: '7' });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.ok, true);
    assert.strictEqual(r.body.trial_holes, 1);
    assert.match(r.body.reference, /^FH-/);
    assert.strictEqual(mails.length, 2);
    const internal = mails[0].payload;
    assert.match(internal.subject, /^Free hole request — Royal Test Golf Club/);
    assert.match(internal.text, /Holes: 1/);
    assert.match(internal.text, /Preferred hole: Hole 7/);
    assert.match(internal.text, /royal-test\.com\.au/);
    assert.deepStrictEqual(mails[1].payload.to, ['gm@royal-test.com.au']);
    assert.match(mails[1].payload.text, /one free hole/i);
    assert.doesNotMatch(mails[1].payload.text, /business days|within \d/i);

    const again = await call(freeHole, { course_name: 'Royal Test Golf Club', course_website: 'https://www.royal-test.com.au/course', email: 'gm@royal-test.com.au' });
    assert.strictEqual(again.body.reference, r.body.reference);
    assert.strictEqual(again.body.duplicate, true);
    assert.strictEqual(mails.length, 2, 'duplicate must not send again');
  });

  await check('free-hole: provider rejection → 502; honeypot → silently dropped', async () => {
    mails.length = 0;
    mailStatus = 422;
    const r = await call(freeHole, { course_name: 'Another Club', course_website: 'another.com.au', email: 'a@another.com.au' });
    assert.strictEqual(r.statusCode, 502);
    mailStatus = 200;
    mails.length = 0;
    const bot = await call(freeHole, { course_name: 'Bot', course_website: 'bot.com', email: 'b@bot.com', company: 'Acme' });
    assert.strictEqual(bot.statusCode, 200);
    assert.strictEqual(mails.length, 0);
  });

  /* 7. Success-page lookup */
  const orderStatus = require(path.join(ROOT, 'api/order-status.js'));
  await check('order-status reads a PaymentIntent back only with its client secret', async () => {
    stripeRetrieve = {
      id: 'pi_1', client_secret: 'pi_1_secret_ok', status: 'succeeded', amount_received: 84500, receipt_email: 'a@b.com',
      metadata: { order_number: 'CV-1', club_name: 'C', hole_count: '18', package: 'essentials', payment_type: 'deposit', project_price: '169000', remaining_balance: '84500' }
    };
    const ok = await call(orderStatus, { payment_intent: 'pi_1', payment_intent_client_secret: 'pi_1_secret_ok' });
    assert.strictEqual(ok.statusCode, 200);
    assert.strictEqual(ok.body.order.amount_paid, 84500);
    assert.strictEqual(ok.body.order.package_label, 'Essentials · 18 holes');
    const bad = await call(orderStatus, { payment_intent: 'pi_1', payment_intent_client_secret: 'wrong' });
    assert.strictEqual(bad.statusCode, 404);
  });

  /* 8. Copy and markup sweep */
  const PUBLIC = ['index.html', 'start/index.html', 'order/success/index.html', 'terms/index.html', 'privacy/index.html',
    'finder.js', 'catalog.js', 'lib/email.js', 'glenelg/index.html',
    'demo/index.html', 'demo/mt-osmond/index.html', 'demo/demo.js', 'demo/configs/public.js', 'demo/configs/mt-osmond.js'];
  const text = Object.fromEntries(PUBLIC.map((f) => [f, read(f)]));
  const hits = (re, files = PUBLIC) => files.filter((f) => re.test(text[f]));

  await check('no old prices remain', () => {
    assert.deepStrictEqual(hits(/\$1,490|\$2,390|\b149000\b|\b239000\b|price: 1490|from: 1490/), []);
  });
  await check('no facility/course-type selector or multiplier remains', () => {
    assert.deepStrictEqual(hits(/Local club|Destination course|Resort \/ multi-course|courseType|TYPE_CONTEXT|CV_CALC/), []);
  });
  await check('free offer is one hole everywhere (Glenelg\'s delivered sample excepted)', () => {
    const site = PUBLIC.filter((f) => f !== 'glenelg/index.html');
    assert.deepStrictEqual(hits(/three (sample )?holes|3 free holes|try three|free holes\b|sample holes/i, site), []);
    assert.ok(/Get one hole free/.test(text['index.html']));
  });
  await check('no quote-based conversion copy remains', () => {
    assert.deepStrictEqual(hits(/get (a|your)( custom)? (course )?quote|request a quote|custom quote|contact us for pricing|quoted from the package/i), []);
  });
  await check('"Most popular" badge and its effects are gone', () => {
    assert.deepStrictEqual(hits(/most popular|popBadge|popBurst|_popArmed|popular: true/i), []);
  });
  await check('old enquiry form and #enquiry links are gone', () => {
    assert.deepStrictEqual(hits(/href="#enquiry"|quoteFromCalc|enquiryFields|mailtoHref\(\)/), []);
    assert.strictEqual(text['index.html'].split('formsubmit.co').length - 1, 1, 'only the scratch-offer notification still posts to FormSubmit');
  });
  await check('order flow has no extended-facility routing left', () => {
    assert.deepStrictEqual(hits(/isExtended|"36\+"|extendedCopy|maxHoles/, ['start/index.html', 'order/success/index.html']), []);
  });
  await check('terms static price table matches the catalogue', () => {
    const rows = [...text['terms/index.html'].matchAll(/<tr><td>(\w+)<\/td>((?:<td[^>]*>[^<]*<\/td>){4})<\/tr>/g)];
    assert.strictEqual(rows.length, 3);
    for (const [, name, cells] of rows) {
      const k = name.toLowerCase();
      const vals = [...cells.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
      assert.deepStrictEqual(vals, HOLES.map((n) => aud(EXPECTED[k][n])), name);
    }
  });
  /* 9. Demo pages */
  const demoConfig = (file) => { const w = {}; new Function('window', read(file))(w); return w.CV_DEMO; };

  await check('demo pages load the shared catalogue + layout, with no trial or quote form', () => {
    for (const f of ['demo/index.html', 'demo/mt-osmond/index.html']) {
      const html = text[f];
      assert.ok(html.includes('src="/catalog.js"') && html.includes('src="/demo/demo.js"'), f);
      assert.doesNotMatch(html, /<form|demo-request|data-open-modal|data-free-hole/i, f);
    }
    assert.ok(!fs.existsSync(path.join(ROOT, 'api/demo-request.js')), 'three-holes endpoint removed');
    const js = text['demo/demo.js'];
    assert.match(js, /Bring the rest of your course to life\./);
    assert.match(js, /Ready to bring every hole to life\?/);
    assert.match(js, /From preview to full course/);
    assert.doesNotMatch(js, /free hole|one hole free|three/i);
  });

  await check('demo package prices come from the matrix (18 holes: Complete $1,990, Hosted $2,590, +$600)', () => {
    assert.strictEqual(catalog.formatPrice('complete', 18), '$1,990');
    assert.strictEqual(catalog.formatPrice('hosted', 18), '$2,590');
    assert.strictEqual(catalog.price('hosted', 18) - catalog.price('complete', 18), 600);
    assert.doesNotMatch(text['demo/demo.js'], /\$\d/, 'no hard-coded prices in the demo layout');
    for (const f of ['demo/configs/public.js', 'demo/configs/mt-osmond.js']) {
      const c = demoConfig(f);
      assert.strictEqual(c.suggestedPackage, 'complete');
      assert.strictEqual(c.alternativePackage, 'hosted');
    }
  });

  await check('Mount Osmond demo: private, own assets only, hole count not inferred from preview videos', () => {
    const c = demoConfig('demo/configs/mt-osmond.js');
    assert.match(text['demo/mt-osmond/index.html'], /noindex/);
    assert.doesNotMatch(read('sitemap.xml'), /mt-osmond/);
    assert.ok(c.course.holes === null || HOLES.includes(c.course.holes));
    assert.ok(c.course.logo.src.startsWith('/demo/mt-osmond/assets/'));
    assert.ok(c.videos.every((v) => v.src.startsWith('/demo/mt-osmond/assets/') && v.label));
    assert.strictEqual(c.handoff.club, 'Mount Osmond Golf Club');
    for (const f of ['index.html', 'demo/index.html', 'demo/configs/public.js']) assert.doesNotMatch(text[f], /osmond/i, f);
    for (const v of demoConfig('demo/configs/public.js').videos) assert.ok(fs.existsSync(path.join(ROOT, v.src)), v.src);
  });

  await check('order/success is start/index.html with deeper asset paths only', () => {
    const a = read('start/index.html').replace(/(src|href)="\.\.\//g, '$1="../../');
    assert.strictEqual(a, read('order/success/index.html'));
  });

  /* report */
  let failed = 0;
  for (const [status, name, msg] of results) {
    if (status === 'FAIL') failed++;
    process.stdout.write(`${status === 'PASS' ? '✓' : '✗'} ${name}${msg ? '\n    ' + msg : ''}\n`);
  }
  process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
  process.exit(failed ? 1 : 0);
})();

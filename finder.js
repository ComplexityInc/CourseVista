// CourseVista conversion dialogs, sharing one accessible modal shell:
//   • Package finder ("Find my package")
//   • One-free-hole request ("Get one hole free")
//
// Package finder: a short guided sequence (holes → inclusions → estimate) that recommends the
// lowest-priced package covering what the visitor asked for, then hands off to
// /start with the package and hole count already selected.
//
// Presentation only: prices, inclusions and the recommendation rules all come
// from window.CVCatalog (catalog.js). Open it from any element with
// data-finder (optionally data-holes="18"), a #find-package link, or
// window.CVFinder.open({ holes: 18 }).
//
// Free hole: open from data-free-hole, a #free-hole link or
// window.CVFinder.openFreeHole(). It requests exactly one hole
// (CVCatalog.FREE_TRIAL) and posts to /api/free-hole; success is shown only
// once a backend has accepted the request.
(function () {
  'use strict';

  var CAT = window.CVCatalog;
  if (!CAT) { console.error('[finder] catalog.js must load before finder.js'); return; }

  var STORE_KEY = 'cv-finder-v1';
  var WORDS = { 9: 'nine', 18: 'eighteen', 27: 'twenty-seven', 36: 'thirty-six' };
  var STATUS = ['Reviewing your selections…', 'Matching package inclusions…', 'Preparing your estimate…'];
  var OPTIONAL = ['homepage', 'hosted'];
  var TRIAL = CAT.FREE_TRIAL;
  var CONTACT = 'business@coursevista.com.au';
  var FORMSUBMIT = 'https://formsubmit.co/ajax/' + CONTACT;

  var answers = { holes: 18, needs: [], unsure: false };
  var view = { step: 1, phase: 'form', compare: false };
  var mode = 'finder';
  // Free-hole form state lives in memory only — no email address is written to storage.
  var trial = { course_name: '', course_website: '', email: '', preferred_hole: '', sending: false, sent: null };
  var root = null, dialog = null, body = null, live = null, segs = null, count = null, eyebrow = null;
  var timers = [], lastFocus = null, isOpen = false, inerted = [];

  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      answers.holes = CAT.normaliseHoles(saved.holes) || answers.holes;
      answers.needs = (saved.needs || []).filter(function (k) { return OPTIONAL.indexOf(k) !== -1; });
      answers.unsure = !!saved.unsure && !answers.needs.length;
    }
  } catch (e) {}

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(answers)); } catch (e) {}
  }

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(n) { return CAT.formatAud(n); }

  function recommendation() {
    return CAT.recommend({ holes: answers.holes, needs: answers.needs, unsure: answers.unsure });
  }

  // A requirement is implied when every package offering something the visitor
  // selected also provides it — e.g. a hosted experience brings the homepage film.
  function impliedBy(req) {
    for (var i = 0; i < answers.needs.length; i++) {
      var sel = answers.needs[i];
      if (sel === req) continue;
      var offering = CAT.PACKAGE_ORDER.filter(function (k) { return CAT.provides(k, sel); });
      if (offering.length && offering.every(function (k) { return CAT.provides(k, req); })) return sel;
    }
    return null;
  }

  function startHref(key, recommended) {
    return '/start?package=' + key + '&holes=' + answers.holes + '&from=' + (recommended ? 'finder' : 'compare');
  }

  var TICK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FAF8F4" stroke-width="3" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7.5"></path></svg>';

  /* ---------- copy ---------- */

  function explain(rec) {
    var w = WORDS[rec.holes];
    if (rec.basis === 'unsure') {
      return 'Complete covers all ' + w + ' holes with individual flyovers and adds a homepage cinematic film, so it’s a full starting point while you decide. Compare the packages below to see what’s lighter or more.';
    }
    if (rec.packageKey === 'essentials') {
      return 'You’re looking for individual flyovers across ' + w + ' holes. Essentials covers those needs.';
    }
    if (rec.packageKey === 'complete') {
      return 'You’d like a homepage cinematic film as well as flyovers for all ' + w + ' holes. Complete is the lowest-priced package that includes both.';
    }
    return 'You’d like a hosted course experience. Hosted is the package that includes one, together with the homepage film and flyovers for all ' + w + ' holes.';
  }

  function resultIncludes(key, n) {
    if (key !== 'hosted') return CAT.features(key, n);
    var c = CAT.features('complete', n);
    return [c[0], c[1]].concat(CAT.adds('hosted', n), ['Website-ready files, commercial usage rights and one revision round']);
  }

  /* ---------- views ---------- */

  function stepOne() {
    var holes = CAT.HOLE_COUNTS.map(function (n) {
      var on = n === answers.holes;
      return '<label class="cvf-hole' + (on ? ' is-on' : '') + '">' +
        '<input type="radio" name="cvf-holes" value="' + n + '"' + (on ? ' checked' : '') + '>' +
        '<span class="cvf-hole-n">' + n + '</span><span class="cvf-hole-l">holes</span></label>';
    }).join('');
    return '<h2 class="cvf-h2" id="cvf-title" tabindex="-1">Find the right package for your course.</h2>' +
      '<p class="cvf-sub">Tell us how many holes you need and what you’d like included.</p>' +
      '<fieldset class="cvf-fieldset"><legend class="cvf-legend">How many holes?</legend>' +
      '<div class="cvf-holes">' + holes + '</div></fieldset>' +
      '<p class="cvf-hint">Every package covers all of your holes. The total holes set the price.</p>' +
      '<div class="cvf-actions"><button type="button" class="cvf-btn cvf-primary" data-action="next">Continue<span aria-hidden="true">&#8594;</span></button></div>';
  }

  function optionsHtml() {
    var n = answers.holes;
    var html = '<div class="cvf-opt is-fixed"><span class="cvf-box">' + TICK + '</span>' +
      '<span class="cvf-opt-t">' + esc(CAT.REQUIREMENTS.flyovers.label) + '</span>' +
      '<span class="cvf-opt-d">A tee-to-green film for each of your ' + n + ' holes, ready for your course pages.</span>' +
      '<span class="cvf-opt-note">Included in every package</span></div>';

    OPTIONAL.forEach(function (key) {
      var req = CAT.REQUIREMENTS[key];
      var by = impliedBy(key);
      var on = answers.needs.indexOf(key) !== -1;
      var cls = by ? ' is-implied' : on ? ' is-on' : '';
      html += '<label class="cvf-opt' + cls + '">' +
        '<input type="checkbox" name="cvf-need" value="' + key + '"' + (on || by ? ' checked' : '') + (by ? ' disabled' : '') + '>' +
        '<span class="cvf-box">' + TICK + '</span>' +
        '<span class="cvf-opt-t">' + esc(req.label) + '</span>' +
        '<span class="cvf-opt-d">' + esc(req.detail) + '</span>' +
        (by ? '<span class="cvf-opt-note">Included with ' + esc(CAT.REQUIREMENTS[by].label.replace(/^A /, 'a ')) + '</span>' : '') +
        '</label>';
    });

    html += '<label class="cvf-opt cvf-opt-unsure' + (answers.unsure ? ' is-on' : '') + '">' +
      '<input type="checkbox" name="cvf-need" value="unsure"' + (answers.unsure ? ' checked' : '') + '>' +
      '<span class="cvf-box">' + TICK + '</span>' +
      '<span class="cvf-opt-t">I’m not sure yet</span>' +
      '<span class="cvf-opt-d">We’ll suggest full course coverage and show how the packages compare.</span></label>';
    return html;
  }

  function stepTwo() {
    return '<h2 class="cvf-h2" id="cvf-title" tabindex="-1">What would you like included?</h2>' +
      '<p class="cvf-sub">Choose everything that applies. We’ll match the lowest-priced package that covers it.</p>' +
      '<fieldset class="cvf-fieldset"><legend class="cvf-sr">Inclusions for ' + answers.holes + ' holes</legend>' +
      '<div class="cvf-opts" data-slot="options">' + optionsHtml() + '</div></fieldset>' +
      '<div class="cvf-actions">' +
      '<button type="button" class="cvf-btn cvf-primary" data-action="estimate">See my estimate<span aria-hidden="true">&#8594;</span></button>' +
      '<button type="button" class="cvf-btn cvf-ghost" data-action="back">Back</button></div>';
  }

  function processing() {
    var items = STATUS.map(function (t, i) {
      return '<li data-i="' + i + '"' + (i === 0 ? ' class="is-active"' : '') + '><span class="cvf-dot">' + TICK + '</span><span>' + esc(t) + '</span></li>';
    }).join('');
    return '<div class="cvf-proc">' +
      '<div class="cvf-proc-head"><span class="cvf-spin" aria-hidden="true"></span>' +
      '<h2 class="cvf-h2 cvf-h2-sm" id="cvf-title" tabindex="-1">Preparing your estimate</h2></div>' +
      '<ul class="cvf-proc-list">' + items + '</ul>' +
      '<div class="cvf-meter" aria-hidden="true"><span></span></div></div>';
  }

  function compareHtml(rec) {
    var rows = CAT.compare(rec.holes, rec.packageKey).map(function (c) {
      var diff = c.difference > 0 ? '+' + money(c.difference) : c.difference < 0 ? money(-c.difference) + ' less' : '';
      var delta = '';
      if (c.adds.length) delta = '<p class="cvf-cmp-delta"><b>Adds</b> ' + c.adds.map(esc).join(' · ') + '</p>';
      if (c.lacks.length) delta = '<p class="cvf-cmp-delta"><b>Doesn’t include</b> ' + c.lacks.map(esc).join(' · ') + '</p>';
      return '<li class="cvf-cmp' + (c.isBase ? ' is-base' : '') + '">' +
        '<div class="cvf-cmp-top"><span class="cvf-cmp-name">' + esc(c.name) + '</span>' +
        (c.isBase ? '<span class="cvf-cmp-tag">Recommended</span>' : '') +
        '<span class="cvf-cmp-price">' + money(c.price) + (diff ? '<span class="cvf-cmp-diff">' + diff + '</span>' : '') + '</span></div>' +
        '<p class="cvf-cmp-line">' + esc(c.tagline) + '</p>' + delta +
        (c.isBase ? '' : '<a class="cvf-link" data-action="continue" href="' + startHref(c.packageKey) + '">Continue with ' + esc(c.name) + '<span aria-hidden="true">&#8594;</span></a>') +
        '</li>';
    }).join('');
    return '<div class="cvf-label">All packages for ' + rec.holes + ' holes &#183; AUD, inc. GST</div><ul class="cvf-cmp-list">' + rows + '</ul>';
  }

  function result() {
    var rec = recommendation();
    var pkg = CAT.PACKAGES[rec.packageKey];
    var deposit = Math.round(rec.price * CAT.DEPOSIT_PERCENT / 100);
    var list = resultIncludes(rec.packageKey, rec.holes).map(function (t) {
      return '<li><span class="cvf-tick" aria-hidden="true">&#10003;</span><span>' + esc(t) + '</span></li>';
    }).join('');
    return '<div class="cvf-res">' +
      '<div class="cvf-eyebrow2">Your recommended package</div>' +
      '<h2 class="cvf-h2" id="cvf-title" tabindex="-1">' + esc(pkg.name) + ' &#183; ' + rec.holes + ' holes</h2>' +
      '<div class="cvf-price"><span class="cvf-amount">' + money(rec.price) + '</span><span class="cvf-cur">AUD</span><span class="cvf-gst">inc. GST</span></div>' +
      '<p class="cvf-why">' + esc(explain(rec)) + '</p>' +
      '<div class="cvf-incl"><div class="cvf-label">What’s included</div><ul>' + list + '</ul>' +
      (pkg.note ? '<p class="cvf-note">' + esc(pkg.note) + '</p>' : '') + '</div>' +
      '<div class="cvf-cta">' +
      '<a class="cvf-btn cvf-primary" data-action="continue" href="' + startHref(rec.packageKey, true) + '">Continue with ' + esc(pkg.name) + '<span aria-hidden="true">&#8594;</span></a>' +
      '<div class="cvf-sec">' +
      '<button type="button" class="cvf-btn cvf-ghost" data-action="edit">Edit selections</button>' +
      '<button type="button" class="cvf-btn cvf-ghost" data-action="compare" aria-expanded="' + view.compare + '" aria-controls="cvf-compare">' + (view.compare ? 'Hide comparison' : 'Compare packages') + '</button>' +
      '</div></div>' +
      '<p class="cvf-fine">Next, add your course details. Reserve with a ' + CAT.DEPOSIT_PERCENT + '% deposit (' + money(deposit) + ') or pay in full — nothing is charged until the final step.</p>' +
      '<div class="cvf-compare" id="cvf-compare"' + (view.compare ? '' : ' hidden') + '>' + compareHtml(rec) + '</div>' +
      '</div>';
  }

  /* ---------- free hole ---------- */

  function validDomain(v) {
    var t = String(v || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
    return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i.test(t);
  }

  function trialErrors(t) {
    var errs = {};
    var hole = t.preferred_hole.trim();
    if (t.course_name.trim().length < 2) errs.course_name = true;
    if (!validDomain(t.course_website)) errs.course_website = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t.email.trim())) errs.email = true;
    if (hole && !(/^\d{1,2}$/.test(hole) && Number(hole) >= 1 && Number(hole) <= 36)) errs.preferred_hole = true;
    return errs;
  }

  // `help` marks the one optional field.
  function field(id, name, label, attrs, error, help) {
    var describedBy = (help ? id + '-help ' : '') + id + '-err';
    return '<div class="cvf-field cvf-field-' + name.replace('_', '-') + '">' +
      '<label for="' + id + '">' + esc(label) + (help ? '<span class="cvf-optional">Optional</span>' : '') + '</label>' +
      '<input id="' + id + '" name="' + name + '" ' + attrs + ' value="' + esc(trial[name]) + '" aria-describedby="' + describedBy + '">' +
      (help ? '<p class="cvf-help" id="' + id + '-help">' + esc(help) + '</p>' : '') +
      '<p class="cvf-err" id="' + id + '-err" hidden>' + esc(error) + '</p></div>';
  }

  function submitLabel(sending) {
    return sending ? '<span class="cvf-spin cvf-spin-light" aria-hidden="true"></span>Sending request…' : 'Request my free hole';
  }

  function trialForm() {
    return '<h2 class="cvf-h2" id="cvf-title" tabindex="-1">Your course. One hole free.</h2>' +
      '<p class="cvf-sub">Tell us where to find your course and where to send your flyover.</p>' +
      '<form class="cvf-form" data-form="trial" novalidate' + (trial.sending ? ' aria-busy="true"' : '') + '>' +
      '<div class="cvf-grid">' +
      field('cvf-course', 'course_name', 'Course name', 'type="text" autocomplete="organization" maxlength="120" required', 'Enter your course name.') +
      field('cvf-site', 'course_website', 'Course website', 'type="text" inputmode="url" autocomplete="url" placeholder="yourclub.com.au" maxlength="200" spellcheck="false" required', 'Enter your course website, like yourclub.com.au.') +
      field('cvf-email', 'email', 'Email address', 'type="email" autocomplete="email" maxlength="200" spellcheck="false" required', 'Enter a valid email address.') +
      field('cvf-hole', 'preferred_hole', 'Preferred hole number', 'type="text" inputmode="numeric" maxlength="2" autocomplete="off"', 'Enter a hole number from 1 to 36, or leave it blank.', 'Leave blank and we’ll help choose.') +
      '</div>' +
      '<div class="cvf-hp" aria-hidden="true"><label>Company <input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="cvf-formerr" role="alert" hidden></div>' +
      '<button type="submit" class="cvf-btn cvf-primary cvf-submit"' + (trial.sending ? ' disabled' : '') + '>' + submitLabel(trial.sending) + '</button>' +
      '<p class="cvf-fine">' + esc(TRIAL.offer) + ' ' + esc(TRIAL.reassurance) + '</p>' +
      '</form>';
  }

  function trialDone() {
    var s = trial.sent;
    var rows = [
      ['Course', s.course_name],
      ['Website', s.course_website],
      ['Preferred hole', s.preferred_hole ? 'Hole ' + s.preferred_hole : 'We’ll help choose'],
      ['Offer', 'One free hole · no payment required']
    ].map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
    return '<div class="cvf-res">' +
      '<span class="cvf-okmark" aria-hidden="true">' + TICK + '</span>' +
      '<h2 class="cvf-h2" id="cvf-title" tabindex="-1">Your free-hole request is in.</h2>' +
      '<p class="cvf-why">We’ll review your course details and email you with the next steps.</p>' +
      '<dl class="cvf-summary">' + rows + '</dl>' +
      '<div class="cvf-cta"><a class="cvf-btn cvf-outline" data-action="explore" href="/#pricing">Explore packages</a></div>' +
      (s.reference ? '<p class="cvf-fine">Reference ' + esc(s.reference) + '</p>' : '') +
      '</div>';
  }

  function showTrialErrors(form, errs) {
    var first = null;
    Array.prototype.forEach.call(form.querySelectorAll('.cvf-field input'), function (input) {
      var bad = !!errs[input.name];
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      var msg = document.getElementById(input.id + '-err');
      if (msg) msg.hidden = !bad;
      if (bad && !first) first = input;
    });
    if (first) first.focus();
  }

  function setSending(form, on) {
    var btn = form.querySelector('.cvf-submit');
    form.setAttribute('aria-busy', on ? 'true' : 'false');
    if (btn) { btn.disabled = on; btn.innerHTML = submitLabel(on); }
  }

  function showFormError(form, html) {
    var box = form.querySelector('.cvf-formerr');
    if (!box) return;
    box.innerHTML = html;
    box.hidden = !html;
  }

  function postJson(url, payload) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        clearTimeout(timer);
        return { status: r.status, body: j };
      });
    }, function () {
      clearTimeout(timer);
      return { status: 0, body: null };
    });
  }

  // Primary path: /api/free-hole records the one-hole trial and emails it via
  // Resend. If that endpoint is unreachable or email isn't configured, the
  // request goes to the site's existing FormSubmit inbox instead. Success is
  // only reported when one of them confirms receipt.
  function submitTrial(p) {
    return postJson('/api/free-hole', p).then(function (r) {
      if (r.status === 200 && r.body && r.body.ok) return { ok: true, reference: r.body.reference || '' };
      if (r.status === 400 && r.body && r.body.fields) return { ok: false, fields: r.body.fields };
      return postJson(FORMSUBMIT, {
        _subject: 'CourseVista free hole request — ' + p.course_name,
        _template: 'table',
        _captcha: 'false',
        _honey: p.company,
        'Request type': 'One free hole flyover (trial — exactly 1 hole)',
        'Holes requested': String(TRIAL.holes),
        Course: p.course_name,
        Website: p.course_website,
        Email: p.email,
        'Preferred hole': p.preferred_hole || 'Not specified — help choose',
        Package: 'None — no payment requested',
        Source: location.hostname + location.pathname
      }).then(function (f) {
        var ok = f.status === 200 && f.body && (f.body.success === true || f.body.success === 'true');
        return ok ? { ok: true, reference: '' } : { ok: false };
      });
    });
  }

  function mailtoFallback() {
    var lines = [
      'Free hole request (one hole)',
      'Course: ' + trial.course_name.trim(),
      'Website: ' + trial.course_website.trim(),
      'Email: ' + trial.email.trim(),
      'Preferred hole: ' + (trial.preferred_hole.trim() || 'Help me choose')
    ];
    return 'mailto:' + CONTACT + '?subject=' + encodeURIComponent('Free hole request — ' + trial.course_name.trim()) +
      '&body=' + encodeURIComponent(lines.join('\r\n'));
  }

  function onInput(e) {
    var input = e.target;
    if (!input.closest || !input.closest('[data-form="trial"]') || !Object.prototype.hasOwnProperty.call(trial, input.name)) return;
    trial[input.name] = input.value;
    if (input.getAttribute('aria-invalid') === 'true') {
      input.setAttribute('aria-invalid', 'false');
      var msg = document.getElementById(input.id + '-err');
      if (msg) msg.hidden = true;
    }
  }

  function onSubmit(e) {
    var form = e.target;
    if (!form.matches || !form.matches('[data-form="trial"]')) return;
    e.preventDefault();
    if (trial.sending) return;                       // duplicate-submit guard
    ['course_name', 'course_website', 'email', 'preferred_hole'].forEach(function (k) { trial[k] = form.elements[k].value; });
    showFormError(form, '');
    var errs = trialErrors(trial);
    showTrialErrors(form, errs);
    if (Object.keys(errs).length) return;

    var payload = {
      course_name: trial.course_name.trim(),
      course_website: trial.course_website.trim(),
      email: trial.email.trim(),
      preferred_hole: trial.preferred_hole.trim(),
      company: form.elements.company.value,
      source: location.pathname
    };
    trial.sending = true;
    setSending(form, true);
    live.textContent = 'Sending your request…';

    submitTrial(payload).then(function (res) {
      trial.sending = false;
      if (res.ok) {
        trial.sent = {
          course_name: payload.course_name, course_website: payload.course_website,
          preferred_hole: payload.preferred_hole, reference: res.reference
        };
        if (isOpen && mode === 'trial') { render(); live.textContent = 'Your free-hole request is in.'; }
        return;
      }
      var current = body && body.querySelector('[data-form="trial"]');
      live.textContent = '';
      if (!current || !isOpen || mode !== 'trial') return;
      setSending(current, false);
      if (res.fields) { showTrialErrors(current, res.fields); return; }
      showFormError(current, 'We couldn’t send your request just now. Please try again, or email <a href="' + esc(mailtoFallback()) + '">' + CONTACT + '</a> with your course name and website.');
    });
  }

  function toPricing() {
    var target = document.getElementById('pricing');
    if (target) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    else location.href = '/#pricing';
  }

  /* ---------- render ---------- */

  function render(focusTitle) {
    root.classList.toggle('is-trial', mode === 'trial');
    eyebrow.textContent = mode === 'trial' ? 'One hole free' : 'Package finder';
    var html = mode === 'trial' ? (trial.sent ? trialDone() : trialForm())
      : view.phase === 'processing' ? processing()
      : view.phase === 'result' ? result()
      : view.step === 1 ? stepOne() : stepTwo();
    var at = view.phase === 'form' ? view.step : 3;
    body.innerHTML = '<div class="cvf-enter">' + html + '</div>';
    body.scrollTop = 0;
    body.setAttribute('aria-busy', view.phase === 'processing' ? 'true' : 'false');
    count.textContent = 'Step ' + at + ' of 3';
    Array.prototype.forEach.call(segs.children, function (s, i) { s.className = i < at ? 'is-on' : ''; });
    if (focusTitle !== false) {
      var t = body.querySelector('#cvf-title');
      if (t) t.focus({ preventScroll: true });
    }
  }

  function refreshOptions(focusValue) {
    var slot = body.querySelector('[data-slot="options"]');
    if (!slot) return;
    slot.innerHTML = optionsHtml();
    var input = slot.querySelector('input[value="' + focusValue + '"]');
    if (input && !input.disabled) input.focus({ preventScroll: true });
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function runEstimate() {
    save();
    view.phase = 'processing';
    view.compare = !!answers.unsure;
    render();
    var fast = reduced();
    var stepMs = fast ? 220 : 430;
    var meter = body.querySelector('.cvf-meter span');
    if (meter && !fast) {
      meter.style.transition = 'transform ' + (stepMs * STATUS.length) + 'ms cubic-bezier(.4,0,.2,1)';
      requestAnimationFrame(function () { meter.style.transform = 'scaleX(1)'; });
    }
    live.textContent = STATUS[0];
    STATUS.forEach(function (text, i) {
      if (!i) return;
      timers.push(setTimeout(function () {
        var items = body.querySelectorAll('.cvf-proc-list li');
        if (items[i - 1]) items[i - 1].className = 'is-done';
        if (items[i]) items[i].className = 'is-active';
        live.textContent = text;
      }, stepMs * i));
    });
    timers.push(setTimeout(function () {
      view.phase = 'result';
      render();
      var rec = recommendation();
      live.textContent = 'Recommendation ready: ' + rec.packageName + ', ' + rec.holes + ' holes, ' + money(rec.price) + ' AUD.';
    }, stepMs * STATUS.length + (fast ? 80 : 160)));
  }

  /* ---------- events ---------- */

  function onClick(e) {
    var t = e.target.closest('[data-action]');
    if (!t || !dialog.contains(t)) return;
    var action = t.getAttribute('data-action');
    if (action === 'close') { close(); return; }
    if (action === 'next') { view.step = 2; render(); return; }
    if (action === 'back') { view.step = 1; render(); return; }
    if (action === 'estimate') { runEstimate(); return; }
    if (action === 'edit') { clearTimers(); view.phase = 'form'; view.step = 2; render(); return; }
    if (action === 'compare') {
      view.compare = !view.compare;
      var panel = body.querySelector('#cvf-compare');
      if (panel) panel.hidden = !view.compare;
      t.setAttribute('aria-expanded', String(view.compare));
      t.textContent = view.compare ? 'Hide comparison' : 'Compare packages';
      if (view.compare && panel) panel.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (action === 'continue') save();
    if (action === 'explore') { e.preventDefault(); close({ restoreFocus: false, then: toPricing }); }
  }

  function onChange(e) {
    var input = e.target;
    if (input.name === 'cvf-holes') {
      answers.holes = CAT.normaliseHoles(input.value) || answers.holes;
      Array.prototype.forEach.call(body.querySelectorAll('.cvf-hole'), function (l) {
        l.classList.toggle('is-on', l.querySelector('input').checked);
      });
      save();
      return;
    }
    if (input.name === 'cvf-need') {
      var v = input.value;
      if (v === 'unsure') {
        answers.unsure = input.checked;
        if (input.checked) answers.needs = [];
      } else {
        answers.unsure = false;
        var i = answers.needs.indexOf(v);
        if (input.checked && i === -1) answers.needs.push(v);
        if (!input.checked && i !== -1) answers.needs.splice(i, 1);
      }
      save();
      refreshOptions(v);
    }
  }

  function focusables() {
    return Array.prototype.filter.call(
      dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'),
      function (n) { return n.offsetParent !== null || n === document.activeElement; }
    );
  }

  function onKey(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var list = focusables();
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  /* ---------- shell ---------- */

  function ensureRoot() {
    if (root) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'cvf';
    root.hidden = true;
    root.innerHTML =
      '<div class="cvf-backdrop" data-action="close"></div>' +
      '<div class="cvf-dialog" role="dialog" aria-modal="true" aria-labelledby="cvf-title">' +
      '<div class="cvf-head"><div class="cvf-head-row">' +
      '<span class="cvf-eyebrow">Package finder</span><span class="cvf-count"></span>' +
      '<button type="button" class="cvf-close" data-action="close" aria-label="Close package finder">&#10005;</button></div>' +
      '<div class="cvf-segs" aria-hidden="true"><span></span><span></span><span></span></div></div>' +
      '<div class="cvf-body"></div>' +
      '<p class="cvf-sr" aria-live="polite" aria-atomic="true"></p>' +
      '</div>';
    document.body.appendChild(root);
    dialog = root.querySelector('.cvf-dialog');
    body = root.querySelector('.cvf-body');
    live = root.querySelector('.cvf-sr');
    segs = root.querySelector('.cvf-segs');
    count = root.querySelector('.cvf-count');
    eyebrow = root.querySelector('.cvf-eyebrow');
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('submit', onSubmit);
  }

  function open(opts) {
    opts = opts || {};
    mode = opts.mode === 'trial' ? 'trial' : 'finder';
    if (mode === 'finder') {
      var h = CAT.normaliseHoles(opts.holes);
      if (h) answers.holes = h;
    }
    ensureRoot();
    clearTimers();
    view = { step: 1, phase: 'form', compare: false };
    if (isOpen) { render(); return; }
    lastFocus = opts.returnFocus || document.activeElement;

    var gap = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = gap + 'px';
    inerted = Array.prototype.filter.call(document.body.children, function (n) {
      return n !== root && n.tagName !== 'SCRIPT' && !n.inert;
    });
    inerted.forEach(function (n) { n.inert = true; });

    root.hidden = false;
    isOpen = true;
    render();
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    document.addEventListener('keydown', onKey, true);
  }

  function close(opts) {
    if (!isOpen) return;
    opts = opts && typeof opts === 'object' && !opts.type ? opts : {};
    isOpen = false;
    clearTimers();
    document.removeEventListener('keydown', onKey, true);
    root.classList.remove('is-open');
    inerted.forEach(function (n) { n.inert = false; });
    inerted = [];
    var done = function () {
      root.hidden = true;
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
      if (opts.then) opts.then();
    };
    if (reduced()) done(); else setTimeout(done, 200);
    if (opts.restoreFocus !== false && lastFocus && document.contains(lastFocus) && lastFocus.focus) {
      lastFocus.focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-finder], [data-free-hole]');
    if (!trigger || (root && root.contains(trigger))) return;
    e.preventDefault();
    if (trigger.hasAttribute('data-free-hole')) open({ mode: 'trial', returnFocus: trigger });
    else open({ holes: trigger.getAttribute('data-holes'), returnFocus: trigger });
  });

  function fromHash() {
    var hash = location.hash;
    if (hash !== '#find-package' && hash !== '#free-hole') return;
    history.replaceState(null, '', location.pathname + location.search);
    if (hash === '#free-hole') open({ mode: 'trial' });
    else open({ holes: new URLSearchParams(location.search).get('holes') });
  }
  window.addEventListener('hashchange', fromHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(fromHash, 300); });
  else setTimeout(fromHash, 300);

  window.CVFinder = {
    open: open,
    openFreeHole: function () { open({ mode: 'trial' }); },
    close: close
  };

  var CSS = [
    '.cvf{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;color:#55584D;-webkit-font-smoothing:antialiased}',
    '.cvf[hidden]{display:none}',
    '.cvf *,.cvf *::before,.cvf *::after{box-sizing:border-box}',
    '.cvf-backdrop{position:absolute;inset:0;background:rgba(22,23,15,.46);opacity:0;transition:opacity 220ms ease}',
    '.cvf.is-open .cvf-backdrop{opacity:1}',
    '.cvf-dialog{position:relative;width:min(640px,100%);max-height:min(880px,calc(100svh - 48px));display:flex;flex-direction:column;background:#FAF8F4;border:1px solid #E4E0D6;box-shadow:0 40px 90px -44px rgba(22,23,15,.6);opacity:0;transform:translateY(14px);transition:opacity 260ms ease,transform 420ms cubic-bezier(.19,1,.22,1)}',
    '.cvf.is-open .cvf-dialog{opacity:1;transform:none}',
    '.cvf-head{flex:0 0 auto;padding:14px 16px 0 28px}',
    '.cvf-head-row{display:flex;align-items:center;gap:14px}',
    '.cvf-eyebrow{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#B08D4F}',
    '.cvf-count{font-size:12px;color:#8A8D82}',
    '.cvf-close{margin-left:auto;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:none;border:1px solid transparent;color:#55584D;font-size:15px;cursor:pointer;transition:border-color 200ms ease,color 200ms ease}',
    '.cvf-close:hover{border-color:#D9D4C8;color:#16170F}',
    '.cvf-segs{display:flex;gap:4px;margin:8px 12px 0 0}',
    '.cvf-segs span{flex:1 1 0;height:2px;background:#E4E0D6;position:relative;overflow:hidden}',
    '.cvf-segs span::after{content:"";position:absolute;inset:0;background:#2C4A3B;transform:scaleX(0);transform-origin:left center;transition:transform 460ms cubic-bezier(.19,1,.22,1)}',
    '.cvf-segs span.is-on::after{transform:scaleX(1)}',
    '.cvf-body{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:26px 28px 30px}',
    '.cvf-enter{animation:cvf-in 340ms cubic-bezier(.19,1,.22,1) both}',
    '@keyframes cvf-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.cvf-h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;color:#16170F;font-size:clamp(26px,4.4vw,34px);line-height:1.12;margin:0;max-width:21ch;text-wrap:pretty;outline:none}',
    '.cvf-sub{font-size:15.5px;line-height:1.6;margin:12px 0 0;max-width:46ch;text-wrap:pretty}',
    '.cvf-fieldset{border:0;margin:26px 0 0;padding:0;min-width:0}',
    '.cvf-legend{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8A8D82;margin:0 0 12px;padding:0}',
    '.cvf-holes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '.cvf-hole{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:92px;background:#FFFFFF;border:1px solid #E4E0D6;cursor:pointer;transition:border-color 220ms ease,background-color 220ms ease}',
    '.cvf-hole:hover{border-color:#2C4A3B}',
    '.cvf-hole input,.cvf-opt input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}',
    '.cvf-hole-n{font-family:"Playfair Display",Georgia,serif;font-size:32px;line-height:1;color:#16170F;transition:color 220ms ease}',
    '.cvf-hole-l{font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8A8D82;transition:color 220ms ease}',
    '.cvf-hole.is-on{background:#2C4A3B;border-color:#2C4A3B}',
    '.cvf-hole.is-on .cvf-hole-n{color:#FAF8F4}',
    '.cvf-hole.is-on .cvf-hole-l{color:#D8DCD2}',
    '.cvf-hole:focus-within,.cvf-opt:focus-within{outline:2px solid #2C4A3B;outline-offset:3px}',
    '.cvf-hole:has(input:focus:not(:focus-visible)),.cvf-opt:has(input:focus:not(:focus-visible)){outline:none}',
    '.cvf-hint{font-size:13px;color:#8A8D82;margin:12px 0 0}',
    '.cvf-opts{display:flex;flex-direction:column;gap:10px}',
    '.cvf-opt{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr);gap:4px 14px;padding:16px 18px;background:#FFFFFF;border:1px solid #E4E0D6;cursor:pointer;transition:border-color 220ms ease,background-color 220ms ease,box-shadow 220ms ease}',
    '.cvf-opt:hover{border-color:#2C4A3B}',
    '.cvf-opt.is-on{border-color:#2C4A3B;background:#F4F6F1;box-shadow:inset 0 0 0 1px rgba(44,74,59,.14)}',
    '.cvf-opt.is-fixed,.cvf-opt.is-implied{cursor:default;background:#FDFCFA}',
    '.cvf-opt.is-fixed:hover,.cvf-opt.is-implied:hover{border-color:#E4E0D6}',
    '.cvf-opt-unsure{border-style:dashed}',
    '.cvf-box{grid-row:1 / span 3;margin-top:1px;width:20px;height:20px;border:1px solid #C4C0B4;background:#FFFFFF;display:flex;align-items:center;justify-content:center;transition:background-color 200ms ease,border-color 200ms ease}',
    '.cvf-box svg{opacity:0;transform:scale(.6);transition:opacity 160ms ease,transform 260ms cubic-bezier(.34,1.4,.64,1)}',
    '.cvf-opt.is-on .cvf-box,.cvf-opt.is-fixed .cvf-box{background:#2C4A3B;border-color:#2C4A3B}',
    '.cvf-opt.is-implied .cvf-box{background:#8A9A8F;border-color:#8A9A8F}',
    '.cvf-opt.is-on .cvf-box svg,.cvf-opt.is-fixed .cvf-box svg,.cvf-opt.is-implied .cvf-box svg{opacity:1;transform:none}',
    '.cvf-opt-t{font-size:15.5px;font-weight:500;color:#16170F}',
    '.cvf-opt-d{font-size:13.5px;line-height:1.55;color:#55584D;text-wrap:pretty}',
    '.cvf-opt-note{font-size:12px;font-weight:500;color:#8A6B2E;margin-top:3px}',
    '.cvf-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px;margin-top:26px}',
    '.cvf-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:0 24px;font-family:inherit;font-size:15px;font-weight:500;border:0;cursor:pointer;text-decoration:none;transition:background-color 240ms ease,color 240ms ease}',
    '.cvf-primary,.cvf-primary:visited{background:#2C4A3B;color:#FAF8F4}',
    '.cvf-primary:hover{background:#16170F;color:#FAF8F4}',
    '.cvf-ghost{background:none;color:#55584D;padding:0 12px;min-height:44px}',
    '.cvf-ghost:hover{color:#2C4A3B}',
    '.cvf-btn:focus-visible,.cvf-close:focus-visible,.cvf-link:focus-visible{outline:2px solid #2C4A3B;outline-offset:3px}',
    '.cvf-proc{padding:10px 0 4px}',
    '.cvf-proc-head{display:flex;align-items:center;gap:14px}',
    '.cvf-spin{width:18px;height:18px;flex:0 0 auto;border-radius:50%;border:2px solid #E4E0D6;border-top-color:#2C4A3B;animation:cvf-spin 780ms linear infinite}',
    '@keyframes cvf-spin{to{transform:rotate(360deg)}}',
    '.cvf-h2-sm{font-size:clamp(22px,3.4vw,27px)}',
    '.cvf-proc-list{list-style:none;margin:24px 0 0;padding:0;display:flex;flex-direction:column;gap:14px}',
    '.cvf-proc-list li{display:flex;align-items:center;gap:12px;font-size:15px;color:#B4B0A4;transition:color 260ms ease}',
    '.cvf-proc-list li.is-active{color:#16170F}',
    '.cvf-proc-list li.is-done{color:#55584D}',
    '.cvf-dot{width:18px;height:18px;flex:0 0 auto;border-radius:50%;border:1px solid #D9D4C8;display:flex;align-items:center;justify-content:center;transition:background-color 260ms ease,border-color 260ms ease,box-shadow 260ms ease}',
    '.cvf-dot svg{width:10px;height:10px;opacity:0;transition:opacity 200ms ease}',
    '.cvf-proc-list li.is-active .cvf-dot{border-color:#2C4A3B;background:#2C4A3B;box-shadow:inset 0 0 0 4px #FAF8F4}',
    '.cvf-proc-list li.is-done .cvf-dot{border-color:#2C4A3B;background:#2C4A3B}',
    '.cvf-proc-list li.is-done .cvf-dot svg{opacity:1}',
    '.cvf-meter{margin-top:26px;height:2px;background:#E4E0D6;overflow:hidden}',
    '.cvf-meter span{display:block;height:100%;background:#B08D4F;transform:scaleX(0);transform-origin:left center}',
    '.cvf-res>*{animation:cvf-in 480ms cubic-bezier(.19,1,.22,1) both}',
    '.cvf-res>*:nth-child(2){animation-delay:50ms}.cvf-res>*:nth-child(3){animation-delay:100ms}.cvf-res>*:nth-child(4){animation-delay:150ms}',
    '.cvf-res>*:nth-child(5){animation-delay:200ms}.cvf-res>*:nth-child(6){animation-delay:250ms}.cvf-res>*:nth-child(n+7){animation-delay:300ms}',
    '.cvf-eyebrow2{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#8A6B2E}',
    '.cvf-res .cvf-h2{margin-top:12px}',
    '.cvf-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:14px;padding-bottom:20px;border-bottom:1px solid #E4E0D6}',
    '.cvf-amount{font-family:"Playfair Display",Georgia,serif;font-size:clamp(42px,7vw,56px);line-height:1;color:#2C4A3B}',
    '.cvf-cur{font-size:12px;font-weight:600;letter-spacing:.16em;color:#16170F}',
    '.cvf-gst{font-size:13px;color:#8A8D82}',
    '.cvf-why{font-size:15.5px;line-height:1.62;color:#16170F;margin:18px 0 0;max-width:52ch;text-wrap:pretty}',
    '.cvf-incl{margin-top:20px;background:#FFFFFF;border:1px solid #E4E0D6;padding:16px 18px}',
    '.cvf-label{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#8A8D82}',
    '.cvf-incl ul{list-style:none;margin:10px 0 0;padding:0}',
    '.cvf-incl li{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid #F1EDE6;font-size:14px;line-height:1.5;color:#55584D}',
    '.cvf-incl li:first-child{border-top:0}',
    '.cvf-tick{color:#2C4A3B;font-size:11px;flex:0 0 auto}',
    '.cvf-note{font-size:12.5px;color:#8A8D82;margin:10px 0 0}',
    '.cvf-cta{margin-top:22px;display:flex;flex-direction:column;gap:8px}',
    '.cvf-cta .cvf-primary{width:100%;min-height:56px;font-size:16px}',
    '.cvf-sec{display:flex;flex-wrap:wrap;justify-content:center;gap:0 8px}',
    '.cvf-fine{font-size:12.5px;line-height:1.55;color:#8A8D82;margin:12px auto 0;max-width:48ch;text-align:center;text-wrap:pretty}',
    '.cvf-compare{margin-top:22px;border-top:1px solid #E4E0D6;padding-top:20px}',
    '.cvf-compare[hidden]{display:none}',
    '.cvf-cmp-list{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}',
    '.cvf-cmp{background:#FFFFFF;border:1px solid #E4E0D6;padding:14px 16px}',
    '.cvf-cmp.is-base{border-color:#2C4A3B;background:#F4F6F1}',
    '.cvf-cmp-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px}',
    '.cvf-cmp-name{font-family:"Playfair Display",Georgia,serif;font-size:20px;color:#16170F}',
    '.cvf-cmp-tag{font-size:9.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#2C4A3B;border:1px solid #C6D2C2;padding:3px 8px}',
    '.cvf-cmp-price{margin-left:auto;font-family:"Playfair Display",Georgia,serif;font-size:20px;color:#16170F;white-space:nowrap}',
    '.cvf-cmp-diff{margin-left:8px;font-family:Inter,system-ui,sans-serif;font-size:12px;color:#8A6B2E}',
    '.cvf-cmp-line{font-size:13.5px;line-height:1.5;color:#55584D;margin:6px 0 0}',
    '.cvf-cmp-delta{font-size:13px;line-height:1.55;color:#55584D;margin:8px 0 0;text-wrap:pretty}',
    '.cvf-cmp-delta b{font-weight:600;color:#16170F;margin-right:4px}',
    '.cvf-link,.cvf-link:visited{display:inline-flex;align-items:center;gap:8px;margin-top:6px;min-height:40px;font-size:14px;font-weight:500;color:#2C4A3B;text-decoration:none}',
    '.cvf-link:hover{color:#16170F}',
    '.cvf-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}',
    '.cvf.is-trial .cvf-segs,.cvf.is-trial .cvf-count{display:none}',
    '.cvf.is-trial .cvf-dialog{width:min(580px,100%)}',
    '.cvf-form{margin-top:24px}',
    '.cvf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 14px}',
    '.cvf-field{display:flex;flex-direction:column;min-width:0}',
    '.cvf-field-course-name{grid-column:1 / -1}',
    '.cvf-field label{display:flex;align-items:baseline;gap:8px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#55584D;margin-bottom:8px}',
    '.cvf-optional{font-size:11px;font-weight:500;letter-spacing:.04em;text-transform:none;color:#8A8D82}',
    '.cvf-field input{width:100%;min-height:50px;background:#FFFFFF;border:1px solid #D9D4C8;border-radius:0;padding:12px 14px;font-family:inherit;font-size:16px;color:#16170F;outline:none;transition:border-color 200ms ease,box-shadow 200ms ease}',
    '.cvf-field input::placeholder{color:#B4B0A4}',
    '.cvf-field input:focus{border-color:#2C4A3B;box-shadow:0 0 0 1px #2C4A3B}',
    '.cvf-field input[aria-invalid="true"]{border-color:#A95752;box-shadow:0 0 0 1px #A95752}',
    '.cvf-field-preferred-hole input{max-width:120px}',
    '.cvf-help{font-size:12.5px;line-height:1.5;color:#8A8D82;margin:7px 0 0}',
    '.cvf-err{font-size:12.5px;line-height:1.5;color:#A95752;margin:7px 0 0}',
    '.cvf-err[hidden],.cvf-formerr[hidden]{display:none}',
    '.cvf-hp{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}',
    '.cvf-formerr{margin-top:18px;border:1px solid #E4C9C7;background:#FBF3F2;color:#8E4642;font-size:13.5px;line-height:1.6;padding:12px 14px;text-wrap:pretty}',
    '.cvf-formerr a{color:#8E4642;text-decoration:underline;text-underline-offset:2px}',
    '.cvf-submit{width:100%;margin-top:22px;min-height:56px;font-size:16px}',
    '.cvf-submit[disabled]{opacity:.8;cursor:progress}',
    '.cvf-spin-light{width:15px;height:15px;border-color:rgba(250,248,244,.35);border-top-color:#FAF8F4}',
    '.cvf-outline,.cvf-outline:visited{background:none;border:1px solid #2C4A3B;color:#2C4A3B}',
    '.cvf-outline:hover{background:#2C4A3B;color:#FAF8F4}',
    '.cvf-okmark{width:44px;height:44px;border-radius:50%;background:#2C4A3B;display:flex;align-items:center;justify-content:center;margin-bottom:18px}',
    '.cvf-okmark svg{width:18px;height:18px}',
    '.cvf-summary{margin:20px 0 0;background:#FFFFFF;border:1px solid #E4E0D6;padding:4px 18px}',
    '.cvf-summary div{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid #F1EDE6;font-size:14px}',
    '.cvf-summary div:first-child{border-top:0}',
    '.cvf-summary dt{color:#8A8D82;flex:0 0 auto}',
    '.cvf-summary dd{margin:0;color:#16170F;text-align:right;overflow-wrap:anywhere}',
    '@media (max-width:600px){',
    '.cvf{padding:0;align-items:stretch}',
    '.cvf-dialog{width:100%;max-height:none;height:100%;border:0;transform:translateY(28px)}',
    '.cvf-head{padding:10px 8px 0 20px}',
    '.cvf-body{padding:22px 20px calc(26px + env(safe-area-inset-bottom))}',
    '.cvf-hole{min-height:80px}',
    '.cvf-hole-n{font-size:28px}',
    '.cvf-actions .cvf-primary{flex:1 1 auto}',
    '.cvf-grid{grid-template-columns:minmax(0,1fr)}',
    '}',
    '@media (max-width:359px){.cvf-holes{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media (prefers-reduced-motion:reduce){.cvf *,.cvf-backdrop,.cvf-dialog{animation:none!important;transition:none!important}}'
  ].join('\n');
})();

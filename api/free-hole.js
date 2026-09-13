const { FREE_TRIAL } = require('../catalog');
const { createLead, updateLead, findRecentLead } = require('../lib/store');
const { sendFreeHoleRequest, sendFreeHoleAcknowledgement } = require('../lib/email');

// POST /api/free-hole { course_name, course_website, email, preferred_hole?, source? }
//
// Records a one-hole trial request (FREE_TRIAL — exactly one hole, no package,
// no payment) and emails it to the CourseVista inbox. The browser is only told
// the request was accepted once that email has actually been accepted.

const DOMAIN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const domainOf = (v) => v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }
  res.setHeader('Cache-Control', 'no-store');

  // Honeypot: real visitors never see this field. Drop the request quietly.
  if (clean(body.company, 200)) return res.status(200).json({ ok: true, trial_holes: FREE_TRIAL.holes });

  const course = clean(body.course_name, 120);
  const website = clean(body.course_website, 200);
  const email = clean(body.email, 200).toLowerCase();
  const holeRaw = clean(body.preferred_hole, 3);

  const fields = {};
  if (course.length < 2) fields.course_name = 'required';
  if (!DOMAIN.test(domainOf(website))) fields.course_website = 'invalid';
  if (!EMAIL.test(email)) fields.email = 'invalid';
  let hole = null;
  if (holeRaw) {
    const n = Number(holeRaw);
    if (/^\d{1,2}$/.test(holeRaw) && n >= 1 && n <= 36) hole = n;
    else fields.preferred_hole = 'invalid';
  }
  if (Object.keys(fields).length) return res.status(400).json({ ok: false, error: 'invalid', fields });

  // A double-click or retry after success returns the same reference instead of a second request.
  const recent = await findRecentLead(email, website, DUPLICATE_WINDOW_MS);
  if (recent && recent.status === 'trial_requested') {
    return res.status(200).json({ ok: true, reference: recent.id, trial_holes: FREE_TRIAL.holes, duplicate: true });
  }

  const lead = recent || await createLead({
    type: 'free_hole_trial',
    offer: FREE_TRIAL.key,
    trial_holes: FREE_TRIAL.holes,
    package: null,
    payment_required: false,
    course_name: course,
    course_website: website,
    customer_email: email,
    preferred_hole: hole,
    source: clean(body.source, 200) || 'coursevista.com.au',
    status: 'received'
  });

  const sent = await sendFreeHoleRequest(lead);
  if (!sent || !sent.ok) {
    const notConfigured = sent && sent.reason === 'not_configured';
    console.error('[free-hole] notification failed for', lead.id, sent && sent.reason);
    return res.status(notConfigured ? 503 : 502).json({ ok: false, error: notConfigured ? 'not_configured' : 'notify_failed' });
  }

  await updateLead(lead.id, { status: 'trial_requested' });
  // Courtesy receipt; a failure here doesn't undo an accepted request.
  await sendFreeHoleAcknowledgement(lead).catch(() => null);

  res.status(200).json({ ok: true, reference: lead.id, trial_holes: FREE_TRIAL.holes });
};

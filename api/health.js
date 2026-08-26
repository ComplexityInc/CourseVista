// GET /api/health — configuration check.
// Reports whether each variable is PRESENT and what shape it has.
// Never returns a key value. Safe to open in a browser.

function shape(v) {
  if (!v) return { set: false };
  const out = { set: true, length: v.length };
  if (/^sk_(test|live)_/.test(v))   out.mode = v.startsWith('sk_live_') ? 'LIVE' : 'test';
  if (/^pk_(test|live)_/.test(v))   out.mode = v.startsWith('pk_live_') ? 'LIVE' : 'test';
  if (/^whsec_/.test(v))            out.mode = 'webhook secret';
  if (/^re_/.test(v))               out.mode = 'resend key';
  return out;
}

module.exports = async (req, res) => {
  const e = process.env;
  const stripeSecret = shape(e.STRIPE_SECRET_KEY);
  const stripePub    = shape(e.STRIPE_PUBLISHABLE_KEY);

  const problems = [];
  if (!stripeSecret.set) problems.push('STRIPE_SECRET_KEY missing');
  if (!stripePub.set)    problems.push('STRIPE_PUBLISHABLE_KEY missing');
  if (!e.STRIPE_WEBHOOK_SECRET) problems.push('STRIPE_WEBHOOK_SECRET missing — webhooks will fail signature checks');
  if (!e.EMAIL_API_KEY)  problems.push('EMAIL_API_KEY missing — no email will send');
  if (stripeSecret.mode && stripePub.mode && stripeSecret.mode !== stripePub.mode) {
    problems.push(`KEY MODE MISMATCH: secret is ${stripeSecret.mode}, publishable is ${stripePub.mode}`);
  }
  if (e.STRIPE_SECRET_KEY && /^pk_/.test(e.STRIPE_SECRET_KEY)) {
    problems.push('STRIPE_SECRET_KEY holds a publishable key — the values are swapped');
  }
  if (e.STRIPE_PUBLISHABLE_KEY && /^sk_/.test(e.STRIPE_PUBLISHABLE_KEY)) {
    problems.push('STRIPE_PUBLISHABLE_KEY holds a SECRET key — swapped, and it is being sent to browsers. Rotate it.');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(problems.length ? 500 : 200).json({
    ok: problems.length === 0,
    vercel_env: e.VERCEL_ENV || 'unknown',
    stripe: {
      secret_key: stripeSecret,
      publishable_key: stripePub,
      webhook_secret: shape(e.STRIPE_WEBHOOK_SECRET),
    },
    email: {
      api_key: shape(e.EMAIL_API_KEY),
      from: e.EMAIL_FROM || '(default) CourseVista <business@send.coursevista.com.au>',
      internal_to: e.COURSEVISTA_INTERNAL_EMAIL || '(default) business@coursevista.com.au',
    },
    site_url: e.SITE_URL || '(not set)',
    problems,
  });
};

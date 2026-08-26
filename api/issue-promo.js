// POST /api/issue-promo  { email }
// Issues the scratch-offer code and emails it. One live code per address.

const { issue } = require('../lib/promo');
const { sendPromoCode } = require('../lib/email');

const REASONS = {
  invalid_email: 'That email doesn\u2019t look complete \u2014 check it and we\u2019ll send the code there.',
  not_configured: 'Offers are unavailable right now.',
  stripe_error: 'Could not create your code. Please try again.',
  collision: 'Could not create your code. Please try again.',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = String(body.email || '').trim().toLowerCase();

  const result = await issue(email);
  if (!result.ok) {
    return res.status(result.reason === 'invalid_email' ? 400 : 502).json({
      ok: false,
      error: REASONS[result.reason] || 'Could not create your code.',
    });
  }

  const sent = await sendPromoCode(email, result.code);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    emailed: Boolean(sent && sent.ok),
    // The code is returned so the UI can show it even if email is slow.
    code: result.code,
  });
};

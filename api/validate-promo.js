const { validate } = require('../lib/promo');

const MESSAGES = {
  format: 'That code doesn\u2019t look right.',
  unknown: 'We can\u2019t find that code.',
  expired: 'That code has expired.',
  redeemed: 'That code has already been used.',
  lookup_failed: 'Could not check that code. Please try again.',
  not_configured: 'Offers are unavailable right now.',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const result = await validate(body.code);

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(
    result.valid
      ? { valid: true, code: result.code, discountPercent: result.discountPercent,
          message: `${result.discountPercent}% off applied.` }
      : { valid: false, reason: result.reason, message: MESSAGES[result.reason] || 'That code isn\u2019t valid.' }
  );
};

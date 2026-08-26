// Promotion code validation. Codes are issued by the scratch offer as CV-XXXXXX.
// Replace the in-memory set with the issued-code table.
const { PROMO_DISCOUNT_PERCENT } = require('./pricing');

const FORMAT = /^CV-[A-Z0-9]{6}$/;
const redeemed = new Set();

async function validate(code) {
  const value = String(code || '').trim().toUpperCase();
  if (!FORMAT.test(value)) return { valid: false, reason: 'format' };
  if (redeemed.has(value)) return { valid: false, reason: 'redeemed' };
  // TODO: look the code up in the issued-code table and confirm it is unexpired.
  return { valid: true, code: value, discountPercent: PROMO_DISCOUNT_PERCENT };
}

async function markRedeemed(code) { if (code) redeemed.add(String(code).toUpperCase()); }

module.exports = { validate, markRedeemed, FORMAT };

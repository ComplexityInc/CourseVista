// Server-side pricing and tax. Prices come from ../catalog.js — the same file the
// browser renders from — so the amount charged always matches the amount shown.
// Never trust a price sent from the browser — resolve everything from here.

const catalog = require('../catalog');

const {
  CURRENCY, GST_MODE, GST_RATE, DEPOSIT_PERCENT, PROMO_DISCOUNT_PERCENT, PACKAGES, HOLE_COUNTS
} = catalog;

class PricingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Server accepts only the exact hole counts on the price matrix. Anything else
// (including the old "36+") is rejected rather than guessed.
function parseHoles(value) {
  const s = String(value == null ? '' : value).trim();
  const n = Number(s);
  return /^\d+$/.test(s) && HOLE_COUNTS.includes(n) ? n : null;
}

function resolve({ packageKey, holes, paymentType, promoValid }) {
  if (!catalog.isPackage(packageKey)) throw new PricingError('unknown_package', 'Unknown package: ' + packageKey);
  const holeCount = parseHoles(holes);
  if (holeCount === null) throw new PricingError('unsupported_hole_count', 'Unsupported hole count: ' + holes);

  const pkg = PACKAGES[packageKey];
  const base = catalog.priceCents(packageKey, holeCount);         // cents
  const discount = promoValid ? Math.round(base * (PROMO_DISCOUNT_PERCENT / 100)) : 0;
  const payable = base - discount;                                 // full project value after discount
  const deposit = paymentType === 'deposit';
  const dueNow = deposit ? Math.round(payable * (DEPOSIT_PERCENT / 100)) : payable;
  const label = `${pkg.name} · ${holeCount} holes`;

  return {
    packageKey,
    packageName: pkg.name,
    packageLabel: label,
    holes: holeCount,
    currency: CURRENCY,
    projectPrice: base,
    discount,
    payableTotal: payable,
    amountDueNow: dueNow,
    remainingBalance: payable - dueNow,
    gstMode: GST_MODE,
    gstRate: GST_RATE,
    lineLabel: deposit
      ? `CourseVista ${label} — ${DEPOSIT_PERCENT}% project deposit`
      : `CourseVista ${label} — project in full`
  };
}

// "Essentials · 18 holes" for emails and invoices; tolerant of partial records.
function packageLabel(packageKey, holes) {
  const pkg = PACKAGES[packageKey];
  const n = catalog.normaliseHoles(holes);
  if (!pkg) return packageKey || '—';
  return n ? `${pkg.name} · ${n} holes` : pkg.name;
}

module.exports = {
  CURRENCY, GST_MODE, GST_RATE, DEPOSIT_PERCENT, PACKAGES, HOLE_COUNTS,
  PROMO_DISCOUNT_PERCENT, PricingError, parseHoles, resolve, packageLabel
};

// Single source of truth for CourseVista pricing and tax.
// Never trust a price sent from the browser — resolve everything from here.

const CURRENCY = 'aud';

// Set to 'inclusive' if displayed prices already contain GST, 'exclusive' to add it at checkout.
const GST_MODE = 'inclusive';
const GST_RATE = 0.10;

const DEPOSIT_PERCENT = 50;

const PACKAGES = {
  essentials: { name: 'Essentials', price: 149000, maxHoles: 9 },   // cents
  complete:   { name: 'Complete',   price: 199000, maxHoles: 18 },
  hosted:     { name: 'Hosted',     price: 239000, maxHoles: 18 }
};

// Extended facilities are scoped manually — no automatic checkout.
const EXTENDED_HOLE_COUNTS = ['27', '36+'];

const PROMO_DISCOUNT_PERCENT = 10;

function resolve({ packageKey, paymentType, promoValid }) {
  const pkg = PACKAGES[packageKey];
  if (!pkg) throw new Error('Unknown package: ' + packageKey);

  const base = pkg.price;
  const discount = promoValid ? Math.round(base * (PROMO_DISCOUNT_PERCENT / 100)) : 0;
  const payable = base - discount;                       // full project value after discount
  const deposit = paymentType === 'deposit';
  const dueNow = deposit ? Math.round(payable * (DEPOSIT_PERCENT / 100)) : payable;

  return {
    packageKey,
    packageName: pkg.name,
    currency: CURRENCY,
    projectPrice: base,
    discount,
    payableTotal: payable,
    amountDueNow: dueNow,
    remainingBalance: payable - dueNow,
    gstMode: GST_MODE,
    gstRate: GST_RATE,
    lineLabel: deposit
      ? `CourseVista ${pkg.name} — ${DEPOSIT_PERCENT}% project deposit`
      : `CourseVista ${pkg.name} — project in full`
  };
}

module.exports = {
  CURRENCY, GST_MODE, GST_RATE, DEPOSIT_PERCENT, PACKAGES,
  EXTENDED_HOLE_COUNTS, PROMO_DISCOUNT_PERCENT, resolve
};

// GET /api/test-email?type=internal
//
// Sends a sample of each template so you can prove the pipeline without
// running a payment. Deliberately hard to abuse: it only ever sends to
// COURSEVISTA_INTERNAL_EMAIL, so it cannot be used to mail anyone else.
// Returns exactly what Resend said, which is what makes it useful.

const email = require('../lib/email');
const { resolve } = require('../lib/pricing');

const INTERNAL = process.env.COURSEVISTA_INTERNAL_EMAIL || 'business@coursevista.com.au';
const SAMPLE_PRICING = resolve({ packageKey: 'complete', holes: 18, paymentType: 'deposit', promoValid: false });

const SAMPLE = {
  order_number: 'CV-TEST01',
  club_name: 'Test Golf Club',
  club_website: 'testgolf.com.au',
  location: 'Adelaide, SA',
  hole_count: '18',
  package: 'complete',
  payment_type: 'deposit',
  project_price: SAMPLE_PRICING.projectPrice,
  amount_paid: SAMPLE_PRICING.amountDueNow,
  remaining_balance: SAMPLE_PRICING.remainingBalance,
  customer_name: 'Test Contact',
  customer_email: INTERNAL,
  source_type: 'website',
  source_links: ['https://example.com/photos'],
  promo_code: 'CV-TEST99',
  stripe_payment_intent_id: 'pi_test_000',
  status: 'deposit_paid',
};

module.exports = async (req, res) => {
  if (!process.env.EMAIL_API_KEY) {
    return res.status(500).json({
      ok: false,
      problem: 'EMAIL_API_KEY is not set on this deployment',
      hint: 'Add it in Vercel, then redeploy — variables apply at build time.',
    });
  }

  const type = String((req.query && req.query.type) || 'internal').toLowerCase();
  let result;

  try {
    if (type === 'confirmation')   result = await email.sendCustomerConfirmation(SAMPLE);
    else if (type === 'free-hole' || type === 'free-hole-ack') {
      const lead = {
        id: 'FH-TEST01', type: 'free_hole_trial', offer: 'one_free_hole', trial_holes: 1,
        course_name: 'Test Golf Club', course_website: 'testgolf.com.au',
        customer_email: INTERNAL, preferred_hole: 7, source: 'test-email',
      };
      result = type === 'free-hole'
        ? await email.sendFreeHoleRequest(lead)
        : await email.sendFreeHoleAcknowledgement(lead);
    }
    else if (type === 'promo')     result = await email.sendPromoCode(INTERNAL, 'CV-TEST99');
    else                           result = await email.sendInternalNotification(SAMPLE);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err && err.message) });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(result && result.ok ? 200 : 502).json({
    ok: Boolean(result && result.ok),
    type,
    sent_to: INTERNAL,
    from: process.env.EMAIL_FROM || '(default) CourseVista <business@send.coursevista.com.au>',
    resend: result,
    next: result && result.ok
      ? 'Check that inbox, and spam. Then try ?type=confirmation, ?type=free-hole, ?type=free-hole-ack, ?type=promo'
      : 'See Resend -> Logs for the rejection reason. Usually an unverified domain or a from-address that does not match it.',
  });
};

// GET /api/test-email?type=internal
//
// Sends a sample of each template so you can prove the pipeline without
// running a payment. Deliberately hard to abuse: it only ever sends to
// COURSEVISTA_INTERNAL_EMAIL, so it cannot be used to mail anyone else.
// Returns exactly what Resend said, which is what makes it useful.

const email = require('../lib/email');

const INTERNAL = process.env.COURSEVISTA_INTERNAL_EMAIL || 'business@coursevista.com.au';

const SAMPLE = {
  order_number: 'CV-TEST01',
  club_name: 'Test Golf Club',
  club_website: 'testgolf.com.au',
  location: 'Adelaide, SA',
  hole_count: '18',
  package: 'complete',
  payment_type: 'deposit',
  project_price: 199000,
  amount_paid: 99500,
  remaining_balance: 99500,
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
    else if (type === 'enquiry')   result = await email.sendEnquiry({
      club: 'Test Golf Club', url: 'testgolf.com.au', holes: '18',
      name: 'Test Contact', role: 'General Manager',
      email: INTERNAL, phone: '0400 000 000', goals: 'Hole films',
    });
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
      ? 'Check that inbox, and spam. Then try ?type=confirmation, ?type=enquiry, ?type=promo'
      : 'See Resend -> Logs for the rejection reason. Usually an unverified domain or a from-address that does not match it.',
  });
};

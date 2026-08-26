const Stripe = require('stripe');
const { resolve, EXTENDED_HOLE_COUNTS, CURRENCY } = require('../lib/pricing');
const { validate } = require('../lib/promo');
const { createOrder, updateOrder } = require('../lib/store');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

// Creates a PaymentIntent for the embedded Payment Element.
// The browser never sends an amount and never sees card data: Stripe.js
// collects the card inside its own cross-origin iframes and tokenises
// straight to Stripe. Nothing card-related reaches this server, so there is
// nothing here to hash or store (PCI DSS SAQ-A scope).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};

  if (!body.club_name || !body.customer_email) return res.status(400).json({ error: 'missing_fields' });
  if (EXTENDED_HOLE_COUNTS.includes(String(body.hole_count))) {
    return res.status(409).json({ error: 'assessment_required' });
  }

  const promo = body.promo_code ? await validate(body.promo_code) : { valid: false };
  let pricing;
  try {
    pricing = resolve({
      packageKey: body.package,
      paymentType: body.payment_type === 'full' ? 'full' : 'deposit',
      promoValid: promo.valid
    });
  } catch (e) {
    return res.status(400).json({ error: 'unknown_package' });
  }

  const order = await createOrder({
    order_number: body.order_number,
    club_name: body.club_name,
    club_website: body.club_website,
    location: body.location,
    hole_count: body.hole_count,
    package: pricing.packageKey,
    project_price: pricing.projectPrice,
    payment_type: body.payment_type === 'full' ? 'full' : 'deposit',
    amount_due_now: pricing.amountDueNow,
    remaining_balance: pricing.remainingBalance,
    customer_email: body.customer_email,
    source_type: body.source_type,
    source_links: body.source_links || [],
    promo_code: promo.valid ? promo.code : null,
    status: 'awaiting_payment'
  });

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: 'stripe_not_configured', order_number: order.order_number });
  }

  // A reusable Customer keeps the deposit, the final-balance invoice and the
  // club's tax details on one record.
  const found = await stripe.customers.list({ email: order.customer_email, limit: 1 });
  const customer = found.data[0] || await stripe.customers.create({
    email: order.customer_email,
    name: order.club_name,
    metadata: { order_number: order.order_number, club_website: order.club_website || '' }
  });

  const intent = await stripe.paymentIntents.create({
    amount: pricing.amountDueNow,
    currency: CURRENCY,
    customer: customer.id,
    setup_future_usage: 'off_session',
    automatic_payment_methods: { enabled: true },
    receipt_email: order.customer_email,
    description: `${pricing.lineLabel} — ${order.club_name}`,
    metadata: {
      order_number: order.order_number,
      package: pricing.packageKey,
      club_name: order.club_name,
      club_website: order.club_website || '',
      hole_count: String(order.hole_count),
      payment_type: order.payment_type,
      project_price: String(pricing.projectPrice),
      remaining_balance: String(pricing.remainingBalance),
      promo_code: order.promo_code || ''
    }
  });

  await updateOrder(order.order_number, {
    stripe_payment_intent_id: intent.id,
    stripe_customer_id: customer.id
  });

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    client_secret: intent.client_secret,
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
    order_number: order.order_number,
    amount_due_now: pricing.amountDueNow
  });
};

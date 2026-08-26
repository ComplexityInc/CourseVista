const Stripe = require('stripe');
const { resolve, EXTENDED_HOLE_COUNTS, CURRENCY, GST_MODE } = require('../lib/pricing');
const { validate } = require('../lib/promo');
const { createOrder, updateOrder } = require('../lib/store');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
const SITE = process.env.SITE_URL || 'https://coursevista.com.au';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};

  if (!body.club_name || !body.customer_email) return res.status(400).json({ error: 'missing_fields' });
  if (EXTENDED_HOLE_COUNTS.includes(String(body.hole_count))) {
    return res.status(409).json({ error: 'assessment_required' });
  }

  // Prices are resolved server-side only — anything sent from the browser is ignored.
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

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'stripe_not_configured', order_number: order.order_number });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.customer_email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: pricing.amountDueNow,
        tax_behavior: GST_MODE === 'inclusive' ? 'inclusive' : 'exclusive',
        product_data: {
          name: pricing.lineLabel,
          description: `${order.club_name} — ${order.hole_count} holes`
        }
      }
    }],
    automatic_tax: { enabled: false },
    metadata: {
      order_number: order.order_number,
      package: pricing.packageKey,
      club_name: order.club_name,
      club_website: order.club_website,
      hole_count: String(order.hole_count),
      payment_type: order.payment_type,
      project_price: String(pricing.projectPrice),
      remaining_balance: String(pricing.remainingBalance),
      promo_code: order.promo_code || ''
    },
    success_url: `${SITE}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/start?package=${pricing.packageKey}&cancelled=1`
  });

  await updateOrder(order.order_number, { stripe_checkout_session_id: session.id });
  res.status(200).json({ url: session.url, order_number: order.order_number });
};

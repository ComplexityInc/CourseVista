const Stripe = require('stripe');
const { CURRENCY, GST_MODE } = require('../lib/pricing');
const { getOrder, updateOrder } = require('../lib/store');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
const SITE = process.env.SITE_URL || 'https://coursevista.com.au';

// Collects the outstanding balance on a deposit order — replaces manual invoicing.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { order_number } = req.body || {};
  const order = await getOrder(order_number);
  if (!order) return res.status(404).json({ error: 'unknown_order' });
  if (!order.remaining_balance) return res.status(409).json({ error: 'nothing_outstanding' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'stripe_not_configured' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.customer_email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: order.remaining_balance,
        tax_behavior: GST_MODE === 'inclusive' ? 'inclusive' : 'exclusive',
        product_data: { name: `CourseVista ${order.package} — final balance`, description: order.club_name }
      }
    }],
    metadata: { order_number: order.order_number, payment_stage: 'balance' },
    success_url: `${SITE}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/order/balance?order=${order.order_number}`
  });

  await updateOrder(order.order_number, { status: 'awaiting_balance' });
  res.status(200).json({ url: session.url });
};

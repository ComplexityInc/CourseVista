const Stripe = require('stripe');
const { findBySession } = require('../lib/store');
const { packageLabel } = require('../lib/pricing');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

// Read-only order lookup for the success page. Payment state itself is set by the
// webhook — never by the browser redirect.
//
// The in-memory store is usually cold on serverless, so when it misses we read
// the order back from Stripe: the Checkout Session (hosted fallback) or the
// PaymentIntent (embedded Payment Element, 3DS redirect). A PaymentIntent is only
// returned when the caller also holds its client secret, which Stripe appends
// to the return URL — an intent id alone reveals nothing.
function shape(md, extra) {
  return Object.assign({
    order_number: md.order_number,
    club_name: md.club_name,
    hole_count: md.hole_count,
    package: md.package,
    payment_type: md.payment_type,
    project_price: Number(md.project_price || 0),
    remaining_balance: Number(md.remaining_balance || 0)
  }, extra);
}

module.exports = async (req, res) => {
  const q = Object.assign({}, req.query || {}, req.body || {});
  const sessionId = q.session_id;
  const intentId = q.payment_intent;
  if (!sessionId && !intentId) return res.status(400).json({ error: 'missing_session' });

  let order = sessionId ? await findBySession(sessionId) : null;

  if (!order && process.env.STRIPE_SECRET_KEY) {
    try {
      if (sessionId) {
        const s = await stripe.checkout.sessions.retrieve(String(sessionId));
        order = shape(s.metadata || {}, {
          customer_email: s.customer_details ? s.customer_details.email : s.customer_email,
          amount_paid: s.payment_status === 'paid' ? s.amount_total || 0 : 0,
          status: s.payment_status === 'paid' ? 'paid' : 'awaiting_payment'
        });
      } else {
        const pi = await stripe.paymentIntents.retrieve(String(intentId));
        if (!q.payment_intent_client_secret || pi.client_secret !== q.payment_intent_client_secret) {
          return res.status(404).json({ error: 'unknown_order' });
        }
        order = shape(pi.metadata || {}, {
          customer_email: pi.receipt_email,
          amount_paid: pi.status === 'succeeded' ? pi.amount_received || 0 : 0,
          status: pi.status === 'succeeded' ? 'paid' : pi.status
        });
      }
    } catch (err) {
      console.error('[order-status] Stripe lookup failed:', err && err.message);
    }
  }

  if (!order || !order.order_number) return res.status(404).json({ error: 'unknown_order' });

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    order: {
      order_number: order.order_number,
      club_name: order.club_name,
      hole_count: order.hole_count,
      package: order.package,
      package_label: packageLabel(order.package, order.hole_count),
      customer_email: order.customer_email,
      payment_type: order.payment_type,
      project_price: order.project_price,
      amount_paid: order.amount_paid,
      remaining_balance: order.remaining_balance,
      status: order.status
    }
  });
};

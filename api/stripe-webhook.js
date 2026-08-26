const Stripe = require('stripe');
const { updateOrder, getOrder } = require('../lib/store');
const { sendCustomerConfirmation, sendInternalNotification } = require('../lib/email');
const { markRedeemed } = require('../lib/promo');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

// Stripe signature verification needs the raw body.
module.exports.config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function applyPayment(orderNumber, { paid, remaining, customerId, paymentIntentId, email, stage }) {
  if (!orderNumber) return null;
  const existing = await getOrder(orderNumber);
  // Idempotent: Stripe retries webhooks, so the same intent must not be counted twice.
  if (existing && paymentIntentId && existing.settled_intents && existing.settled_intents.includes(paymentIntentId)) {
    return existing;
  }
  const settled = ((existing && existing.settled_intents) || []).concat(paymentIntentId ? [paymentIntentId] : []);
  const outstanding = typeof remaining === 'number' ? remaining : (existing ? existing.remaining_balance || 0 : 0);
  return updateOrder(orderNumber, {
    amount_paid: (existing ? existing.amount_paid || 0 : 0) + (paid || 0),
    remaining_balance: outstanding,
    status: outstanding > 0 ? (stage === 'balance' ? 'awaiting_balance' : 'deposit_paid') : 'paid_in_full',
    stripe_customer_id: customerId || (existing ? existing.stripe_customer_id : null),
    stripe_payment_intent_id: paymentIntentId || (existing ? existing.stripe_payment_intent_id : null),
    customer_email: email || undefined,
    settled_intents: settled
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(buf, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    // Embedded Payment Element — the path the order flow uses now.
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const md = pi.metadata || {};
      const order = await applyPayment(md.order_number, {
        paid: pi.amount_received || pi.amount || 0,
        remaining: Number(md.remaining_balance || 0),
        customerId: pi.customer || null,
        paymentIntentId: pi.id,
        email: pi.receipt_email || undefined,
        stage: md.payment_stage
      });
      if (order) {
        if (md.promo_code) await markRedeemed(md.promo_code);
        await sendCustomerConfirmation(order);
        await sendInternalNotification(order);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const orderNumber = (pi.metadata || {}).order_number;
      if (orderNumber) {
        await updateOrder(orderNumber, {
          status: 'payment_failed',
          last_payment_error: pi.last_payment_error ? pi.last_payment_error.code || 'declined' : 'declined'
        });
      }
    }

    // Hosted Checkout — kept as the fallback path.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const md = session.metadata || {};
      const order = await applyPayment(md.order_number, {
        paid: session.amount_total || 0,
        remaining: Number(md.remaining_balance || 0),
        customerId: session.customer || null,
        paymentIntentId: session.payment_intent || null,
        email: session.customer_details ? session.customer_details.email : undefined,
        stage: md.payment_stage
      });
      if (order) {
        if (md.promo_code) await markRedeemed(md.promo_code);
        await sendCustomerConfirmation(order);
        await sendInternalNotification(order);
      }
    }

    // Final-balance invoices.
    if (event.type === 'invoice.paid') {
      const inv = event.data.object;
      const md = inv.metadata || {};
      const order = await applyPayment(md.order_number, {
        paid: inv.amount_paid || 0,
        remaining: 0,
        customerId: inv.customer || null,
        paymentIntentId: inv.payment_intent || inv.id,
        email: inv.customer_email || undefined,
        stage: 'balance'
      });
      if (order) await sendInternalNotification(order);
    }

    if (event.type === 'invoice.payment_failed' || event.type === 'invoice.marked_uncollectible') {
      const inv = event.data.object;
      const orderNumber = (inv.metadata || {}).order_number;
      if (orderNumber) await updateOrder(orderNumber, { status: 'balance_overdue' });
    }
  } catch (err) {
    // Returning 500 makes Stripe retry rather than silently dropping the event.
    return res.status(500).json({ error: 'handler_failed' });
  }

  res.status(200).json({ received: true });
};

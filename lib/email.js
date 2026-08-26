// Transactional email boundary. Wire to Resend / Postmark / SES.
const INTERNAL_TO = process.env.COURSEVISTA_INTERNAL_EMAIL || 'business@coursevista.com.au';

async function send({ to, subject, text }) {
  if (!process.env.EMAIL_API_KEY) {
    console.log('[email:dry-run]', to, subject);
    return { skipped: true };
  }
  // TODO: replace with provider call.
  return { skipped: true };
}

function money(cents) { return '$' + (cents / 100).toLocaleString('en-AU'); }

async function sendCustomerConfirmation(order) {
  return send({
    to: order.customer_email,
    subject: 'Your CourseVista project is reserved',
    text: [
      `Order ${order.order_number}`,
      `Club: ${order.club_name}`,
      `Package: ${order.package}`,
      `Paid today: ${money(order.amount_paid)}`,
      `Remaining before delivery: ${money(order.remaining_balance)}`,
      '',
      'Next: complete your project intake so we can begin.',
      `https://coursevista.com.au/order/intake?order=${order.order_number}`
    ].join('\n')
  });
}

async function sendInternalNotification(order) {
  return send({
    to: INTERNAL_TO,
    subject: `New CourseVista order — ${order.club_name} (${order.package})`,
    text: [
      `Order: ${order.order_number}`,
      `Customer: ${order.customer_name || '—'} <${order.customer_email}>`,
      `Club: ${order.club_name} — ${order.club_website}`,
      `Location: ${order.location}`,
      `Holes: ${order.hole_count}`,
      `Package: ${order.package} (${order.payment_type})`,
      `Paid: ${money(order.amount_paid)} of ${money(order.project_price)}`,
      `Source: ${order.source_type} ${(order.source_links || []).join(' ')}`,
      `Promo: ${order.promo_code || '—'}`,
      `Stripe: ${order.stripe_payment_intent_id || order.stripe_checkout_session_id || '—'}`
    ].join('\n')
  });
}

module.exports = { send, sendCustomerConfirmation, sendInternalNotification };

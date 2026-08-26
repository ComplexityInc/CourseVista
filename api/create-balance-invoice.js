const Stripe = require('stripe');
const { CURRENCY, GST_MODE } = require('../lib/pricing');
const { getOrder, updateOrder } = require('../lib/store');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
const DAYS_UNTIL_DUE = Number(process.env.INVOICE_DAYS_UNTIL_DUE || 7);

// Final balance is billed as a proper Stripe Invoice, not a checkout link:
// the club gets a numbered tax invoice PDF with CourseVista's ABN and GST
// breakdown, payable by card or bank transfer, and Stripe chases it.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { order_number } = req.body || {};
  const order = await getOrder(order_number);
  if (!order) return res.status(404).json({ error: 'unknown_order' });
  if (!order.remaining_balance) return res.status(409).json({ error: 'nothing_outstanding' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'stripe_not_configured' });

  let customerId = order.stripe_customer_id;
  if (!customerId) {
    const found = order.customer_email
      ? await stripe.customers.list({ email: order.customer_email, limit: 1 })
      : { data: [] };
    const customer = found.data[0] || await stripe.customers.create({
      email: order.customer_email,
      name: order.club_name,
      metadata: { order_number: order.order_number, club_website: order.club_website || '' }
    });
    customerId = customer.id;
  }

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: DAYS_UNTIL_DUE,
    currency: CURRENCY,
    // Stripe Tax works out GST from the club's address and our AU registration.
    automatic_tax: { enabled: true },
    description: `Final balance — CourseVista ${order.package} for ${order.club_name}`,
    metadata: { order_number: order.order_number, payment_stage: 'balance' },
    pending_invoice_items_behavior: 'exclude'
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    currency: CURRENCY,
    amount: order.remaining_balance,
    tax_behavior: GST_MODE === 'inclusive' ? 'inclusive' : 'exclusive',
    description: `CourseVista ${order.package} — final balance (${order.hole_count} holes)`
  });

  const finalised = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(finalised.id);

  await updateOrder(order.order_number, {
    status: 'awaiting_balance',
    stripe_customer_id: customerId,
    stripe_balance_invoice_id: finalised.id
  });

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    invoice_id: finalised.id,
    invoice_number: finalised.number,
    hosted_invoice_url: finalised.hosted_invoice_url,
    invoice_pdf: finalised.invoice_pdf,
    amount_due: finalised.amount_due
  });
};

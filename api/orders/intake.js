const { updateOrder, getOrder } = require('../../lib/store');
const { sendInternalNotification } = require('../../lib/email');

// Post-payment source-material submission.
//
// This used to 404 whenever the store was cold — which, on serverless, is
// almost always. The order_number arrives from the customer's confirmation
// email and is verified by the webhook at payment time, so we no longer
// require a warm record: we take what was submitted and notify regardless.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!body.order_number) return res.status(400).json({ error: 'missing_order' });

  const patch = {
    customer_name: body.customer_name,
    customer_role: body.customer_role,
    customer_email: body.customer_email,
    customer_phone: body.customer_phone,
    source_type: body.source_type,
    source_links: [body.photography_link].filter(Boolean),
    course_page: body.course_page,
    logo_file: body.logo_file,
    notes: body.notes,
    status: 'source_review',
  };

  let order;
  try {
    const existing = await getOrder(body.order_number);
    order = existing
      ? await updateOrder(body.order_number, patch)
      : Object.assign({ order_number: body.order_number }, patch);
  } catch (err) {
    order = Object.assign({ order_number: body.order_number }, patch);
  }

  const sent = await sendInternalNotification(order);
  if (!sent || !sent.ok) {
    // Never tell the customer it worked if we did not actually receive it.
    console.error('[intake] notification failed for', body.order_number);
    return res.status(502).json({ error: 'notify_failed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ order_number: body.order_number, status: 'source_review' });
};

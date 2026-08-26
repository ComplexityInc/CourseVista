const { createOrder } = require('../lib/store');
const { sendInternalNotification } = require('../lib/email');
const { EXTENDED_HOLE_COUNTS } = require('../lib/pricing');

// Creates a project record without payment — used by the free assessment route.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};
  if (!body.club_name || !body.customer_email) return res.status(400).json({ error: 'missing_fields' });

  const status = body.status === 'assessment_required' || EXTENDED_HOLE_COUNTS.includes(String(body.hole_count))
    ? 'assessment_required'
    : 'draft';

  const order = await createOrder(Object.assign({}, body, { status, project_price: 0, amount_due_now: 0 }));
  await sendInternalNotification(order);
  res.status(200).json({ order_number: order.order_number, status: order.status });
};

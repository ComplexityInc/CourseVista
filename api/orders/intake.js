const { updateOrder, getOrder } = require('../../lib/store');
const { sendInternalNotification } = require('../../lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};
  if (!body.order_number) return res.status(400).json({ error: 'missing_order' });

  const existing = await getOrder(body.order_number);
  if (!existing) return res.status(404).json({ error: 'unknown_order' });

  const order = await updateOrder(body.order_number, {
    customer_name: body.customer_name,
    customer_role: body.customer_role,
    customer_email: body.customer_email || existing.customer_email,
    customer_phone: body.customer_phone,
    source_links: [body.photography_link].filter(Boolean),
    course_page: body.course_page,
    logo_file: body.logo_file,
    notes: body.notes,
    status: 'source_review'
  });
  await sendInternalNotification(order);
  res.status(200).json({ order_number: order.order_number, status: order.status });
};

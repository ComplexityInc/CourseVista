const { findBySession } = require('../lib/store');

// Read-only order lookup for the success page. Payment state itself is set by the
// webhook — never by the browser redirect.
module.exports = async (req, res) => {
  const sessionId = (req.body && req.body.session_id) || (req.query && req.query.session_id);
  if (!sessionId) return res.status(400).json({ error: 'missing_session' });
  const order = await findBySession(sessionId);
  if (!order) return res.status(404).json({ error: 'unknown_order' });
  res.status(200).json({
    order: {
      order_number: order.order_number,
      club_name: order.club_name,
      hole_count: order.hole_count,
      package: order.package,
      customer_email: order.customer_email,
      payment_type: order.payment_type,
      amount_paid: order.amount_paid,
      remaining_balance: order.remaining_balance,
      status: order.status
    }
  });
};

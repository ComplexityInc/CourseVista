// Order persistence boundary.
// Swap the in-memory map for the real datastore (Supabase / Postgres / Airtable).
// Field names match the CourseVista order model.

const memory = new Map();

async function createOrder(data) {
  const id = data.order_number || 'CV-' + Math.floor(1000 + Math.random() * 9000);
  const now = new Date().toISOString();
  const record = Object.assign({
    id,
    order_number: id,
    club_name: '', club_website: '', location: '', hole_count: '',
    package: '', project_price: 0, payment_type: 'deposit',
    amount_due_now: 0, amount_paid: 0, remaining_balance: 0,
    customer_name: '', customer_email: '',
    source_type: '', source_links: [],
    status: 'draft',
    stripe_customer_id: null, stripe_checkout_session_id: null, stripe_payment_intent_id: null,
    promo_code: null,
    created_at: now
  }, data, { updated_at: now });
  memory.set(id, record);
  return record;
}

async function updateOrder(id, patch) {
  const existing = memory.get(id) || { id, order_number: id };
  const next = Object.assign({}, existing, patch, { updated_at: new Date().toISOString() });
  memory.set(id, next);
  return next;
}

async function getOrder(id) { return memory.get(id) || null; }

async function findBySession(sessionId) {
  for (const record of memory.values()) {
    if (record.stripe_checkout_session_id === sessionId) return record;
  }
  return null;
}

module.exports = { createOrder, updateOrder, getOrder, findBySession };

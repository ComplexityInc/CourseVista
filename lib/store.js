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

// Free-hole trial requests. Kept apart from orders: a lead carries no package,
// price or payment.
const leads = new Map();

async function createLead(data) {
  const id = 'FH-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const record = Object.assign({ id, created_at: new Date().toISOString() }, data);
  leads.set(id, record);
  return record;
}

async function updateLead(id, patch) {
  const next = Object.assign({}, leads.get(id) || { id }, patch, { updated_at: new Date().toISOString() });
  leads.set(id, next);
  return next;
}

// Best-effort duplicate guard on a warm instance; the notification email is the record of truth.
async function findRecentLead(email, website, withinMs) {
  const since = Date.now() - withinMs;
  for (const lead of leads.values()) {
    if (lead.customer_email === email && lead.course_website === website && Date.parse(lead.created_at) >= since) return lead;
  }
  return null;
}

module.exports = { createOrder, updateOrder, getOrder, findBySession, createLead, updateLead, findRecentLead };

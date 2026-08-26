// Transactional email via Resend.
// Server-side only. EMAIL_API_KEY is never exposed to the browser.

const INTERNAL_TO = process.env.COURSEVISTA_INTERNAL_EMAIL || 'business@coursevista.com.au';
const FROM        = process.env.EMAIL_FROM || 'CourseVista <business@send.coursevista.com.au>';
const REPLY_TO    = process.env.EMAIL_REPLY_TO || 'business@coursevista.com.au';
const SITE        = (process.env.SITE_URL || 'https://www.coursevista.com.au').replace(/\/$/, '');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function money(cents) {
  const n = Number(cents || 0) / 100;
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ---------- transport ---------- */

async function send({ to, subject, text, html, replyTo }) {
  if (!to) {
    console.error('[email] no recipient for:', subject);
    return { ok: false, reason: 'no_recipient' };
  }
  if (!process.env.EMAIL_API_KEY) {
    // Loud, not silent — a missing key used to fail invisibly.
    console.error('[email] EMAIL_API_KEY is not set. NOT SENT:', subject, '->', to);
    return { ok: false, reason: 'not_configured' };
  }

  const payload = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    reply_to: replyTo || REPLY_TO,
  };
  if (html) payload.html = html;

  // One retry: Resend 429s and 5xx are transient, and losing an order
  // confirmation to a blip is worse than a second request.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        return { ok: true, id: data.id };
      }

      const detail = await r.text().catch(() => '');
      if (r.status === 429 || r.status >= 500) {
        console.warn(`[email] transient ${r.status}, retrying:`, subject);
        await new Promise((res) => setTimeout(res, 600));
        continue;
      }
      console.error(`[email] Resend rejected ${r.status}:`, detail.slice(0, 400));
      return { ok: false, reason: 'rejected', status: r.status };
    } catch (err) {
      console.error('[email] network failure:', err && err.message);
      await new Promise((res) => setTimeout(res, 600));
    }
  }
  return { ok: false, reason: 'failed' };
}

/* ---------- shared shell ---------- */

function shell(heading, introHtml, rows, footerHtml) {
  const body = rows.filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `
      <tr>
        <td style="padding:9px 22px 9px 0;color:#77796F;font-size:14px;vertical-align:top;white-space:nowrap">${esc(k)}</td>
        <td style="padding:9px 0;color:#16170F;font-size:15px"><strong>${esc(v)}</strong></td>
      </tr>`).join('');

  return `<!doctype html><html><body style="margin:0;padding:0;background:#FAF8F4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#FFFFFF;border:1px solid #E4E0D6">
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:400;color:#2C4A3B">${esc(heading)}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 20px;font-family:-apple-system,system-ui,sans-serif;font-size:15px;line-height:1.55;color:#55584D">
          ${introHtml}
        </td></tr>
        <tr><td style="padding:0 32px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0"
                 style="width:100%;border-collapse:collapse;font-family:-apple-system,system-ui,sans-serif;border-top:1px solid #E4E0D6">
            ${body}
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 30px;font-family:-apple-system,system-ui,sans-serif;font-size:13px;line-height:1.5;color:#77796F;border-top:1px solid #E4E0D6;padding-top:18px">
          ${footerHtml}
        </td></tr>
      </table>
      <p style="max-width:560px;margin:16px auto 0;font-family:-apple-system,system-ui,sans-serif;font-size:12px;color:#9B9C93;text-align:center">
        CourseVista · Adelaide, South Australia · <a href="${SITE}" style="color:#77796F">coursevista.com.au</a>
      </p>
    </td></tr>
  </table></body></html>`;
}

/* ---------- messages ---------- */

async function sendCustomerConfirmation(order) {
  const rows = [
    ['Order', order.order_number],
    ['Club', order.club_name],
    ['Package', order.package],
    ['Paid today', money(order.amount_paid)],
    ['Remaining before delivery', money(order.remaining_balance)],
  ];
  const intake = `${SITE}/order/intake?order=${encodeURIComponent(order.order_number || '')}`;

  return send({
    to: order.customer_email,
    subject: `Your CourseVista project is reserved — ${order.order_number || ''}`.trim(),
    html: shell(
      'Your project is reserved.',
      `<p style="margin:0">Thanks — your payment has gone through and we've reserved production capacity for ${esc(order.club_name || 'your club')}.</p>`,
      rows,
      `<p style="margin:0 0 14px">Next: send us anything extra we should work from. A link is plenty.</p>
       <p style="margin:0"><a href="${intake}" style="display:inline-block;background:#2C4A3B;color:#FFFFFF;padding:11px 20px;font-size:14px;text-decoration:none">Complete project intake →</a></p>
       <p style="margin:16px 0 0">Or just reply to this email — it reaches us directly.</p>`
    ),
    text: [
      `Your CourseVista project is reserved.`, '',
      ...rows.map(([k, v]) => `${k}: ${v}`), '',
      `Complete your project intake: ${intake}`, '',
      `Reply to this email and it reaches us directly.`,
    ].join('\n'),
  });
}

async function sendInternalNotification(order) {
  const rows = [
    ['Order', order.order_number],
    ['Club', order.club_name],
    ['Website', order.club_website],
    ['Location', order.location],
    ['Holes', order.hole_count],
    ['Package', `${order.package || '—'} (${order.payment_type || '—'})`],
    ['Contact', order.customer_name],
    ['Email', order.customer_email],
    ['Paid', `${money(order.amount_paid)} of ${money(order.project_price)}`],
    ['Remaining', money(order.remaining_balance)],
    ['Source', `${order.source_type || '—'} ${(order.source_links || []).join(' ')}`.trim()],
    ['Promo', order.promo_code],
    ['Stripe', order.stripe_payment_intent_id || order.stripe_checkout_session_id],
  ];

  return send({
    to: INTERNAL_TO,
    replyTo: order.customer_email || REPLY_TO,
    subject: `New order — ${order.club_name || 'unknown club'} (${order.package || '—'}) ${money(order.amount_paid)}`,
    html: shell(
      'New CourseVista order',
      `<p style="margin:0">Payment received. Reply to this email to reach the club directly.</p>`,
      rows,
      `<p style="margin:0">Status: <strong>${esc(order.status || 'paid')}</strong></p>`
    ),
    text: rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'),
  });
}

async function sendEnquiry(data) {
  const rows = [
    ['Club', data.club], ['Website', data.url], ['Holes', data.holes],
    ['Contact', data.name], ['Role', data.role],
    ['Email', data.email], ['Phone', data.phone], ['Wants', data.goals],
  ];
  return send({
    to: INTERNAL_TO,
    replyTo: data.email || REPLY_TO,
    subject: `Enquiry — ${data.club || data.name || 'new'}`,
    html: shell('New enquiry',
      `<p style="margin:0">From the site enquiry form. Reply directly to respond.</p>`, rows, ''),
    text: rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'),
  });
}

async function sendPromoCode(email, code) {
  return send({
    to: email,
    subject: 'Your CourseVista offer code',
    html: shell('Your offer code',
      `<p style="margin:0">Here's the code you unlocked. It takes 10% off your first project.</p>`,
      [['Code', code], ['Valid for', '14 days']],
      `<p style="margin:0">Quote it when you request your project, or use it at checkout.</p>
       <p style="margin:14px 0 0"><a href="${SITE}/start?package=complete" style="color:#2C4A3B">Start a project →</a></p>`),
    text: `Your CourseVista offer code: ${code}\nValid 14 days. 10% off your first project.\n${SITE}/start?package=complete`,
  });
}

module.exports = {
  send, money,
  sendCustomerConfirmation, sendInternalNotification,
  sendEnquiry, sendPromoCode,
};

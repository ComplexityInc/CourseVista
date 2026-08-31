// POST /api/demo-request
// Three-holes-free request from the /demo page modal.
// Server-side only; EMAIL_API_KEY never reaches the browser.

const { send } = require('../lib/email');

const INTERNAL = process.env.COURSEVISTA_INTERNAL_EMAIL || 'business@coursevista.com.au';
const SITE = (process.env.SITE_URL || 'https://www.coursevista.com.au').replace(/\/$/, '');
const MAX = 400;

const clean = (v) => String(v ?? '').trim().slice(0, MAX);
const esc = (v) => clean(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // Honeypot — bots complete hidden fields, humans never see them.
  if (clean(body.company)) return res.status(200).json({ ok: true });

  const email = clean(body.email).toLowerCase();
  const club = clean(body.club);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!club) {
    return res.status(400).json({ error: 'Please tell us which club you\u2019re with.' });
  }

  const rows = [
    ['Club', body.club],
    ['Website', body.website],
    ['Contact', body.name],
    ['Role', body.role],
    ['Email', email],
    ['Phone', body.phone],
    ['Holes wanted', body.holes],
    ['Interested in full course', body.full ? 'Yes' : 'Not stated'],
    ['Notes', body.notes],
  ].filter(([, v]) => clean(v));

  const html = `
    <h2 style="font-family:Georgia,serif;color:#2C4A3B;margin:0 0 6px">Three holes free \u2014 request</h2>
    <p style="font-family:system-ui,sans-serif;font-size:14px;color:#77796F;margin:0 0 18px">
      From the demonstration page. Reply to this email to reach them directly.</p>
    <table style="font-family:system-ui,sans-serif;font-size:15px;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:7px 20px 7px 0;color:#77796F;vertical-align:top;white-space:nowrap">${esc(k)}</td>
        <td style="padding:7px 0;color:#16170F"><strong>${esc(v)}</strong></td></tr>`).join('')}
    </table>`;

  const internal = await send({
    to: INTERNAL,
    replyTo: email,
    subject: `Three holes free \u2014 ${clean(body.club)}`,
    html,
    text: rows.map(([k, v]) => `${k}: ${clean(v)}`).join('\n'),
  });

  if (!internal || !internal.ok) {
    console.error('[demo-request] internal notification failed for', email);
    return res.status(502).json({ error: 'Could not send just now. Please email business@coursevista.com.au directly.' });
  }

  // Acknowledgement to the club. Failure here is not fatal — we have the lead.
  await send({
    to: email,
    subject: 'Your three holes \u2014 CourseVista',
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#55584D;max-width:520px">
      <h2 style="font-family:Georgia,serif;font-weight:400;color:#2C4A3B;margin:0 0 12px">Thanks \u2014 got it.</h2>
      <p style="margin:0 0 14px">I'll come back to you within a day or so about the three holes for ${esc(body.club)}.</p>
      <p style="margin:0 0 14px">If you already know which photographs you'd like me to work from, just reply to this email with links or attachments. If not, I'll usually find enough on the club's own website.</p>
      <p style="margin:0 0 20px">No cost, and nothing to commit to.</p>
      <p style="margin:0;color:#77796F;font-size:13px">Brandon Pullens \u00b7 CourseVista<br>
      <a href="${SITE}" style="color:#2C4A3B">coursevista.com.au</a></p></div>`,
    text: `Thanks — got it.\n\nI'll come back to you within a day or so about the three holes for ${clean(body.club)}.\n\nIf you already know which photographs you'd like me to work from, reply with links or attachments. Otherwise I'll usually find enough on the club's own website.\n\nNo cost, nothing to commit to.\n\nBrandon Pullens · CourseVista\n${SITE}`,
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
};

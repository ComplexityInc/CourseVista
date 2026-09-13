# CourseVista

Static marketing site. No build step — plain HTML, CSS and JS.

| Path | Page |
| --- | --- |
| `index.html` | Landing page |
| `glenelg/index.html` | Glenelg Golf Club delivery preview |
| `assets/` | Films, photography, textures, logos |
| `support.js` | Runtime for the landing page |
| `catalog.js` | **Package prices, inclusions, free-trial offer and recommendation rules** — shared by every page and the API |
| `finder.js` | "Find my package" finder and "Get one hole free" request dialogs |
| `demo/` | Demo pages: one layout (`demo.js`, `demo.css`) driven by a config per page in `demo/configs/` — `/demo` and client demos such as `/demo/mt-osmond` |
| `start/index.html` | Project ordering flow (`/start?package=essentials&holes=18`) |
| `order/success/index.html` | Stripe return page + project intake |
| `api/` | Serverless functions: Stripe checkout, webhook, orders, promo codes |
| `lib/` | Pricing/tax config, order store, email and promo boundaries |

## Publishing a change

Double-click **publish.bat** (Windows) or **publish.command** (Mac).

It commits everything and pushes to `ComplexityInc/CourseVista`. Vercel picks
that up and redeploys within about a minute. First run also sets the
repository up, so there is nothing to configure.

## Vercel

Framework preset: Other. No build command. Output directory `.`.
Connect the repo under Project → Settings → Git so pushes deploy automatically.

## Prices and packages

Every price lives in `catalog.js` (`PRICES`): total AUD package prices, GST-inclusive,
for 9, 18, 27 or 36 holes. The home page, package finder, `/start`, terms page,
Glenelg preview and the Stripe charge all read from it — change a price there and
nowhere else, then run `npm run check`.

The package finder recommends the lowest-priced package that includes everything
the visitor selected (`CVCatalog.recommend`); "not sure yet" starts from Complete.

## Free-hole requests

The only free offer is **one hole** (`CVCatalog.FREE_TRIAL`). "Get one hole free"
opens a short form (course name, website, email, optional hole number) that posts
to `POST /api/free-hole`. That records a one-hole trial — no package, no payment —
and emails it to `COURSEVISTA_INTERNAL_EMAIL` via Resend, plus a receipt to the
requester. The visitor only sees success once the email is accepted.

If the API is unreachable or `EMAIL_API_KEY` is missing, the form falls back to
**FormSubmit** (`https://formsubmit.co/ajax/business@coursevista.com.au`), which
needs one-time activation from the confirmation email it sends to that inbox. If
both fail, the visitor gets an error with a pre-filled email link — never a false
success.

## Demo pages

`/demo` and client demos share `demo/demo.js`: introduction → flyovers → Complete
(suggested) and Hosted (upgrade) priced from `catalog.js` → what happens after
purchase → closing purchase CTA. Package buttons open `/start` with the package,
hole count and any known course details pre-filled.

To add a client demo: copy `demo/mt-osmond/index.html` to `demo/<slug>/index.html`,
point it at a new `demo/configs/<slug>.js`, and put that club's files in
`demo/<slug>/assets/`. In the config set the verified full-course hole count
(`course.holes`, not the number of preview films), the logo, one `videos` entry per
supplied film with its real hole label, and `handoff` details for the order form.
Client pages are `noindex` and are not linked from the homepage, `/demo` or the sitemap.

## Ordering flow

`/start` runs the four-step commissioning flow — course, package, review, payment.
Package and hole count arrive pre-selected from the pricing cards or the package
finder (`?package=…&holes=…`). Unclear source material is routed to a free source
review instead of checkout, so no payment is taken on a project that may not be workable.
Facilities beyond 36 holes or with multiple courses are handled by email.

### Server pieces

| Endpoint | Does |
| --- | --- |
| `POST /api/create-payment-intent` | Creates/reuses the Stripe Customer, resolves the price server-side, returns a client secret for the embedded Payment Element |
| `POST /api/create-checkout-session` | Fallback path — hosted Stripe Checkout when the Payment Element cannot load |
| `POST /api/stripe-webhook` | Verifies the signature and settles the order (`payment_intent.*`, `checkout.session.completed`, `invoice.*`) |
| `POST /api/order-status` | Read-only lookup for the success page (falls back to the Stripe Session / PaymentIntent when the store is cold) |
| `POST /api/free-hole` | Records a one-hole trial request and emails it; no payment |
| `POST /api/orders` | Creates an `assessment_required` record with no payment |
| `POST /api/orders/intake` | Attaches post-purchase project details |
| `POST /api/validate-promo` | Validates a `CV-XXXXXX` scratch code (10% first project) |
| `POST /api/create-balance-invoice` | Issues the final-balance tax invoice with Stripe Invoicing + Tax |
| `POST /api/create-balance-session` | Older Checkout-link version of the balance collection |

The server prices every charge from package + hole count via `lib/pricing.js`
(which reads `catalog.js`) — the browser never sets an amount, and Stripe charges
use inline `price_data`, so there are no Stripe Price IDs to keep in sync. Swap
`lib/store.js` for the real database and `lib/email.js` for the mail provider.

### Environment variables

```
STRIPE_SECRET_KEY            # sk_live_… / sk_test_… — server only, never in the repo
STRIPE_PUBLISHABLE_KEY      # pk_live_… / pk_test_… — returned to the browser by the API
STRIPE_WEBHOOK_SECRET       # whsec_…
INVOICE_DAYS_UNTIL_DUE=7
SITE_URL=https://coursevista.com.au
COURSEVISTA_INTERNAL_EMAIL=business@coursevista.com.au
EMAIL_API_KEY
```

Set these in Vercel → Project → Settings → Environment Variables (Production and
Preview). They must never be committed, pasted into the site's HTML, or sent to
the browser — the publishable key is the only one that ever reaches the client,
and it is served by the API rather than hard-coded.

### Card data and PCI scope

Card entry is a Stripe Payment Element: Stripe.js renders the number, expiry and
CVC inside its own cross-origin iframes and tokenises straight to Stripe. No card
data enters this site's DOM, JavaScript state, `localStorage` or our API, so there
is nothing on our side to encrypt or hash (PCI DSS SAQ‑A). The browser draft in
`localStorage` holds only package, club, website, hole count and location — no
email, promo code or payment detail — and is cleared on successful payment.

### Stripe dashboard setup

1. **Webhook** → `https://coursevista.com.au/api/stripe-webhook`, subscribed to
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
   `invoice.marked_uncollectible`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
2. **Payment methods** → enable cards, Apple Pay, Google Pay and Link. Apple Pay
   needs coursevista.com.au registered as a verified domain.
3. **Tax** → register AU GST under Tax → Registrations, and set the product tax
   code to a digital/professional service. Displayed prices are GST-inclusive
   (`GST_MODE` in `lib/pricing.js`), so invoice line items use `tax_behavior: 'inclusive'`.
4. **Invoicing** → add the ABN (63 310 893 546), logo and payment terms under
   Settings → Invoicing so balance invoices are valid AU tax invoices.
5. **Branding** → set the business name, logo and brand colours; these show on
   the Payment Element, receipts and hosted invoices.

Test with `sk_test_…` and card `4242 4242 4242 4242`, plus `4000 0027 6000 3184`
for a 3DS challenge. Until `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are
set the API returns `stripe_not_configured`, the card field shows a locked
placeholder, and the flow falls back to hosted Checkout.

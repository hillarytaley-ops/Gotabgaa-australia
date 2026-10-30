import fs from 'fs';
import path from 'path';

const TEST_FROM = 'Gotabgaa Australia <onboarding@resend.dev>';
const FROM = process.env.EMAIL_FROM || TEST_FROM;
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'info@gotabgaaaustralia.org';
const LOGO_CID = 'gotabgaa-logo';

function isUnverifiedDomainError(message) {
  return /associated domain with your API key is not verified|domain is not verified|create a new API key with full access/i.test(String(message || ''));
}

function friendlyEmailError(message) {
  if (isUnverifiedDomainError(message)) {
    return 'Resend cannot send from your domain yet. Confirm gotabgaaaustralia.org is Verified in Resend, set EMAIL_FROM to Gotabgaa Australia <noreply@gotabgaaaustralia.org> in Vercel, then redeploy.';
  }
  return message;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function siteUrl() {
  const raw = String(process.env.SITE_URL || 'https://www.gotabgaaaustralia.org').trim().replace(/\/$/, '');
  // Prefer www so logo + password links open on the live site.
  if (/^https?:\/\/gotabgaaaustralia\.org$/i.test(raw)) {
    return 'https://www.gotabgaaaustralia.org';
  }
  return raw || 'https://www.gotabgaaaustralia.org';
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Inline logo so it opens inside the email (not a separate remote image / attachment view). */
function getLogoAttachment() {
  try {
    const filePath = path.join(process.cwd(), 'assets', 'logo-round.png');
    if (fs.existsSync(filePath)) {
      return {
        filename: 'logo-round.png',
        content: fs.readFileSync(filePath).toString('base64'),
        content_id: LOGO_CID,
        content_type: 'image/png'
      };
    }
  } catch (_) {
    /* fall through to hosted path */
  }
  return {
    filename: 'logo-round.png',
    path: `${siteUrl()}/assets/logo-round.png`,
    content_id: LOGO_CID
  };
}

/**
 * One branded message: logo on top of the same body as the copy.
 */
function withGotabgaaBrand(html) {
  let body = String(html || '').trim();
  body = body
    .replace(/<div[^>]*>\s*<img[^>]*(?:logo-round\.png|cid:gotabgaa-logo)[^>]*>[\s\S]*?<\/div>/i, '')
    .trim();

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#2a1f17;max-width:560px;margin:0 auto;padding:24px 16px">
  <p style="margin:0 0 18px;text-align:center">
    <img src="cid:${LOGO_CID}" alt="Gotabgaa Australia" width="88" height="88" style="display:inline-block;border:0;border-radius:50%;outline:none;text-decoration:none" />
    <br />
    <span style="display:inline-block;margin-top:10px;font-size:15px;font-weight:700;color:#3d2e22">Gotabgaa Australia</span>
  </p>
  ${body}
  <p style="margin:24px 0 0;color:#3d2e22">Unity · Heritage · Excellence<br /><strong>Gotabgaa Australia</strong></p>
  <p style="margin:10px 0 0;color:#6b5b4f;font-size:14px">Questions? Reply to this email or write to ${escapeHtml(REPLY_TO)}.</p>
</div>
  `;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function isUsingCustomFromDomain() {
  return Boolean(FROM) && !/onboarding@resend\.dev/i.test(FROM);
}

async function postResendEmail(key, from, { to, subject, html, text, attachments }) {
  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || stripHtmlToText(html),
    attachments: attachments || undefined
  };
  // Custom-domain From improves inbox placement; Reply-To helps Gmail trust the brand.
  if (REPLY_TO && !/onboarding@resend\.dev/i.test(from)) {
    body.reply_to = REPLY_TO;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return {
      ok: false,
      skipped: true,
      reason: 'RESEND_API_KEY is not set in Vercel. Add it under Project Settings → Environment Variables, then redeploy.'
    };
  }
  if (!to) {
    return { ok: false, skipped: true, reason: 'Missing recipient email' };
  }

  const brandedHtml = withGotabgaaBrand(html);
  const plainText = text || stripHtmlToText(brandedHtml);
  const payload = {
    to,
    subject,
    html: brandedHtml,
    text: plainText,
    attachments: [getLogoAttachment()]
  };
  // Prefer branded domain From (inbox). Fall back to Resend test sender only if domain is not verified.
  let { res, data } = await postResendEmail(key, FROM, payload);
  const firstError = data.message || data.error || (!res.ok ? `Email failed (${res.status})` : '');

  if (!res.ok && FROM !== TEST_FROM && isUnverifiedDomainError(firstError)) {
    ({ res, data } = await postResendEmail(key, TEST_FROM, payload));
  }

  if (!res.ok) {
    const err = data.message || data.error || firstError || `Email failed (${res.status})`;
    return { ok: false, error: friendlyEmailError(err) };
  }

  return { ok: true, id: data.id, from: FROM };
}

function paymentBlock(payment, amount, reference) {
  const lines = [
    payment?.legalName,
    payment?.abn ? `ABN: ${payment.abn}` : null,
    amount ? `Amount: ${amount}` : null,
    reference ? `Reference: ${reference}` : null,
    payment?.payId ? `PayID: ${payment.payId}` : null,
    payment?.bsb && payment?.accountNumber
      ? `BSB: ${payment.bsb} · Account: ${payment.accountNumber}` : null,
    payment?.accountName ? `Account name: ${payment.accountName}` : null,
    payment?.gstNote || null,
    payment?.instructions || null
  ].filter(Boolean);

  return lines.map(line => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join('');
}

export async function sendRegistrationConfirmation({ to, name, payment, amount, reference, subject, intro }) {
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px">Registration received</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>${escapeHtml(intro || 'Thank you for registering with Gotabgaa Australia. Please complete payment using the details below.')}</p>
      ${paymentBlock(payment, amount, reference)}
      <p>Our team will confirm your membership after payment is received.</p>
  `;

  return sendEmail({
    to,
    subject: subject || 'Gotabgaa Australia — complete your membership payment',
    html
  });
}

export async function sendMembershipApproved({
  to,
  name,
  membershipId,
  payment,
  amount,
  reference,
  paymentStatus,
  passwordSetupLink,
  isResync
}) {
  const paySection = paymentStatus === 'paid'
    ? '<p>Your payment is recorded. Welcome to the community!</p>'
    : `${paymentBlock(payment, amount, reference)}`;

  const loginSection = passwordSetupLink
    ? `<p><strong>Create your password</strong> to access the members dashboard:</p>
       <p><a href="${escapeHtml(passwordSetupLink)}" style="display:inline-block;padding:12px 18px;background:#3d2b1f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Set password &amp; sign in</a></p>
       <p style="color:#6b5b4f;font-size:14px">This secure link expires after a short time. If it expires, use “Forgot password” on the sign-in page.</p>`
    : `<p>Visit <strong>login.html</strong> and use <em>Forgot password</em> with this email to create your password.</p>`;

  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px">${isResync ? 'Member login ready' : 'Membership approved'}</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>${isResync
        ? 'Your Gotabgaa Australia member login has been set up (or refreshed).'
        : 'Your Gotabgaa Australia membership has been approved.'}</p>
      <p>Your membership ID is <strong>${escapeHtml(membershipId)}</strong> (keep this for your records).</p>
      ${loginSection}
      <p>After setting your password, sign in at <a href="${escapeHtml(siteUrl())}/login.html">the Sign In page</a> with your <strong>email and password</strong>.</p>
      ${paySection}
  `;

  return sendEmail({
    to,
    subject: isResync
      ? 'Gotabgaa Australia — set your member password'
      : 'Gotabgaa Australia — membership approved',
    html
  });
}

export async function sendPaymentReceipt({ to, name, type, payment, amount, reference, invoiceNumber }) {
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px">Payment receipt</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>We have received your payment for <strong>${escapeHtml(type)}</strong>.</p>
      <p><strong>Receipt #:</strong> ${escapeHtml(invoiceNumber || reference)}</p>
      <p><strong>Amount:</strong> ${escapeHtml(amount)}</p>
      <p><strong>Reference:</strong> ${escapeHtml(reference)}</p>
      <p>${escapeHtml(payment?.legalName || 'Gotabgaa Australia')}${payment?.abn ? ` · ABN ${escapeHtml(payment.abn)}` : ''}</p>
      <p style="color:#6b5b4f">${escapeHtml(payment?.gstNote || '')}</p>
  `;

  return sendEmail({
    to,
    subject: 'Gotabgaa Australia — payment receipt',
    html
  });
}

export async function sendPasswordReset({ to, name, resetLink }) {
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px">Reset your password</h2>
      <p>Hi ${escapeHtml(name || 'there')},</p>
      <p>Use this link to set a new password for your Gotabgaa Australia account:</p>
      <p><a href="${escapeHtml(resetLink)}" style="display:inline-block;padding:12px 18px;background:#3d2b1f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Set password &amp; sign in</a></p>
      <p style="color:#6b5b4f;font-size:14px">This link expires after a short time. If you did not request it, you can ignore this email.</p>
      <p>After setting your password, sign in at <a href="${escapeHtml(siteUrl())}/login.html">the Sign In page</a>.</p>
  `;

  return sendEmail({
    to,
    subject: 'Gotabgaa Australia — reset your password',
    html
  });
}

export async function sendAdminInvite({ to, name, setupLink }) {
  const firstName = String(name || 'Committee member').trim() || 'Committee member';
  const loginUrl = `${siteUrl()}/login.html?dest=admin`;
  const fromHint = /onboarding@resend\.dev/i.test(FROM)
    ? 'Gotabgaa Australia'
    : (FROM.match(/<([^>]+)>/) || [])[1] || REPLY_TO;
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px">Committee admin invitation</h2>
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>You have been invited to the <strong>Gotabgaa Australia</strong> committee admin dashboard.</p>
      <p>Use this link to create your password (it expires after a short time):</p>
      <p><a href="${escapeHtml(setupLink)}" style="display:inline-block;padding:12px 18px;background:#3d2b1f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Create password &amp; continue</a></p>
      <p>After that, sign in at <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a> with this email and your new password, then open the leadership admin dashboard.</p>
      <p style="color:#6b5b4f;font-size:14px">If you were not expecting this invitation, you can ignore this email. Questions? Reply to ${escapeHtml(REPLY_TO)} (sent via ${escapeHtml(fromHint)}).</p>
  `;

  return sendEmail({
    to,
    subject: 'Gotabgaa Australia — committee admin invitation',
    html
  });
}

export async function sendBookingConfirmation({ to, name, eventTitle, payment, amount, reference, tickets }) {
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px">Event booking received</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your booking for <strong>${escapeHtml(eventTitle)}</strong> (${escapeHtml(String(tickets))} place(s)) is registered.</p>
      ${Number(amount?.replace?.(/[^0-9.]/g, '') || 0) > 0
    ? `<p>Please complete payment:</p>${paymentBlock(payment, amount, reference)}`
    : '<p>No payment is required for this event.</p>'}
  `;

  return sendEmail({
    to,
    subject: `Gotabgaa Australia — booking: ${eventTitle}`,
    html
  });
}

export async function sendMeetGreetFeedbackThanks({ to, name }) {
  const firstName = String(name || 'Friend').trim() || 'Friend';
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px;font-size:22px">Kongoi Bik Chok</h2>
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Thank you for taking part in the Meet &amp; Greet feedback review with Gotabgaa Australia.</p>
      <p>Your answers help us plan the next gathering for our community.</p>
      <p>We are grateful for your time and participation.</p>
  `;

  return sendEmail({
    to,
    subject: 'Kongoi Bik Chok — thank you for your Meet & Greet feedback',
    html
  });
}

export async function sendEfareVoteThanks({ to, name, vote }) {
  const firstName = String(name || 'Friend').trim() || 'Friend';
  const choice = vote === 'nay' ? 'Nay — I do not adopt the proposal' : 'Aye — I adopt the proposal';
  const html = `
      <h2 style="color:#3d2e22;margin:0 0 16px;font-size:22px">Thank you for voting</h2>
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Thank you for taking part in the Interim Leadership vote on <strong>Empowerment Fare (E-Fare)</strong>.</p>
      <p>Your vote has been recorded as <strong>${escapeHtml(choice)}</strong>.</p>
      <p>Each email can vote only once. This note confirms that your vote is in.</p>
  `;

  return sendEmail({
    to,
    subject: 'Gotabgaa Australia — thank you for your E-Fare vote',
    html
  });
}

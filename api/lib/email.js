const FROM = process.env.EMAIL_FROM || 'Gotabgaa Australia <onboarding@resend.dev>';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) {
    return { ok: false, skipped: true, reason: 'Email not configured or missing recipient' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ')
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.message || data.error || `Email failed (${res.status})` };
  }

  return { ok: true, id: data.id };
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
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#2a1f17">
      <h2 style="color:#3d2e22">Registration received</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>${escapeHtml(intro || 'Thank you for registering with Gotabgaa Australia. Please complete payment using the details below.')}</p>
      ${paymentBlock(payment, amount, reference)}
      <p>Our team will confirm your membership after payment is received.</p>
      <p style="color:#6b5b4f;font-size:14px">Questions? Reply to ${escapeHtml(payment?.receiptEmail || 'info@gotabgaaaustralia.org')}</p>
    </div>
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
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#2a1f17">
      <h2 style="color:#3d2e22">${isResync ? 'Member login ready' : 'Membership approved'}</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>${isResync
        ? 'Your Gotabgaa Australia member login has been set up (or refreshed).'
        : 'Your Gotabgaa Australia membership has been approved.'}</p>
      <p>Your membership ID is <strong>${escapeHtml(membershipId)}</strong> (keep this for your records).</p>
      ${loginSection}
      <p>After setting your password, sign in at <a href="https://gotabgaa-australia.vercel.app/login.html">the Sign In page</a> with your <strong>email and password</strong>.</p>
      ${paySection}
    </div>
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
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#2a1f17">
      <h2 style="color:#3d2e22">Payment receipt</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>We have received your payment for <strong>${escapeHtml(type)}</strong>.</p>
      <p><strong>Receipt #:</strong> ${escapeHtml(invoiceNumber || reference)}</p>
      <p><strong>Amount:</strong> ${escapeHtml(amount)}</p>
      <p><strong>Reference:</strong> ${escapeHtml(reference)}</p>
      <p>${escapeHtml(payment?.legalName || 'Gotabgaa Australia')}${payment?.abn ? ` · ABN ${escapeHtml(payment.abn)}` : ''}</p>
      <p style="color:#6b5b4f">${escapeHtml(payment?.gstNote || '')}</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: 'Gotabgaa Australia — payment receipt',
    html
  });
}

export async function sendBookingConfirmation({ to, name, eventTitle, payment, amount, reference, tickets }) {
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#2a1f17">
      <h2 style="color:#3d2e22">Event booking received</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your booking for <strong>${escapeHtml(eventTitle)}</strong> (${escapeHtml(String(tickets))} place(s)) is registered.</p>
      ${Number(amount?.replace?.(/[^0-9.]/g, '') || 0) > 0
    ? `<p>Please complete payment:</p>${paymentBlock(payment, amount, reference)}`
    : '<p>No payment is required for this event.</p>'}
    </div>
  `;

  return sendEmail({
    to,
    subject: `Gotabgaa Australia — booking: ${eventTitle}`,
    html
  });
}

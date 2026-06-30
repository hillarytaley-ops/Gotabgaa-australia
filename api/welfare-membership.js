import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { buildPaymentReference, loadPaymentConfig, formatAud } from './lib/payment.js';
import { sendRegistrationConfirmation } from './lib/email.js';

function buildWelfareReference(id, config = {}) {
  return buildPaymentReference(config.welReferencePrefix || 'GAA-WEL', id);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Welfare database not configured' });
    return;
  }

  const {
    name,
    email,
    phone,
    membershipId,
    stateChapter,
    packageId,
    packageTitle,
    feeAmount,
    feeCurrency,
    feeDisplay,
    notes
  } = req.body || {};

  if (!name?.trim() || !email?.trim() || !packageId?.trim()) {
    res.status(400).json({ error: 'Name, email, and welfare package are required' });
    return;
  }

  const supabase = getSupabase();
  const paymentConfig = await loadPaymentConfig();

  const { data: row, error } = await supabase
    .from('welfare_registrations')
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || '').trim(),
      membership_id: (membershipId || '').trim().toUpperCase() || null,
      state_chapter: (stateChapter || '').trim(),
      package_id: packageId.trim(),
      package_title: (packageTitle || '').trim(),
      fee_amount: feeAmount != null && feeAmount !== '' ? Number(feeAmount) : null,
      fee_currency: (feeCurrency || 'AUD').trim(),
      fee_display: (feeDisplay || '').trim(),
      payment_status: 'pending',
      welfare_status: 'pending',
      notes: (notes || '').trim(),
      data: {}
    })
    .select('id')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to save welfare registration', detail: error.message });
    return;
  }

  const paymentReference = buildWelfareReference(row.id, paymentConfig);
  const amount = feeDisplay || formatAud(feeAmount);

  await supabase
    .from('welfare_registrations')
    .update({
      payment_reference: paymentReference,
      data: { paymentReference }
    })
    .eq('id', row.id);

  const emailResult = await sendRegistrationConfirmation({
    to: email.trim(),
    name: name.trim(),
    payment: paymentConfig,
    amount,
    reference: paymentReference,
    subject: 'Gotabgaa Australia — Social Welfare registration received',
    intro: 'Thank you for registering for the Gotabgaa Australia Social Welfare program. Complete payment using the details below. The welfare team will activate your membership after payment is confirmed.'
  });

  res.status(200).json({
    ok: true,
    registrationId: row.id,
    paymentReference,
    amount,
    payment: paymentConfig,
    emailSent: emailResult.ok === true,
    message: 'Welfare registration received! Complete payment using the instructions below. Our welfare team will activate your membership after payment is confirmed.'
  });
}

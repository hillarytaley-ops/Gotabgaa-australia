import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  buildMembershipReference,
  loadPaymentConfig,
  formatAud
} from './lib/payment.js';
import { sendRegistrationConfirmation } from './lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Membership database not configured' });
    return;
  }

  const {
    name,
    email,
    phone,
    stateChapter,
    membershipType,
    address,
    dateOfBirth,
    referralSource,
    notes,
    feeAmount,
    feeCurrency,
    feeDisplay
  } = req.body || {};

  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  const supabase = getSupabase();
  const paymentConfig = await loadPaymentConfig();

  const { data: row, error } = await supabase
    .from('membership_registrations')
    .insert({
      name: name.trim(),
      email: email.trim(),
      phone: (phone || '').trim(),
      state_chapter: (stateChapter || '').trim(),
      membership_type: (membershipType || '').trim(),
      address: (address || '').trim(),
      date_of_birth: (dateOfBirth || '').trim(),
      referral_source: (referralSource || '').trim(),
      notes: (notes || '').trim(),
      fee_amount: feeAmount != null && feeAmount !== '' ? Number(feeAmount) : null,
      fee_currency: (feeCurrency || 'AUD').trim(),
      fee_display: (feeDisplay || '').trim(),
      payment_status: 'pending',
      payment_method: null,
      data: {}
    })
    .select('id')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to save registration', detail: error.message });
    return;
  }

  const paymentReference = buildMembershipReference(row.id, paymentConfig);
  const amount = feeDisplay || formatAud(feeAmount);

  await supabase
    .from('membership_registrations')
    .update({
      payment_reference: paymentReference,
      data: { paymentReference }
    })
    .eq('id', row.id)
    .then(({ error: refError }) => {
      if (refError && String(refError.message).includes('payment_reference')) {
        return supabase
          .from('membership_registrations')
          .update({ data: { paymentReference } })
          .eq('id', row.id);
      }
      return null;
    });

  const emailResult = await sendRegistrationConfirmation({
    to: email.trim(),
    name: name.trim(),
    payment: paymentConfig,
    amount,
    reference: paymentReference
  });

  res.status(200).json({
    ok: true,
    registrationId: row.id,
    paymentReference,
    amount,
    payment: paymentConfig,
    emailSent: emailResult.ok === true,
    message: 'Registration received! Complete payment using the instructions below. Our team will confirm your membership after payment is received.'
  });
}

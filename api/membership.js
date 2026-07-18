import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  buildMembershipReference,
  loadPaymentConfig,
  formatAud
} from './lib/payment.js';
import { sendRegistrationConfirmation } from './lib/email.js';
import { isSchemaColumnError } from './lib/member-registration.js';

async function insertMembership(supabase, payload) {
  const attempts = [
    payload,
    // Drop optional columns that older schemas may not have
    (() => {
      const next = { ...payload };
      delete next.payment_reference;
      delete next.paid_at;
      delete next.membership_id;
      delete next.member_status;
      delete next.auth_user_id;
      return next;
    })(),
    {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      state_chapter: payload.state_chapter,
      membership_type: payload.membership_type,
      notes: payload.notes,
      fee_amount: payload.fee_amount,
      fee_currency: payload.fee_currency,
      fee_display: payload.fee_display,
      payment_status: 'pending',
      data: payload.data || {}
    },
    {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      membership_type: payload.membership_type,
      notes: payload.notes,
      payment_status: 'pending',
      data: payload.data || {}
    }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('membership_registrations')
      .insert(attempt)
      .select('id')
      .single();

    if (!error && data) return data;
    lastError = error;
    if (error && !isSchemaColumnError(error)) break;
  }

  throw lastError || new Error('Failed to save registration');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Membership database not configured' });
    return;
  }

  try {
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

    const row = await insertMembership(supabase, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
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
      member_status: 'pending',
      data: {}
    });

    const paymentReference = buildMembershipReference(row.id, paymentConfig);
    const amount = feeDisplay || formatAud(feeAmount);

    const { error: refError } = await supabase
      .from('membership_registrations')
      .update({
        payment_reference: paymentReference,
        data: { paymentReference }
      })
      .eq('id', row.id);

    if (refError) {
      await supabase
        .from('membership_registrations')
        .update({ data: { paymentReference } })
        .eq('id', row.id);
    }

    let emailResult = { ok: false };
    try {
      emailResult = await sendRegistrationConfirmation({
        to: email.trim(),
        name: name.trim(),
        payment: paymentConfig,
        amount,
        reference: paymentReference
      });
    } catch (emailError) {
      console.error('[membership] confirmation email failed', emailError);
    }

    res.status(200).json({
      ok: true,
      registrationId: row.id,
      paymentReference,
      amount,
      payment: paymentConfig,
      emailSent: emailResult.ok === true,
      message: 'Registration received! Complete payment using the instructions below. Our team will confirm your membership after payment is received.'
    });
  } catch (error) {
    console.error('[membership] registration failed', error);
    res.status(500).json({
      error: 'Failed to save registration',
      detail: error?.message || String(error)
    });
  }
}

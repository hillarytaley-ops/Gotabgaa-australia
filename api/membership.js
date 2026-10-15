import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  buildMembershipReference,
  loadPaymentConfig,
  formatAud
} from './lib/payment.js';
import { sendRegistrationConfirmation } from './lib/email.js';
import { isSchemaColumnError } from './lib/member-registration.js';
import { ensureMemberAuthUser } from './lib/member-auth.js';

function parseBody(req) {
  if (req.body == null || req.body === '') return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Invalid JSON body');
    }
  }
  return req.body;
}

function toFeeAmount(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function insertMembership(supabase, base) {
  // Progressive fallbacks for older Supabase schemas missing newer columns
  const attempts = [
    { ...base },
    (() => {
      const next = { ...base };
      delete next.payment_reference;
      delete next.paid_at;
      delete next.membership_id;
      delete next.member_status;
      delete next.auth_user_id;
      delete next.payment_method;
      return next;
    })(),
    {
      name: base.name,
      email: base.email,
      phone: base.phone,
      state_chapter: base.state_chapter,
      membership_type: base.membership_type,
      address: base.address,
      date_of_birth: base.date_of_birth,
      referral_source: base.referral_source,
      notes: base.notes,
      fee_amount: base.fee_amount,
      fee_currency: base.fee_currency,
      fee_display: base.fee_display,
      payment_status: 'pending',
      data: base.data
    },
    {
      name: base.name,
      email: base.email,
      phone: base.phone,
      state_chapter: base.state_chapter,
      membership_type: base.membership_type,
      address: base.address,
      date_of_birth: base.date_of_birth,
      referral_source: base.referral_source,
      notes: base.notes,
      fee_amount: base.fee_amount,
      fee_currency: base.fee_currency,
      fee_display: base.fee_display,
      payment_status: 'pending'
    },
    {
      name: base.name,
      email: base.email,
      phone: base.phone,
      state_chapter: base.state_chapter,
      membership_type: base.membership_type,
      notes: base.notes,
      fee_amount: base.fee_amount,
      fee_currency: base.fee_currency,
      fee_display: base.fee_display,
      payment_status: 'pending'
    },
    {
      name: base.name,
      email: base.email,
      phone: base.phone,
      membership_type: base.membership_type,
      notes: base.notes,
      payment_status: 'pending'
    },
    {
      name: base.name,
      email: base.email,
      phone: base.phone,
      notes: base.notes
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
    // Keep trying simpler payloads when the schema is missing columns
    if (error && !isSchemaColumnError(error)) {
      // Still retry once without optional payment fields for other recoverable cases
      continue;
    }
  }

  const detail = lastError?.message || 'Failed to save registration';
  const err = new Error(detail);
  err.code = lastError?.code;
  err.details = lastError?.details;
  throw err;
}

async function savePaymentReference(supabase, id, paymentReference) {
  const attempts = [
    { payment_reference: paymentReference, data: { paymentReference } },
    { data: { paymentReference } },
    { payment_reference: paymentReference },
    { notes: `[gaa-payment-ref]${paymentReference}` }
  ];

  for (const payload of attempts) {
    // notes fallback should append, not overwrite — only use if we can read first
    if (payload.notes) {
      const { data: row } = await supabase
        .from('membership_registrations')
        .select('notes')
        .eq('id', id)
        .maybeSingle();
      const existing = String(row?.notes || '').trim();
      payload.notes = existing
        ? `${existing}\n[gaa-payment-ref]${paymentReference}`
        : `[gaa-payment-ref]${paymentReference}`;
    }

    const { error } = await supabase
      .from('membership_registrations')
      .update(payload)
      .eq('id', id);

    if (!error) return true;
    if (!isSchemaColumnError(error)) return false;
  }
  return false;
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
    const body = parseBody(req);
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
      feeDisplay,
      password
    } = body;

    if (!name?.trim() || !email?.trim()) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    const chosenPassword = String(password || '');
    if (chosenPassword && chosenPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const supabase = getSupabase();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingRows, error: existingError } = await supabase
      .from('membership_registrations')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(1);
    if (!existingError && existingRows?.length) {
      res.status(409).json({
        error: 'That email is already registered. Sign in with it, or use Forgot password.'
      });
      return;
    }

    const paymentConfig = await loadPaymentConfig();

    const row = await insertMembership(supabase, {
      name: name.trim(),
      email: normalizedEmail,
      phone: (phone || '').trim(),
      state_chapter: (stateChapter || '').trim(),
      membership_type: (membershipType || '').trim(),
      address: (address || '').trim(),
      date_of_birth: (dateOfBirth || '').trim(),
      referral_source: (referralSource || '').trim(),
      notes: (notes || '').trim(),
      fee_amount: toFeeAmount(feeAmount),
      fee_currency: (feeCurrency || 'AUD').trim(),
      fee_display: (feeDisplay || '').trim(),
      payment_status: 'pending',
      payment_method: null,
      member_status: 'pending',
      data: {}
    });

    const paymentReference = buildMembershipReference(row.id, paymentConfig);
    const amount = feeDisplay || formatAud(feeAmount);

    await savePaymentReference(supabase, row.id, paymentReference);

    let accountReady = false;
    if (chosenPassword) {
      try {
        const authUser = await ensureMemberAuthUser(supabase, {
          email: normalizedEmail,
          name: name.trim(),
          membershipId: '',
          authUserId: null
        });
        const { error: passwordError } = await supabase.auth.admin.updateUserById(authUser.id, {
          password: chosenPassword,
          email_confirm: true
        });
        if (passwordError) throw passwordError;
        await supabase
          .from('membership_registrations')
          .update({ data: { paymentReference, _authUserId: authUser.id } })
          .eq('id', row.id);
        accountReady = true;
      } catch (authError) {
        console.error('[membership] could not set login password', authError);
      }
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
      accountReady,
      message: accountReady
        ? 'Account created. Complete the $50 payment below. You can sign in with this email and password after payment is confirmed.'
        : 'Registration received! Complete payment using the instructions below. Our team will confirm your membership after payment is received.'
    });
  } catch (error) {
    console.error('[membership] registration failed', error);
    res.status(500).json({
      error: 'Failed to save registration',
      detail: error?.message || String(error),
      code: error?.code || null
    });
  }
}

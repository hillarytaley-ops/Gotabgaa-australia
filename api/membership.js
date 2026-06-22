import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

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
  const { error } = await supabase.from('membership_registrations').insert({
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
    payment_method: null
  });

  if (error) {
    res.status(500).json({ error: 'Failed to save registration', detail: error.message });
    return;
  }

  res.status(200).json({
    ok: true,
    message: 'Registration received! Our team will confirm your membership by email. Online payment will be added in a future update.'
  });
}

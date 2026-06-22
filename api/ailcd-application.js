import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { generateReferenceCode } from './lib/reference-code.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Application database not configured' });
    return;
  }

  const body = req.body || {};
  const personal = body.personal || {};
  const email = personal.email?.trim() || body.email?.trim();
  const fullName = personal.fullName?.trim()
    || [personal.givenNames, personal.surname].filter(Boolean).join(' ').trim()
    || body.fullName?.trim();

  if (!fullName || !email) {
    res.status(400).json({ error: 'Full name and email are required' });
    return;
  }

  if (!body.declaration?.agreed) {
    res.status(400).json({ error: 'You must agree to the declaration before submitting' });
    return;
  }

  const nameParts = fullName.split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';

  const supabase = getSupabase();
  const normalizedEmail = email.trim().toLowerCase();

  let referenceCode = null;
  let error = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    referenceCode = generateReferenceCode();
    const result = await supabase.from('ailcd_applications').insert({
      surname: surname || null,
      given_names: givenNames || null,
      full_name: fullName,
      email: normalizedEmail,
      phone: (personal.mobile || personal.phone || body.phone || '').trim() || null,
      state: (personal.stateTerritory || personal.state || body.state || '').trim() || null,
      reference_code: referenceCode,
      status: 'pending',
      data: body
    });

    error = result.error;
    if (!error) break;
    if (error.code !== '23505') break;
  }

  if (error) {
    res.status(500).json({ error: 'Failed to save application', detail: error.message });
    return;
  }

  res.status(200).json({
    ok: true,
    referenceCode,
    message: 'Expression of interest received. Save your reference number to check your application status on this page.'
  });
}

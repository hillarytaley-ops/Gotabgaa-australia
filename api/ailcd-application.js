import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { generateReferenceCode } from './lib/reference-code.js';
import {
  findApplicationByEmail,
  getAppMeta,
  isSchemaColumnError,
  isAilcdApplicationsOpen,
  withAppMeta
} from './lib/ailcd-app.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAilcdApplicationsOpen()) {
    res.status(403).json({
      error: 'Expressions of interest closed at midnight on 10 July 2026 (AEST). You can still check an existing application using your email above.'
    });
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

  const positions = body.position?.positions || [];
  if (positions.length !== 1) {
    res.status(400).json({ error: 'Please select exactly one interim leadership position.' });
    return;
  }

  const nameParts = fullName.split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';

  const supabase = getSupabase();
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await findApplicationByEmail(supabase, normalizedEmail);
    if (existing) {
      const meta = getAppMeta(existing);
      res.status(409).json({
        error: 'You have already submitted an application. Each person may apply only once. Use your email and reference number on this page to check your application status.',
        referenceCode: meta.referenceCode || null
      });
      return;
    }
  } catch (lookupError) {
    res.status(500).json({
      error: 'Failed to check existing applications',
      detail: lookupError.message
    });
    return;
  }

  const baseRow = {
    surname: surname || null,
    given_names: givenNames || null,
    full_name: fullName,
    email: normalizedEmail,
    phone: (personal.mobile || personal.phone || body.phone || '').trim() || null,
    state: (personal.stateTerritory || personal.state || body.state || '').trim() || null
  };

  let referenceCode = null;
  let error = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    referenceCode = generateReferenceCode();

    const fullRow = {
      ...baseRow,
      reference_code: referenceCode,
      status: 'pending',
      data: body
    };

    let result = await supabase.from('ailcd_applications').insert(fullRow);

    if (result.error && isSchemaColumnError(result.error)) {
      result = await supabase.from('ailcd_applications').insert({
        ...baseRow,
        data: withAppMeta(body, { referenceCode, status: 'pending' })
      });
    }

    error = result.error;
    if (!error) break;
    if (error.code !== '23505') break;
  }

  if (error) {
    if (error.code === '23505') {
      try {
        const duplicate = await findApplicationByEmail(supabase, normalizedEmail);
        const meta = getAppMeta(duplicate || {});
        res.status(409).json({
          error: 'You have already submitted an application. Each person may apply only once. Use your email and reference number on this page to check your application status.',
          referenceCode: meta.referenceCode || null
        });
        return;
      } catch {
        res.status(409).json({
          error: 'You have already submitted an application. Each person may apply only once.'
        });
        return;
      }
    }

    res.status(500).json({ error: 'Failed to save application', detail: error.message });
    return;
  }

  res.status(200).json({
    ok: true,
    referenceCode,
    message: 'Expression of interest received. Save your reference number to check your application status on this page.'
  });
}

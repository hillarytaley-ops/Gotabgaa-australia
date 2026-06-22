import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Application database not configured' });
    return;
  }

  const email = String(req.query?.email || '').trim().toLowerCase();
  const reference = String(req.query?.ref || req.query?.reference || '')
    .trim()
    .toUpperCase();

  if (!email || !reference) {
    res.status(400).json({ error: 'Email and reference number are required' });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ailcd_applications')
    .select('full_name, email, status, status_message, status_updated_at, created_at, reference_code')
    .ilike('email', email)
    .eq('reference_code', reference)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: 'No application found with that email and reference number' });
    return;
  }

  res.status(200).json({
    application: {
      fullName: data.full_name,
      email: data.email,
      referenceCode: data.reference_code,
      status: data.status || 'pending',
      statusMessage: data.status_message || '',
      submittedAt: data.created_at,
      updatedAt: data.status_updated_at || data.created_at
    }
  });
}

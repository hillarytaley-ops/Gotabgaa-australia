import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { findApplicationByEmailAndReference, getAppMeta } from './lib/ailcd-app.js';

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

  try {
    const row = await findApplicationByEmailAndReference(supabase, email, reference);

    if (!row) {
      res.status(404).json({ error: 'No application found with that email and reference number' });
      return;
    }

    const meta = getAppMeta(row);

    res.status(200).json({
      application: {
        fullName: row.full_name,
        email: row.email,
        referenceCode: meta.referenceCode,
        status: meta.status,
        statusMessage: meta.statusMessage,
        submittedAt: row.created_at,
        updatedAt: meta.statusUpdatedAt || row.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load application status' });
  }
}

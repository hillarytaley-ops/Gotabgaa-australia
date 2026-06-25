import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  findApplicationByEmail,
  findApplicationByEmailAndReference,
  getAppMeta,
  isAilcdApplicationsOpen
} from './lib/ailcd-app.js';

function toStatusResponse(row) {
  const meta = getAppMeta(row);
  return {
    fullName: row.full_name,
    email: row.email,
    referenceCode: meta.referenceCode,
    status: meta.status,
    statusMessage: meta.statusMessage,
    submittedAt: row.created_at,
    updatedAt: meta.statusUpdatedAt || row.created_at
  };
}

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

  if (!email) {
    res.status(400).json({ error: 'Email address is required' });
    return;
  }

  const supabase = getSupabase();

  try {
    let row = null;

    if (reference) {
      row = await findApplicationByEmailAndReference(supabase, email, reference);
      if (!row) {
        res.status(404).json({ error: 'No application found with that email and reference number' });
        return;
      }
    } else {
      row = await findApplicationByEmail(supabase, email);
      if (!row) {
        res.status(404).json({
          error: isAilcdApplicationsOpen()
            ? 'No application found for this email. If you have not applied yet, complete the form below.'
            : 'No application found for this email. Expressions of interest closed at midnight on 27 June 2026 (AEST).'
        });
        return;
      }
    }

    res.status(200).json({ application: toStatusResponse(row) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load application status' });
  }
}

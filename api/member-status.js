import { isSupabaseConfigured } from './lib/supabase.js';
import { resolveMemberFromRequest } from './lib/member-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Member database not configured' });
    return;
  }

  try {
    const resolved = await resolveMemberFromRequest(req);
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }

    res.status(200).json({ member: resolved.member });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load membership' });
  }
}

import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

export default async function handler(req, res) {
  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('efare_votes')
    .select('id, name, email, vote, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const votes = data || [];
  const aye = votes.filter(v => v.vote === 'aye').length;
  const nay = votes.filter(v => v.vote === 'nay').length;
  res.status(200).json({ votes, aye, nay, total: votes.length });
}

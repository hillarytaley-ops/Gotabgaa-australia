import { verifyToken, readAuthToken } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

function flattenForCsv(data, app) {
  const p = data.personal || {};
  const pos = data.position || {};
  const exp = data.experience || {};
  const dec = data.declaration || {};

  return {
    date: app.created_at,
    full_name: app.full_name,
    email: app.email,
    phone: app.phone,
    state: app.state,
    address: p.address,
    suburb: p.suburb,
    gender: p.gender,
    date_of_birth: p.dateOfBirth,
    occupation: p.occupation,
    positions: (pos.positions || []).join('; '),
    previous_leadership: exp.previousLeadership,
    experience: exp.experienceDescription,
    skills: (exp.skills || []).join('; '),
    declaration_name: dec.fullName,
    declaration_date: dec.date
  };
}

function toCsv(rows) {
  if (!rows.length) return 'No applications';
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  const token = readAuthToken(req);
  if (!verifyToken(token, secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('ailcd_applications')
      .select('id, surname, given_names, full_name, email, phone, state, data, created_at, read')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (req.query?.format === 'csv') {
      const flat = (data || []).map(a => flattenForCsv(a.data || {}, a));
      const csv = toCsv(flat);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="ailcd-applications.csv"');
      res.status(200).send(csv);
      return;
    }

    res.status(200).json({ applications: data });
    return;
  }

  if (req.method === 'PATCH') {
    const { id, read } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing application id' });
      return;
    }

    const { error } = await supabase
      .from('ailcd_applications')
      .update({ read: Boolean(read) })
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

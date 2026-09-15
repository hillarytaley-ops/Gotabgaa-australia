import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

const SELECT_FIELDS = [
  'id, name, email, attended, state, overall, useful, topics, time_ok, zoom, come_again, next_steps, answers, created_at, read',
  'id, attended, state, overall, useful, topics, time_ok, zoom, come_again, next_steps, answers, created_at, read'
];

function joinList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('; ');
  return value == null ? '' : String(value);
}

function displayName(row) {
  return row?.name || row?.answers?.name || '';
}

function displayEmail(row) {
  return row?.email || row?.answers?.email || '';
}

async function selectRows(supabase) {
  for (const fields of SELECT_FIELDS) {
    const { data, error } = await supabase
      .from('meet_greet_feedback')
      .select(fields)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error && /does not exist|schema cache|PGRST204|42703/i.test(String(error.message))) continue;
    if (error) throw error;
    return data || [];
  }
  return [];
}

function toCsv(rows) {
  const headers = [
    'Date',
    'Name',
    'Email',
    'Attended',
    'State',
    'Overall',
    'Useful',
    'Topics',
    'Time ok',
    'Zoom',
    'Come again',
    'Next steps',
    'Read'
  ];
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map(r => [
      r.created_at ? new Date(r.created_at).toISOString() : '',
      displayName(r),
      displayEmail(r),
      r.attended,
      r.state,
      r.overall,
      r.useful,
      joinList(r.topics),
      r.time_ok,
      r.zoom,
      r.come_again,
      joinList(r.next_steps),
      r.read ? 'yes' : 'no'
    ].map(escape).join(','))
  ].join('\n');
}

export default async function handler(req, res) {
  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const rows = await selectRows(supabase);
      if (req.query?.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="meet-greet-feedback.csv"');
        res.status(200).send(toCsv(rows));
        return;
      }
      res.status(200).json({ submissions: rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { id, read } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing submission id' });
      return;
    }

    const { error } = await supabase
      .from('meet_greet_feedback')
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

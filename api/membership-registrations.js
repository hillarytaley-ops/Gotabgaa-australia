import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

function toCsv(rows) {
  const headers = [
    'Date',
    'Name',
    'Email',
    'Phone',
    'State/Chapter',
    'Membership Type',
    'Address',
    'Date of Birth',
    'Referral',
    'Notes',
    'Fee Display',
    'Fee Amount',
    'Currency',
    'Payment Status',
    'Payment Method'
  ];

  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.created_at ? new Date(r.created_at).toISOString() : '',
      r.name,
      r.email,
      r.phone,
      r.state_chapter,
      r.membership_type,
      r.address,
      r.date_of_birth,
      r.referral_source,
      r.notes,
      r.fee_display,
      r.fee_amount,
      r.fee_currency,
      r.payment_status,
      r.payment_method
    ].map(escape).join(','))
  ];

  return lines.join('\n');
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
    const { data, error } = await supabase
      .from('membership_registrations')
      .select('id, name, email, phone, state_chapter, membership_type, address, date_of_birth, referral_source, notes, fee_amount, fee_currency, fee_display, payment_status, payment_method, created_at, read')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (req.query?.format === 'csv') {
      const csv = toCsv(data || []);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="membership-registrations.csv"');
      res.status(200).send(csv);
      return;
    }

    res.status(200).json({ registrations: data });
    return;
  }

  if (req.method === 'PATCH') {
    const { id, read } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing registration id' });
      return;
    }

    const { error } = await supabase
      .from('membership_registrations')
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

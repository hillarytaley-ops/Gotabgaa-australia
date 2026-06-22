import { verifyToken, readAuthToken } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { getAppMeta, isSchemaColumnError, withAppMeta } from './lib/ailcd-app.js';

function normalizeApplication(row) {
  if (!row) return row;
  const meta = getAppMeta(row);
  return {
    ...row,
    reference_code: meta.referenceCode,
    status: meta.status,
    status_message: meta.statusMessage,
    status_updated_at: meta.statusUpdatedAt
  };
}

function flattenForCsv(data, app) {
  const normalized = normalizeApplication(app);
  const p = data.personal || {};
  const pos = data.position || {};
  const exp = data.experience || {};
  const dec = data.declaration || {};

  return {
    date: normalized.created_at,
    reference_code: normalized.reference_code,
    status: normalized.status,
    full_name: normalized.full_name,
    email: normalized.email,
    phone: normalized.phone,
    state: normalized.state,
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

async function loadApplications(supabase) {
  const fullSelect = 'id, surname, given_names, full_name, email, phone, state, data, created_at, read, reference_code, status, status_message, status_updated_at';
  const legacySelect = 'id, surname, given_names, full_name, email, phone, state, data, created_at, read';

  let result = await supabase
    .from('ailcd_applications')
    .select(fullSelect)
    .order('created_at', { ascending: false })
    .limit(500);

  if (result.error && isSchemaColumnError(result.error)) {
    result = await supabase
      .from('ailcd_applications')
      .select(legacySelect)
      .order('created_at', { ascending: false })
      .limit(500);
  }

  if (result.error) throw result.error;
  return (result.data || []).map(normalizeApplication);
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
    try {
      const applications = await loadApplications(supabase);

      if (req.query?.format === 'csv') {
        const flat = applications.map(a => flattenForCsv(a.data || {}, a));
        const csv = toCsv(flat);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="ailcd-applications.csv"');
        res.status(200).send(csv);
        return;
      }

      res.status(200).json({ applications });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { id, read, status, statusMessage } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing application id' });
      return;
    }

    const updates = {};
    if (read !== undefined) updates.read = Boolean(read);
    if (status !== undefined) {
      const allowed = ['pending', 'approved', 'rejected'];
      if (!allowed.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      updates.status = status;
      updates.status_updated_at = new Date().toISOString();
    }
    if (statusMessage !== undefined) {
      updates.status_message = String(statusMessage).trim() || null;
    }

    if (!Object.keys(updates).length) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    let { error } = await supabase
      .from('ailcd_applications')
      .update(updates)
      .eq('id', id);

    if (error && isSchemaColumnError(error)) {
      const { data: row, error: rowError } = await supabase
        .from('ailcd_applications')
        .select('data')
        .eq('id', id)
        .maybeSingle();

      if (rowError || !row) {
        res.status(500).json({ error: rowError?.message || 'Application not found' });
        return;
      }

      const meta = {
        referenceCode: row.data?._referenceCode,
        status: status ?? row.data?._status ?? 'pending',
        statusMessage: statusMessage !== undefined
          ? (String(statusMessage).trim() || null)
          : (row.data?._statusMessage || null),
        statusUpdatedAt: new Date().toISOString()
      };

      const dataUpdate = withAppMeta(row.data || {}, meta);
      const legacyUpdates = { data: dataUpdate };
      if (read !== undefined) legacyUpdates.read = Boolean(read);

      ({ error } = await supabase
        .from('ailcd_applications')
        .update(legacyUpdates)
        .eq('id', id));
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) {
      res.status(400).json({ error: 'Missing application id' });
      return;
    }

    const { error } = await supabase
      .from('ailcd_applications')
      .delete()
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

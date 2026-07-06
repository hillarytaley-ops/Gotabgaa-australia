export function isSchemaColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST204'
    || error?.code === '42703'
    || message.includes('schema cache')
    || message.includes('does not exist')
    || /could not find the '[^']+' column/.test(message);
}

export function getAppMeta(row) {
  const data = row?.data || {};
  return {
    referenceCode: row?.reference_code || data._referenceCode || null,
    status: row?.status || data._status || 'pending',
    statusMessage: row?.status_message || data._statusMessage || '',
    statusUpdatedAt: row?.status_updated_at || data._statusUpdatedAt || row?.created_at || null
  };
}

export function withAppMeta(body, meta) {
  const next = { ...body };
  if (meta.referenceCode != null) next._referenceCode = meta.referenceCode;
  if (meta.status != null) next._status = meta.status;
  if (meta.statusMessage != null) next._statusMessage = meta.statusMessage;
  if (meta.statusUpdatedAt != null) next._statusUpdatedAt = meta.statusUpdatedAt;
  return next;
}

export async function findApplicationByEmail(supabase, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const attempts = [
    'full_name, email, reference_code, status, status_message, status_updated_at, created_at, data',
    'full_name, email, created_at, data'
  ];

  for (const fields of attempts) {
    const { data, error } = await supabase
      .from('ailcd_applications')
      .select(fields)
      .ilike('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error && isSchemaColumnError(error)) continue;
    if (error) throw error;
    return data?.[0] || null;
  }

  return null;
}

export async function findApplicationByEmailAndReference(supabase, email, reference) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedReference = String(reference || '').trim().toUpperCase();
  if (!normalizedEmail || !normalizedReference) return null;

  const attempts = [
    'full_name, email, reference_code, status, status_message, status_updated_at, created_at, data',
    'full_name, email, created_at, data'
  ];

  for (const fields of attempts) {
    const { data, error } = await supabase
      .from('ailcd_applications')
      .select(fields)
      .ilike('email', normalizedEmail);

    if (error && isSchemaColumnError(error)) continue;
    if (error) throw error;

    const match = (data || []).find(row => {
      const meta = getAppMeta(row);
      return String(meta.referenceCode || '').toUpperCase() === normalizedReference;
    });

    if (match) return match;

    if (fields.includes('reference_code')) {
      const { data: directMatch, error: directError } = await supabase
        .from('ailcd_applications')
        .select(fields)
        .ilike('email', normalizedEmail)
        .eq('reference_code', normalizedReference)
        .maybeSingle();

      if (directError && isSchemaColumnError(directError)) continue;
      if (directError) throw directError;
      if (directMatch) return directMatch;
    }
  }

  return null;
}

/** Applications close at midnight at the end of 10 July 2026 (AEST, UTC+10). */
export const AILCD_EOI_DEADLINE_ISO = '2026-07-11T00:00:00+10:00';

export function getAilcdDeadlineDate() {
  return new Date(AILCD_EOI_DEADLINE_ISO);
}

export function isAilcdApplicationsOpen(at = new Date()) {
  return at.getTime() < getAilcdDeadlineDate().getTime();
}

export function getAilcdDeadlinePayload(at = new Date()) {
  const deadline = getAilcdDeadlineDate();
  return {
    deadline: AILCD_EOI_DEADLINE_ISO,
    deadlineMs: deadline.getTime(),
    displayClose: 'midnight on 10 July 2026 (AEST)',
    open: isAilcdApplicationsOpen(at),
    serverTime: at.toISOString()
  };
}

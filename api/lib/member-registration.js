export function isSchemaColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST204'
    || error?.code === '42703'
    || message.includes('schema cache')
    || message.includes('does not exist')
    || /could not find the '[^']+' column/.test(message);
}

const MEMBER_META_TAG = '[gaa-member-meta]';

const MEMBER_ROW_FIELDS = [
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, membership_id, member_status, created_at, data, notes',
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, created_at, data, notes',
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, created_at, notes',
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, created_at'
];

export function parseMemberMetaFromNotes(notes) {
  const match = String(notes || '').match(/\[gaa-member-meta\](\{.*\})\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function appendMemberMetaToNotes(notes, meta) {
  const clean = String(notes || '')
    .replace(/\n?\[gaa-member-meta\]\{[\s\S]*?\}\s*$/, '')
    .trim();
  const payload = JSON.stringify({
    membershipId: meta.membershipId ?? null,
    memberStatus: meta.memberStatus ?? null
  });
  const tag = `${MEMBER_META_TAG}${payload}`;
  return clean ? `${clean}\n${tag}` : tag;
}

export function displayNotesWithoutMeta(notes) {
  return String(notes || '')
    .replace(/\n?\[gaa-member-meta\]\{[\s\S]*?\}\s*$/, '')
    .trim();
}

export function normalizeMemberEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeMembershipId(membershipId) {
  return String(membershipId || '').trim().toUpperCase();
}

export function getMemberMeta(row) {
  const data = row?.data || {};
  const notesMeta = parseMemberMetaFromNotes(row?.notes);
  return {
    membershipId: row?.membership_id || data._membershipId || notesMeta?.membershipId || null,
    memberStatus: row?.member_status || data._memberStatus || notesMeta?.memberStatus || 'pending',
    paymentStatus: row?.payment_status || 'pending'
  };
}

function emailsMatch(rowEmail, normalizedEmail) {
  return normalizeMemberEmail(rowEmail) === normalizedEmail;
}

function idMatchesRow(row, normalizedId) {
  const meta = getMemberMeta(row);
  return normalizeMembershipId(meta.membershipId) === normalizedId;
}

function credentialsMatch(row, normalizedEmail, normalizedId) {
  return emailsMatch(row.email, normalizedEmail) && idMatchesRow(row, normalizedId);
}

async function selectRows(supabase, fields, buildQuery) {
  const query = buildQuery(
    supabase.from('membership_registrations').select(fields)
  );
  const { data, error } = await query;
  if (error && isSchemaColumnError(error)) return null;
  if (error) throw error;
  return data || [];
}

export async function mirrorMemberMetaToNotes(supabase, id, meta) {
  const { data: row, error } = await supabase
    .from('membership_registrations')
    .select('id, notes')
    .eq('id', id)
    .maybeSingle();

  if (error && !isSchemaColumnError(error)) throw error;
  if (!row) return false;

  const notes = appendMemberMetaToNotes(row.notes, meta);
  const { error: updateError } = await supabase
    .from('membership_registrations')
    .update({ notes })
    .eq('id', id);

  if (updateError && !isSchemaColumnError(updateError)) throw updateError;
  return !updateError;
}

export async function syncMemberMetaEverywhere(supabase, id, meta) {
  const membershipId = meta.membershipId ?? null;
  const memberStatus = meta.memberStatus ?? null;

  await mirrorMemberMetaToNotes(supabase, id, { membershipId, memberStatus });

  const { data: row, error: fetchError } = await supabase
    .from('membership_registrations')
    .select('id, data')
    .eq('id', id)
    .maybeSingle();

  if (!fetchError && row) {
    const data = { ...(row.data || {}) };
    if (membershipId != null) data._membershipId = membershipId;
    if (memberStatus != null) data._memberStatus = memberStatus;

    const payload = { data };
    if (membershipId != null) payload.membership_id = membershipId;
    if (memberStatus != null) payload.member_status = memberStatus;

    const { error: updateError } = await supabase
      .from('membership_registrations')
      .update(payload)
      .eq('id', id);

    if (updateError && isSchemaColumnError(updateError)) {
      await supabase
        .from('membership_registrations')
        .update({ data })
        .eq('id', id);
    }
  }
}

export async function findMemberByEmailAndId(supabase, email, membershipId) {
  const normalizedEmail = normalizeMemberEmail(email);
  const normalizedId = normalizeMembershipId(membershipId);
  if (!normalizedEmail || !normalizedId) return null;

  for (const fields of MEMBER_ROW_FIELDS) {
    if (fields.includes('membership_id')) {
      const byColumn = await selectRows(
        supabase,
        fields,
        q => q.eq('membership_id', normalizedId)
      );
      if (byColumn) {
        const match = byColumn.find(row => credentialsMatch(row, normalizedEmail, normalizedId));
        if (match) return match;
      }
    }

    if (fields.includes('data')) {
      const byData = await selectRows(
        supabase,
        fields,
        q => q.filter('data->>_membershipId', 'eq', normalizedId)
      );
      if (byData) {
        const match = byData.find(row => credentialsMatch(row, normalizedEmail, normalizedId));
        if (match) return match;
      }
    }

    if (fields.includes('notes')) {
      const byNotes = await selectRows(
        supabase,
        fields,
        q => q.ilike('notes', `%${normalizedId}%`)
      );
      if (byNotes) {
        const match = byNotes.find(row => credentialsMatch(row, normalizedEmail, normalizedId));
        if (match) return match;
      }
    }

    const byEmail = await selectRows(
      supabase,
      fields,
      q => q.ilike('email', normalizedEmail)
    );
    if (byEmail) {
      const match = byEmail.find(row => credentialsMatch(row, normalizedEmail, normalizedId));
      if (match) return match;
    }
  }

  return null;
}

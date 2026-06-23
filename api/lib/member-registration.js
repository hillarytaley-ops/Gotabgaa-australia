export function isSchemaColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST204'
    || error?.code === '42703'
    || message.includes('schema cache')
    || message.includes('does not exist')
    || /could not find the '[^']+' column/.test(message);
}

export function getMemberMeta(row) {
  const data = row?.data || {};
  return {
    membershipId: row?.membership_id || data._membershipId || null,
    memberStatus: row?.member_status || data._memberStatus || 'pending',
    paymentStatus: row?.payment_status || 'pending'
  };
}

export async function findMemberByEmailAndId(supabase, email, membershipId) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedId = String(membershipId || '').trim().toUpperCase();
  if (!normalizedEmail || !normalizedId) return null;

  const attempts = [
    'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, membership_id, member_status, created_at, data',
    'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, created_at, data',
    'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, payment_status, payment_method, fee_display, created_at'
  ];

  for (const fields of attempts) {
    const { data, error } = await supabase
      .from('membership_registrations')
      .select(fields)
      .ilike('email', normalizedEmail);

    if (error && isSchemaColumnError(error)) continue;
    if (error) throw error;

    const match = (data || []).find(row => {
      const meta = getMemberMeta(row);
      return String(meta.membershipId || '').toUpperCase() === normalizedId;
    });

    if (match) return match;

    if (fields.includes('membership_id')) {
      const { data: directMatch, error: directError } = await supabase
        .from('membership_registrations')
        .select(fields)
        .ilike('email', normalizedEmail)
        .eq('membership_id', normalizedId)
        .maybeSingle();

      if (directError && isSchemaColumnError(directError)) continue;
      if (directError) throw directError;
      if (directMatch) return directMatch;
    }
  }

  return null;
}

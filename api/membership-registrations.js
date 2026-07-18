import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { generateMembershipId } from './lib/member-id.js';
import { getMemberMeta, isSchemaColumnError, appendMemberMetaToNotes, syncMemberMetaEverywhere, getPaymentReferenceFromRow } from './lib/member-registration.js';
import { loadPaymentConfig, buildMembershipReference } from './lib/payment.js';
import { sendMembershipApproved, sendPaymentReceipt } from './lib/email.js';
import {
  ensureMemberAuthUser,
  createPasswordSetupLink,
  banMemberAuthUser,
  getStoredAuthUserId
} from './lib/member-auth.js';

async function provisionMemberLogin(supabase, row, membershipId) {
  const authUser = await ensureMemberAuthUser(supabase, {
    email: row.email,
    name: row.name,
    membershipId,
    authUserId: getStoredAuthUserId(row)
  });

  const nextData = {
    ...(row.data || {}),
    _membershipId: membershipId,
    _memberStatus: 'active',
    _authUserId: authUser.id
  };

  await updateRegistration(supabase, row.id, {
    data: nextData
  });

  // Best-effort column write if migrate-member-auth.sql was applied
  const { error: authColError } = await supabase
    .from('membership_registrations')
    .update({ auth_user_id: authUser.id })
    .eq('id', row.id);
  if (authColError && !isSchemaColumnError(authColError)) {
    console.warn('[member-auth] could not store auth_user_id column', authColError.message);
  }

  const { actionLink } = await createPasswordSetupLink(supabase, row.email);
  return { authUserId: authUser.id, passwordSetupLink: actionLink };
}

const SELECT_FIELDS = [
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, referral_source, notes, fee_amount, fee_currency, fee_display, payment_status, payment_method, membership_id, member_status, created_at, read, data',
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, referral_source, notes, fee_amount, fee_currency, fee_display, payment_status, payment_method, created_at, read, data',
  'id, name, email, phone, state_chapter, membership_type, address, date_of_birth, referral_source, notes, fee_amount, fee_currency, fee_display, payment_status, payment_method, created_at, read'
];

async function selectRegistrations(supabase) {
  for (const fields of SELECT_FIELDS) {
    const { data, error } = await supabase
      .from('membership_registrations')
      .select(fields)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error && isSchemaColumnError(error)) continue;
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
    'Phone',
    'Membership ID',
    'Member Status',
    'State/Territory',
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
    ...rows.map(r => {
      const meta = getMemberMeta(r);
      return [
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.name,
        r.email,
        r.phone,
        meta.membershipId,
        meta.memberStatus,
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
      ].map(escape).join(',');
    })
  ];

  return lines.join('\n');
}

async function updateRegistration(supabase, id, payload) {
  const { error } = await supabase
    .from('membership_registrations')
    .update(payload)
    .eq('id', id);

  if (!error) return { ok: true };

  if (!isSchemaColumnError(error)) throw error;

  const { data: row, error: fetchError } = await supabase
    .from('membership_registrations')
    .select('id, data')
    .eq('id', id)
    .maybeSingle();

  if (fetchError && isSchemaColumnError(fetchError)) {
    const { data: notesRow, error: notesFetchError } = await supabase
      .from('membership_registrations')
      .select('id, notes')
      .eq('id', id)
      .maybeSingle();

    if (!notesFetchError && notesRow && (payload.membership_id != null || payload.member_status != null)) {
      const notes = appendMemberMetaToNotes(notesRow.notes, {
        membershipId: payload.membership_id,
        memberStatus: payload.member_status
      });
      const notesUpdate = {
        notes,
        read: payload.read,
        payment_status: payload.payment_status
      };
      const { error: notesUpdateError } = await supabase
        .from('membership_registrations')
        .update(notesUpdate)
        .eq('id', id);
      if (!notesUpdateError) return { ok: true, fallback: 'notes' };
    }

    const minimal = { ...payload };
    delete minimal.membership_id;
    delete minimal.member_status;
    delete minimal.data;
    const { error: minimalError } = await supabase
      .from('membership_registrations')
      .update(minimal)
      .eq('id', id);
    if (minimalError) throw minimalError;
    return { ok: true, fallback: true };
  }

  if (fetchError) throw fetchError;

  const data = { ...(row?.data || {}) };
  if (payload.membership_id != null) data._membershipId = payload.membership_id;
  if (payload.member_status != null) data._memberStatus = payload.member_status;

  const fallbackPayload = { ...payload, data };
  delete fallbackPayload.membership_id;
  delete fallbackPayload.member_status;

  const attempts = [
    { ...payload, data },
    fallbackPayload,
    { read: payload.read, payment_status: payload.payment_status, data }
  ];

  for (const attempt of attempts) {
    const { error: updateError } = await supabase
      .from('membership_registrations')
      .update(attempt)
      .eq('id', id);

    if (!updateError) return { ok: true, fallback: true };
    if (!isSchemaColumnError(updateError)) throw updateError;
  }

  throw error;
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
      let data = await selectRegistrations(supabase);
      const paymentFilter = req.query?.payment;

      if (paymentFilter && paymentFilter !== 'all') {
        data = data.filter(r => (r.payment_status || 'pending') === paymentFilter);
      }

      if (req.query?.format === 'csv') {
        const csv = toCsv(data);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="membership-registrations.csv"');
        res.status(200).send(csv);
        return;
      }

      res.status(200).json({ registrations: data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { id, read, action, paymentStatus, paymentMethod } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing registration id' });
      return;
    }

    try {
      if (action === 'markPaid') {
        const rows = await selectRegistrations(supabase);
        const row = rows.find(r => r.id === id);
        if (!row) {
          res.status(404).json({ error: 'Registration not found' });
          return;
        }

        const paymentConfig = await loadPaymentConfig();
        const reference = getPaymentReferenceFromRow(row) || buildMembershipReference(row.id, paymentConfig);
        const paidAt = new Date().toISOString();

        await updateRegistration(supabase, id, {
          payment_status: 'paid',
          payment_method: paymentMethod || 'PayID/EFT',
          payment_reference: reference,
          paid_at: paidAt,
          read: true,
          data: { ...(row.data || {}), paymentReference: reference }
        });

        await sendPaymentReceipt({
          to: row.email,
          name: row.name,
          type: 'membership fee',
          payment: paymentConfig,
          amount: row.fee_display || '',
          reference,
          invoiceNumber: `GAA-INV-MEM-${String(row.id).slice(0, 8).toUpperCase()}`
        });

        res.status(200).json({ ok: true, paymentStatus: 'paid', paymentReference: reference });
        return;
      }

      if (action === 'approve') {
        const rows = await selectRegistrations(supabase);
        const row = rows.find(r => r.id === id);
        if (!row) {
          res.status(404).json({ error: 'Registration not found' });
          return;
        }

        const meta = getMemberMeta(row);
        const membershipId = meta.membershipId || generateMembershipId();
        const paymentConfig = await loadPaymentConfig();
        const reference = getPaymentReferenceFromRow(row) || buildMembershipReference(row.id, paymentConfig);
        const currentPayment = row.payment_status || 'pending';

        await updateRegistration(supabase, id, {
          membership_id: membershipId,
          member_status: 'active',
          payment_status: currentPayment === 'paid' ? 'paid' : (paymentStatus || currentPayment || 'pending'),
          payment_reference: reference,
          read: true,
          data: { ...(row.data || {}), paymentReference: reference, _membershipId: membershipId, _memberStatus: 'active' }
        });

        await syncMemberMetaEverywhere(supabase, id, {
          membershipId,
          memberStatus: 'active'
        });

        let loginInvite = null;
        let authError = null;
        try {
          const refreshed = { ...row, data: { ...(row.data || {}), paymentReference: reference, _membershipId: membershipId, _memberStatus: 'active' } };
          loginInvite = await provisionMemberLogin(supabase, refreshed, membershipId);
        } catch (err) {
          authError = err.message || 'Could not create member login account';
          console.error('[membership-approve] auth provision failed', err);
        }

        await sendMembershipApproved({
          to: row.email,
          name: row.name,
          membershipId,
          payment: paymentConfig,
          amount: row.fee_display || '',
          reference,
          paymentStatus: currentPayment === 'paid' ? 'paid' : 'pending',
          passwordSetupLink: loginInvite?.passwordSetupLink || null
        });

        res.status(200).json({
          ok: true,
          membershipId,
          memberStatus: 'active',
          paymentReference: reference,
          authUserId: loginInvite?.authUserId || null,
          loginInviteSent: Boolean(loginInvite?.passwordSetupLink),
          authError
        });
        return;
      }

      if (action === 'revoke') {
        const rows = await selectRegistrations(supabase);
        const row = rows.find(r => r.id === id);
        await updateRegistration(supabase, id, {
          member_status: 'inactive',
          read: true
        });
        try {
          const authUserId = getStoredAuthUserId(row);
          if (authUserId) await banMemberAuthUser(supabase, authUserId);
        } catch (err) {
          console.error('[membership-revoke] ban auth user failed', err);
        }
        res.status(200).json({ ok: true, memberStatus: 'inactive' });
        return;
      }

      if (action === 'resync') {
        const rows = await selectRegistrations(supabase);
        const row = rows.find(r => r.id === id);
        if (!row) {
          res.status(404).json({ error: 'Registration not found' });
          return;
        }

        const meta = getMemberMeta(row);
        const membershipId = meta.membershipId || generateMembershipId();
        const memberStatus = meta.memberStatus === 'inactive' ? 'inactive' : 'active';

        await updateRegistration(supabase, id, {
          membership_id: membershipId,
          member_status: memberStatus,
          read: true
        });

        await syncMemberMetaEverywhere(supabase, id, {
          membershipId,
          memberStatus
        });

        let loginInvite = null;
        let authError = null;
        if (memberStatus === 'active') {
          try {
            loginInvite = await provisionMemberLogin(supabase, row, membershipId);
            const paymentConfig = await loadPaymentConfig();
            await sendMembershipApproved({
              to: row.email,
              name: row.name,
              membershipId,
              payment: paymentConfig,
              amount: row.fee_display || '',
              reference: getPaymentReferenceFromRow(row) || '',
              paymentStatus: row.payment_status || 'pending',
              passwordSetupLink: loginInvite?.passwordSetupLink || null,
              isResync: true
            });
          } catch (err) {
            authError = err.message || 'Could not sync member login';
            console.error('[membership-resync] auth provision failed', err);
          }
        }

        res.status(200).json({
          ok: true,
          membershipId,
          memberStatus,
          authUserId: loginInvite?.authUserId || null,
          loginInviteSent: Boolean(loginInvite?.passwordSetupLink),
          authError
        });
        return;
      }

      if (read !== undefined) {
        await updateRegistration(supabase, id, { read: Boolean(read) });
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Nothing to update' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) {
      res.status(400).json({ error: 'Missing registration id' });
      return;
    }

    const { error } = await supabase
      .from('membership_registrations')
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

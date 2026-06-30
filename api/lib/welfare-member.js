import { findMemberByEmailAndId } from './member-registration.js';

export const REIMBURSEMENT_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'paid',
  'declined'
];

export const PROCESSING_STATUSES = ['under_review', 'approved', 'paid'];

export function getWelfareMeta(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    membershipId: row.membership_id || data.membershipId || null,
    stateChapter: row.state_chapter,
    packageId: row.package_id,
    packageTitle: row.package_title,
    welfareStatus: row.welfare_status || 'pending',
    paymentStatus: row.payment_status || 'pending',
    paymentReference: row.payment_reference || data.paymentReference || null,
    feeDisplay: row.fee_display,
    feeAmount: row.fee_amount,
    joinedAt: row.created_at
  };
}

export async function findWelfareRegistration(supabase, email, membershipId) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedId = String(membershipId || '').trim().toUpperCase();

  if (!normalizedEmail) return null;

  let query = supabase
    .from('welfare_registrations')
    .select('*')
    .ilike('email', normalizedEmail)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return null;

  if (normalizedId) {
    const match = data.find(r => String(r.membership_id || '').toUpperCase() === normalizedId);
    if (match) return match;
  }

  return data[0];
}

export async function verifyMainMember(supabase, email, membershipId) {
  const row = await findMemberByEmailAndId(supabase, email, membershipId);
  if (!row) return { ok: false, error: 'No Gotabgaa Australia member found with that email and membership ID.' };

  const meta = row.data?._memberStatus || row.member_status;
  if (meta === 'inactive') {
    return { ok: false, error: 'Your main membership is inactive. Contact Gotabgaa Australia for assistance.' };
  }

  return { ok: true, member: row };
}

export async function verifyActiveWelfareMember(supabase, email, membershipId) {
  const main = await verifyMainMember(supabase, email, membershipId);
  if (!main.ok) return main;

  const welfare = await findWelfareRegistration(supabase, email, membershipId);
  if (!welfare) {
    return { ok: false, error: 'No social welfare registration found. Enrol on the welfare page first.' };
  }

  if (welfare.welfare_status !== 'active') {
    return {
      ok: false,
      error: welfare.welfare_status === 'pending'
        ? 'Your welfare membership is pending approval by the welfare team.'
        : 'Your social welfare membership is not active.'
    };
  }

  return { ok: true, welfare, member: main.member };
}

export async function getActiveCommunityAlerts(supabase) {
  const { data, error } = await supabase
    .from('welfare_community_alerts')
    .select('id, alert_type, message, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

export async function createReimbursementAlert(supabase, requestId, message) {
  await supabase
    .from('welfare_community_alerts')
    .update({ active: false })
    .eq('related_request_id', requestId);

  const { error } = await supabase
    .from('welfare_community_alerts')
    .insert({
      alert_type: 'reimbursement_in_progress',
      message,
      related_request_id: requestId,
      active: true
    });

  if (error) throw error;
}

export async function deactivateReimbursementAlerts(supabase, requestId) {
  await supabase
    .from('welfare_community_alerts')
    .update({ active: false })
    .eq('related_request_id', requestId);
}

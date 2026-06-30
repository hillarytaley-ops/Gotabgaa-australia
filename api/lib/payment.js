import { getSupabase, isSupabaseConfigured } from './supabase.js';

export const DEFAULT_PAYMENT_CONFIG = {
  enabled: true,
  legalName: 'Gotabgaa Australia',
  abn: '',
  payId: '',
  bsb: '',
  accountNumber: '',
  accountName: 'Gotabgaa Australia',
  gstNote: 'No GST has been charged unless stated on your receipt.',
  instructions: 'Pay via PayID or bank transfer. You must include the payment reference exactly as shown.',
  receiptEmail: 'info@gotabgaaaustralia.org',
  memReferencePrefix: 'GAA-MEM',
  evtReferencePrefix: 'GAA-EVT'
};

export function shortId(id) {
  return String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function buildPaymentReference(prefix, id) {
  const base = (prefix || 'GAA').trim().toUpperCase();
  return `${base}-${shortId(id)}`;
}

export function buildMembershipReference(id, config = {}) {
  return buildPaymentReference(config.memReferencePrefix || 'GAA-MEM', id);
}

export function buildEventReference(id, config = {}) {
  return buildPaymentReference(config.evtReferencePrefix || 'GAA-EVT', id);
}

export function formatAud(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)} AUD`;
}

export async function loadPaymentConfig() {
  if (!isSupabaseConfigured()) return { ...DEFAULT_PAYMENT_CONFIG };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'main')
      .maybeSingle();

    if (error || !data?.data?.payment) return { ...DEFAULT_PAYMENT_CONFIG };
    return { ...DEFAULT_PAYMENT_CONFIG, ...data.data.payment };
  } catch {
    return { ...DEFAULT_PAYMENT_CONFIG };
  }
}

export function getPaymentReferenceFromRow(row) {
  const data = row?.data || {};
  if (data.paymentReference) return data.paymentReference;
  if (row?.payment_reference) return row.payment_reference;
  const notesMatch = String(row?.notes || '').match(/\[gaa-payment-ref\]([^\s\]]+)/);
  return notesMatch ? notesMatch[1] : null;
}

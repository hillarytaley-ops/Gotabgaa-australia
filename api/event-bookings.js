import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import { loadPaymentConfig, buildEventReference } from './lib/payment.js';
import { sendPaymentReceipt } from './lib/email.js';

const SELECT_FIELDS = [
  'id, event_id, event_title, name, email, phone, tickets, notes, payment_status, payment_method, payment_reference, fee_amount, fee_display, created_at, read, data',
  'id, event_id, event_title, name, email, phone, tickets, notes, created_at, read'
];

async function selectBookings(supabase) {
  for (const fields of SELECT_FIELDS) {
    const { data, error } = await supabase
      .from('event_bookings')
      .select(fields)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error && /does not exist|schema cache|PGRST204|42703/i.test(String(error.message))) continue;
    if (error) throw error;
    return data || [];
  }
  return [];
}

function getBookingReference(row) {
  if (row?.payment_reference) return row.payment_reference;
  if (row?.data?.paymentReference) return row.data.paymentReference;
  const match = String(row?.notes || '').match(/\[gaa-payment-ref\]([^\s\]]+)/);
  return match ? match[1] : null;
}

function toCsv(rows) {
  const headers = ['Date', 'Event', 'Name', 'Email', 'Phone', 'Tickets', 'Fee', 'Payment Status', 'Payment Method', 'Reference', 'Notes'];
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map(r => [
      r.created_at ? new Date(r.created_at).toISOString() : '',
      r.event_title,
      r.name,
      r.email,
      r.phone,
      r.tickets,
      r.fee_display,
      r.payment_status,
      r.payment_method,
      getBookingReference(r),
      r.notes
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
      let bookings = await selectBookings(supabase);
      const paymentFilter = req.query?.payment;
      if (paymentFilter && paymentFilter !== 'all') {
        bookings = bookings.filter(b => (b.payment_status || 'pending') === paymentFilter);
      }

      if (req.query?.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="event-bookings.csv"');
        res.status(200).send(toCsv(bookings));
        return;
      }

      res.status(200).json({ bookings });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { id, read, action, paymentMethod } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing booking id' });
      return;
    }

    if (action === 'markPaid') {
      try {
        const bookings = await selectBookings(supabase);
        const row = bookings.find(b => b.id === id);
        if (!row) {
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        const paymentConfig = await loadPaymentConfig();
        const reference = getBookingReference(row) || buildEventReference(row.id, paymentConfig);

        const payload = {
          payment_status: 'paid',
          payment_method: paymentMethod || 'PayID/EFT',
          read: true
        };

        let { error } = await supabase.from('event_bookings').update({
          ...payload,
          payment_reference: reference,
          data: { ...(row.data || {}), paymentReference: reference }
        }).eq('id', id);

        if (error) {
          ({ error } = await supabase.from('event_bookings').update(payload).eq('id', id));
        }
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }

        await sendPaymentReceipt({
          to: row.email,
          name: row.name,
          type: row.event_title,
          payment: paymentConfig,
          amount: row.fee_display || '',
          reference,
          invoiceNumber: `GAA-INV-EVT-${String(row.id).slice(0, 8).toUpperCase()}`
        });

        res.status(200).json({ ok: true, paymentStatus: 'paid' });
        return;
      } catch (error) {
        res.status(500).json({ error: error.message });
        return;
      }
    }

    const { error } = await supabase
      .from('event_bookings')
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

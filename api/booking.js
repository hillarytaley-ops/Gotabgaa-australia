import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  buildEventReference,
  loadPaymentConfig,
  formatAud
} from './lib/payment.js';
import { sendBookingConfirmation } from './lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Booking database not configured' });
    return;
  }

  const {
    eventId,
    eventTitle,
    name,
    email,
    phone,
    tickets,
    notes,
    feeAmount,
    feeDisplay
  } = req.body || {};

  if (!eventId?.trim() || !eventTitle?.trim() || !name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Event, name, and email are required' });
    return;
  }

  const ticketCount = Math.max(1, Math.min(20, parseInt(tickets, 10) || 1));
  const unitFee = Number(feeAmount) || 0;
  const totalFee = unitFee * ticketCount;
  const displayAmount = feeDisplay || (totalFee > 0 ? formatAud(totalFee) : 'Free');
  const paymentConfig = await loadPaymentConfig();

  const supabase = getSupabase();

  const insertPayload = {
    event_id: eventId.trim(),
    event_title: eventTitle.trim(),
    name: name.trim(),
    email: email.trim(),
    phone: (phone || '').trim(),
    tickets: ticketCount,
    notes: (notes || '').trim(),
    payment_status: totalFee > 0 ? 'pending' : 'paid',
    payment_method: totalFee > 0 ? null : 'free',
    fee_amount: totalFee > 0 ? totalFee : null,
    fee_display: displayAmount,
    data: {}
  };

  let row = null;
  let insertError = null;

  const fullInsert = await supabase
    .from('event_bookings')
    .insert(insertPayload)
    .select('id')
    .single();

  if (fullInsert.error) {
    insertError = fullInsert.error;
    const minimal = await supabase
      .from('event_bookings')
      .insert({
        event_id: insertPayload.event_id,
        event_title: insertPayload.event_title,
        name: insertPayload.name,
        email: insertPayload.email,
        phone: insertPayload.phone,
        tickets: insertPayload.tickets,
        notes: insertPayload.notes
      })
      .select('id')
      .single();
    row = minimal.data;
    insertError = minimal.error;
  } else {
    row = fullInsert.data;
  }

  if (insertError || !row?.id) {
    res.status(500).json({ error: 'Failed to save booking', detail: insertError?.message });
    return;
  }

  const paymentReference = buildEventReference(row.id, paymentConfig);

  await supabase
    .from('event_bookings')
    .update({
      payment_reference: paymentReference,
      data: { paymentReference, feeAmount: totalFee, feeDisplay: displayAmount }
    })
    .eq('id', row.id)
    .then(({ error: refError }) => {
      if (refError) {
        const noteTag = `[gaa-payment-ref]${paymentReference}`;
        const mergedNotes = insertPayload.notes
          ? `${insertPayload.notes}\n${noteTag}`
          : noteTag;
        return supabase.from('event_bookings').update({ notes: mergedNotes }).eq('id', row.id);
      }
      return null;
    });

  const emailResult = await sendBookingConfirmation({
    to: email.trim(),
    name: name.trim(),
    eventTitle: eventTitle.trim(),
    payment: paymentConfig,
    amount: displayAmount,
    reference: paymentReference,
    tickets: ticketCount
  });

  res.status(200).json({
    ok: true,
    bookingId: row.id,
    paymentReference,
    amount: displayAmount,
    payment: paymentConfig,
    emailSent: emailResult.ok === true,
    message: totalFee > 0
      ? 'Booking received! Complete payment using the instructions below.'
      : 'Booking confirmed! No payment required for this event.'
  });
}

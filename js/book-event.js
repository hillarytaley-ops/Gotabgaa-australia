/**
 * Event booking portal — PayID / bank transfer when fee applies
 */
(function () {
  let currentEvent = null;
  let paymentConfig = null;

  function getEventIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id')?.trim() || '';
  }

  function findEvent(content, eventId) {
    return content?.events?.find(e => e.id === eventId) || null;
  }

  function showMissing() {
    document.getElementById('bookingMissing').hidden = false;
    document.getElementById('bookingLayout').hidden = true;
  }

  function getEventFee(event) {
    const amount = Number(event.ticketAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { amount: 0, display: event.ticketFeeDisplay || 'Free' };
    }
    const display = event.ticketFeeDisplay || `$${amount % 1 === 0 ? amount : amount.toFixed(2)} AUD per place`;
    return { amount, display };
  }

  function populateEvent(event) {
    currentEvent = event;
    paymentConfig = window.CMS_CONTENT?.payment || null;

    document.getElementById('bookingMissing').hidden = true;
    document.getElementById('bookingLayout').hidden = false;

    const fee = getEventFee(event);

    document.getElementById('bookingEventImage').src = event.image;
    document.getElementById('bookingEventImage').alt = event.title;
    document.getElementById('bookingEventTitle').textContent = event.title;
    document.getElementById('bookingEventDate').textContent = event.date;
    document.getElementById('bookingEventTime').textContent = event.time;
    document.getElementById('bookingEventLocation').textContent = event.location;
    document.getElementById('bookingEventSummary').textContent = event.summary || event.description || '';
    document.getElementById('bookingEventNote').textContent = event.ticketPriceNote
      || (fee.amount > 0 ? `Fee: ${fee.display} — pay via PayID after booking` : 'Free registration — no payment required');
    document.getElementById('bookingEventId').value = event.id;
    document.getElementById('bookingEventTitleField').value = event.title;
    document.title = `Book: ${event.title} | Gotabgaa Australia`;
  }

  function showPaymentInstructions(data) {
    const wrap = document.getElementById('bookingPaymentInstructions');
    if (!wrap || !window.PaymentInstructions) return;

    wrap.hidden = false;
    window.PaymentInstructions.render(wrap, {
      payment: data.payment || paymentConfig,
      amount: data.amount,
      reference: data.paymentReference,
      title: 'Complete your event payment',
      subtitle: (data.payment || paymentConfig)?.instructions
    });
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = '1';

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const success = document.getElementById('bookingSuccess');
      const error = document.getElementById('bookingError');
      const btn = document.getElementById('bookingSubmitBtn');
      const payWrap = document.getElementById('bookingPaymentInstructions');

      success.hidden = true;
      error.hidden = true;
      if (payWrap) payWrap.hidden = true;

      if (!currentEvent) {
        error.textContent = 'Event not loaded.';
        error.hidden = false;
        return;
      }

      const fee = getEventFee(currentEvent);
      const tickets = parseInt(document.getElementById('bookingTickets').value, 10) || 1;
      const totalAmount = fee.amount * tickets;
      const totalDisplay = totalAmount > 0
        ? `$${totalAmount % 1 === 0 ? totalAmount : totalAmount.toFixed(2)} AUD (${tickets} × ${fee.display})`
        : 'Free';

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting…';
      }

      try {
        const res = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: currentEvent.id,
            eventTitle: currentEvent.title,
            name: document.getElementById('bookingName').value,
            email: document.getElementById('bookingEmail').value,
            phone: document.getElementById('bookingPhone').value,
            tickets: document.getElementById('bookingTickets').value,
            notes: document.getElementById('bookingNotes').value,
            feeAmount: fee.amount,
            feeDisplay: totalDisplay
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.detail || 'Booking failed');

        success.textContent = data.message || 'Booking received!';
        success.hidden = false;
        if (data.paymentReference && totalAmount > 0) showPaymentInstructions(data);
        form.reset();
        document.getElementById('bookingEventId').value = currentEvent.id;
        document.getElementById('bookingEventTitleField').value = currentEvent.title;
      } catch (err) {
        error.textContent = err.message || 'Could not submit booking. Please contact us directly.';
        error.hidden = false;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit Booking';
        }
      }
    });
  }

  async function loadEvent() {
    const eventId = getEventIdFromUrl();
    if (!eventId) {
      showMissing();
      return;
    }

    let content = window.CMS_CONTENT;
    if (!content) {
      try {
        let res = await fetch('/api/content', { cache: 'no-cache' });
        if (!res.ok) res = await fetch('/data/content.json', { cache: 'no-cache' });
        if (res.ok) content = await res.json();
      } catch {
        content = null;
      }
    }

    const event = findEvent(content, eventId);
    if (!event || event.status !== 'upcoming' || event.bookingEnabled === false) {
      showMissing();
      return;
    }

    populateEvent(event);
    initBookingForm();
  }

  document.addEventListener('cms-ready', loadEvent);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEvent);
  } else {
    loadEvent();
  }
})();

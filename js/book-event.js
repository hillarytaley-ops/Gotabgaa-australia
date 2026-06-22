/**
 * Event booking portal — register for upcoming events (payment later)
 */
(function () {
  let currentEvent = null;

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

  function populateEvent(event) {
    currentEvent = event;
    document.getElementById('bookingMissing').hidden = true;
    document.getElementById('bookingLayout').hidden = false;

    document.getElementById('bookingEventImage').src = event.image;
    document.getElementById('bookingEventImage').alt = event.title;
    document.getElementById('bookingEventTitle').textContent = event.title;
    document.getElementById('bookingEventDate').textContent = event.date;
    document.getElementById('bookingEventTime').textContent = event.time;
    document.getElementById('bookingEventLocation').textContent = event.location;
    document.getElementById('bookingEventSummary').textContent = event.summary || event.description || '';
    document.getElementById('bookingEventNote').textContent = event.ticketPriceNote || 'Free registration — secure payment coming soon.';
    document.getElementById('bookingEventId').value = event.id;
    document.getElementById('bookingEventTitleField').value = event.title;
    document.title = `Book: ${event.title} | Gotabgaa Australia`;
  }

  function initBookingForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const success = document.getElementById('bookingSuccess');
      const error = document.getElementById('bookingError');
      const btn = document.getElementById('bookingSubmitBtn');

      success.hidden = true;
      error.hidden = true;

      if (!currentEvent) {
        error.textContent = 'Event not loaded.';
        error.hidden = false;
        return;
      }

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
            notes: document.getElementById('bookingNotes').value
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.detail || 'Booking failed');

        success.textContent = data.message || 'Booking received! We will email you shortly. Online payment will be added in a future update.';
        success.hidden = false;
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
    document.addEventListener('DOMContentLoaded', () => {
      if (window.CMS_CONTENT) loadEvent();
      else if (!window.CMS_CONTENT) loadEvent();
    });
  } else {
    loadEvent();
  }
})();

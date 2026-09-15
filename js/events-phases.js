/**
 * Gotabgaa events phases — modelled on Taunet Nelel (#events-phases).
 * Upcoming → Present → Most Recent → Past (Australia/Melbourne calendar days).
 */
(function (global) {
  'use strict';

  const TABS = ['events-phases', 'gallery', 'inquiry'];
  const PHASE_ORDER = ['upcoming', 'present', 'most-recent', 'past'];
  const PHASE_META = {
    upcoming: {
      label: 'Upcoming Events',
      icon: '◷',
      hint: 'Empty until new dates are published',
      mod: 'upcoming'
    },
    present: {
      label: 'Present Events',
      icon: '●',
      hint: 'Live on the event day, until Melbourne midnight',
      mod: 'present',
      live: true
    },
    'most-recent': {
      label: 'Most Recent',
      icon: '✦',
      hint: 'Newest finished event after its last Melbourne midnight',
      mod: 'recent'
    },
    past: {
      label: 'Past Events',
      icon: '◷',
      hint: 'Earlier events · newest first',
      mod: 'past'
    }
  };

  let EVENTS = [];
  let GALLERY = [];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeUrl(value) {
    return String(value ?? '').replace(/^(javascript|data|vbscript):/i, '');
  }

  function parseDate(value) {
    return new Date(value);
  }

  function melbourneYmd(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
  }

  function eventLastDay(event) {
    const start = parseDate(event.start);
    const end = parseDate(event.end || event.start);
    return !Number.isNaN(end.getTime()) ? end : start;
  }

  function eventHasEnded(event, now) {
    const last = eventLastDay(event);
    if (Number.isNaN(last.getTime())) return true;
    const eventDay = melbourneYmd(last);
    const today = melbourneYmd(now || new Date());
    return Boolean(eventDay && today && today > eventDay);
  }

  function getEventPhase(event, now) {
    const current = now || new Date();
    const ended = eventHasEnded(event, current);
    const override = String(event.phaseOverride || '').trim();
    const pinned =
      override && ['upcoming', 'present', 'most-recent', 'past'].includes(override) ? override : '';

    if (pinned === 'upcoming' || pinned === 'present') {
      if (!ended) return pinned;
    } else if (pinned) {
      return pinned;
    }

    const start = parseDate(event.start);
    const end = parseDate(event.end || event.start);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || ended) {
      return 'past';
    }
    if (current.getTime() < start.getTime()) return 'upcoming';
    return 'present';
  }

  function categorizeEvents(now) {
    const current = now || new Date();
    const groups = { upcoming: [], present: [], 'most-recent': [], past: [] };

    EVENTS.forEach((event) => {
      const phase = getEventPhase(event, current);
      groups[phase].push(event);
    });

    groups.upcoming = groups.upcoming.filter((e) => !eventHasEnded(e, current));
    groups.present = groups.present.filter((e) => !eventHasEnded(e, current));

    const byStart = (a, b) => parseDate(a.start) - parseDate(b.start);
    const byEndDesc = (a, b) => parseDate(b.end || b.start) - parseDate(a.end || a.start);

    const endedPool = [...groups['most-recent'], ...groups.past].filter((e) =>
      eventHasEnded(e, current)
    );
    endedPool.sort(byEndDesc);
    const newest = endedPool[0] || null;
    groups['most-recent'] = newest ? [newest] : [];
    groups.past = endedPool.filter((e) => e !== newest);
    groups.upcoming.sort(byStart);
    groups.present.sort(byStart);
    return groups;
  }

  function dateBadge(event) {
    const start = parseDate(event.start);
    if (Number.isNaN(start.getTime())) {
      return event.datePill || event.date || '—';
    }
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(start);
  }

  function photosForEvent(eventId) {
    return GALLERY.filter((p) => p && p.eventId === eventId);
  }

  function emptyMessage(phase) {
    const messages = {
      upcoming: 'No upcoming events yet — this column stays empty until new dates are published.',
      present: 'No events are running right now.',
      'most-recent': 'No recently finished event to show yet.',
      past: 'No past events to display yet.'
    };
    return messages[phase] || 'No events in this category.';
  }

  function phaseBadge(phase) {
    if (phase === 'present') return 'Live now';
    if (phase === 'most-recent') return 'Recently ended';
    if (phase === 'upcoming') return 'Upcoming';
    return '';
  }

  function renderPhotoStrip(event) {
    const photos = photosForEvent(event.id);
    if (!photos.length) return '';
    const limit = 4;
    const extra = photos.length > limit ? photos.length - (limit - 1) : 0;
    const thumbs = extra > 0 ? photos.slice(0, limit - 1) : photos.slice(0, limit);
    const figures = thumbs
      .map((photo) => {
        const src = escapeHtml(safeUrl(photo.image));
        const alt = escapeHtml(photo.alt || photo.caption || event.title || 'Event photo');
        return `<button type="button" class="events-phase-item__photo" data-view="${src}" data-caption="${alt}" aria-label="${alt}">
          <img src="${src}" alt="" width="72" height="72" loading="lazy">
        </button>`;
      })
      .join('');
    const more =
      extra > 0
        ? `<a href="#gallery" class="events-phase-item__photos-more" data-events-tab-link="gallery">+${extra}</a>`
        : '';
    return `<div class="events-phase-item__photos">${figures}${more}</div>`;
  }

  function renderCompactItem(event, phase) {
    const badge = phaseBadge(phase);
    const mod = PHASE_META[phase]?.mod || phase;
    const img = escapeHtml(safeUrl(event.image || ''));
    const title = escapeHtml(event.title || 'Event');
    const meta = escapeHtml(event.meta || [event.date, event.location].filter(Boolean).join(' · '));
    const dateLabel = escapeHtml(dateBadge(event));
    const detailHref = event.bookingEnabled && event.registerUrl
      ? escapeHtml(safeUrl(event.registerUrl))
      : `#event-${escapeHtml(event.id)}`;

    let action = '';
    if (phase === 'upcoming' && event.bookingEnabled !== false && event.registerUrl) {
      action = `<a href="${escapeHtml(safeUrl(event.registerUrl.startsWith('http') || event.registerUrl.includes('.html') ? event.registerUrl : `book.html?event=${encodeURIComponent(event.id)}`))}" class="events-phase-item__action events-phase-item__action--book">${escapeHtml(event.bookingLabel || event.registerLabel || 'Book Now')}</a>`;
    } else if (phase === 'present') {
      action = `<a href="contact.html" class="events-phase-item__action events-phase-item__action--live">Join us today</a>`;
    } else if (photosForEvent(event.id).length) {
      action = `<a href="#gallery" class="events-phase-item__action events-phase-item__action--gallery" data-events-tab-link="gallery">Photos →</a>`;
    } else if (event.registerUrl) {
      action = `<a href="${escapeHtml(safeUrl(event.registerUrl))}" class="events-phase-item__action events-phase-item__action--gallery">${escapeHtml(event.registerLabel || 'Details')}</a>`;
    }

    const media = img
      ? `<a href="${detailHref}" class="events-phase-item__media" data-event-open="${escapeHtml(event.id)}">
          <img src="${img}" alt="${title}" loading="lazy" decoding="async">
          <span class="events-phase-item__overlay"></span>
          <span class="events-phase-item__date">${dateLabel}</span>
        </a>`
      : '';

    return `
      <article class="events-phase-item events-phase-item--${mod}" id="event-${escapeHtml(event.id)}">
        ${media}
        ${phase === 'past' || phase === 'most-recent' ? renderPhotoStrip(event) : ''}
        <div class="events-phase-item__body">
          ${badge ? `<span class="events-phase-item__badge events-phase-item__badge--${mod}">${badge}</span>` : ''}
          <h4>${title}</h4>
          <p>${meta}</p>
          ${action}
        </div>
      </article>`;
  }

  function renderPhaseHeader(phase, count) {
    const meta = PHASE_META[phase];
    return `
      <header class="events-phase-column__head events-phase-column__head--${meta.mod}">
        <div class="events-phase-column__title-wrap">
          <span class="events-phase-column__icon${meta.live ? ' events-phase-column__icon--live' : ''}" aria-hidden="true">${meta.icon}</span>
          <div>
            <h3>${meta.label}</h3>
            <p class="events-phase-column__hint">${meta.hint}</p>
          </div>
        </div>
        <span class="events-phase-column__count">${count}</span>
      </header>`;
  }

  function renderPhases() {
    const row = document.getElementById('eventsPhasesRow') || document.querySelector('.events-phases-row');
    if (!row) return;

    const groups = categorizeEvents(new Date());
    const showPresent = groups.present.length > 0;
    const phases = showPresent
      ? PHASE_ORDER
      : PHASE_ORDER.filter((p) => p !== 'present');

    const liveBanner = !showPresent
      ? `<p class="events-live-status"><span class="events-live-status__dot" aria-hidden="true"></span> No events are live right now</p>`
      : '';

    const columns = phases
      .map((phase) => {
        const list = groups[phase] || [];
        const body =
          list.length > 0
            ? `<div class="events-phase-list">${list.map((e) => renderCompactItem(e, phase)).join('')}</div>`
            : `<p class="events-phase-empty">${emptyMessage(phase)}</p>`;
        return `
          <section class="events-phase-column events-phase-column--${PHASE_META[phase].mod}" id="${phase === 'most-recent' ? 'most-recent' : phase}">
            ${renderPhaseHeader(phase, list.length)}
            <div class="events-phase-column__body" aria-live="polite">${body}</div>
          </section>`;
      })
      .join('');

    row.className = `events-phases-row events-phases-row--${showPresent ? 'four' : 'three'}`;
    row.innerHTML = liveBanner + columns;
    bindPhotoButtons();
    bindEventOpens();
    focusSharedEvent();
  }

  function renderGalleryPanel() {
    const root = document.getElementById('gallery-root');
    if (!root) return;

    const byEvent = new Map();
    GALLERY.forEach((photo) => {
      if (!photo?.eventId) return;
      if (!byEvent.has(photo.eventId)) byEvent.set(photo.eventId, []);
      byEvent.get(photo.eventId).push(photo);
    });

    const albums = [...byEvent.entries()]
      .map(([eventId, photos]) => {
        const event = EVENTS.find((e) => e.id === eventId) || { id: eventId, title: eventId };
        return { event, photos };
      })
      .sort((a, b) => parseDate(b.event.end || b.event.start || 0) - parseDate(a.event.end || a.event.start || 0));

    if (!albums.length) {
      root.innerHTML = '<p class="events-gallery-empty">Event albums will appear here after photos are published.</p>';
      return;
    }

    root.innerHTML = `<div class="events-gallery-albums">${albums
      .map(({ event, photos }) => {
        const cover = photos[0];
        return `
          <article class="events-gallery-album" id="${escapeHtml(event.id)}">
            <a href="${escapeHtml(safeUrl(cover.image))}" class="events-gallery-album__cover" data-view="${escapeHtml(safeUrl(cover.image))}" data-caption="${escapeHtml(cover.alt || event.title || '')}">
              <img src="${escapeHtml(safeUrl(cover.image))}" alt="${escapeHtml(cover.alt || event.title || '')}" loading="lazy">
            </a>
            <div class="events-gallery-album__body">
              <h3>${escapeHtml(event.title || 'Event')}</h3>
              <p>${photos.length} photo${photos.length === 1 ? '' : 's'} · ${escapeHtml(event.datePill || event.date || '')}</p>
            </div>
          </article>`;
      })
      .join('')}</div>`;

    bindPhotoButtons();
  }

  function bindPhotoButtons() {
    document.querySelectorAll('[data-view]').forEach((el) => {
      if (el.dataset.boundView) return;
      el.dataset.boundView = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openLightbox(el.getAttribute('data-view'), el.getAttribute('data-caption') || '');
      });
    });
  }

  function openLightbox(src, caption) {
    const box = document.getElementById('photoLightbox');
    const img = document.getElementById('photoLightboxImg');
    const cap = document.getElementById('photoLightboxCaption');
    if (!box || !img) return;
    img.src = src || '';
    img.alt = caption || '';
    if (cap) cap.textContent = caption || '';
    box.hidden = false;
    box.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    const box = document.getElementById('photoLightbox');
    if (!box) return;
    box.hidden = true;
    box.setAttribute('aria-hidden', 'true');
  }

  function bindEventOpens() {
    document.querySelectorAll('[data-event-open]').forEach((el) => {
      if (el.dataset.boundOpen) return;
      el.dataset.boundOpen = '1';
      el.addEventListener('click', (e) => {
        const id = el.getAttribute('data-event-open');
        const event = EVENTS.find((x) => x.id === id);
        if (!event) return;
        e.preventDefault();
        openEventModal(event);
      });
    });
  }

  function openEventModal(event) {
    const modal = document.getElementById('eventModal');
    if (!modal) return;
    const img = document.getElementById('eventModalImage');
    const title = document.getElementById('eventModalTitle');
    const desc = document.getElementById('eventModalDesc');
    const meta = document.getElementById('eventModalMeta');
    const tags = document.getElementById('eventModalTags');
    const book = document.getElementById('eventModalBook');
    const register = document.getElementById('eventModalRegister');

    if (img) {
      img.src = event.image || '';
      img.alt = event.title || '';
    }
    if (title) title.textContent = event.title || '';
    if (desc) desc.textContent = event.description || event.summary || '';
    if (tags) {
      tags.innerHTML = event.category
        ? `<span class="event-modal__tag">${escapeHtml(event.category)}</span>`
        : '';
    }
    if (meta) {
      meta.innerHTML = [event.date, event.time, event.location]
        .filter(Boolean)
        .map((t) => `<li>${escapeHtml(t)}</li>`)
        .join('');
    }
    if (book) {
      const canBook = event.bookingEnabled !== false && event.status === 'upcoming';
      book.hidden = !canBook;
      book.href = event.registerUrl || `book.html?event=${encodeURIComponent(event.id)}`;
      book.textContent = event.bookingLabel || 'Book Now';
    }
    if (register) {
      register.href = event.registerUrl || 'contact.html';
      register.textContent = event.registerLabel || 'More info';
    }
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
  }

  function closeEventModal() {
    const modal = document.getElementById('eventModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
  }

  function focusSharedEvent() {
    const hash = String(global.location?.hash || '');
    const match = hash.match(/^#event-(.+)$/);
    if (!match) return;
    const el = document.getElementById('event-' + decodeURIComponent(match[1]));
    if (!el) return;
    el.classList.add('is-shared-target');
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  function showTab(tabId, pushHash) {
    const id = TABS.includes(tabId) ? tabId : 'events-phases';
    document.querySelectorAll('[data-events-panel]').forEach((panel) => {
      panel.hidden = panel.getAttribute('data-events-panel') !== id;
    });
    document.querySelectorAll('[data-events-tab]').forEach((tab) => {
      const active = tab.getAttribute('data-events-tab') === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (pushHash !== false) {
      const next = id === 'events-phases' ? '#events-phases' : `#${id}`;
      if (global.location.hash !== next) {
        global.history.replaceState(null, '', next);
      }
    }
  }

  function tabForHash(hash) {
    const h = String(hash || '').replace(/^#/, '');
    if (!h || h === 'events-phases' || h === 'upcoming' || h === 'present' || h === 'most-recent' || h === 'past' || h.startsWith('event-')) {
      return 'events-phases';
    }
    if (h === 'gallery' || EVENTS.some((e) => e.id === h)) return 'gallery';
    if (h === 'inquiry') return 'inquiry';
    return 'events-phases';
  }

  function bindTabs() {
    document.querySelectorAll('[data-events-tab], [data-events-tab-link]').forEach((el) => {
      if (el.dataset.boundTab) return;
      el.dataset.boundTab = '1';
      el.addEventListener('click', (e) => {
        const tab = el.getAttribute('data-events-tab') || el.getAttribute('data-events-tab-link');
        if (!tab || !TABS.includes(tab)) return;
        e.preventDefault();
        showTab(tab);
        const panel = document.getElementById(tab);
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    global.addEventListener('hashchange', () => {
      showTab(tabForHash(global.location.hash), false);
    });
  }

  function parseLooseDate(event) {
    if (event.start) return event;
    const pill = String(event.datePill || event.date || '');
    const parsed = Date.parse(pill.replace(/,/g, ''));
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      const iso = d.toISOString();
      return { ...event, start: iso, end: iso };
    }
    // Fallback: treat CMS "past" as ended, "upcoming" as far future so phase matches status
    if (event.status === 'upcoming') {
      return {
        ...event,
        start: '2099-01-01T10:00:00+11:00',
        end: '2099-01-01T18:00:00+11:00'
      };
    }
    return {
      ...event,
      start: '2020-01-01T10:00:00+11:00',
      end: '2020-01-01T18:00:00+11:00'
    };
  }

  function normalizeFromCms(content) {
    const events = Array.isArray(content?.events) ? content.events : [];
    EVENTS = events
      .filter((e) => e && e.id)
      .map((e) => parseLooseDate({ ...e }));
    GALLERY = Array.isArray(content?.gallery) ? content.gallery : [];
  }

  function refresh(content) {
    if (content) normalizeFromCms(content);
    else if (global.CMS_CONTENT) normalizeFromCms(global.CMS_CONTENT);
    renderPhases();
    renderGalleryPanel();
  }

  function bindChrome() {
    document.querySelectorAll('[data-event-close]').forEach((el) => {
      el.addEventListener('click', closeEventModal);
    });
    document.querySelectorAll('[data-lightbox-close]').forEach((el) => {
      el.addEventListener('click', closeLightbox);
    });
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
      });
    }
    global.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        closeEventModal();
      }
    });

    const params = new URLSearchParams(global.location.search);
    if (params.get('sent') === '1') {
      const success = document.getElementById('eventsInquirySuccess');
      if (success) success.hidden = false;
      showTab('inquiry', false);
    }
  }

  function init() {
    if (document.body?.dataset?.page !== 'events') return;
    bindTabs();
    bindChrome();
    showTab(tabForHash(global.location.hash), false);
    refresh(global.CMS_CONTENT || null);
    document.addEventListener('cms-ready', (ev) => {
      refresh(ev.detail || global.CMS_CONTENT);
    });
  }

  global.GotabgaaEventsPhases = { refresh, setEvents: (list) => { EVENTS = (list || []).map(parseLooseDate); } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);

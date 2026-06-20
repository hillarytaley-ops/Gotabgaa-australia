/**
 * Events page — filtering, search, and detail modal
 */
(function () {
  const FEATURED_EVENT = {
    title: 'Annual Cultural Fete 2026',
    date: 'Saturday, 12 September 2026',
    time: '10:00 AM – 6:00 PM AEST',
    location: 'Riverstage Park, Brisbane, QLD',
    image: 'assets/hero/taunet-cultural-dance.png',
    status: 'upcoming',
    category: 'cultural',
    desc: 'Our flagship celebration of Kalenjin heritage — traditional music, dance, storytelling, cuisine, and games for all generations. Food vendors, children\'s activities, and live performances throughout the day.'
  };

  document.addEventListener('DOMContentLoaded', () => {
    initEventFilters();
    initEventModal();
  });

  function initEventFilters() {
    const grid = document.getElementById('eventsGrid');
    const empty = document.getElementById('eventsEmpty');
    const search = document.getElementById('eventsSearch');
    const filters = document.querySelectorAll('.events__filter');
    if (!grid) return;

    const cards = [...grid.querySelectorAll('.event-card')];
    let activeFilter = 'all';
    let query = '';

    const matches = card => {
      const status = card.dataset.status;
      const category = card.dataset.category;
      const text = [
        card.dataset.title,
        card.dataset.date,
        card.dataset.location,
        card.dataset.desc,
        card.textContent
      ].join(' ').toLowerCase();

      const filterOk =
        activeFilter === 'all' ||
        activeFilter === status ||
        activeFilter === category;

      const searchOk = !query || text.includes(query);

      return filterOk && searchOk;
    };

    const apply = () => {
      let visible = 0;

      cards.forEach(card => {
        const show = matches(card);
        card.classList.toggle('is-hidden', !show);
        card.hidden = !show;
        if (show) visible += 1;
      });

      if (empty) {
        empty.hidden = visible > 0;
      }
    };

    filters.forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filters.forEach(b => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        apply();
      });
    });

    if (search) {
      search.addEventListener('input', () => {
        query = search.value.trim().toLowerCase();
        apply();
      });
    }
  }

  function initEventModal() {
    const modal = document.getElementById('eventModal');
    if (!modal) return;

    const img = document.getElementById('eventModalImage');
    const title = document.getElementById('eventModalTitle');
    const tags = document.getElementById('eventModalTags');
    const meta = document.getElementById('eventModalMeta');
    const desc = document.getElementById('eventModalDesc');
    const register = document.getElementById('eventModalRegister');
    const featuredBtn = document.querySelector('.events-featured__details-btn');

    const categoryLabels = {
      cultural: 'Cultural',
      sports: 'Sports',
      community: 'Community',
      agm: 'AGM'
    };

    const openFromCard = card => {
      const data = card.dataset;
      openModal({
        title: data.title,
        date: data.date,
        time: data.time,
        location: data.location,
        image: data.image,
        status: data.status,
        category: data.category,
        desc: data.desc
      });
    };

    const openModal = data => {
      img.src = data.image;
      img.alt = data.title;
      title.textContent = data.title;
      desc.textContent = data.desc;

      tags.innerHTML = `
        <span class="event-card__tag event-card__tag--${data.category}">${categoryLabels[data.category] || data.category}</span>
        <span class="event-card__tag event-card__tag--${data.status}">${data.status === 'upcoming' ? 'Upcoming' : 'Past'}</span>
      `;

      meta.innerHTML = `
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>${data.date}</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>${data.time}</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span>${data.location}</span></li>
      `;

      if (data.status === 'past') {
        register.textContent = 'Contact Us';
        register.href = 'contact.html';
      } else {
        register.textContent = 'Register Interest';
        register.href = 'contact.html';
      }

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    };

    const closeModal = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };

    document.querySelectorAll('[data-event-open]').forEach(btn => {
      btn.addEventListener('click', e => {
        const card = e.target.closest('.event-card');
        if (card) openFromCard(card);
      });
    });

    if (featuredBtn) {
      featuredBtn.addEventListener('click', () => openModal(FEATURED_EVENT));
    }

    modal.querySelectorAll('[data-event-close]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }
})();

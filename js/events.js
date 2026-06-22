/**
 * Events page — filtering, search, grouped lists, and detail modal
 */
(function () {
  function getFeaturedEvent() {
    if (window.CMS_FEATURED_EVENT) return window.CMS_FEATURED_EVENT;
    return null;
  }

  function boot() {
    initEventFilters();
    if (!window.__eventModalReady) {
      initEventModal();
      window.__eventModalReady = true;
    }
  }

  document.addEventListener('cms-ready', boot);
  document.addEventListener('events-ready', () => initEventFilters());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.CMS_CONTENT) boot();
    });
  } else if (window.CMS_CONTENT) {
    boot();
  }

  function initEventFilters() {
    const upcomingGrid = document.getElementById('eventsGridUpcoming');
    const pastGrid = document.getElementById('eventsGridPast');
    const empty = document.getElementById('eventsEmpty');
    const emptyUpcoming = document.getElementById('eventsEmptyUpcoming');
    const emptyPast = document.getElementById('eventsEmptyPast');
    const groupUpcoming = document.getElementById('eventsGroupUpcoming');
    const groupPast = document.getElementById('eventsGroupPast');
    const search = document.getElementById('eventsSearch');
    const filters = document.querySelectorAll('.events__filter');
    if (!upcomingGrid && !pastGrid) return;

    const cards = () => [
      ...(upcomingGrid ? [...upcomingGrid.querySelectorAll('.event-card')] : []),
      ...(pastGrid ? [...pastGrid.querySelectorAll('.event-card')] : [])
    ];

    let activeFilter = 'all';
    let query = '';

    const matches = card => {
      const category = card.dataset.category;
      const text = [
        card.dataset.title,
        card.dataset.date,
        card.dataset.location,
        card.dataset.desc,
        card.textContent
      ].join(' ').toLowerCase();

      const filterOk = activeFilter === 'all' || activeFilter === category;
      const searchOk = !query || text.includes(query);
      return filterOk && searchOk;
    };

    const apply = () => {
      let totalVisible = 0;
      let upcomingVisible = 0;
      let pastVisible = 0;

      cards().forEach(card => {
        const show = matches(card);
        card.classList.toggle('is-hidden', !show);
        card.hidden = !show;
        if (show) {
          totalVisible += 1;
          if (card.dataset.status === 'upcoming') upcomingVisible += 1;
          if (card.dataset.status === 'past') pastVisible += 1;
        }
      });

      if (emptyUpcoming) {
        emptyUpcoming.hidden = upcomingVisible > 0 || !upcomingGrid?.children.length;
      }
      if (emptyPast) {
        emptyPast.hidden = pastVisible > 0 || !pastGrid?.children.length;
      }
      if (groupUpcoming) {
        groupUpcoming.hidden = !upcomingGrid?.children.length;
      }
      if (groupPast) {
        groupPast.hidden = !pastGrid?.children.length;
      }
      if (empty) empty.hidden = totalVisible > 0;
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

    apply();
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
    const book = document.getElementById('eventModalBook');
    const featuredBtn = document.querySelector('.events-featured__details-btn');

    const categoryLabels = {
      cultural: 'Cultural',
      sports: 'Sports',
      community: 'Community',
      agm: 'AGM'
    };

    const openFromCard = card => {
      openModal({
        id: card.dataset.id,
        title: card.dataset.title,
        date: card.dataset.date,
        time: card.dataset.time,
        location: card.dataset.location,
        image: card.dataset.image,
        status: card.dataset.status,
        category: card.dataset.category,
        desc: card.dataset.desc,
        bookingUrl: card.dataset.bookingUrl,
        bookingEnabled: card.dataset.bookingEnabled === '1'
      });
    };

    const openModal = data => {
      img.src = data.image;
      img.alt = data.title;
      title.textContent = data.title;
      desc.textContent = data.desc || data.description;

      tags.innerHTML = `
        <span class="event-card__tag event-card__tag--${data.category}">${categoryLabels[data.category] || data.category}</span>
        <span class="event-card__tag event-card__tag--${data.status}">${data.status === 'upcoming' ? 'Upcoming' : 'Past'}</span>
      `;

      meta.innerHTML = `
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>${data.date}</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span>${data.time}</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span>${data.location}</span></li>
      `;

      if (data.status === 'upcoming' && data.bookingEnabled && data.bookingUrl) {
        if (book) {
          book.href = data.bookingUrl;
          book.textContent = 'Book Now';
          book.hidden = false;
        }
        if (register) {
          register.href = 'contact.html';
          register.textContent = 'Ask a Question';
          register.hidden = false;
        }
      } else if (data.status === 'past') {
        if (book) book.hidden = true;
        if (register) {
          register.textContent = 'Contact Us';
          register.href = 'contact.html';
          register.hidden = false;
        }
      } else {
        if (book) book.hidden = true;
        if (register) {
          register.textContent = 'Register Interest';
          register.href = 'contact.html';
          register.hidden = false;
        }
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

    modal.querySelectorAll('[data-event-close]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-event-open]');
      if (!btn) return;
      const card = btn.closest('.event-card');
      if (card) {
        e.preventDefault();
        openFromCard(card);
      }
    });

    if (featuredBtn) {
      featuredBtn.addEventListener('click', () => {
        const featured = getFeaturedEvent();
        if (!featured) return;
        openModal({
          id: featured.id,
          title: featured.title,
          date: featured.date,
          time: featured.time,
          location: featured.location,
          image: featured.image,
          status: featured.status,
          category: featured.category,
          desc: featured.description || featured.desc,
          bookingUrl: featured.registerUrl || (featured.id ? `book.html?id=${encodeURIComponent(featured.id)}` : ''),
          bookingEnabled: featured.status === 'upcoming' && featured.bookingEnabled !== false
        });
      });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }
})();

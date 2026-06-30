/**
 * Loads data/content.json and hydrates the public site.
 */
(function () {
  const CATEGORY_LABELS = {
    cultural: 'Cultural',
    sports: 'Sports',
    community: 'Community',
    agm: 'AGM'
  };

  const PROGRAM_ICONS = {
    education: '<path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>',
    heart: '<path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
    building: '<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>',
    music: '<path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>',
    support: '<path d="M18 9a3 3 0 100-6 3 3 0 000 6zM6 9a3 3 0 100-6 3 3 0 000 6zM12 22c4.418 0 8-2.686 8-6H4c0 3.314 3.582 6 8 6z"/>',
    health: '<path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/><path d="M12 8v8m-4-4h8"/>',
    family: '<path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>'
  };

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applySiteConfig(site) {
    if (!site) return;
    window.SITE_CONFIG = {
      siteUrl: site.siteUrl,
      siteName: site.siteName,
      contactEmail: site.contactEmail,
      social: { ...site.social }
    };

    document.querySelectorAll('[data-social]').forEach(link => {
      const key = link.getAttribute('data-social');
      if (site.social?.[key]) link.href = site.social[key];
    });

    document.querySelectorAll('[data-contact-email]').forEach(el => {
      if (el.tagName === 'A') el.href = `mailto:${site.contactEmail}`;
      else el.textContent = site.contactEmail;
    });

    document.querySelectorAll('.footer__brand p:first-of-type').forEach(el => {
      if (site.tagline) el.textContent = site.tagline;
    });

    document.querySelectorAll('.footer__affiliation').forEach(el => {
      if (site.affiliationText) {
        el.textContent = site.affiliationText;
      } else {
        el.hidden = true;
      }
    });

    document.querySelectorAll('.footer__bottom p').forEach(el => {
      if (site.copyrightYear) {
        el.textContent = el.textContent.replace(/\d{4}/, site.copyrightYear);
      }
    });
  }

  function getCurrentPage() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    const map = {
      '': 'home',
      'index.html': 'home',
      'about.html': 'about',
      'programs.html': 'programs',
      'welfare.html': 'welfare',
      'sports.html': 'sports',
      'business.html': 'business',
      'events.html': 'events',
      'leadership.html': 'leadership',
      'gallery.html': 'gallery',
      'contact.html': 'contact',
      'privacy.html': 'privacy',
      'terms.html': 'terms',
      'portal.html': 'portal',
      'login.html': 'portal',
      'join.html': 'join',
      'book.html': 'book',
      'members.html': 'members',
      'ailcd-apply.html': 'ailcd-apply'
    };
    return map[file] || null;
  }

  function applyPageHero(pageKey, pages) {
    const hero = pages?.[pageKey]?.hero;
    const section = document.querySelector('.page-hero');
    if (!hero || !section) return;

    const tag = section.querySelector('.section__tag');
    const title = section.querySelector('.page-hero__title');
    const desc = section.querySelector('.page-hero__desc');
    if (tag && hero.tag) tag.textContent = hero.tag;
    if (title && hero.title) title.textContent = hero.title;
    if (desc && hero.description) desc.textContent = hero.description;
    if (hero.backgroundImage && window.mountPageHeroBackground) {
      window.mountPageHeroBackground(section, hero.backgroundImage);
    }
  }

  function getEventBookingUrl(event) {
    if (event.bookingUrl) return event.bookingUrl;
    if (event.status === 'upcoming' && event.bookingEnabled !== false) {
      return `book.html?id=${encodeURIComponent(event.id)}`;
    }
    return event.registerUrl || '';
  }

  function getEventActionHtml(event) {
    if (event.status === 'upcoming' && event.bookingEnabled !== false) {
      const url = getEventBookingUrl(event);
      const label = event.bookingLabel || event.registerLabel || 'Book Now';
      return `<a href="${escapeHtml(url)}" class="event-card__register event-card__book">${escapeHtml(label)}</a>`;
    }
    if (event.registerUrl) {
      return `<a href="${escapeHtml(event.registerUrl)}" class="event-card__register">${escapeHtml(event.registerLabel || 'Register')}</a>`;
    }
    return '';
  }

  function renderEventCard(event, delay) {
    const catLabel = CATEGORY_LABELS[event.category] || event.category;
    const statusLabel = event.status === 'upcoming' ? 'Upcoming' : 'Past';
    const actionHtml = getEventActionHtml(event);
    const bookingUrl = getEventBookingUrl(event);

    return `
      <article class="event-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}"
        data-id="${escapeHtml(event.id)}"
        data-status="${escapeHtml(event.status)}"
        data-category="${escapeHtml(event.category)}"
        data-title="${escapeHtml(event.title)}"
        data-date="${escapeHtml(event.date)}"
        data-time="${escapeHtml(event.time)}"
        data-location="${escapeHtml(event.location)}"
        data-image="${escapeHtml(event.image)}"
        data-desc="${escapeHtml(event.description)}"
        data-booking-url="${escapeHtml(bookingUrl)}"
        data-booking-enabled="${event.status === 'upcoming' && event.bookingEnabled !== false ? '1' : '0'}">
        <div class="event-card__media">
          <img src="${escapeHtml(event.image)}" alt="" loading="lazy" decoding="async">
          <span class="event-card__date-pill">${escapeHtml(event.datePill)}</span>
        </div>
        <div class="event-card__body">
          <div class="event-card__tags">
            <span class="event-card__tag event-card__tag--${escapeHtml(event.category)}">${catLabel}</span>
            <span class="event-card__tag event-card__tag--${escapeHtml(event.status)}">${statusLabel}</span>
          </div>
          <h3>${escapeHtml(event.title)}</h3>
          <p class="event-card__meta">${escapeHtml(event.meta)}</p>
          <p class="event-card__summary">${escapeHtml(event.summary)}</p>
          ${event.ticketPriceNote && event.status === 'upcoming' ? `<p class="event-card__price-note">${escapeHtml(event.ticketPriceNote)}</p>` : ''}
          <div class="event-card__actions">
            <button type="button" class="event-card__details-btn" data-event-open>View Details</button>
            ${actionHtml}
          </div>
        </div>
      </article>
    `;
  }

  function renderHomeEventCard(event) {
    const isUpcoming = event.status === 'upcoming' && event.bookingEnabled !== false;
    const actionUrl = isUpcoming
      ? getEventBookingUrl(event)
      : (event.registerUrl || 'events.html');
    const actionLabel = isUpcoming
      ? (event.bookingLabel || 'RSVP')
      : (event.registerLabel || 'Learn More');

    return `
      <article class="home-event-card animate-on-scroll" data-animate="fade-up">
        <div class="home-event-card__media">
          <img src="${escapeHtml(event.image)}" alt="${escapeHtml(event.title)}" loading="lazy" decoding="async">
        </div>
        <div class="home-event-card__body">
          <time class="home-event-card__date">${escapeHtml(event.datePill || event.date)}</time>
          <h3>${escapeHtml(event.title)}</h3>
          <p class="home-event-card__location">${escapeHtml(event.location)}</p>
          <p class="home-event-card__summary">${escapeHtml(event.summary || event.description)}</p>
          <a href="${escapeHtml(actionUrl)}" class="btn btn--primary btn--sm">${escapeHtml(actionLabel)}</a>
        </div>
      </article>
    `;
  }

  function renderHomeEvents(content) {
    const grid = document.getElementById('homeEventsGrid');
    if (!grid || !content.events) return;

    const upcoming = content.events.filter(e => e.status === 'upcoming').slice(0, 2);
    grid.innerHTML = upcoming.length
      ? upcoming.map(e => renderHomeEventCard(e)).join('')
      : '<p class="home-events__empty">No upcoming events at the moment. Check back soon!</p>';
  }

  function renderFeaturedEvent(event) {
    const card = document.querySelector('.events-featured__card');
    if (!card || !event) return;

    const img = card.querySelector('.events-featured__media img');
    const status = card.querySelector('.events-featured__status');
    const title = card.querySelector('.events-featured__title');
    const desc = card.querySelector('.events-featured__desc');
    const metaItems = card.querySelectorAll('.events-featured__meta li span');
    const bookBtn = document.getElementById('featuredBookBtn');

    if (img) {
      img.src = event.image;
      img.alt = event.title;
    }
    if (status) status.textContent = event.status === 'upcoming' ? 'Upcoming' : 'Past';
    if (title) title.textContent = event.title;
    if (desc) desc.textContent = event.summary || event.description;

    if (metaItems.length >= 3) {
      metaItems[0].textContent = event.date;
      metaItems[1].textContent = event.time;
      metaItems[2].textContent = event.location;
    }

    if (bookBtn) {
      if (event.status === 'upcoming' && event.bookingEnabled !== false) {
        bookBtn.href = getEventBookingUrl(event);
        bookBtn.textContent = event.bookingLabel || 'Book Now';
        bookBtn.hidden = false;
      } else if (event.registerUrl) {
        bookBtn.href = event.registerUrl;
        bookBtn.textContent = event.registerLabel || 'Register';
        bookBtn.hidden = false;
      } else {
        bookBtn.hidden = true;
      }
    }
  }

  function renderEvents(content) {
    const upcomingGrid = document.getElementById('eventsGridUpcoming');
    const pastGrid = document.getElementById('eventsGridPast');
    if ((!upcomingGrid && !pastGrid) || !content.events) return;

    const upcoming = content.events.filter(e => e.status === 'upcoming');
    const past = content.events.filter(e => e.status === 'past');

    if (upcomingGrid) {
      upcomingGrid.innerHTML = upcoming.length
        ? upcoming.map((e, i) => renderEventCard(e, i % 5)).join('')
        : '';
    }
    if (pastGrid) {
      pastGrid.innerHTML = past.length
        ? past.map((e, i) => renderEventCard(e, i % 5)).join('')
        : '';
    }

    const eventsPage = content.pages?.events;
    if (eventsPage?.upcomingHeader) {
      const h = eventsPage.upcomingHeader;
      const tag = document.getElementById('upcomingEventsTag');
      const title = document.getElementById('upcomingEventsTitle');
      const desc = document.getElementById('upcomingEventsDesc');
      if (tag) tag.textContent = h.tag;
      if (title) title.textContent = h.title;
      if (desc) desc.textContent = h.description;
    }
    if (eventsPage?.pastHeader) {
      const h = eventsPage.pastHeader;
      const tag = document.getElementById('pastEventsTag');
      const title = document.getElementById('pastEventsTitle');
      const desc = document.getElementById('pastEventsDesc');
      if (tag) tag.textContent = h.tag;
      if (title) title.textContent = h.title;
      if (desc) desc.textContent = h.description;
    }

    const featured = content.events.find(e => e.id === content.featuredEventId)
      || upcoming[0]
      || content.events[0];
    renderFeaturedEvent(featured);
    window.CMS_FEATURED_EVENT = featured;

    const typesGrid = document.querySelector('.events-types__grid');
    if (typesGrid && content.eventTypes) {
      typesGrid.innerHTML = content.eventTypes.map((t, i) => `
        <article class="events-type-card animate-on-scroll" data-animate="fade-up" data-delay="${i}">
          <div class="events-type-card__icon events-type-card__icon--${escapeHtml(t.icon)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 19V6l12-3v13"/></svg>
          </div>
          <h3>${escapeHtml(t.title)}</h3>
          <p>${escapeHtml(t.description)}</p>
        </article>
      `).join('');
    }

    const timeline = document.querySelector('.events-timeline__list');
    if (timeline && content.timeline) {
      timeline.innerHTML = content.timeline.map((item) => `
        <li class="events-timeline__item">
          <span class="events-timeline__month">${escapeHtml(item.month)}</span>
          <div class="events-timeline__content">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        </li>
      `).join('');
    }

    const eventsPage = content.pages?.events;
    if (eventsPage?.typesHeader) {
      const header = document.querySelector('.events-types .section__header');
      if (header) {
        const tag = header.querySelector('.section__tag');
        const h2 = header.querySelector('.section__title');
        const p = header.querySelector('.section__desc');
        if (tag) tag.textContent = eventsPage.typesHeader.tag;
        if (h2) h2.textContent = eventsPage.typesHeader.title;
        if (p) p.textContent = eventsPage.typesHeader.description;
      }
    }

    if (eventsPage?.timelineHeader) {
      const header = document.querySelector('.events-timeline .section__header');
      if (header) {
        const tag = header.querySelector('.section__tag');
        const h2 = header.querySelector('.section__title');
        const p = header.querySelector('.section__desc');
        if (tag) tag.textContent = eventsPage.timelineHeader.tag;
        if (h2) h2.textContent = eventsPage.timelineHeader.title;
        if (p) p.textContent = eventsPage.timelineHeader.description;
      }
    }

    if (eventsPage?.cta) {
      const cta = document.querySelector('.events + .cta-banner, .events-timeline + .cta-banner, section.cta-banner');
      const eventsCta = document.querySelectorAll('.cta-banner');
      eventsCta.forEach(banner => {
        const h2 = banner.querySelector('h2');
        const p = banner.querySelector('p');
        if (h2?.textContent?.includes('host an event')) {
          h2.textContent = eventsPage.cta.title;
          if (p) p.textContent = eventsPage.cta.description;
        }
      });
    }

    const impactSection = document.querySelector('.events-impact .impact__grid');
    if (impactSection && eventsPage?.impact) {
      impactSection.innerHTML = eventsPage.impact.map((stat) => `
        <div class="impact__card">
          <span class="impact__number">${escapeHtml(stat.number)}</span>
          <span class="impact__label">${escapeHtml(stat.label)}</span>
        </div>
      `).join('');
    }

    document.dispatchEvent(new CustomEvent('events-ready'));
  }

  function renderPrograms(content) {
    const programs = content.programs || [];
    const pageGrid = document.querySelector('.programs .programs__grid');
    const homeGrid = document.querySelector('.programs-preview__grid');

    const renderCard = (prog, delay, flip, animate = true) => {
      const iconPath = PROGRAM_ICONS[prog.icon] || PROGRAM_ICONS.education;
      const anim = flip ? 'flip-up' : 'fade-up';
      const animAttrs = animate
        ? ` class="program-card animate-on-scroll" data-animate="${anim}" data-delay="${delay}"`
        : ' class="program-card"';
      return `
        <article${animAttrs}>
          <div class="program-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${iconPath}</svg>
          </div>
          <h3>${escapeHtml(prog.title)}</h3>
          <p>${escapeHtml(prog.description)}</p>
          <a href="${escapeHtml(prog.link)}" class="program-card__link">Learn more →</a>
        </article>
      `;
    };

    if (pageGrid) {
      const pagePrograms = programs.filter(p => !p.showOnHome);
      pageGrid.innerHTML = pagePrograms.map((p, i) => renderCard(p, i, false)).join('');
    }

    if (homeGrid) {
      const homePrograms = programs.filter(p => p.showOnHome);
      homeGrid.innerHTML = homePrograms.map((p) => renderCard(p, 0, false, false)).join('');
      homeGrid.querySelectorAll('.program-card').forEach(card => {
        card.classList.add('is-visible');
        card.style.opacity = '1';
        card.style.transform = 'none';
      });
    }
  }

  function renderLeadership(content) {
    const grid = document.querySelector('.leadership__grid');
    if (!grid || !content.leadership) return;

    grid.innerHTML = content.leadership.map((leader, i) => {
      const avatar = leader.photo
        ? `<img src="${escapeHtml(leader.photo)}" alt="${escapeHtml(leader.name)}" class="leader-card__photo">`
        : `<div class="leader-card__avatar">${escapeHtml(leader.initials)}</div>`;
      return `
        <div class="leader-card animate-on-scroll" data-animate="flip-up" data-delay="${i}">
          ${avatar}
          <h3>${escapeHtml(leader.name)}</h3>
          <p class="leader-card__role">${escapeHtml(leader.role)}</p>
        </div>
      `;
    }).join('');
  }

  function galleryPhotoHtml(item, delay) {
    const filename = (item.image || 'photo').split('/').pop() || 'gotabgaa-photo.jpg';
    return `
      <div class="gallery__item${item.wide ? ' gallery__item--wide' : ''} animate-on-scroll is-visible" data-animate="zoom-in" data-delay="${delay}">
        <div class="gallery__photo-wrap">
          <img class="gallery__photo" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async" draggable="false">
          <span class="gallery__caption">${escapeHtml(item.caption)}</span>
          <button type="button" class="gallery__download" data-gallery-download data-url="${escapeHtml(item.image)}" data-filename="${escapeHtml(filename)}" aria-label="Download ${escapeHtml(item.caption)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
            Download
          </button>
        </div>
      </div>
    `;
  }

  function renderGalleryAlbum(event, photos, delayStart) {
    if (!photos.length) return '';
    return `
      <div class="gallery-album animate-on-scroll" data-animate="fade-up">
        <div class="gallery-album__header">
          <h3 class="gallery-album__title">${escapeHtml(event.title)}</h3>
          <p class="gallery-album__meta">${escapeHtml(event.datePill || event.date || '')}${event.location ? ` · ${escapeHtml(event.location)}` : ''}</p>
        </div>
        <div class="gallery__grid">
          ${photos.map((item, i) => galleryPhotoHtml(item, (delayStart + i) % 6)).join('')}
        </div>
      </div>
    `;
  }

  function renderGallery(content) {
    const upcomingRoot = document.getElementById('galleryAlbumsUpcoming');
    const pastRoot = document.getElementById('galleryAlbumsPast');
    if (!upcomingRoot && !pastRoot) return;

    const events = content.events || [];
    const photos = content.gallery || [];
    const eventMap = Object.fromEntries(events.map(e => [e.id, e]));

    const upcomingEvents = events.filter(e => e.status === 'upcoming');
    const pastEvents = events.filter(e => e.status === 'past');

    const photosForEvent = eventId => photos.filter(p => p.eventId === eventId);

    let delay = 0;
    const upcomingHtml = upcomingEvents
      .map(event => {
        const album = renderGalleryAlbum(event, photosForEvent(event.id), delay);
        delay += photosForEvent(event.id).length;
        return album;
      })
      .filter(Boolean)
      .join('');

    delay = 0;
    const pastHtml = pastEvents
      .map(event => {
        const album = renderGalleryAlbum(event, photosForEvent(event.id), delay);
        delay += photosForEvent(event.id).length;
        return album;
      })
      .filter(Boolean)
      .join('');

    if (upcomingRoot) upcomingRoot.innerHTML = upcomingHtml;
    if (pastRoot) pastRoot.innerHTML = pastHtml;

    const upcomingCount = upcomingEvents.reduce((n, e) => n + photosForEvent(e.id).length, 0);
    const pastCount = pastEvents.reduce((n, e) => n + photosForEvent(e.id).length, 0);

    const emptyUpcoming = document.getElementById('galleryEmptyUpcoming');
    const emptyPast = document.getElementById('galleryEmptyPast');
    const groupUpcoming = document.getElementById('galleryGroupUpcoming');
    const groupPast = document.getElementById('galleryGroupPast');

    if (emptyUpcoming) emptyUpcoming.hidden = upcomingCount > 0;
    if (emptyPast) emptyPast.hidden = pastCount > 0;
    if (groupUpcoming) groupUpcoming.hidden = upcomingCount === 0 && pastCount > 0;
    if (groupPast) groupPast.hidden = pastCount === 0;

    const galleryPage = content.pages?.gallery;
    if (galleryPage?.upcomingHeader) {
      const h = galleryPage.upcomingHeader;
      const tag = document.getElementById('galleryUpcomingTag');
      const title = document.getElementById('galleryUpcomingTitle');
      const desc = document.getElementById('galleryUpcomingDesc');
      if (tag) tag.textContent = h.tag;
      if (title) title.textContent = h.title;
      if (desc) desc.textContent = h.description;
    }
    if (galleryPage?.pastHeader) {
      const h = galleryPage.pastHeader;
      const tag = document.getElementById('galleryPastTag');
      const title = document.getElementById('galleryPastTitle');
      const desc = document.getElementById('galleryPastDesc');
      if (tag) tag.textContent = h.tag;
      if (title) title.textContent = h.title;
      if (desc) desc.textContent = h.description;
    }

    document.dispatchEvent(new CustomEvent('gallery-ready'));
  }

  function applyHome(content) {
    const home = content.pages?.home;
    if (!home) return;

    const badge = document.querySelector('.hero__badge');
    const title = document.querySelector('.hero__title');
    const subtitle = document.querySelector('.hero__subtitle');
    const desc = document.querySelector('.hero__desc');
    const actions = document.querySelector('.hero__actions');

    if (badge && home.hero?.badge) badge.textContent = home.hero.badge;
    if (title && home.hero) {
      title.innerHTML = `${escapeHtml(home.hero.title)}<br><em>${escapeHtml(home.hero.titleEm)}</em>`;
    }
    if (subtitle && home.hero?.subtitle) subtitle.textContent = home.hero.subtitle;
    if (desc && home.hero?.description) desc.textContent = home.hero.description;

    if (home.hero?.slides?.length) {
      document.querySelectorAll('.hero__slide__photo').forEach((img, i) => {
        if (home.hero.slides[i]) img.src = home.hero.slides[i];
      });
    }

    if (actions && home.hero) {
      const primary = actions.querySelector('.btn--primary');
      const secondary = actions.querySelector('.btn--outline');
      if (primary) {
        primary.textContent = home.hero.ctaPrimary;
        primary.href = home.hero.ctaPrimaryUrl;
      }
      if (secondary) {
        secondary.textContent = home.hero.ctaSecondary;
        secondary.href = home.hero.ctaSecondaryUrl;
      }
    }

    const impactGrid = document.querySelector('.impact .impact__grid');
    if (impactGrid && home.impact) {
      impactGrid.innerHTML = home.impact.map((stat) => `
        <div class="impact__card">
          <span class="impact__number">${escapeHtml(stat.number)}</span>
          <span class="impact__label">${escapeHtml(stat.label)}</span>
        </div>
      `).join('');
    }

    const aboutPreview = document.querySelector('.about-preview');
    if (aboutPreview && home.aboutPreview) {
      const ap = home.aboutPreview;
      const tag = aboutPreview.querySelector('.home-about__heading') || aboutPreview.querySelector('.section__tag');
      const h2 = aboutPreview.querySelector('.home-about__org') || aboutPreview.querySelector('.section__title');
      const paragraphs = aboutPreview.querySelectorAll('.about-preview__content p, .home-about__content p');
      const cta = aboutPreview.querySelector('.about-preview__content .btn, .home-about__content .btn');
      const caption = aboutPreview.querySelector('.about-preview__caption');
      if (tag) tag.textContent = ap.tag;
      if (h2) h2.textContent = ap.title;
      if (paragraphs.length >= 2 && ap.paragraphs) {
        paragraphs[0].textContent = ap.paragraphs[0];
        paragraphs[1].textContent = ap.paragraphs[1];
      }
      if (cta) {
        cta.textContent = ap.cta;
        cta.href = ap.ctaUrl;
      }
      if (caption) caption.textContent = ap.caption;
    }

    const programsHeader = document.querySelector('.programs-preview .section__header');
    if (programsHeader && home.programsPreview) {
      const pp = home.programsPreview;
      const tag = programsHeader.querySelector('.section__tag');
      const h2 = programsHeader.querySelector('.section__title');
      const p = programsHeader.querySelector('.section__desc');
      if (tag) tag.textContent = pp.tag;
      if (h2) h2.textContent = pp.title;
      if (p) p.textContent = pp.description;
    }

    const homeCta = document.querySelector('.programs-preview + .cta-banner, .section.programs-preview + .cta-banner');
    const ctaBanners = document.querySelectorAll('.cta-banner');
    ctaBanners.forEach(banner => {
      const h2 = banner.querySelector('h2');
      if (h2?.textContent?.includes('Growing Community') && home.cta) {
        h2.textContent = home.cta.title;
        const p = banner.querySelector('p');
        const btn = banner.querySelector('.btn');
        if (p) p.textContent = home.cta.description;
        if (btn) {
          btn.textContent = home.cta.button;
          btn.href = home.cta.buttonUrl;
        }
      }
    });
  }

  function applyAbout(content) {
    const about = content.pages?.about;
    if (!about) return;

    const cards = document.querySelectorAll('.about__card');
    if (cards[0]) {
      const missionP = cards[0].querySelector('p');
      if (missionP) missionP.textContent = about.mission;
    }
    if (cards[1]) {
      const visionP = cards[1].querySelector('p');
      if (visionP) visionP.textContent = about.vision;
    }

    const storyLead = document.querySelector('.story-section__prose .about__lead');
    if (storyLead && about.lead) storyLead.textContent = about.lead;

    const tags = document.querySelector('.about__tags');
    if (tags && about.cities) {
      tags.innerHTML = about.cities.map((city, i) =>
        `<span class="city-tag animate-on-scroll" data-animate="pop" data-delay="${i}">${escapeHtml(city)}</span>`
      ).join('');
    }

    const quote = document.querySelector('.about__quote blockquote');
    if (quote) quote.textContent = about.quote;

    const photo = document.querySelector('.about__community-photo');
    if (photo && about.image) {
      photo.src = about.image;
    }

    const aboutCta = document.querySelector('.about.section + .cta-banner');
    if (aboutCta && about.cta) {
      const h2 = aboutCta.querySelector('h2');
      const p = aboutCta.querySelector('p');
      const btn = aboutCta.querySelector('.btn');
      if (h2) h2.textContent = about.cta.title;
      if (p) p.textContent = about.cta.description;
      if (btn) {
        btn.textContent = about.cta.button;
        btn.href = about.cta.buttonUrl;
      }
    }
  }

  function applyContact(content) {
    const contact = content.contact;
    if (!contact) return;

    const intro = document.querySelector('.contact__info p');
    if (intro) intro.textContent = contact.intro;

    const details = document.querySelectorAll('.contact__details li');
    if (details[0]) {
      const a = details[0].querySelector('a');
      if (a) {
        a.href = `mailto:${content.site.contactEmail}`;
        a.textContent = content.site.contactEmail;
      }
    }
    if (details[1]) details[1].querySelector('span').textContent = contact.location;
    if (details[2]) details[2].querySelector('span').textContent = contact.officeHours;
  }

  function applySectionHeader(rootId, header) {
    if (!header) return;
    const root = document.getElementById(rootId);
    if (!root) return;
    const tag = root.querySelector('.section__tag');
    const title = root.querySelector('.section__title');
    const desc = root.querySelector('.section__desc');
    if (tag && header.tag) tag.textContent = header.tag;
    if (title && header.title) title.textContent = header.title;
    if (desc && header.description) desc.textContent = header.description;
  }

  function youtubeEmbedUrl(url) {
    if (!url) return '';
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/@)([^&?/]+)/);
    if (!match) return url;
    if (url.includes('/@')) return url;
    return `https://www.youtube.com/embed/${match[1]}`;
  }

  function isYoutubeChannel(url) {
    return url && url.includes('youtube.com/@');
  }

  function renderVlogCard(item, delay) {
    const thumb = item.thumbnail || 'assets/hero/page/kokwet-sports-day.png';
    const embed = youtubeEmbedUrl(item.videoUrl);
    const isChannel = isYoutubeChannel(item.videoUrl);
    const media = isChannel
      ? `<a href="${escapeHtml(item.videoUrl)}" class="hub-vlog-card__thumb-link" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">
          <span class="hub-vlog-card__play" aria-hidden="true">▶</span>
        </a>`
      : `<div class="hub-vlog-card__embed">
          <iframe src="${escapeHtml(embed)}" title="${escapeHtml(item.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>`;

    return `
      <article class="hub-vlog-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}">
        ${media}
        <div class="hub-vlog-card__body">
          <time class="hub-vlog-card__date">${escapeHtml(item.date || '')}</time>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || '')}</p>
          ${isChannel ? `<a href="${escapeHtml(item.videoUrl)}" class="hub-vlog-card__link" target="_blank" rel="noopener noreferrer">Watch on YouTube →</a>` : ''}
        </div>
      </article>
    `;
  }

  function renderNewsCard(item, delay) {
    const img = item.image
      ? `<div class="hub-news-card__media"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async"></div>`
      : '';
    const link = item.link
      ? `<a href="${escapeHtml(item.link)}" class="hub-news-card__link">Read more →</a>`
      : '';

    return `
      <article class="hub-news-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}">
        ${img}
        <div class="hub-news-card__body">
          <time class="hub-news-card__date">${escapeHtml(item.date || '')}</time>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || '')}</p>
          ${link}
        </div>
      </article>
    `;
  }

  function renderHubEventCard(item, delay) {
    const statusLabel = item.status === 'upcoming' ? 'Upcoming' : 'Past';
    const action = item.link
      ? `<a href="${escapeHtml(item.link)}" class="btn btn--outline btn--sm">${escapeHtml(item.linkLabel || 'Learn more')}</a>`
      : '';

    return `
      <article class="hub-event-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}">
        <div class="hub-event-card__media">
          <img src="${escapeHtml(item.image || 'assets/hero/kokwet-sports-day.png')}" alt="" loading="lazy" decoding="async">
          <span class="hub-event-card__pill">${escapeHtml(item.datePill || item.date || '')}</span>
        </div>
        <div class="hub-event-card__body">
          <span class="hub-event-card__status hub-event-card__status--${escapeHtml(item.status || 'upcoming')}">${statusLabel}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="hub-event-card__location">${escapeHtml(item.location || '')}</p>
          <p class="hub-event-card__summary">${escapeHtml(item.summary || '')}</p>
          ${action}
        </div>
      </article>
    `;
  }

  function renderAdvertCard(item, delay) {
    const emailLink = item.contactEmail
      ? `<a href="mailto:${escapeHtml(item.contactEmail)}" class="hub-advert-card__email">${escapeHtml(item.contactEmail)}</a>`
      : '';
    const extLink = item.link
      ? `<a href="${escapeHtml(item.link)}" class="hub-advert-card__link">${escapeHtml(item.linkLabel || 'Visit website →')}</a>`
      : '';

    return `
      <article class="hub-advert-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}">
        <div class="hub-advert-card__media">
          <img src="${escapeHtml(item.image || 'assets/logo-round.png')}" alt="" loading="lazy" decoding="async">
          ${item.category ? `<span class="hub-advert-card__category">${escapeHtml(item.category)}</span>` : ''}
        </div>
        <div class="hub-advert-card__body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description || '')}</p>
          ${emailLink}
          ${extLink}
        </div>
      </article>
    `;
  }

  function renderInvestmentCard(item, delay) {
    const statusLabel = item.status === 'open' ? 'Open' : 'Closed';
    const action = item.link
      ? `<a href="${escapeHtml(item.link)}" class="btn btn--primary btn--sm">${escapeHtml(item.linkLabel || 'Express interest')}</a>`
      : '';

    return `
      <article class="hub-investment-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}">
        <div class="hub-investment-card__media">
          <img src="${escapeHtml(item.image || 'assets/hero/page/gala-celebration.png')}" alt="" loading="lazy" decoding="async">
          <span class="hub-investment-card__status hub-investment-card__status--${escapeHtml(item.status || 'open')}">${statusLabel}</span>
        </div>
        <div class="hub-investment-card__body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || '')}</p>
          <ul class="hub-investment-card__meta">
            ${item.amount ? `<li><strong>Amount:</strong> ${escapeHtml(item.amount)}</li>` : ''}
            ${item.deadline ? `<li><strong>Deadline:</strong> ${escapeHtml(item.deadline)}</li>` : ''}
          </ul>
          ${action}
        </div>
      </article>
    `;
  }

  function renderWelfareInitiativeCard(item, delay) {
    const iconPath = PROGRAM_ICONS[item.icon] || PROGRAM_ICONS.heart;
    return `
      <article class="program-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}">
        <div class="program-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${iconPath}</svg>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || '')}</p>
        <a href="${escapeHtml(item.link || 'contact.html')}" class="program-card__link">${escapeHtml(item.linkLabel || 'Learn more')} →</a>
      </article>
    `;
  }

  function renderPublished(items) {
    return (items || []).filter(item => item.published !== false);
  }

  function renderWelfare(content) {
    const page = content.pages?.welfare;
    const data = content.welfare || {};
    const membership = data.membership || {};

    const introEl = document.getElementById('welfareIntro');
    if (introEl && page?.intro) introEl.textContent = page.intro;

    applySectionHeader('welfareInitiativesHeader', page?.initiativesHeader);
    applySectionHeader('welfareNewsHeader', page?.newsHeader);
    applySectionHeader('welfarePackagesHeader', membership.packagesHeader);

    const regIntro = document.getElementById('welfareRegIntro');
    if (regIntro && membership.intro) regIntro.textContent = membership.intro;

    const signInIntro = document.getElementById('welfareSignInIntro');
    if (signInIntro && membership.signInIntro) signInIntro.textContent = membership.signInIntro;

    const feeNote = document.getElementById('welfareFeeNote');
    if (feeNote && membership.feeNote) feeNote.textContent = membership.feeNote;

    const initiativesGrid = document.getElementById('welfareInitiativesGrid');
    if (initiativesGrid) {
      const items = data.initiatives || [];
      initiativesGrid.innerHTML = items.length
        ? items.map((item, i) => renderWelfareInitiativeCard(item, i)).join('')
        : '<p class="hub-empty">Welfare initiatives will appear here once added in the admin dashboard.</p>';
    }

    const newsGrid = document.getElementById('welfareNewsGrid');
    if (newsGrid) {
      const items = renderPublished(data.news);
      newsGrid.innerHTML = items.length
        ? items.map((item, i) => renderNewsCard(item, i)).join('')
        : '<p class="hub-empty">No welfare news yet.</p>';
    }

    const cta = page?.cta;
    if (cta) {
      const titleEl = document.querySelector('#welfareCta .cta-banner__title');
      const descEl = document.querySelector('#welfareCta .cta-banner__desc');
      const btnEl = document.getElementById('welfareCtaBtn');
      if (titleEl && cta.title) titleEl.textContent = cta.title;
      if (descEl && cta.description) descEl.textContent = cta.description;
      if (btnEl && cta.button) {
        btnEl.textContent = cta.button;
        if (cta.buttonUrl) btnEl.href = cta.buttonUrl;
      }
    }
  }

  function renderSports(content) {
    const page = content.pages?.sports;
    const data = content.sports || {};

    applySectionHeader('sportsVlogHeader', page?.vlogHeader);
    applySectionHeader('sportsEventsHeader', page?.eventsHeader);
    applySectionHeader('sportsNewsHeader', page?.newsHeader);

    const vlogGrid = document.getElementById('sportsVlogGrid');
    if (vlogGrid) {
      const items = renderPublished(data.vlogs);
      vlogGrid.innerHTML = items.length
        ? items.map((item, i) => renderVlogCard(item, i)).join('')
        : '<p class="hub-empty">Sports vlogs will appear here once added in the admin dashboard.</p>';
    }

    const eventsGrid = document.getElementById('sportsEventsGrid');
    if (eventsGrid) {
      const items = data.events || [];
      eventsGrid.innerHTML = items.length
        ? items.map((item, i) => renderHubEventCard(item, i)).join('')
        : '<p class="hub-empty">No planned sports events yet.</p>';
    }

    const newsGrid = document.getElementById('sportsNewsGrid');
    if (newsGrid) {
      const items = renderPublished(data.news);
      newsGrid.innerHTML = items.length
        ? items.map((item, i) => renderNewsCard(item, i)).join('')
        : '<p class="hub-empty">No sports news yet.</p>';
    }
  }

  function renderBusiness(content) {
    const page = content.pages?.business;
    const data = content.business || {};

    applySectionHeader('businessVlogHeader', page?.vlogHeader);
    applySectionHeader('businessAdvertsHeader', page?.advertsHeader);
    applySectionHeader('businessInvestmentsHeader', page?.investmentsHeader);
    applySectionHeader('businessNewsHeader', page?.newsHeader);

    const vlogGrid = document.getElementById('businessVlogGrid');
    if (vlogGrid) {
      const items = renderPublished(data.vlogs);
      vlogGrid.innerHTML = items.length
        ? items.map((item, i) => renderVlogCard(item, i)).join('')
        : '<p class="hub-empty">Business vlogs will appear here once added in the admin dashboard.</p>';
    }

    const advertsGrid = document.getElementById('businessAdvertsGrid');
    if (advertsGrid) {
      const items = renderPublished(data.adverts);
      advertsGrid.innerHTML = items.length
        ? items.map((item, i) => renderAdvertCard(item, i)).join('')
        : '<p class="hub-empty">No business adverts yet.</p>';
    }

    const investmentsGrid = document.getElementById('businessInvestmentsGrid');
    if (investmentsGrid) {
      const items = data.investments || [];
      investmentsGrid.innerHTML = items.length
        ? items.map((item, i) => renderInvestmentCard(item, i)).join('')
        : '<p class="hub-empty">No investment opportunities listed yet.</p>';
    }

    const newsGrid = document.getElementById('businessNewsGrid');
    if (newsGrid) {
      const items = renderPublished(data.news);
      newsGrid.innerHTML = items.length
        ? items.map((item, i) => renderNewsCard(item, i)).join('')
        : '<p class="hub-empty">No business news yet.</p>';
    }
  }

  function hydrate(content) {
    window.CMS_CONTENT = content;
    applySiteConfig(content.site);

    const page = getCurrentPage();

    if (page === 'home') {
      applyHome(content);
      renderPrograms(content);
      renderHomeEvents(content);
    } else if (page && content.pages?.[page]?.hero) {
      applyPageHero(page, content.pages);
    }

    if (page === 'about') applyAbout(content);
    if (page === 'contact') applyContact(content);
    if (page === 'events') renderEvents(content);
    if (page === 'programs') renderPrograms(content);
    if (page === 'leadership') renderLeadership(content);
    if (page === 'gallery') renderGallery(content);
    if (page === 'welfare') renderWelfare(content);
    if (page === 'sports') renderSports(content);
    if (page === 'business') renderBusiness(content);

    document.dispatchEvent(new CustomEvent('cms-ready', { detail: content }));
  }

  async function load() {
    try {
      let res = await fetch('/api/content', { cache: 'no-cache' });
      if (!res.ok) {
        res = await fetch('/data/content.json', { cache: 'no-cache' });
      }
      if (!res.ok) throw new Error('Content fetch failed');
      const content = await res.json();
      hydrate(content);
    } catch (err) {
      console.warn('CMS content not loaded:', err.message);
      document.dispatchEvent(new CustomEvent('cms-ready', { detail: null }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

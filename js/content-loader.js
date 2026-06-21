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
    music: '<path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>'
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
      const link = el.querySelector('a');
      if (link && site.affiliationUrl) link.href = site.affiliationUrl;
      if (site.affiliationText) {
        if (link) el.innerHTML = `${escapeHtml(site.affiliationText)} <a href="${escapeHtml(site.affiliationUrl)}" target="_blank" rel="noopener">Gotabgaa International</a>`;
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
      'events.html': 'events',
      'leadership.html': 'leadership',
      'gallery.html': 'gallery',
      'contact.html': 'contact',
      'privacy.html': 'privacy',
      'terms.html': 'terms',
      'portal.html': 'portal'
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
  }

  function renderEventCard(event, delay) {
    const catLabel = CATEGORY_LABELS[event.category] || event.category;
    const statusLabel = event.status === 'upcoming' ? 'Upcoming' : 'Past';
    const registerHtml = event.registerUrl
      ? `<a href="${escapeHtml(event.registerUrl)}" class="event-card__register">${escapeHtml(event.registerLabel || 'Register')}</a>`
      : '';

    return `
      <article class="event-card animate-on-scroll" data-animate="fade-up" data-delay="${delay}"
        data-status="${escapeHtml(event.status)}"
        data-category="${escapeHtml(event.category)}"
        data-title="${escapeHtml(event.title)}"
        data-date="${escapeHtml(event.date)}"
        data-time="${escapeHtml(event.time)}"
        data-location="${escapeHtml(event.location)}"
        data-image="${escapeHtml(event.image)}"
        data-desc="${escapeHtml(event.description)}">
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
          <div class="event-card__actions">
            <button type="button" class="event-card__details-btn" data-event-open>View Details</button>
            ${registerHtml}
          </div>
        </div>
      </article>
    `;
  }

  function renderFeaturedEvent(event) {
    const card = document.querySelector('.events-featured__card');
    if (!card || !event) return;

    const img = card.querySelector('.events-featured__media img');
    const status = card.querySelector('.events-featured__status');
    const title = card.querySelector('.events-featured__title');
    const desc = card.querySelector('.events-featured__desc');
    const metaItems = card.querySelectorAll('.events-featured__meta li span');

    if (img) {
      img.src = event.image;
      img.alt = event.title;
    }
    if (status) status.textContent = event.status === 'upcoming' ? 'Upcoming' : 'Past';
    if (title) title.textContent = event.title;
    if (desc) desc.textContent = event.description;

    if (metaItems.length >= 3) {
      metaItems[0].textContent = event.date;
      metaItems[1].textContent = event.time;
      metaItems[2].textContent = event.location;
    }
  }

  function renderEvents(content) {
    const grid = document.getElementById('eventsGrid');
    if (!grid || !content.events) return;

    grid.innerHTML = content.events.map((e, i) => renderEventCard(e, i % 5)).join('');

    const featured = content.events.find(e => e.id === content.featuredEventId) || content.events[0];
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
      timeline.innerHTML = content.timeline.map((item, i) => `
        <li class="events-timeline__item animate-on-scroll" data-animate="fade-right" data-delay="${i}">
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
      impactSection.innerHTML = eventsPage.impact.map((stat, i) => `
        <div class="impact__card animate-on-scroll" data-animate="scale-up" data-delay="${i}">
          <span class="impact__number" ${stat.animate ? `data-count="${stat.number}"` : ''}>${stat.animate ? '0' : stat.number}</span>
          <span class="impact__label">${escapeHtml(stat.label)}</span>
        </div>
      `).join('');
    }
  }

  function renderPrograms(content) {
    const programs = content.programs || [];
    const pageGrid = document.querySelector('.programs .programs__grid');
    const homeGrid = document.querySelector('.programs-preview__grid');

    const renderCard = (prog, delay, flip) => {
      const iconPath = PROGRAM_ICONS[prog.icon] || PROGRAM_ICONS.education;
      const anim = flip ? 'flip-up' : 'fade-up';
      return `
        <article class="program-card animate-on-scroll" data-animate="${anim}" data-delay="${delay}">
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
      homeGrid.innerHTML = homePrograms.map((p, i) => renderCard(p, i * 100, true)).join('');
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

  function renderGallery(content) {
    const grid = document.querySelector('.gallery__grid');
    if (!grid || !content.gallery?.length) return;

    grid.innerHTML = content.gallery.map((item, i) => `
      <div class="gallery__item${item.wide ? ' gallery__item--wide' : ''} animate-on-scroll is-visible" data-animate="zoom-in" data-delay="${i}">
        <div class="gallery__photo-wrap">
          <img class="gallery__photo" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">
          <span class="gallery__caption">${escapeHtml(item.caption)}</span>
        </div>
      </div>
    `).join('');
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
      impactGrid.innerHTML = home.impact.map((stat, i) => `
        <div class="impact__card animate-on-scroll" data-animate="scale-up" data-delay="${i * 100}">
          <span class="impact__number">${escapeHtml(stat.number)}</span>
          <span class="impact__label">${escapeHtml(stat.label)}</span>
        </div>
      `).join('');
    }

    const aboutPreview = document.querySelector('.about-preview');
    if (aboutPreview && home.aboutPreview) {
      const ap = home.aboutPreview;
      const tag = aboutPreview.querySelector('.section__tag');
      const h2 = aboutPreview.querySelector('.section__title');
      const paragraphs = aboutPreview.querySelectorAll('.about-preview__content p');
      const cta = aboutPreview.querySelector('.about-preview__content .btn');
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

    const lead = document.querySelector('.about__lead');
    if (lead) lead.textContent = about.lead;

    const cards = document.querySelectorAll('.about__card');
    if (cards[0]) cards[0].querySelector('p').textContent = about.mission;
    if (cards[1]) cards[1].querySelector('p').textContent = about.vision;

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

  function hydrate(content) {
    window.CMS_CONTENT = content;
    applySiteConfig(content.site);

    const page = getCurrentPage();

    if (page === 'home') {
      applyHome(content);
      renderPrograms(content);
    } else if (page && content.pages?.[page]?.hero) {
      applyPageHero(page, content.pages);
    }

    if (page === 'about') applyAbout(content);
    if (page === 'contact') applyContact(content);
    if (page === 'events') renderEvents(content);
    if (page === 'programs') renderPrograms(content);
    if (page === 'leadership') renderLeadership(content);
    if (page === 'gallery') renderGallery(content);

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

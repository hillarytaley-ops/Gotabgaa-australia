// Gotabgaa Australia — Main JavaScript

(function initMobileShellEarly() {
  if (!window.matchMedia('(max-width: 1024px)').matches) return;

  const run = () => {
    if (document.body.classList.contains('admin-page')) return;
    if (document.querySelector('.site-shell')) return;

    const shell = document.createElement('div');
    shell.className = 'site-shell';
    const movable = [];

    document.body.childNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'SCRIPT') return;
      movable.push(node);
    });

    if (!movable.length) return;
    movable.forEach(node => shell.appendChild(node));
    document.body.insertBefore(shell, document.body.firstChild);
  };

  if (document.body) run();
  else document.addEventListener('DOMContentLoaded', run, { once: true });
})();

document.addEventListener('DOMContentLoaded', () => {
  initSiteConfig();
  initHeader();
  initNavigation();
  initScrollProgress();
  initCounters();
  document.addEventListener('cms-ready', initCounters);
  initContactForm();
  initScrollAnimations();
  initHeroPhotoFit();
  initHeroParallax();
  initTiltCards();
  initPageHeroBackground();
  initPageHeroLogos();
  initAdminPortalLinks();
  initMemberPortalLinks();
  lockMobileViewport();
  window.addEventListener('resize', lockMobileViewport, { passive: true });
});

document.addEventListener('cms-ready', () => {
  initScrollAnimations();
  initTiltCards();
  initHeroPhotoFit();
  lockMobileViewport();
});

document.addEventListener('events-ready', () => {
  initScrollAnimations();
  initTiltCards();
});

document.addEventListener('gallery-ready', () => {
  initScrollAnimations();
});

function initSiteConfig() {
  const cfg = window.SITE_CONFIG;
  if (!cfg) return;

  const social = cfg.social || {};
  document.querySelectorAll('[data-social]').forEach(link => {
    const key = link.getAttribute('data-social');
    if (social[key]) link.href = social[key];
  });

  if (cfg.contactEmail) {
    document.querySelectorAll('[data-contact-email]').forEach(el => {
      if (el.tagName === 'A') el.href = `mailto:${cfg.contactEmail}`;
      else el.textContent = cfg.contactEmail;
    });
  }
}

// Sticky header on scroll
function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Scroll progress bar at top
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;

  const update = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${progress}%`;
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

// Mobile nav & active link tracking
function initNavigation() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  const links = document.querySelectorAll('.nav__link');

  function closeFloatingSocial() {
    if (typeof window.closeFloatingSocial === 'function') {
      window.closeFloatingSocial();
    }
  }

  if (toggle && menu) {
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      closeFloatingSocial();
      menu.classList.toggle('open');
      toggle.classList.toggle('active');
      document.body.classList.toggle('nav-menu-open', willOpen);
    });

    links.forEach(link => {
      link.addEventListener('click', () => {
        closeFloatingSocial();
        menu.classList.remove('open');
        toggle.classList.remove('active');
        document.body.classList.remove('nav-menu-open');
      });
    });

    menu.querySelectorAll('.nav__cta').forEach(link => {
      link.addEventListener('click', () => {
        closeFloatingSocial();
        menu.classList.remove('open');
        toggle.classList.remove('active');
        document.body.classList.remove('nav-menu-open');
      });
    });
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isHome = currentPage === '' || currentPage === 'index.html';

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    const target = href.split('/').pop();
    const isActive = target === currentPage || (isHome && target === 'index.html');
    link.classList.toggle('active', isActive);
  });

  const memberLink = document.querySelector('[data-member-link]');
  if (memberLink && (currentPage === 'members.html' || currentPage === 'members')) {
    memberLink.classList.add('is-active');
  }

  const hashSections = document.querySelectorAll('section[id]');
  const hasHashNav = [...links].some(link => link.getAttribute('href')?.startsWith('#'));

  if (!hasHashNav || hashSections.length < 2) return;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          links.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    },
    { rootMargin: isMobile ? '-30% 0px -50% 0px' : '-40% 0px -55% 0px' }
  );

  hashSections.forEach(section => observer.observe(section));
}

// Animated stat counters
function initCounters() {
  const counters = document.querySelectorAll('.impact__number[data-count]');
  if (!counters.length) return;

  const animateCounter = el => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 2000;
    const start = performance.now();

    const step = now => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + (target >= 100 ? '+' : '');
    };

    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(counter => observer.observe(counter));
}

// Contact form — Supabase API when configured, else FormSubmit.co
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const cfg = window.SITE_CONFIG || {};
  const siteUrl = (cfg.siteUrl || window.location.origin).replace(/\/$/, '');
  const nextField = form.querySelector('[name="_next"]');
  if (nextField) nextField.value = `${siteUrl}/contact.html?sent=1`;

  const successEl = document.getElementById('contactSuccess');
  if (successEl && new URLSearchParams(window.location.search).get('sent') === '1') {
    successEl.hidden = false;
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  let useFormSubmitFallback = false;

  form.addEventListener('submit', async e => {
    if (useFormSubmitFallback) return;

    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.textContent = 'Sending...';
      btn.disabled = true;
      btn.classList.add('btn--loading');
    }

    const payload = {
      name: form.querySelector('[name="name"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      subject: form.querySelector('[name="subject"]')?.value,
      message: form.querySelector('[name="message"]')?.value
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 503) {
        useFormSubmitFallback = true;
        form.requestSubmit();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send message');
      }

      form.reset();
      if (successEl) {
        successEl.hidden = false;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      alert(err.message || 'Failed to send. Please email us directly.');
    } finally {
      if (btn && !useFormSubmitFallback) {
        btn.textContent = 'Send Message';
        btn.disabled = false;
        btn.classList.remove('btn--loading');
      }
    }
  });
}

// Scroll-triggered animations with stagger
function initScrollAnimations() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = document.querySelectorAll('.animate-on-scroll');

  if (reducedMotion || window.matchMedia('(max-width: 768px)').matches) {
    elements.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const getScrollDelay = (el, isMobile) => {
    const raw = parseInt(el.dataset.delay || '0', 10);
    const index = raw > 20 ? Math.floor(raw / 100) : raw;
    return Math.min(Math.max(index, 0), 5) * (isMobile ? 60 : 100);
  };

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = getScrollDelay(entry.target, isMobile);
          setTimeout(() => {
            entry.target.classList.add('is-visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: isMobile ? 0.06 : 0.12,
      rootMargin: isMobile ? '0px 0px -24px 0px' : '0px 0px -50px 0px'
    }
  );

  elements.forEach(el => {
    observer.observe(el);

    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      const delay = getScrollDelay(el, isMobile);
      setTimeout(() => {
        el.classList.add('is-visible');
      }, delay);
    }
  });
}

// Size each hero slide to show the complete photo (no CSS crop) — desktop only
function initHeroPhotoFit() {
  const photos = document.querySelectorAll('.hero__slide__photo');
  if (!photos.length) return;

  const resetMobileStyles = img => {
    img.style.width = '';
    img.style.height = '';
    img.style.left = '';
    img.style.top = '';
    img.style.right = '';
    img.style.bottom = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    img.style.objectFit = '';
  };

  const fit = () => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    photos.forEach(img => {
      if (isMobile) {
        resetMobileStyles(img);
        return;
      }

      const box = img.closest('.hero__slide__media');
      if (!box || !img.naturalWidth || !img.naturalHeight) return;

      const bw = box.clientWidth;
      const bh = box.clientHeight;
      if (!bw || !bh) return;

      const scale = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;

      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.left = `${(bw - w) / 2}px`;
      img.style.top = `${(bh - h) / 2}px`;
      img.style.right = 'auto';
      img.style.bottom = 'auto';
      img.style.maxWidth = 'none';
      img.style.maxHeight = 'none';
      img.style.objectFit = 'fill';
    });
  };

  photos.forEach(img => {
    if (img.complete) fit();
    else img.addEventListener('load', fit, { once: true });
  });

  window.addEventListener('resize', fit, { passive: true });
}

// Animated logo orbits on sub-page heroes (left & right)
const PAGE_HERO_BACKGROUNDS = {
  'about.html': 'assets/hero/page/taunet-nelel.png',
  'programs.html': 'assets/hero/page/cultural-procession.png',
  'events.html': 'assets/hero/page/kokwet-sports-day.png',
  'leadership.html': 'assets/hero/page/stage-address.png',
  'gallery.html': 'assets/hero/page/women-traditional.png',
  'contact.html': 'assets/hero/page/community-gathering.png',
  'join.html': 'assets/hero/page/gala-celebration.png',
  'book.html': 'assets/hero/page/kokwet-sports-day.png',
  'members.html': 'assets/hero/page/community-gathering.png',
  'portal.html': 'assets/hero/page/stage-address.png',
  'privacy.html': 'assets/hero/page/women-traditional.png',
  'terms.html': 'assets/hero/page/women-traditional.png',
  'ailcd-apply.html': 'assets/hero/page/taunet-nelel.png'
};

function mountPageHeroBackground(section, src) {
  if (!section || !src) return;

  let wrap = section.querySelector('.page-hero__photo-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'page-hero__photo-wrap';
    wrap.setAttribute('aria-hidden', 'true');

    const img = document.createElement('img');
    img.className = 'page-hero__photo';
    img.alt = '';
    img.decoding = 'async';
    wrap.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'page-hero__overlay';
    overlay.setAttribute('aria-hidden', 'true');

    section.insertBefore(wrap, section.firstChild);
    section.insertBefore(overlay, wrap.nextSibling);
  }

  const img = wrap.querySelector('.page-hero__photo');
  if (img && img.getAttribute('src') !== src) {
    img.src = src;
  }
}

function initPageHeroBackground() {
  if (!document.body.classList.contains('page-sub')) return;

  const section = document.querySelector('.page-hero');
  if (!section) return;

  const page = window.location.pathname.split('/').pop() || '';
  const src = section.dataset.heroBg || PAGE_HERO_BACKGROUNDS[page];
  if (src) mountPageHeroBackground(section, src);
}

window.mountPageHeroBackground = mountPageHeroBackground;

function initPageHeroLogos() {
  if (window.matchMedia('(max-width: 768px)').matches) return;
  if (!document.body.classList.contains('page-sub')) return;

  const hero = document.querySelector('.page-hero');
  const container = hero?.querySelector('.container');
  if (!hero || !container) return;

  function createSideLogo(side) {
    const wrap = document.createElement('div');
    wrap.className = `page-hero__logo page-hero__logo--${side}`;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <div class="hero__logo-ring hero__logo-ring--page">
        <div class="hero__orbit hero__orbit--outer"></div>
        <div class="hero__orbit hero__orbit--inner"></div>
        <div class="logo-spinner">
          <img src="assets/logo-round.png" alt="" class="logo-spinner__img logo-circle" decoding="async">
        </div>
      </div>
    `;
    return wrap;
  }

  hero.insertBefore(createSideLogo('left'), container);
  container.insertAdjacentElement('afterend', createSideLogo('right'));
}

// Footer and community links to admin portal
function initAdminPortalLinks() {
  document.querySelectorAll('.footer__nav .footer__links').forEach(col => {
    const h4 = col.querySelector('h4');
    if (!h4 || h4.textContent.trim() !== 'Community') return;
    const ul = col.querySelector('ul');
    if (!ul || ul.querySelector('[data-portal-link]')) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = 'portal.html';
    a.textContent = 'Admin Portal';
    a.setAttribute('data-portal-link', '');
    li.appendChild(a);
    ul.appendChild(li);
  });

  document.querySelectorAll('.footer__legal').forEach(legal => {
    if (legal.querySelector('[data-admin-link]')) return;
    const a = document.createElement('a');
    a.href = 'portal.html';
    a.textContent = 'Admin Portal';
    a.setAttribute('data-admin-link', '');
    a.setAttribute('aria-label', 'Open leadership admin portal');
    legal.appendChild(a);
  });
}

function initMemberPortalLinks() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const onMembersPage = currentPage === 'members.html' || currentPage === 'members';

  const menu = document.getElementById('navMenu');
  if (menu && !menu.querySelector('[data-member-link]') && !onMembersPage) {
    const joinItem = menu.querySelector('a.nav__cta[href*="join"]')?.closest('li');
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = 'members.html';
    a.className = 'btn btn--outline nav__cta nav__cta--member';
    a.textContent = 'Member Sign In';
    a.setAttribute('data-member-link', '');
    li.appendChild(a);
    if (joinItem) joinItem.before(li);
    else menu.appendChild(li);
  }

  document.querySelectorAll('.footer__nav .footer__links').forEach(col => {
    const h4 = col.querySelector('h4');
    if (!h4 || h4.textContent.trim() !== 'Community') return;
    const ul = col.querySelector('ul');
    if (!ul || ul.querySelector('[data-member-footer-link]')) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = 'members.html';
    a.textContent = 'Member Sign In';
    a.setAttribute('data-member-footer-link', '');
    li.appendChild(a);
    const joinLink = ul.querySelector('a[href*="join"]');
    if (joinLink?.parentElement) joinLink.parentElement.before(li);
    else ul.appendChild(li);
  });

  document.querySelectorAll('.footer__legal').forEach(legal => {
    if (legal.querySelector('[data-member-legal-link]')) return;
    const a = document.createElement('a');
    a.href = 'members.html';
    a.textContent = 'Member Sign In';
    a.setAttribute('data-member-legal-link', '');
    legal.insertBefore(a, legal.firstChild);
  });
}

// Subtle parallax on hero logo only (slideshow parallax cropped photos)
function initHeroParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const hero = document.querySelector('.hero');
  const visual = document.querySelector('.hero__visual');
  if (!hero) return;

  window.addEventListener('scroll', () => {
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const progress = -rect.top / rect.height;

    if (visual) {
      visual.style.transform = `translateY(${progress * -15}px)`;
    }
  }, { passive: true });
}

function lockMobileViewport() {
  const isMobile = window.matchMedia('(max-width: 1024px)').matches;
  if (!isMobile) return;

  document.documentElement.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';
  document.body.style.maxWidth = '100%';
  document.documentElement.style.maxWidth = '100%';

  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  const shell = document.querySelector('.site-shell');
  if (shell) shell.scrollLeft = 0;

  document.querySelectorAll('.hero__slide__photo').forEach(img => {
    img.removeAttribute('style');
  });

  document.querySelectorAll('.page-hero__logo').forEach(el => el.remove());

  document.querySelectorAll('.programs-preview .program-card').forEach(card => {
    card.classList.add('is-visible');
    card.style.opacity = '1';
    card.style.transform = 'none';
    card.style.visibility = 'visible';
  });
}

// 3D tilt on program & leader cards (desktop only)
function initTiltCards() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const cards = document.querySelectorAll('.programs .program-card, .leader-card, .event-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-6px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

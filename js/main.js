// Gotabgaa Australia — Main JavaScript

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
  initPageHeroLogos();
  initAdminPortalLinks();
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

// Contact form — submits via FormSubmit.co; shows success after redirect
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

  form.addEventListener('submit', () => {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.textContent = 'Sending...';
    btn.disabled = true;
    btn.classList.add('btn--loading');
  });
}

// Scroll-triggered animations with stagger
function initScrollAnimations() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = document.querySelectorAll('.animate-on-scroll');

  if (reducedMotion) {
    elements.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || '0', 10) * (isMobile ? 60 : 100);
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

  elements.forEach(el => observer.observe(el));
}

// Size each hero slide to show the complete photo (no CSS crop)
function initHeroPhotoFit() {
  const photos = document.querySelectorAll('.hero__slide__photo');
  if (!photos.length) return;

  const fit = () => {
    photos.forEach(img => {
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
function initPageHeroLogos() {
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

// 3D tilt on program & leader cards (desktop only)
function initTiltCards() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const cards = document.querySelectorAll('.program-card, .leader-card, .event-card');

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

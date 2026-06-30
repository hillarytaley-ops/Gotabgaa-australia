/**
 * Gotabgaa Australia — Admin Dashboard
 */
(function () {
  const TOKEN_KEY = 'gaa_admin_token';
  const PREVIEW_KEY = 'gaa_admin_preview';
  let content = null;
  let activeSection = 'dashboard';
  let memberPortalActiveTab = 'welcome';
  let isPreviewMode = false;

  const els = {
    loginScreen: document.getElementById('loginScreen'),
    app: document.getElementById('app'),
    loginForm: document.getElementById('loginForm'),
    loginError: document.getElementById('loginError'),
    loginStatus: document.getElementById('loginStatus'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    password: document.getElementById('password'),
    logoutBtn: document.getElementById('logoutBtn'),
    publishBtn: document.getElementById('publishBtn'),
    exportBtn: document.getElementById('exportBtn'),
    previewBtn: document.getElementById('previewBtn'),
    statusBar: document.getElementById('statusBar'),
    sectionTitle: document.getElementById('sectionTitle'),
    lastUpdated: document.getElementById('lastUpdated'),
    statsGrid: document.getElementById('statsGrid'),
    sidebarNav: document.getElementById('sidebarNav')
  };

  const SECTION_TITLES = {
    dashboard: 'Dashboard',
    site: 'Site & PayID',
    home: 'Home Page',
    about: 'About Page',
    programs: 'Programs',
    welfare: 'Welfare',
    sports: 'Sports',
    business: 'Business',
    events: 'Events',
    leadership: 'Leadership',
    gallery: 'Gallery',
    contact: 'Contact Info',
    membership: 'Membership',
    memberPortal: 'Member Portal',
    ailcd: 'Leadership EOI',
    inbox: 'Contact Inbox',
    pages: 'Page Heroes'
  };

  const SECTION_ICONS = {
    dashboard: 'dashboard',
    site: 'site',
    home: 'home',
    about: 'about',
    programs: 'programs',
    welfare: 'welfare',
    sports: 'sports',
    business: 'business',
    events: 'events',
    leadership: 'leadership',
    gallery: 'gallery',
    contact: 'contact',
    membership: 'membership',
    memberPortal: 'portal',
    ailcd: 'eoi',
    inbox: 'inbox',
    pages: 'pages'
  };

  function setPreviewMode(on) {
    isPreviewMode = on;
    if (on) sessionStorage.setItem(PREVIEW_KEY, '1');
    else sessionStorage.removeItem(PREVIEW_KEY);

    if (els.publishBtn) {
      els.publishBtn.disabled = on;
      els.publishBtn.textContent = on ? 'Publish (sign in required)' : 'Publish Changes';
    }
    if (on) showStatus('Preview mode — changes are only in this browser until you sign in and click Publish Changes.', 'error');
  }

  async function enterPreview() {
    clearLoginMessages();
    try {
      await loadContent();
      setPreviewMode(true);
      showApp();
    } catch (err) {
      showLoginError(err.message);
    }
  }

  function showStatus(msg, type = '') {
    els.statusBar.hidden = false;
    els.statusBar.textContent = msg;
    els.statusBar.className = 'status-bar' + (type ? ` is-${type}` : '');
    if (type === 'success') setTimeout(() => { els.statusBar.hidden = true; }, 5000);
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch {
      try {
        return sessionStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    }
  }

  function setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      throw new Error('This browser blocked site storage. Allow cookies/data for this site and try again.');
    }
  }

  async function verifyAdminSession() {
    const token = getToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/contact-submissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        setToken(null);
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  async function authFetch(url, options = {}) {
    const token = getToken();
    if (!token) {
      showLogin('Please sign in to continue.');
      throw new Error('Not authenticated');
    }

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      setToken(null);
      showLogin('Your admin session expired or is invalid. Please sign in again.');
      throw new Error('Unauthorized');
    }

    return res;
  }

  function isAuthError(err) {
    const msg = err?.message || '';
    return msg === 'Unauthorized' || msg === 'Not authenticated';
  }

  function isContentEmpty(data) {
    if (!data || typeof data !== 'object') return true;
    return !data.site && !data.pages;
  }

  async function loadContent() {
    let res;
    try {
      res = await fetch('/api/content', { cache: 'no-cache' });
    } catch {
      res = { ok: false };
    }

    if (!res.ok) {
      const fallback = await fetch('/data/content.json', { cache: 'no-cache' });
      if (!fallback.ok) throw new Error('Could not load content');
      content = await fallback.json();
    } else {
      const text = await res.text();
      try {
        content = JSON.parse(text);
      } catch {
        throw new Error('Content API returned invalid JSON');
      }
    }

    if (isContentEmpty(content)) {
      const fallback = await fetch('/data/content.json', { cache: 'no-cache' });
      if (fallback.ok) {
        content = await fallback.json();
      }
    }

    if (isContentEmpty(content)) {
      throw new Error('No site content found. Sign in and use “Load content into Supabase”.');
    }
    updateMeta();
    renderSection(activeSection);
    renderDashboardStats();
  }

  function setLoginStatus(msg, isError = false) {
    if (!els.loginStatus) return;
    if (!msg) {
      els.loginStatus.hidden = true;
      els.loginStatus.textContent = '';
      return;
    }
    els.loginStatus.hidden = false;
    els.loginStatus.textContent = msg;
    els.loginStatus.style.color = isError ? '' : '';
  }

  function showLoginError(msg) {
    if (!els.loginError) return;
    els.loginError.textContent = msg;
    els.loginError.hidden = false;
    els.loginError.removeAttribute('hidden');
    els.loginError.scrollIntoView({ block: 'nearest' });
  }

  function clearLoginMessages() {
    if (els.loginError) {
      els.loginError.hidden = true;
      els.loginError.textContent = '';
    }
    setLoginStatus('');
  }

  function updateMeta() {
    if (content?.meta?.updatedAt) {
      const d = new Date(content.meta.updatedAt);
      els.lastUpdated.textContent = `Last updated: ${d.toLocaleString()}`;
    }
  }

  function field(label, id, value, type = 'text', opts = {}) {
    const val = value ?? '';
    if (type === 'textarea') {
      return `<div class="form-field ${opts.full ? 'form-field--full' : ''}"><label for="${id}">${label}</label><textarea id="${id}" name="${id}">${escapeHtml(val)}</textarea></div>`;
    }
    if (type === 'select') {
      const options = opts.options.map(o =>
        `<option value="${escapeHtml(o.value)}" ${o.value === val ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
      ).join('');
      return `<div class="form-field"><label for="${id}">${label}</label><select id="${id}" name="${id}">${options}</select></div>`;
    }
    if (type === 'checkbox') {
      return `<div class="checkbox-row"><input type="checkbox" id="${id}" name="${id}" ${val ? 'checked' : ''}><label for="${id}">${label}</label></div>`;
    }
    return `<div class="form-field ${opts.full ? 'form-field--full' : ''}"><label for="${id}">${label}</label><input type="${type}" id="${id}" name="${id}" value="${escapeHtml(val)}"></div>`;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDashboardStats() {
    const upcoming = content.events?.filter(e => e.status === 'upcoming').length || 0;
    const past = content.events?.filter(e => e.status === 'past').length || 0;
    const programs = content.programs?.length || 0;
    const leaders = content.leadership?.length || 0;
    const siteName = content.site?.siteName || 'Gotabgaa Australia';

    const welcome = document.getElementById('dashboardWelcome');
    if (welcome) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      welcome.textContent = `${greeting}`;
    }

    const heroSub = document.querySelector('.dashboard-hero__sub');
    if (heroSub) {
      heroSub.textContent = `Managing ${siteName} — content, members, events, and PayID settings.`;
    }

    els.statsGrid.innerHTML = `
      <div class="stat-card stat-card--upcoming">
        <span class="stat-card__icon" aria-hidden="true"></span>
        <strong>${upcoming}</strong>
        <span>Upcoming events</span>
      </div>
      <div class="stat-card stat-card--past">
        <span class="stat-card__icon" aria-hidden="true"></span>
        <strong>${past}</strong>
        <span>Past events</span>
      </div>
      <div class="stat-card stat-card--programs">
        <span class="stat-card__icon" aria-hidden="true"></span>
        <strong>${programs}</strong>
        <span>Programs</span>
      </div>
      <div class="stat-card stat-card--leaders">
        <span class="stat-card__icon" aria-hidden="true"></span>
        <strong>${leaders}</strong>
        <span>Leaders</span>
      </div>
    `;
  }

  function defaultPayment() {
    return {
      enabled: true,
      legalName: 'Gotabgaa Australia',
      abn: '',
      payId: '',
      bsb: '',
      accountNumber: '',
      accountName: 'Gotabgaa Australia',
      gstNote: 'No GST has been charged unless stated on your receipt. Confirm GST treatment with your accountant.',
      instructions: 'Pay via PayID or bank transfer. You must include the payment reference exactly as shown.',
      receiptEmail: 'info@gotabgaaaustralia.org',
      memReferencePrefix: 'GAA-MEM',
      evtReferencePrefix: 'GAA-EVT'
    };
  }

  function renderSitePanel() {
    if (!content.payment) content.payment = defaultPayment();
    const s = content.site;
    const p = content.payment;
    return `
      <div class="card"><h3>General</h3><div class="form-grid">
        ${field('Site name', 'siteName', s.siteName)}
        ${field('Site URL', 'siteUrl', s.siteUrl)}
        ${field('Tagline', 'tagline', s.tagline)}
        ${field('Contact email', 'contactEmail', s.contactEmail, 'email')}
        ${field('Copyright year', 'copyrightYear', s.copyrightYear, 'number')}
        ${field('Affiliation text', 'affiliationText', s.affiliationText, 'textarea', { full: true })}
        ${field('Affiliation URL', 'affiliationUrl', s.affiliationUrl)}
      </div></div>
      <div class="card"><h3>Social links</h3><div class="form-grid">
        ${field('Facebook', 'socialFacebook', s.social?.facebook)}
        ${field('TikTok', 'socialTiktok', s.social?.tiktok)}
        ${field('Instagram', 'socialInstagram', s.social?.instagram)}
        ${field('WhatsApp / mailto', 'socialWhatsapp', s.social?.whatsapp)}
        ${field('YouTube', 'socialYoutube', s.social?.youtube)}
      </div></div>
      <div class="card"><h3>PayID &amp; bank details</h3>
        <p class="form-hint">Shown on join/book forms after registration and on the member dashboard when payment is pending. Leave PayID blank until your association account is ready.</p>
        <div class="form-grid">
        ${field('Payments enabled', 'payEnabled', p.enabled !== false, 'checkbox')}
        ${field('Legal name', 'payLegalName', p.legalName || 'Gotabgaa Australia')}
        ${field('ABN', 'payAbn', p.abn || '')}
        ${field('PayID (email or phone)', 'payPayId', p.payId || '')}
        ${field('BSB', 'payBsb', p.bsb || '')}
        ${field('Account number', 'payAccountNumber', p.accountNumber || '')}
        ${field('Account name', 'payAccountName', p.accountName || p.legalName || 'Gotabgaa Australia')}
        ${field('Receipt / enquiries email', 'payReceiptEmail', p.receiptEmail || 'info@gotabgaaaustralia.org', 'email')}
        ${field('Payment instructions (public)', 'payInstructions', p.instructions || '', 'textarea', { full: true })}
        ${field('GST note (public)', 'payGstNote', p.gstNote || '', 'textarea', { full: true })}
      </div></div>
    `;
  }

  function renderHomePanel() {
    const h = content.pages.home;
    return `
      <div class="card"><h3>Hero</h3><div class="form-grid">
        ${field('Badge', 'homeBadge', h.hero.badge)}
        ${field('Title line 1', 'homeTitle', h.hero.title)}
        ${field('Title emphasis', 'homeTitleEm', h.hero.titleEm)}
        ${field('Subtitle', 'homeSubtitle', h.hero.subtitle)}
        ${field('Description', 'homeDesc', h.hero.description, 'textarea', { full: true })}
        ${field('Primary CTA', 'homeCtaPrimary', h.hero.ctaPrimary)}
        ${field('Primary URL', 'homeCtaPrimaryUrl', h.hero.ctaPrimaryUrl)}
        ${field('Secondary CTA', 'homeCtaSecondary', h.hero.ctaSecondary)}
        ${field('Secondary URL', 'homeCtaSecondaryUrl', h.hero.ctaSecondaryUrl)}
        ${field('Slideshow images (one path per line)', 'homeSlides', (h.hero.slides || []).join('\n'), 'textarea', { full: true })}
      </div></div>
      <div class="card"><h3>Impact stats</h3>
        ${h.impact.map((stat, i) => `
          <div class="list-item"><div class="form-grid">
            ${field(`Stat ${i + 1} number`, `impactNum${i}`, stat.number)}
            ${field(`Stat ${i + 1} label`, `impactLabel${i}`, stat.label)}
          </div></div>
        `).join('')}
      </div>
      <div class="card"><h3>About preview & CTA</h3><div class="form-grid">
        ${field('Section tag', 'homeAboutTag', h.aboutPreview.tag)}
        ${field('Section title', 'homeAboutTitle', h.aboutPreview.title)}
        ${field('Paragraph 1', 'homeAboutP1', h.aboutPreview.paragraphs[0], 'textarea')}
        ${field('Paragraph 2', 'homeAboutP2', h.aboutPreview.paragraphs[1], 'textarea')}
        ${field('CTA button', 'homeAboutCta', h.aboutPreview.cta)}
        ${field('Photo caption', 'homeAboutCaption', h.aboutPreview.caption)}
        ${field('Home CTA title', 'homeCtaTitle', h.cta.title)}
        ${field('Home CTA text', 'homeCtaDesc', h.cta.description, 'textarea')}
        ${field('Home CTA button', 'homeCtaBtn', h.cta.button)}
        ${field('Home CTA button URL', 'homeCtaBtnUrl', h.cta.buttonUrl || 'join.html')}
      </div></div>
    `;
  }

  function renderAboutPanel() {
    const a = content.pages.about;
    return `
      <div class="card"><h3>About content</h3><div class="form-grid">
        ${field('Lead paragraph', 'aboutLead', a.lead, 'textarea', { full: true })}
        ${field('Mission', 'aboutMission', a.mission, 'textarea')}
        ${field('Vision', 'aboutVision', a.vision, 'textarea')}
        ${field('Quote', 'aboutQuote', a.quote, 'textarea', { full: true })}
        ${field('Image path', 'aboutImage', a.image)}
        ${field('Cities (comma-separated)', 'aboutCities', a.cities.join(', '))}
        ${field('CTA title', 'aboutCtaTitle', a.cta.title)}
        ${field('CTA description', 'aboutCtaDesc', a.cta.description, 'textarea')}
        ${field('CTA button', 'aboutCtaBtn', a.cta.button)}
      </div></div>
    `;
  }

  function renderProgramsPanel() {
    return `
      <div class="card">
        <div class="list-item__header"><h3>Programs</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addProgram">+ Add Program</button>
        </div>
        <div id="programsList">${content.programs.map((p, i) => programItemHtml(p, i)).join('')}</div>
      </div>
    `;
  }

  function programItemHtml(p, i) {
    return `
      <div class="list-item" data-program-index="${i}">
        <div class="list-item__header">
          <h4>${escapeHtml(p.title)}</h4>
          <button type="button" class="btn btn--danger btn--sm" data-remove-program="${i}">Remove</button>
        </div>
        <div class="form-grid">
          ${field('Title', `progTitle${i}`, p.title)}
          ${field('Link', `progLink${i}`, p.link)}
          ${field('Icon', `progIcon${i}`, p.icon, 'select', { options: [
            { value: 'education', label: 'Education' },
            { value: 'heart', label: 'Heart / Support' },
            { value: 'building', label: 'Building' },
            { value: 'music', label: 'Music / Cultural' }
          ]})}
          ${field('Description', `progDesc${i}`, p.description, 'textarea', { full: true })}
          ${field('Show on home page', `progHome${i}`, p.showOnHome, 'checkbox')}
        </div>
      </div>
    `;
  }

  function renderEventsPanel() {
    const upcoming = content.events.filter(e => e.status === 'upcoming');
    const past = content.events.filter(e => e.status === 'past');
    const featuredOpts = content.events.map(e => ({ value: e.id, label: e.title }));

    const renderList = (list, label) => {
      if (!list.length) return `<p class="form-hint">No ${label.toLowerCase()} events yet.</p>`;
      return list.map(e => {
        const i = content.events.indexOf(e);
        return eventItemHtml(e, i);
      }).join('');
    };

    return `
      <div class="card card--notice">
        <p><strong>Public site:</strong> Events appear in <strong>Upcoming</strong> and <strong>Past</strong> groups on <a href="../events.html" target="_blank" rel="noopener">events.html</a>. Upcoming events link to the <a href="../book.html" target="_blank" rel="noopener">booking portal</a> with PayID / bank transfer when a ticket fee is set.</p>
      </div>
      <div class="card" id="eventBookingsCard">
        <h3>Recent bookings</h3>
        <p class="form-hint">Loading booking requests…</p>
      </div>
      <div class="card"><h3>Featured event</h3>
        ${field('Featured event', 'featuredEventId', content.featuredEventId, 'select', { options: featuredOpts })}
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Upcoming events (${upcoming.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addEvent">+ Add Upcoming Event</button>
        </div>
        <div id="eventsListUpcoming">${renderList(upcoming, 'Upcoming')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Past events (${past.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addPastEvent">+ Add Past Event</button>
        </div>
        <div id="eventsListPast">${renderList(past, 'Past')}</div>
      </div>
    `;
  }

  function eventItemHtml(e, i) {
    const bookingFields = e.status === 'upcoming' ? `
          ${field('Booking enabled', `evtBooking${i}`, e.bookingEnabled !== false, 'checkbox')}
          ${field('Book button label', `evtBookingLabel${i}`, e.bookingLabel || 'Book Now')}
          ${field('Ticket fee (AUD, 0 = free)', `evtTicketAmount${i}`, e.ticketAmount ?? 0, 'number')}
          ${field('Ticket / price note', `evtPriceNote${i}`, e.ticketPriceNote || '', 'textarea')}
          ${field('Booking URL (optional)', `evtBookingUrl${i}`, e.bookingUrl || `book.html?id=${e.id}`)}
        ` : `
          ${field('Past action URL', `evtRegUrl${i}`, e.registerUrl)}
          ${field('Past action label', `evtRegLabel${i}`, e.registerLabel)}
        `;

    return `
      <div class="list-item" data-event-index="${i}">
        <div class="list-item__header">
          <h4>${escapeHtml(e.title)} <span class="form-hint">(${e.status})</span></h4>
          <button type="button" class="btn btn--danger btn--sm" data-remove-event="${i}">Remove</button>
        </div>
        <div class="form-grid">
          ${field('Title', `evtTitle${i}`, e.title)}
          ${field('Date pill', `evtPill${i}`, e.datePill)}
          ${field('Full date', `evtDate${i}`, e.date)}
          ${field('Time', `evtTime${i}`, e.time)}
          ${field('Location', `evtLocation${i}`, e.location)}
          ${field('Meta line', `evtMeta${i}`, e.meta)}
          ${field('Image path', `evtImage${i}`, e.image)}
          ${field('Status', `evtStatus${i}`, e.status, 'select', { options: [
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' }
          ]})}
          ${field('Category', `evtCategory${i}`, e.category, 'select', { options: [
            { value: 'cultural', label: 'Cultural' },
            { value: 'sports', label: 'Sports' },
            { value: 'community', label: 'Community' },
            { value: 'agm', label: 'AGM' }
          ]})}
          ${field('Summary', `evtSummary${i}`, e.summary, 'textarea')}
          ${field('Full description', `evtDesc${i}`, e.description, 'textarea', { full: true })}
          ${bookingFields}
        </div>
      </div>
    `;
  }

  function renderLeadershipPanel() {
    return `
      <div class="card">
        <div class="list-item__header"><h3>Leadership team</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addLeader">+ Add Leader</button>
        </div>
        <div id="leadersList">${content.leadership.map((l, i) => leaderItemHtml(l, i)).join('')}</div>
      </div>
    `;
  }

  function leaderItemHtml(l, i) {
    return `
      <div class="list-item" data-leader-index="${i}">
        <div class="list-item__header">
          <h4>${escapeHtml(l.name)}</h4>
          <button type="button" class="btn btn--danger btn--sm" data-remove-leader="${i}">Remove</button>
        </div>
        <div class="form-grid">
          ${field('Name / title', `ldrName${i}`, l.name)}
          ${field('Role', `ldrRole${i}`, l.role)}
          ${field('Initials', `ldrInitials${i}`, l.initials)}
          ${field('Photo URL (optional)', `ldrPhoto${i}`, l.photo)}
        </div>
      </div>
    `;
  }

  let openGalleryAlbums = new Set();

  function renderGalleryPanel() {
    const upcoming = content.events.filter(e => e.status === 'upcoming');
    const past = content.events.filter(e => e.status === 'past');
    const eventIds = new Set(content.events.map(e => e.id));
    const uncategorized = content.gallery
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => !g.eventId || !eventIds.has(g.eventId));

    const renderAlbumSection = events => {
      if (!events.length) return '<p class="form-hint">No events in this group yet — add them in Events.</p>';
      return events.map(event => renderGalleryEventAlbum(event)).join('');
    };

    const uncategorizedHtml = uncategorized.length ? `
      <details class="gallery-section">
        <summary class="gallery-section__summary">
          <span>Uncategorized photos</span>
          <span class="gallery-section__count">${uncategorized.length}</span>
        </summary>
        <div class="gallery-section__body">
          ${uncategorized.map(({ g, i }) => galleryItemHtml(g, i, true)).join('')}
        </div>
      </details>
    ` : '';

    return `
      <div class="card card--notice">
        <p><strong>Public site:</strong> Photos are grouped by event on <a href="../gallery.html" target="_blank" rel="noopener">gallery.html</a>. Expand an event album to upload or edit photos, then publish.</p>
        <p class="form-hint">Bulk upload: Supabase Storage bucket <strong>gallery</strong> (public), or GitHub token.</p>
      </div>
      <div class="card">
        <details class="gallery-section" open>
          <summary class="gallery-section__summary">
            <span>Upcoming event albums</span>
            <span class="gallery-section__count">${upcoming.length}</span>
          </summary>
          <div class="gallery-section__body">${renderAlbumSection(upcoming)}</div>
        </details>
        <details class="gallery-section">
          <summary class="gallery-section__summary">
            <span>Past event albums</span>
            <span class="gallery-section__count">${past.length}</span>
          </summary>
          <div class="gallery-section__body">${renderAlbumSection(past)}</div>
        </details>
        ${uncategorizedHtml}
      </div>
    `;
  }

  function renderGalleryEventAlbum(event) {
    const photos = content.gallery
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => g.eventId === event.id);
    const isOpen = openGalleryAlbums.has(event.id);

    return `
      <details class="gallery-admin-album" data-event-id="${escapeHtml(event.id)}"${isOpen ? ' open' : ''}>
        <summary class="gallery-admin-album__summary">
          <span class="gallery-admin-album__title">${escapeHtml(event.title)}</span>
          <span class="gallery-admin-album__meta">${photos.length} photo${photos.length === 1 ? '' : 's'}</span>
        </summary>
        <div class="gallery-admin-album__body">
          <div class="gallery-admin-album__actions">
            <label class="btn btn--outline btn--sm">
              Bulk upload
              <input type="file" class="gallery-bulk-input" data-event-id="${escapeHtml(event.id)}" accept="image/*" multiple hidden>
            </label>
            <button type="button" class="btn btn--outline btn--sm" data-add-gallery-photo="${escapeHtml(event.id)}">+ Add photo</button>
          </div>
          <p class="gallery-admin-upload-status form-hint" id="galleryUploadStatus-${escapeHtml(event.id)}" hidden></p>
          ${photos.length
            ? `<div class="gallery-photo-list">${photos.map(({ g, i }) => galleryItemHtml(g, i, true)).join('')}</div>`
            : '<p class="form-hint">No photos yet — use bulk upload above.</p>'}
        </div>
      </details>
    `;
  }

  function galleryItemHtml(g, i, compact = false) {
    const imgSrc = g.image?.startsWith('http') ? g.image : `../${String(g.image || '').replace(/^\//, '')}`;

    if (compact) {
      return `
        <div class="gallery-photo-row" data-gallery-index="${i}">
          <img src="${escapeHtml(imgSrc)}" alt="" class="gallery-admin-thumb" loading="lazy">
          <div class="gallery-photo-row__fields">
            ${field('Caption', `galCaption${i}`, g.caption)}
            ${field('Alt text', `galAlt${i}`, g.alt)}
            <div class="gallery-photo-row__inline">
              ${field('Wide', `galWide${i}`, g.wide, 'checkbox')}
            </div>
            <details class="gallery-photo-row__advanced">
              <summary>Image path</summary>
              ${field('Path / URL', `galImage${i}`, g.image)}
              <input type="hidden" id="galEvent${i}" name="galEvent${i}" value="${escapeHtml(g.eventId || '')}">
            </details>
          </div>
          <button type="button" class="btn btn--danger btn--sm gallery-photo-row__remove" data-remove-gallery="${i}" aria-label="Remove photo">×</button>
        </div>
      `;
    }

    const eventOpts = [{ value: '', label: '— Select event —' }].concat(
      content.events.map(e => ({ value: e.id, label: `${e.title} (${e.status})` }))
    );

    return `
      <div class="list-item" data-gallery-index="${i}">
        <div class="list-item__header">
          <h4>${escapeHtml(g.caption || 'Photo')}</h4>
          <button type="button" class="btn btn--danger btn--sm" data-remove-gallery="${i}">Remove</button>
        </div>
        <div class="form-grid">
          ${field('Event', `galEvent${i}`, g.eventId || '', 'select', { options: eventOpts })}
          ${field('Image path / URL', `galImage${i}`, g.image)}
          ${field('Alt text', `galAlt${i}`, g.alt)}
          ${field('Caption', `galCaption${i}`, g.caption)}
          ${field('Wide layout', `galWide${i}`, g.wide, 'checkbox')}
        </div>
      </div>
    `;
  }

  async function uploadGalleryFile(eventId, file) {
    const token = getToken();
    if (!token) throw new Error('Sign in to upload photos.');

    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/upload-gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        eventId,
        filename: file.name,
        contentType: file.type,
        data
      })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.detail || json.error || 'Upload failed');
    return json.url;
  }

  async function handleGalleryBulkUpload(eventId, files, statusEl) {
    if (isPreviewMode) {
      showStatus('Sign in to upload gallery photos.', 'error');
      return;
    }

    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) return;

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = `Uploading 0/${list.length}…`;
    }

    let uploaded = 0;
    for (const file of list) {
      try {
        const url = await uploadGalleryFile(eventId, file);
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        content.gallery.push({
          id: `gal-${Date.now()}-${uploaded}`,
          eventId,
          image: url,
          alt: baseName,
          caption: baseName,
          wide: false
        });
        uploaded += 1;
        if (statusEl) statusEl.textContent = `Uploading ${uploaded}/${list.length}…`;
      } catch (err) {
        if (statusEl) statusEl.textContent = err.message;
        showStatus(err.message, 'error');
        break;
      }
    }

    if (uploaded > 0) {
      openGalleryAlbums.add(eventId);
      showStatus(`Uploaded ${uploaded} photo(s). Click Publish Changes to update the live site.`, 'success');
      renderSection('gallery');
    }
  }

  function renderContactPanel() {
    const c = content.contact;
    return `
      <div class="card"><h3>Contact page info</h3><div class="form-grid">
        ${field('Intro text', 'contactIntro', c.intro, 'textarea', { full: true })}
        ${field('Location', 'contactLocation', c.location)}
        ${field('Office hours', 'contactHours', c.officeHours)}
      </div></div>
    `;
  }

  function defaultMembership() {
    return {
      enabled: true,
      feeAmount: 50,
      feeCurrency: 'AUD',
      feePeriod: 'year',
      feeDisplay: '$50 AUD / year',
      feeNote: 'Annual membership fee — pay via PayID or bank transfer after registering.',
      paymentPlaceholder: 'After you submit this form, you will receive PayID and bank details with a unique payment reference.',
      intro: 'Join our growing community across Australia.',
      image: 'assets/hero/brisbane-team.png',
      benefits: ['Community events and gatherings', 'Cultural and youth programs', 'Community support network'],
      types: [
        { id: 'full', label: 'Full Member' },
        { id: 'associate', label: 'Associate Member' },
        { id: 'youth', label: 'Youth Member' },
        { id: 'family', label: 'Family Membership' }
      ]
    };
  }

  function getPaymentReference(row) {
    if (row?.payment_reference) return row.payment_reference;
    if (row?.data?.paymentReference) return row.data.paymentReference;
    const match = String(row?.notes || '').match(/\[gaa-payment-ref\]([^\s\]]+)/);
    return match ? match[1] : null;
  }

  function getMemberMeta(row) {
    const data = row?.data || {};
    let notesMeta = null;
    const notesMatch = String(row?.notes || '').match(/\[gaa-member-meta\](\{.*\})\s*$/);
    if (notesMatch) {
      try {
        notesMeta = JSON.parse(notesMatch[1]);
      } catch {
        notesMeta = null;
      }
    }
    return {
      membershipId: row?.membership_id || data._membershipId || notesMeta?.membershipId || null,
      memberStatus: row?.member_status || data._memberStatus || notesMeta?.memberStatus || 'pending'
    };
  }

  function displayMemberNotes(notes) {
    return String(notes || '')
      .replace(/\n?\[gaa-member-meta\]\{[\s\S]*?\}\s*$/, '')
      .trim();
  }

  function renderMembershipIdField(membershipId) {
    if (!membershipId) {
      return '<p><strong>Membership ID:</strong> — (not issued)</p>';
    }
    return `
      <p class="membership-reg-item__id">
        <strong>Membership ID:</strong>
        <code class="membership-id-code">${escapeHtml(membershipId)}</code>
        <button type="button" class="btn btn--outline btn--sm membership-copy-id" data-copy-id="${escapeHtml(membershipId)}">Copy ID</button>
      </p>
    `;
  }

  function renderMembershipPanel() {
    if (!content.membership) content.membership = defaultMembership();
    const m = content.membership;
    const typeLines = (m.types || []).map(t => t.label).join('\n');
    const benefitLines = (m.benefits || []).join('\n');

    return `
      <div class="card card--notice">
        <p><strong>Public portal:</strong> Members register at <a href="../join.html" target="_blank" rel="noopener">join.html</a>. Approved members sign in at <a href="../login.html" target="_blank" rel="noopener">login.html</a> with their membership ID. <a href="../members.html?preview=1" target="_blank" rel="noopener" class="btn btn--outline btn--sm" style="margin-left:8px">Preview dashboard</a></p>
      </div>
      <div class="card" id="membershipRegistrationsCard">
        <h3>Member registrations</h3>
        <p class="form-hint">Loading registration data…</p>
      </div>
      <div class="card"><h3>Registration fee</h3><div class="form-grid">
        ${field('Registration open', 'memEnabled', m.enabled !== false, 'checkbox')}
        ${field('Fee amount', 'memFeeAmount', m.feeAmount, 'number')}
        ${field('Currency', 'memFeeCurrency', m.feeCurrency || 'AUD')}
        ${field('Billing period', 'memFeePeriod', m.feePeriod || 'year')}
        ${field('Fee display (public)', 'memFeeDisplay', m.feeDisplay)}
        ${field('Fee note (public)', 'memFeeNote', m.feeNote, 'textarea', { full: true })}
        ${field('Payment placeholder text', 'memPaymentPlaceholder', m.paymentPlaceholder, 'textarea', { full: true })}
      </div></div>
      <div class="card"><h3>Portal content</h3><div class="form-grid">
        ${field('Intro paragraph', 'memIntro', m.intro, 'textarea', { full: true })}
        ${field('Sidebar image path', 'memImage', m.image || '')}
        ${field('Benefits (one per line)', 'memBenefits', benefitLines, 'textarea', { full: true })}
        ${field('Membership types (one label per line)', 'memTypes', typeLines, 'textarea', { full: true })}
      </div></div>
      <div class="card"><h3>Join page hero</h3><div class="form-grid">
        ${field('Tag', 'heroTag_join', content.pages?.join?.hero?.tag || 'Membership')}
        ${field('Title', 'heroTitle_join', content.pages?.join?.hero?.title || 'Join Gotabgaa Australia')}
        ${field('Description', 'heroDesc_join', content.pages?.join?.hero?.description || '', 'textarea', { full: true })}
      </div></div>
    `;
  }

  function positionsToLines(positions) {
    return (positions || []).map(p => {
      if (p.description) return `${p.title} | ${p.description}`;
      return p.title;
    }).join('\n');
  }

  function parsePositionLines(text) {
    return String(text || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const parts = line.split('|').map(s => s.trim());
        const title = parts[0] || line;
        const description = parts.slice(1).join(' | ');
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${i}`;
        return {
          id: `pos-${slug}-${i}`,
          title,
          description
        };
      });
  }

  function defaultGovernancePositions() {
    return [
      { id: 'pos-president', title: 'President', description: 'Board President' },
      { id: 'pos-vp', title: 'Vice President', description: 'Board Vice President' },
      { id: 'pos-secretary', title: 'Secretary General', description: 'Administration and records' },
      { id: 'pos-coordinator', title: 'National Coordinator', description: 'Programs and events' },
      { id: 'pos-treasurer', title: 'Treasurer', description: 'Finance' }
    ];
  }

  function collectGovernancePositions(idPrefix, existing) {
    const positions = [];
    for (let i = 0; document.getElementById(`mp${idPrefix}PosTitle_${i}`); i += 1) {
      const title = val(`mp${idPrefix}PosTitle_${i}`).trim();
      if (!title) continue;
      positions.push({
        id: existing?.[i]?.id || `pos-${Date.now()}-${i}`,
        title,
        description: val(`mp${idPrefix}PosDesc_${i}`).trim()
      });
    }
    return positions;
  }

  function renderGovernancePositionsList(idPrefix, positions, removeDataAttr, addButtonId, applyBulkId) {
    return `
      <div class="governance-positions-admin">
        <div class="governance-positions-admin__header">
          <h4>Positions (${positions.length})</h4>
          <button type="button" class="btn btn--outline btn--sm" id="${addButtonId}">Add position</button>
        </div>
        ${positions.length ? `
          <ul class="governance-positions-summary">
            ${positions.map((p, i) => `
              <li><span class="governance-positions-summary__num">${i + 1}.</span> <strong>${escapeHtml(p.title)}</strong>${p.description ? `<span class="governance-positions-summary__desc"> — ${escapeHtml(p.description)}</span>` : ''}</li>
            `).join('')}
          </ul>
        ` : '<p class="form-hint">No positions listed yet. Add one below or paste a bulk list.</p>'}
        <div class="governance-positions-admin__list">
          ${positions.map((p, i) => `
            <details class="mp-admin-accordion">
              <summary>
                <span class="mp-admin-accordion__title">${escapeHtml(p.title || `Position ${i + 1}`)}</span>
                <span class="mp-admin-accordion__meta">${p.description ? escapeHtml(p.description) : 'Edit'}</span>
              </summary>
              <div class="mp-admin-accordion__body">
                <div class="form-grid">
                  ${field('Position title', `mp${idPrefix}PosTitle_${i}`, p.title)}
                  ${field('Description (optional)', `mp${idPrefix}PosDesc_${i}`, p.description || '', 'textarea', { full: true })}
                </div>
                <button type="button" class="btn btn--danger btn--sm" data-remove-${removeDataAttr}="${i}">Remove position</button>
              </div>
            </details>
          `).join('')}
        </div>
        <details class="mp-admin-accordion governance-admin-positions-bulk">
          <summary><span class="mp-admin-accordion__title">Bulk paste positions</span></summary>
          <div class="mp-admin-accordion__body">
            <p class="form-hint">One position per line. Optional description after <code>|</code>, e.g. <code>Treasurer | Finance</code>. Applying replaces the list above.</p>
            ${field('Paste positions', `mp${idPrefix}PositionsBulk`, positionsToLines(positions), 'textarea', { full: true })}
            <button type="button" class="btn btn--outline btn--sm" id="${applyBulkId}">Apply bulk list</button>
          </div>
        </details>
      </div>
    `;
  }

  function defaultExploreLinks() {
    return [
      { href: 'index.html', label: 'Home', desc: 'Gotabgaa Australia homepage' },
      { href: 'about.html', label: 'About', desc: 'Our story and mission' },
      { href: 'programs.html', label: 'Programs', desc: 'Education, culture, and outreach' },
      { href: 'events.html', label: 'Events', desc: 'Public events calendar' },
      { href: 'leadership.html', label: 'Leadership', desc: 'Board and leadership team' },
      { href: 'gallery.html', label: 'Gallery', desc: 'Public photo gallery' },
      { href: 'contact.html', label: 'Contact', desc: 'Get in touch with us' },
      { href: 'book.html', label: 'Book events', desc: 'Reserve places at gatherings' }
    ];
  }

  function defaultMemberPortal() {
    return {
      welcomeTitle: 'Welcome to the Members Dashboard',
      welcomeMessage: 'Access Gotabgaa Australia news, event updates, photo albums, and governance portals.',
      feeds: [],
      eventsIntro: 'View upcoming Gotabgaa Australia events and manage your bookings.',
      photosIntro: 'Download photos from community events. Albums match events on the public gallery.',
      exploreIntro: 'Quick links to public Gotabgaa Australia pages and resources.',
      exploreLinks: defaultExploreLinks(),
      elections: {
        nominationOpen: false,
        nominationTitle: 'Nomination Portal',
        nominationPeriod: '',
        nominationMessage: 'Submit your nomination for Gotabgaa Australia leadership positions during the nomination period.',
        nominationClosedMessage: 'Nominations are currently closed. You will be notified when the next nomination period opens.',
        nominationUrl: '',
        nominationButtonLabel: 'Open nomination portal',
        nominationPositions: defaultGovernancePositions(),
        electionOpen: false,
        electionTitle: 'Election Portal',
        electionPeriod: '',
        electionMessage: 'Cast your vote for Gotabgaa Australia leadership during the election period.',
        electionClosedMessage: 'Elections are currently closed. Check back during the election period.',
        electionUrl: '',
        electionButtonLabel: 'Open election portal',
        electionPositions: defaultGovernancePositions()
      }
    };
  }

  function renderGovernanceAdminCard(title, idPrefix, dataPrefix, data) {
    const isOpen = Boolean(data[`${dataPrefix}Open`]);
    const positions = data[`${dataPrefix}Positions`] || [];
    const addId = dataPrefix === 'nomination' ? 'addNomPosition' : 'addElePosition';
    const applyBulkId = dataPrefix === 'nomination' ? 'mpNomApplyBulk' : 'mpEleApplyBulk';
    const removeAttr = dataPrefix === 'nomination' ? 'nom-pos' : 'ele-pos';
    return `
      <div class="card governance-admin-card">
        <div class="governance-admin-card__header">
          <h3>${title}</h3>
          <span class="governance-admin-card__status ${isOpen ? 'is-open' : 'is-closed'}">${isOpen ? 'Open on members site' : 'Closed on members site'}</span>
        </div>
        <p class="form-hint">Members see this card under <strong>Governance</strong> on the dashboard. Toggle open when the portal is live, add positions and the external form URL, then publish.</p>
        <div class="form-grid">
          ${field('Portal open', `mp${idPrefix}Open`, isOpen, 'checkbox')}
          ${field('Card title', `mp${idPrefix}Title`, data[`${dataPrefix}Title`] || title)}
          ${field('Period label (optional)', `mp${idPrefix}Period`, data[`${dataPrefix}Period`] || '')}
          ${field('Message when open', `mp${idPrefix}Message`, data[`${dataPrefix}Message`] || '', 'textarea', { full: true })}
          ${field('Message when closed', `mp${idPrefix}ClosedMessage`, data[`${dataPrefix}ClosedMessage`] || '', 'textarea', { full: true })}
          ${field('Portal URL', `mp${idPrefix}Url`, data[`${dataPrefix}Url`] || '', 'url')}
          ${field('Button label', `mp${idPrefix}ButtonLabel`, data[`${dataPrefix}ButtonLabel`] || '')}
        </div>
        ${renderGovernancePositionsList(idPrefix, positions, removeAttr, addId, applyBulkId)}
      </div>
    `;
  }

  function renderMemberPortalPanel() {
    if (!content.memberPortal) content.memberPortal = defaultMemberPortal();
    const mp = content.memberPortal;
    const feeds = mp.feeds || [];
    const el = mp.elections || defaultMemberPortal().elections;
    const exploreLinks = mp.exploreLinks || defaultExploreLinks();
    const feedCategories = [
      { value: 'news', label: 'News' },
      { value: 'sports', label: 'Sports' },
      { value: 'business', label: 'Business' },
      { value: 'social', label: 'Social' }
    ];

    const tabs = [
      { id: 'welcome', label: 'Welcome' },
      { id: 'feeds', label: 'News & Feeds' },
      { id: 'events', label: 'Events' },
      { id: 'photos', label: 'Photos' },
      { id: 'governance', label: 'Governance' },
      { id: 'explore', label: 'Explore' }
    ];

    return `
      <div class="card card--notice">
        <p><strong>Members dashboard:</strong> <a href="../members.html" target="_blank" rel="noopener">members.html</a> — edit one tab at a time below. Approve members under <button type="button" class="btn btn--outline btn--sm" data-goto="membership">Membership</button>. <a href="../members.html?preview=1" target="_blank" rel="noopener" class="btn btn--outline btn--sm" style="margin-left:8px">Preview dashboard</a></p>
        <p class="form-hint" style="margin-top:8px">Switch tabs to edit each section, then click <strong>Publish Changes</strong>.</p>
      </div>

      <nav class="mp-admin-tabs" id="mpAdminTabs" aria-label="Member portal sections">
        ${tabs.map(tab => `
          <button type="button" class="mp-admin-tabs__btn ${memberPortalActiveTab === tab.id ? 'is-active' : ''}" data-mp-tab="${tab.id}">${tab.label}</button>
        `).join('')}
      </nav>

      <div class="mp-admin-panel" data-mp-panel="welcome" ${memberPortalActiveTab !== 'welcome' ? 'hidden' : ''}>
        <div class="card"><h3>Welcome screen</h3>
          <p class="form-hint">Shown at the top of the members dashboard after sign-in.</p>
          <div class="form-grid">
            ${field('Welcome title', 'mpWelcomeTitle', mp.welcomeTitle)}
            ${field('Welcome message', 'mpWelcomeMessage', mp.welcomeMessage, 'textarea', { full: true })}
          </div>
        </div>
      </div>

      <div class="mp-admin-panel" data-mp-panel="feeds" ${memberPortalActiveTab !== 'feeds' ? 'hidden' : ''}>
        <div class="card"><h3>News &amp; feeds</h3>
          <p class="form-hint">Posts appear under the <strong>News &amp; Feeds</strong> tab on the members site. Expand a post to edit.</p>
          <div id="memberFeedsList">
            ${feeds.length ? feeds.map((feed, i) => `
              <details class="mp-admin-accordion">
                <summary>
                  <span class="mp-admin-accordion__title">${escapeHtml(feed.title || `Feed post ${i + 1}`)}</span>
                  <span class="mp-admin-accordion__meta">${escapeHtml((feed.category || 'news').toUpperCase())}${feed.publishedAt ? ` · ${escapeHtml(feed.publishedAt)}` : ''}</span>
                </summary>
                <div class="mp-admin-accordion__body">
                  <div class="form-grid">
                    ${field('Category', `mpFeedCat_${i}`, feed.category || 'news', 'select', { options: feedCategories })}
                    ${field('Title', `mpFeedTitle_${i}`, feed.title)}
                    ${field('Published date', `mpFeedDate_${i}`, feed.publishedAt || '', 'date')}
                    ${field('Link (optional)', `mpFeedLink_${i}`, feed.link || '')}
                    ${field('Body', `mpFeedBody_${i}`, feed.body || '', 'textarea', { full: true })}
                  </div>
                  <button type="button" class="btn btn--danger btn--sm" data-remove-feed="${i}">Remove post</button>
                </div>
              </details>
            `).join('') : '<p class="form-hint">No feed posts yet.</p>'}
          </div>
          <button type="button" class="btn btn--outline" id="addMemberFeed">Add feed post</button>
        </div>
      </div>

      <div class="mp-admin-panel" data-mp-panel="events" ${memberPortalActiveTab !== 'events' ? 'hidden' : ''}>
        <div class="card"><h3>Events &amp; bookings tab</h3>
          <p class="form-hint">Events are pulled from <button type="button" class="btn btn--outline btn--sm" data-goto="events">Events</button>. Bookings come from Supabase when members register via the booking portal.</p>
          <div class="form-grid">
            ${field('Intro text', 'mpEventsIntro', mp.eventsIntro || defaultMemberPortal().eventsIntro, 'textarea', { full: true })}
          </div>
        </div>
      </div>

      <div class="mp-admin-panel" data-mp-panel="photos" ${memberPortalActiveTab !== 'photos' ? 'hidden' : ''}>
        <div class="card"><h3>Event photos tab</h3>
          <p class="form-hint">Photo albums are built from <button type="button" class="btn btn--outline btn--sm" data-goto="gallery">Gallery</button> images grouped by event.</p>
          <div class="form-grid">
            ${field('Intro text', 'mpPhotosIntro', mp.photosIntro || defaultMemberPortal().photosIntro, 'textarea', { full: true })}
          </div>
        </div>
      </div>

      <div class="mp-admin-panel" data-mp-panel="governance" ${memberPortalActiveTab !== 'governance' ? 'hidden' : ''}>
        ${renderGovernanceAdminCard('Nomination portal', 'Nom', 'nomination', el)}
        ${renderGovernanceAdminCard('Election portal', 'Ele', 'election', el)}
      </div>

      <div class="mp-admin-panel" data-mp-panel="explore" ${memberPortalActiveTab !== 'explore' ? 'hidden' : ''}>
        <div class="card"><h3>Explore site tab</h3>
          <p class="form-hint">Quick links shown on the members dashboard. Expand a link to edit.</p>
          <div class="form-grid">
            ${field('Intro text', 'mpExploreIntro', mp.exploreIntro || defaultMemberPortal().exploreIntro, 'textarea', { full: true })}
          </div>
          <div id="memberExploreList">
            ${exploreLinks.map((link, i) => `
              <details class="mp-admin-accordion">
                <summary>
                  <span class="mp-admin-accordion__title">${escapeHtml(link.label || `Link ${i + 1}`)}</span>
                  <span class="mp-admin-accordion__meta">${escapeHtml(link.href || '')}</span>
                </summary>
                <div class="mp-admin-accordion__body">
                  <div class="form-grid">
                    ${field('Label', `mpExploreLabel_${i}`, link.label)}
                    ${field('Description', `mpExploreDesc_${i}`, link.desc)}
                    ${field('URL path', `mpExploreHref_${i}`, link.href)}
                  </div>
                  <button type="button" class="btn btn--danger btn--sm" data-remove-explore="${i}">Remove link</button>
                </div>
              </details>
            `).join('')}
          </div>
          <button type="button" class="btn btn--outline" id="addMemberExplore">Add quick link</button>
        </div>
      </div>
    `;
  }

  function switchMemberPortalTab(tab) {
    memberPortalActiveTab = tab;
    document.querySelectorAll('[data-mp-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mpTab === tab);
    });
    document.querySelectorAll('[data-mp-panel]').forEach(panel => {
      panel.hidden = panel.dataset.mpPanel !== tab;
    });
  }

  function bindMemberPortalTabs() {
    document.querySelectorAll('[data-mp-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        collectFromForm();
        switchMemberPortalTab(btn.dataset.mpTab);
      });
    });
  }

  function renderAilcdPanel() {
    return `
      <div class="card card--notice">
        <p><strong>Public form:</strong> <a href="../ailcd-apply.html" target="_blank" rel="noopener">ailcd-apply.html</a> — Gotabgaa Interim Leadership Expression of Interest. Share this link with applicants.</p>
        <p class="form-hint">Applications close at <strong>midnight on 27 June 2026 (AEST)</strong>. After that, new submissions are blocked; applicants can still check status on the public form.</p>
      </div>
      <div class="card" id="ailcdApplicationsCard">
        <h3>Leadership EOI submissions</h3>
        <p class="form-hint">Loading…</p>
      </div>
    `;
  }

  async function loadEventBookings(paymentFilter) {
    const token = getToken();
    if (!token) return [];

    let url = '/api/event-bookings';
    if (paymentFilter && paymentFilter !== 'all') {
      url += `?payment=${encodeURIComponent(paymentFilter)}`;
    }

    const res = await authFetch(url);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not load bookings');
    }

    const data = await res.json();
    return data.bookings || [];
  }

  function renderEventBookingsPanel(bookings, errorMsg, paymentFilter) {
    const filter = paymentFilter || 'all';
    if (errorMsg) {
      return `<h3>Recent bookings</h3><p class="form-hint">${escapeHtml(errorMsg)}</p>`;
    }

    const toolbar = `
      <div class="list-item__header">
        <h3>Recent bookings (${bookings.length})</h3>
        <div class="admin-toolbar">
          <label class="form-hint">Payment:
            <select id="bookingPaymentFilter" class="admin-filter-select">
              <option value="all"${filter === 'all' ? ' selected' : ''}>All</option>
              <option value="pending"${filter === 'pending' ? ' selected' : ''}>Pending</option>
              <option value="paid"${filter === 'paid' ? ' selected' : ''}>Paid</option>
            </select>
          </label>
          <a href="/api/event-bookings?format=csv" class="btn btn--outline btn--sm" id="exportBookingsCsv" target="_blank" rel="noopener">Download CSV</a>
        </div>
      </div>
    `;

    if (!bookings.length) {
      return `${toolbar}<p class="form-hint">No booking requests yet. Submissions from the booking portal appear here when Supabase is connected.</p>`;
    }

    return `
      ${toolbar}
      <div id="bookingsList">
        ${bookings.slice(0, 50).map(b => {
          const ref = getPaymentReference(b);
          const payStatus = b.payment_status || 'pending';
          return `
          <div class="list-item inbox-item ${b.read ? 'inbox-item--read' : ''}" data-id="${escapeHtml(b.id)}">
            <div class="list-item__header">
              <h4>${escapeHtml(b.event_title)}</h4>
              <span class="inbox-item__date">${new Date(b.created_at).toLocaleString()}</span>
            </div>
            <p><strong>${escapeHtml(b.name)}</strong> · ${escapeHtml(b.email)}${b.phone ? ` · ${escapeHtml(b.phone)}` : ''}</p>
            <p class="form-hint">${b.tickets} place(s) · ${escapeHtml(b.fee_display || 'Free')}${b.notes ? ` · ${escapeHtml(b.notes)}` : ''}</p>
            <p class="form-hint"><strong>Payment:</strong> ${escapeHtml(payStatus)}${ref ? ` · Ref: <code>${escapeHtml(ref)}</code>` : ''}</p>
            <div class="inbox-item__actions">
              ${payStatus !== 'paid' ? `<button type="button" class="btn btn--primary btn--sm booking-mark-paid" data-id="${escapeHtml(b.id)}">Mark as paid</button>` : ''}
              <button type="button" class="btn btn--outline btn--sm booking-mark-read" data-id="${escapeHtml(b.id)}" data-read="${b.read ? '0' : '1'}">
                ${b.read ? 'Mark unread' : 'Mark read'}
              </button>
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  }

  async function loadEventBookingsPanel(paymentFilter) {
    const card = document.getElementById('eventBookingsCard');
    if (!card) return;

    if (isPreviewMode || !getToken()) {
      card.innerHTML = renderEventBookingsPanel([], 'Sign in to view event bookings.');
      return;
    }

    card.innerHTML = '<h3>Recent bookings</h3><p class="form-hint">Loading…</p>';

    try {
      const filter = paymentFilter || card.dataset.paymentFilter || 'all';
      const bookings = await loadEventBookings(filter);
      card.dataset.paymentFilter = filter;
      card.innerHTML = renderEventBookingsPanel(bookings, null, filter);

      card.querySelector('#bookingPaymentFilter')?.addEventListener('change', e => {
        loadEventBookingsPanel(e.target.value);
      });

      card.querySelector('#exportBookingsCsv')?.addEventListener('click', e => {
        const token = getToken();
        if (token) {
          e.preventDefault();
          const f = card.dataset.paymentFilter || 'all';
          let href = `/api/event-bookings?format=csv`;
          if (f !== 'all') href += `&payment=${encodeURIComponent(f)}`;
          fetch(href, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob())
            .then(blob => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `event-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            })
            .catch(() => showStatus('Could not export CSV.', 'error'));
        }
      });

      card.querySelectorAll('.booking-mark-paid').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Mark this booking as paid? A receipt email will be sent if email is configured.')) return;
          btn.disabled = true;
          try {
            const res = await authFetch('/api/event-bookings', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: btn.dataset.id, action: 'markPaid' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not mark as paid');
            showStatus('Booking marked as paid.', 'success');
            loadEventBookingsPanel(card.dataset.paymentFilter);
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      card.querySelectorAll('.booking-mark-read').forEach(btn => {
        btn.addEventListener('click', async () => {
          const token = getToken();
          await fetch('/api/event-bookings', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ id: btn.dataset.id, read: btn.dataset.read === '1' })
          });
          loadEventBookingsPanel(card.dataset.paymentFilter);
        });
      });
    } catch (err) {
      if (isAuthError(err)) return;
      card.innerHTML = renderEventBookingsPanel([], err.message, paymentFilter);
    }
  }

  async function loadMembershipRegistrations(paymentFilter) {
    const token = getToken();
    if (!token) return [];

    let url = '/api/membership-registrations';
    if (paymentFilter && paymentFilter !== 'all') {
      url += `?payment=${encodeURIComponent(paymentFilter)}`;
    }

    const res = await authFetch(url);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not load registrations');
    }

    const data = await res.json();
    return data.registrations || [];
  }

  function downloadMembershipCsvClient(registrations) {
    const headers = [
      'Date', 'Name', 'Email', 'Phone', 'State/Territory', 'Membership Type',
      'Address', 'Date of Birth', 'Referral', 'Notes', 'Fee Display', 'Payment Status'
    ];
    const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = registrations.map(r => [
      r.created_at ? new Date(r.created_at).toISOString() : '',
      r.name, r.email, r.phone, r.state_chapter, r.membership_type,
      r.address, r.date_of_birth, r.referral_source, r.notes,
      r.fee_display, r.payment_status
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `membership-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderMembershipRegistrationsPanel(registrations, errorMsg, paymentFilter) {
    const filter = paymentFilter || 'all';
    if (errorMsg) {
      return `<h3>Member registrations</h3><p class="form-hint">${escapeHtml(errorMsg)}</p>`;
    }
    if (!registrations.length) {
      return `
        <div class="list-item__header">
          <h3>Member registrations</h3>
          <label class="form-hint">Payment:
            <select id="membershipPaymentFilter" class="admin-filter-select">
              <option value="all"${filter === 'all' ? ' selected' : ''}>All</option>
              <option value="pending"${filter === 'pending' ? ' selected' : ''}>Pending</option>
              <option value="paid"${filter === 'paid' ? ' selected' : ''}>Paid</option>
            </select>
          </label>
        </div>
        <p class="form-hint">No registrations yet. Submissions from the join portal appear here when Supabase is connected.</p>`;
    }

    const unread = registrations.filter(r => !r.read).length;

    return `
      <div class="list-item__header">
        <h3>Member registrations (${registrations.length}${unread ? ` · ${unread} new` : ''})</h3>
        <div class="admin-toolbar">
          <label class="form-hint">Payment:
            <select id="membershipPaymentFilter" class="admin-filter-select">
              <option value="all"${filter === 'all' ? ' selected' : ''}>All</option>
              <option value="pending"${filter === 'pending' ? ' selected' : ''}>Pending</option>
              <option value="paid"${filter === 'paid' ? ' selected' : ''}>Paid</option>
            </select>
          </label>
          <button type="button" class="btn btn--outline btn--sm" id="exportMembershipCsv">Download CSV</button>
        </div>
      </div>
      <p class="form-hint">Approve members to issue a membership ID. Mark as paid when PayID/EFT is received — separate from approval.</p>
      <div id="membershipRegistrationsList">
        ${registrations.map(r => {
          const meta = getMemberMeta(r);
          const payRef = getPaymentReference(r);
          const payStatus = r.payment_status || 'pending';
          return `
          <details class="list-item inbox-item membership-reg-item ${r.read ? 'inbox-item--read' : ''}" data-id="${escapeHtml(r.id)}">
            <summary class="membership-reg-item__summary">
              <span class="membership-reg-item__name">${escapeHtml(r.name)}</span>
              <span class="membership-reg-item__meta">${escapeHtml(r.membership_type || 'Member')} · ${escapeHtml(r.state_chapter || '—')}${meta.membershipId ? ` · ${escapeHtml(meta.membershipId)}` : ''} · ${escapeHtml(payStatus)}</span>
              <span class="inbox-item__date">${new Date(r.created_at).toLocaleString()}</span>
            </summary>
            <div class="membership-reg-item__body">
              <div class="form-grid membership-reg-item__grid">
                <p><strong>Email:</strong> ${escapeHtml(r.email)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(r.phone || '—')}</p>
                ${renderMembershipIdField(meta.membershipId)}
                <p><strong>Member status:</strong> <span class="membership-reg-status membership-reg-status--${escapeHtml(meta.memberStatus)}">${escapeHtml(meta.memberStatus)}</span></p>
                <p><strong>State / territory:</strong> ${escapeHtml(r.state_chapter || '—')}</p>
                <p><strong>Membership type:</strong> ${escapeHtml(r.membership_type || '—')}</p>
                <p><strong>Address:</strong> ${escapeHtml(r.address || '—')}</p>
                <p><strong>Date of birth:</strong> ${escapeHtml(r.date_of_birth || '—')}</p>
                <p><strong>Referral:</strong> ${escapeHtml(r.referral_source || '—')}</p>
                <p><strong>Fee at registration:</strong> ${escapeHtml(r.fee_display || '—')}</p>
                <p><strong>Payment status:</strong> ${escapeHtml(payStatus)}${r.payment_method ? ` (${escapeHtml(r.payment_method)})` : ''}</p>
                ${payRef ? `<p><strong>Payment reference:</strong> <code>${escapeHtml(payRef)}</code></p>` : ''}
                ${displayMemberNotes(r.notes) ? `<p class="form-field--full"><strong>Notes:</strong> ${escapeHtml(displayMemberNotes(r.notes))}</p>` : ''}
              </div>
              <div class="inbox-item__actions">
                ${!meta.membershipId ? `<button type="button" class="btn btn--primary btn--sm membership-approve" data-id="${escapeHtml(r.id)}">Approve &amp; issue ID</button>` : ''}
                ${payStatus !== 'paid' ? `<button type="button" class="btn btn--outline btn--sm membership-mark-paid" data-id="${escapeHtml(r.id)}">Mark as paid</button>` : ''}
                ${meta.membershipId ? `<button type="button" class="btn btn--outline btn--sm membership-resync" data-id="${escapeHtml(r.id)}">Sync member login</button>` : ''}
                ${meta.memberStatus === 'active' ? `<button type="button" class="btn btn--outline btn--sm membership-revoke" data-id="${escapeHtml(r.id)}">Deactivate member</button>` : ''}
                <button type="button" class="btn btn--outline btn--sm membership-mark-read" data-id="${escapeHtml(r.id)}" data-read="${r.read ? '0' : '1'}">
                  ${r.read ? 'Mark unread' : 'Mark read'}
                </button>
                <button type="button" class="btn btn--danger btn--sm membership-delete" data-id="${escapeHtml(r.id)}" data-name="${escapeHtml(r.name || 'this applicant')}">
                  Delete
                </button>
              </div>
            </div>
          </details>
        `}).join('')}
      </div>
    `;
  }

  async function loadMembershipRegistrationsPanel(paymentFilter) {
    const card = document.getElementById('membershipRegistrationsCard');
    if (!card) return;

    if (isPreviewMode || !getToken()) {
      card.innerHTML = renderMembershipRegistrationsPanel([], 'Sign in to view member registrations.');
      return;
    }

    card.innerHTML = '<h3>Member registrations</h3><p class="form-hint">Loading…</p>';

    try {
      const filter = paymentFilter || card.dataset.paymentFilter || 'all';
      const registrations = await loadMembershipRegistrations(filter);
      card.dataset.paymentFilter = filter;
      card.innerHTML = renderMembershipRegistrationsPanel(registrations, null, filter);

      card.querySelector('#membershipPaymentFilter')?.addEventListener('change', e => {
        loadMembershipRegistrationsPanel(e.target.value);
      });

      card.querySelector('#exportMembershipCsv')?.addEventListener('click', () => {
        downloadMembershipCsvClient(registrations);
        showStatus('Membership registrations exported as CSV.', 'success');
      });

      card.querySelectorAll('.membership-mark-paid').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Mark this membership payment as received? A receipt email will be sent if email is configured.')) return;
          btn.disabled = true;
          try {
            const res = await authFetch('/api/membership-registrations', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: btn.dataset.id, action: 'markPaid' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not mark as paid');
            showStatus('Payment marked as received.', 'success');
            loadMembershipRegistrationsPanel(card.dataset.paymentFilter);
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      card.querySelectorAll('.membership-mark-read').forEach(btn => {
        btn.addEventListener('click', async () => {
          const token = getToken();
          await fetch('/api/membership-registrations', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ id: btn.dataset.id, read: btn.dataset.read === '1' })
          });
          loadMembershipRegistrationsPanel(card.dataset.paymentFilter);
        });
      });

      card.querySelectorAll('.membership-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Approve this member and issue a membership ID?')) return;
          btn.disabled = true;
          try {
            const res = await authFetch('/api/membership-registrations', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: btn.dataset.id, action: 'approve' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Approval failed');
            showStatus(`Member approved. ID: ${data.membershipId}`, 'success');

            const item = card.querySelector(`.membership-reg-item[data-id="${CSS.escape(btn.dataset.id)}"]`);
            if (item && data.membershipId) {
              item.open = true;
              const summaryMeta = item.querySelector('.membership-reg-item__meta');
              if (summaryMeta && !summaryMeta.textContent.includes(data.membershipId)) {
                summaryMeta.textContent += ` · ${data.membershipId}`;
              }
            }

            loadMembershipRegistrationsPanel();
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      card.querySelectorAll('.membership-revoke').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Deactivate this member? They will no longer access the dashboard.')) return;
          try {
            const res = await authFetch('/api/membership-registrations', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: btn.dataset.id, action: 'revoke' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not deactivate');
            showStatus('Member deactivated.', 'success');
            loadMembershipRegistrationsPanel();
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
          }
        });
      });

      card.querySelectorAll('.membership-resync').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await authFetch('/api/membership-registrations', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: btn.dataset.id, action: 'resync' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not sync member login');
            showStatus(`Member login synced. ID: ${data.membershipId}`, 'success');
            loadMembershipRegistrationsPanel();
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      card.querySelectorAll('.membership-copy-id').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.copyId;
          try {
            await navigator.clipboard.writeText(id);
            showStatus(`Copied ${id}`, 'success');
          } catch {
            showStatus('Could not copy — select the ID and copy manually.', 'error');
          }
        });
      });

      card.querySelectorAll('.membership-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.name || 'this applicant';
          if (!confirm(`Delete the registration from ${name}? This cannot be undone.`)) return;

          try {
            const res = await authFetch(`/api/membership-registrations?id=${encodeURIComponent(btn.dataset.id)}`, {
              method: 'DELETE'
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not delete registration');
            showStatus('Registration deleted.', 'success');
            loadMembershipRegistrationsPanel();
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
          }
        });
      });
    } catch (err) {
      if (isAuthError(err)) return;
      card.innerHTML = renderMembershipRegistrationsPanel([], err.message);
    }
  }

  async function loadAilcdApplications() {
    const res = await authFetch('/api/ailcd-applications');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || data.error || 'Could not load applications');
    }
    return data.applications || [];
  }

  function formatAilcdStatusLabel(status) {
    const labels = {
      pending: 'Under review',
      approved: 'Approved',
      rejected: 'Rejected'
    };
    return labels[status] || 'Under review';
  }

  function formatAilcdStatusBadge(status) {
    const value = status || 'pending';
    return `<span class="eoi-status-badge eoi-status-badge--${escapeHtml(value)}">${escapeHtml(formatAilcdStatusLabel(value))}</span>`;
  }

  function formatAilcdDetails(data) {
    if (!data || typeof data !== 'object') return '<p class="form-hint">No detail data</p>';
    const rows = [];
    const sig = data.declaration?.signatureImage;
    const walk = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, val]) => {
        if (key === 'signatureImage') return;
        const label = prefix ? `${prefix} → ${key}` : key;
        if (val && typeof val === 'object' && !Array.isArray(val)) walk(val, label);
        else if (Array.isArray(val)) rows.push(`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(JSON.stringify(val))}</p>`);
        else if (val) rows.push(`<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(val))}</p>`);
      });
    };
    walk(data);
    if (sig && String(sig).startsWith('data:image')) {
      rows.push(`<p><strong>Signature:</strong></p><img src="${sig}" alt="Applicant signature" class="admin-signature-preview">`);
    }
    return rows.join('') || '<p class="form-hint">No detail data</p>';
  }

  async function downloadAilcdPdfClient() {
    const res = await authFetch('/api/ailcd-applications?format=pdf');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ailcd-applications-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadAilcdCsvClient(applications) {
    const headers = ['Date', 'Reference', 'Status', 'Full Name', 'Email', 'Phone', 'State', 'Address', 'Suburb', 'Positions', 'Skills'];
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = applications.map(a => {
      const d = a.data || {};
      const p = d.personal || {};
      return [
        a.created_at ? new Date(a.created_at).toISOString() : '',
        a.reference_code || '',
        formatAilcdStatusLabel(a.status),
        a.full_name, a.email, a.phone, a.state,
        p.address, p.suburb,
        (d.position?.positions || []).join('; '),
        (d.experience?.skills || d.leadership?.skills || []).join('; ')
      ].map(escape).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ailcd-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function renderAilcdApplicationsPanel(applications, errorMsg) {
    if (errorMsg) {
      return `<h3>Leadership EOI submissions</h3><p class="form-hint">${escapeHtml(errorMsg)}</p>`;
    }
    if (!applications.length) {
      return `<h3>Leadership EOI submissions</h3><p class="form-hint">No submissions yet. Share the form link with applicants.</p>`;
    }

    const unread = applications.filter(a => !a.read).length;
    return `
      <div class="list-item__header">
        <h3>Leadership EOI submissions (${applications.length}${unread ? ` · ${unread} new` : ''})</h3>
        <div class="list-item__actions">
          <button type="button" class="btn btn--outline btn--sm" id="exportAilcdPdf">Download PDF</button>
          <button type="button" class="btn btn--outline btn--sm" id="exportAilcdCsv">Download CSV</button>
        </div>
      </div>
      <p class="form-hint">Expand an application to view full details. Data is admin-only.</p>
      <div id="ailcdApplicationsList">
        ${applications.map(a => `
          <details class="list-item inbox-item membership-reg-item ${a.read ? 'inbox-item--read' : ''}">
            <summary class="membership-reg-item__summary">
              <span class="membership-reg-item__name">${escapeHtml(a.full_name)} ${formatAilcdStatusBadge(a.status)}</span>
              <span class="membership-reg-item__meta">${escapeHtml(a.state || '—')} · ${escapeHtml((a.data?.position?.positions || []).slice(0, 2).join(', ') || '—')}${a.reference_code ? ` · ${escapeHtml(a.reference_code)}` : ''}</span>
              <span class="inbox-item__date">${new Date(a.created_at).toLocaleString()}</span>
            </summary>
            <div class="membership-reg-item__body">
              <div class="ailcd-admin-status">
                <p><strong>Application status:</strong> ${formatAilcdStatusBadge(a.status)}</p>
                ${a.reference_code ? `<p><strong>Reference:</strong> ${escapeHtml(a.reference_code)}</p>` : '<p class="form-hint">No reference number (submitted before status tracking was enabled).</p>'}
                <label class="form-label" for="ailcdStatusMessage-${escapeHtml(a.id)}">Message to applicant (optional)</label>
                <textarea id="ailcdStatusMessage-${escapeHtml(a.id)}" class="ailcd-status-message" data-id="${escapeHtml(a.id)}" rows="2" placeholder="Optional note shown to the applicant when approved or rejected">${escapeHtml(a.status_message || '')}</textarea>
                <div class="inbox-item__actions">
                  <button type="button" class="btn btn--primary btn--sm ailcd-set-status" data-id="${escapeHtml(a.id)}" data-status="approved">Approve</button>
                  <button type="button" class="btn btn--danger btn--sm ailcd-set-status" data-id="${escapeHtml(a.id)}" data-status="rejected">Reject</button>
                  <button type="button" class="btn btn--outline btn--sm ailcd-set-status" data-id="${escapeHtml(a.id)}" data-status="pending">Mark under review</button>
                </div>
              </div>
              <div class="membership-reg-item__grid">${formatAilcdDetails(a.data)}</div>
              <div class="inbox-item__actions">
                <button type="button" class="btn btn--outline btn--sm ailcd-mark-read" data-id="${escapeHtml(a.id)}" data-read="${a.read ? '0' : '1'}">
                  ${a.read ? 'Mark unread' : 'Mark read'}
                </button>
                <button type="button" class="btn btn--danger btn--sm ailcd-delete" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.full_name || 'this applicant')}">
                  Delete
                </button>
              </div>
            </div>
          </details>
        `).join('')}
      </div>
    `;
  }

  async function loadAilcdApplicationsPanel() {
    const card = document.getElementById('ailcdApplicationsCard');
    if (!card) return;

    if (isPreviewMode || !getToken()) {
      card.innerHTML = renderAilcdApplicationsPanel([], 'Sign in to view Leadership EOI submissions.');
      return;
    }

    card.innerHTML = '<h3>Leadership EOI submissions</h3><p class="form-hint">Loading…</p>';

    try {
      const applications = await loadAilcdApplications();
      card.innerHTML = renderAilcdApplicationsPanel(applications);

      card.querySelector('#exportAilcdCsv')?.addEventListener('click', () => {
        downloadAilcdCsvClient(applications);
        showStatus('Leadership EOI submissions exported as CSV.', 'success');
      });

      card.querySelector('#exportAilcdPdf')?.addEventListener('click', async () => {
        const btn = card.querySelector('#exportAilcdPdf');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Preparing PDF…';
        }
        try {
          await downloadAilcdPdfClient();
          showStatus('All applications downloaded as PDF.', 'success');
        } catch (err) {
          showStatus(err.message || 'Could not generate PDF.', 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Download PDF';
          }
        }
      });

      card.querySelectorAll('.ailcd-mark-read').forEach(btn => {
        btn.addEventListener('click', async () => {
          await authFetch('/api/ailcd-applications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: btn.dataset.id, read: btn.dataset.read === '1' })
          });
          loadAilcdApplicationsPanel();
        });
      });

      card.querySelectorAll('.ailcd-set-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const status = btn.dataset.status;
          const id = btn.dataset.id;
          const messageEl = card.querySelector(`.ailcd-status-message[data-id="${id}"]`);
          const statusMessage = messageEl?.value?.trim() || '';

          if (status === 'rejected' && !statusMessage && !confirm('Reject without a message to the applicant?')) {
            return;
          }

          const res = await authFetch('/api/ailcd-applications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, statusMessage, read: true })
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showStatus(data.error || 'Could not update application status.', 'error');
            return;
          }

          showStatus(`Application marked as ${formatAilcdStatusLabel(status).toLowerCase()}.`, 'success');
          loadAilcdApplicationsPanel();
        });
      });

      card.querySelectorAll('.ailcd-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.name || 'this applicant';
          if (!confirm(`Delete the application from ${name}? This cannot be undone.`)) return;

          const res = await authFetch(`/api/ailcd-applications?id=${encodeURIComponent(btn.dataset.id)}`, {
            method: 'DELETE'
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showStatus(data.error || 'Could not delete application.', 'error');
            return;
          }

          showStatus('Application deleted.', 'success');
          loadAilcdApplicationsPanel();
        });
      });
    } catch (err) {
      if (isAuthError(err)) return;
      card.innerHTML = renderAilcdApplicationsPanel([], err.message);
    }
  }

  async function loadSubmissions() {
    const token = getToken();
    if (!token) return [];

    const res = await authFetch('/api/contact-submissions');

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not load inbox');
    }

    const data = await res.json();
    return data.submissions || [];
  }

  function renderInboxPanel(submissions, errorMsg) {
    if (errorMsg) {
      return `<div class="card"><p>${escapeHtml(errorMsg)}</p><p class="portal__notice-small">Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then run <code>supabase/schema.sql</code> in your Supabase project.</p></div>`;
    }

    if (!submissions.length) {
      return `<div class="card"><h3>Contact inbox</h3><p>No messages yet. Submissions from the contact form appear here when Supabase is connected.</p></div>`;
    }

    return `
      <div class="card">
        <h3>Contact inbox (${submissions.length})</h3>
        <div id="inboxList">
          ${submissions.map(s => `
            <div class="list-item inbox-item ${s.read ? 'inbox-item--read' : ''}" data-id="${escapeHtml(s.id)}">
              <div class="list-item__header">
                <h4>${escapeHtml(s.name)} · ${escapeHtml(s.subject || 'general')}</h4>
                <span class="inbox-item__date">${new Date(s.created_at).toLocaleString()}</span>
              </div>
              <p><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></p>
              <p class="inbox-item__message">${escapeHtml(s.message)}</p>
              <button type="button" class="btn btn--outline btn--sm inbox-mark-read" data-id="${escapeHtml(s.id)}" data-read="${s.read ? '0' : '1'}">
                ${s.read ? 'Mark unread' : 'Mark read'}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async function renderInboxSection(panel) {
    if (isPreviewMode) {
      panel.innerHTML = renderInboxPanel([], 'Sign in to view the contact inbox.');
      return;
    }

    panel.innerHTML = '<div class="card"><p>Loading inbox…</p></div>';
    try {
      const submissions = await loadSubmissions();
      panel.innerHTML = renderInboxPanel(submissions);
      panel.querySelectorAll('.inbox-mark-read').forEach(btn => {
        btn.addEventListener('click', async () => {
          const token = getToken();
          const id = btn.dataset.id;
          const read = btn.dataset.read === '1';
          await fetch('/api/contact-submissions', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ id, read })
          });
          renderInboxSection(panel);
        });
      });
    } catch (err) {
      if (isAuthError(err)) return;
      panel.innerHTML = renderInboxPanel([], err.message);
    }
  }

  async function loadWelfareRegistrationsPanel() {
    const card = document.getElementById('welfareRegistrationsCard');
    if (!card) return;

    if (isPreviewMode || !getToken()) {
      card.innerHTML = '<h3>Welfare registrations &amp; reimbursements</h3><p class="form-hint">Sign in to manage welfare registrations.</p>';
      return;
    }

    card.innerHTML = '<h3>Welfare registrations &amp; reimbursements</h3><p class="form-hint">Loading…</p>';

    try {
      const res = await authFetch('/api/welfare-registrations');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load welfare data');

      const regs = data.registrations || [];
      const reimbs = data.reimbursements || [];

      card.innerHTML = `
        <h3>Welfare registrations (${regs.length})</h3>
        ${!regs.length ? '<p class="form-hint">No welfare registrations yet.</p>' : regs.map(r => {
          const meta = r.meta || {};
          return `
            <details class="list-item" style="margin-bottom:12px">
              <summary><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.package_title || '')} · ${escapeHtml(r.welfare_status)} · ${escapeHtml(r.payment_status)}</summary>
              <div style="margin-top:12px">
                <p><strong>Email:</strong> ${escapeHtml(r.email)}</p>
                <p><strong>Membership ID:</strong> ${escapeHtml(r.membership_id || '—')}</p>
                <p><strong>Reference:</strong> <code>${escapeHtml(meta.paymentReference || r.payment_reference || '—')}</code></p>
                <p><strong>Fee:</strong> ${escapeHtml(r.fee_display || '—')}</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                  ${r.welfare_status !== 'active' ? `<button type="button" class="btn btn--primary btn--sm welfare-approve" data-id="${r.id}">Activate welfare member</button>` : ''}
                  ${r.payment_status !== 'paid' ? `<button type="button" class="btn btn--outline btn--sm welfare-mark-paid" data-id="${r.id}">Mark as paid</button>` : ''}
                  ${r.welfare_status === 'active' ? `<button type="button" class="btn btn--danger btn--sm welfare-revoke" data-id="${r.id}">Deactivate</button>` : ''}
                  <button type="button" class="btn btn--danger btn--sm welfare-delete" data-id="${r.id}">Delete</button>
                </div>
              </div>
            </details>
          `;
        }).join('')}
        <h3 style="margin-top:24px">Reimbursement requests (${reimbs.length})</h3>
        ${!reimbs.length ? '<p class="form-hint">No reimbursement requests yet.</p>' : reimbs.map(req => `
          <details class="list-item" style="margin-bottom:12px">
            <summary><strong>${escapeHtml(req.deceased_name || 'Request')}</strong> — ${escapeHtml(req.status)} · ${escapeHtml(req.member_name || req.email)}</summary>
            <div style="margin-top:12px">
              <p><strong>Relationship:</strong> ${escapeHtml(req.relationship || '—')}</p>
              <p><strong>Date of loss:</strong> ${escapeHtml(req.date_of_loss || '—')}</p>
              <p>${escapeHtml(req.summary || '')}</p>
              <div class="form-grid" style="margin-top:8px">
                ${field('Status', `welfReimbStatus_${req.id}`, req.status, 'select', { options: [
                  { value: 'submitted', label: 'Submitted' },
                  { value: 'under_review', label: 'Under review' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'declined', label: 'Declined' }
                ]})}
                ${field('Status message to member', `welfReimbMsg_${req.id}`, req.status_message || '', 'textarea')}
              </div>
              <button type="button" class="btn btn--primary btn--sm welfare-reimb-update" data-id="${req.id}" style="margin-top:8px">Update reimbursement</button>
              <p class="form-hint">Under review / Approved / Paid sends an anonymous alert to all active welfare members.</p>
            </div>
          </details>
        `).join('')}
      `;

      const reload = () => loadWelfareRegistrationsPanel();

      card.querySelectorAll('.welfare-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await authFetch('/api/welfare-registrations', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: btn.dataset.id, action: 'approve' })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
            showStatus('Welfare member activated.', 'success');
            reload();
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      card.querySelectorAll('.welfare-mark-paid').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Mark welfare payment as received?')) return;
          const res = await authFetch('/api/welfare-registrations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: btn.dataset.id, action: 'markPaid' })
          });
          if (res.ok) {
            showStatus('Welfare payment marked as paid.', 'success');
            reload();
          }
        });
      });

      card.querySelectorAll('.welfare-revoke').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Deactivate this welfare member?')) return;
          await authFetch('/api/welfare-registrations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: btn.dataset.id, action: 'revoke' })
          });
          reload();
        });
      });

      card.querySelectorAll('.welfare-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this welfare registration permanently?')) return;
          await authFetch(`/api/welfare-registrations?id=${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
          reload();
        });
      });

      card.querySelectorAll('.welfare-reimb-update').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          btn.disabled = true;
          try {
            const res = await authFetch('/api/welfare-reimbursements', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id,
                status: val(`welfReimbStatus_${id}`),
                statusMessage: val(`welfReimbMsg_${id}`)
              })
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
            showStatus('Reimbursement updated.', 'success');
            reload();
          } catch (err) {
            if (isAuthError(err)) return;
            showStatus(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      if (isAuthError(err)) return;
      card.innerHTML = `<h3>Welfare registrations</h3><p class="form-hint">${escapeHtml(err.message)}</p>`;
    }
  }

  function ensureHubContent() {
    if (!content.welfare) content.welfare = { initiatives: [], news: [], membership: { packages: [] } };
    if (!content.welfare.initiatives) content.welfare.initiatives = [];
    if (!content.welfare.news) content.welfare.news = [];
    if (!content.welfare.membership) content.welfare.membership = { enabled: true, packages: [] };
    if (!content.welfare.membership.packages) content.welfare.membership.packages = [];
    if (!content.sports) content.sports = { vlogs: [], events: [], news: [] };
    if (!content.sports.vlogs) content.sports.vlogs = [];
    if (!content.sports.events) content.sports.events = [];
    if (!content.sports.news) content.sports.news = [];
    if (!content.business) content.business = { vlogs: [], adverts: [], investments: [], news: [] };
    if (!content.business.vlogs) content.business.vlogs = [];
    if (!content.business.adverts) content.business.adverts = [];
    if (!content.business.investments) content.business.investments = [];
    if (!content.business.news) content.business.news = [];
  }

  function hubNewsItemHtml(item, i, prefix, removeAttr) {
    return `
      <div class="list-item" data-hub-index="${i}">
        <div class="list-item__header">
          <h4>${escapeHtml(item.title || 'News item')}</h4>
          <button type="button" class="btn btn--danger btn--sm" ${removeAttr}="${i}">Remove</button>
        </div>
        <div class="form-grid">
          ${field('Title', `${prefix}Title${i}`, item.title)}
          ${field('Date', `${prefix}Date${i}`, item.date)}
          ${field('Summary', `${prefix}Summary${i}`, item.summary, 'textarea')}
          ${field('Link URL', `${prefix}Link${i}`, item.link)}
          ${field('Image path', `${prefix}Image${i}`, item.image)}
          ${field('Published', `${prefix}Published${i}`, item.published !== false, 'checkbox')}
        </div>
      </div>
    `;
  }

  function hubVlogItemHtml(item, i, prefix, removeAttr) {
    return `
      <div class="list-item" data-hub-index="${i}">
        <div class="list-item__header">
          <h4>${escapeHtml(item.title || 'Vlog')}</h4>
          <button type="button" class="btn btn--danger btn--sm" ${removeAttr}="${i}">Remove</button>
        </div>
        <div class="form-grid">
          ${field('Title', `${prefix}Title${i}`, item.title)}
          ${field('Date', `${prefix}Date${i}`, item.date)}
          ${field('Summary', `${prefix}Summary${i}`, item.summary, 'textarea')}
          ${field('Video URL (YouTube watch or channel)', `${prefix}Video${i}`, item.videoUrl)}
          ${field('Thumbnail image', `${prefix}Thumb${i}`, item.thumbnail)}
          ${field('Published', `${prefix}Published${i}`, item.published !== false, 'checkbox')}
        </div>
      </div>
    `;
  }

  function renderWelfarePanel() {
    ensureHubContent();
    const p = content.pages?.welfare || {};
    const w = content.welfare;
    const m = w.membership || {};
    const pkgs = m.packages || [];
    return `
      <div class="card card--notice">
        <p><strong>Public page:</strong> <a href="../welfare.html" target="_blank" rel="noopener">welfare.html</a> — registration form, packages, and sign-in portal. Hero text under <button type="button" class="btn btn--outline btn--sm" data-goto="pages">Page Heroes</button>.</p>
        <p class="form-hint">Run <code>supabase/migrate-welfare.sql</code> in Supabase if welfare registrations are not saving yet.</p>
      </div>
      <div class="card" id="welfareRegistrationsCard">
        <h3>Welfare registrations &amp; reimbursements</h3>
        <p class="form-hint">Loading from database…</p>
      </div>
      <div class="card"><h3>Welfare membership settings</h3><div class="form-grid">
        ${field('Registration enabled', 'welfMemEnabled', m.enabled !== false, 'checkbox')}
        ${field('Registration intro', 'welfMemIntro', m.intro, 'textarea', { full: true })}
        ${field('Fee note', 'welfMemFeeNote', m.feeNote, 'textarea')}
        ${field('Sign-in intro', 'welfMemSignInIntro', m.signInIntro, 'textarea', { full: true })}
        ${field('Community alert message', 'welfMemAlertMsg', m.communityAlertMessage, 'textarea', { full: true })}
        ${field('Packages section tag', 'welfPkgTag', m.packagesHeader?.tag)}
        ${field('Packages section title', 'welfPkgSectionTitle', m.packagesHeader?.title)}
        ${field('Packages section description', 'welfPkgSectionDesc', m.packagesHeader?.description, 'textarea')}
      </div></div>
      <div class="card">
        <div class="list-item__header"><h3>Welfare packages (${pkgs.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addWelfarePackage">+ Add package</button>
        </div>
        <div id="welfarePackagesList">${pkgs.map((pkg, i) => `
          <div class="list-item" data-welfare-pkg-index="${i}">
            <div class="list-item__header">
              <h4>${escapeHtml(pkg.title)} — ${escapeHtml(pkg.priceDisplay || `$${pkg.price}`)}</h4>
              <button type="button" class="btn btn--danger btn--sm" data-remove-welfare-pkg="${i}">Remove</button>
            </div>
            <div class="form-grid">
              ${field('Title', `welfPkgTitle${i}`, pkg.title)}
              ${field('Description', `welfPkgItemDesc${i}`, pkg.description, 'textarea', { full: true })}
              ${field('Price (number)', `welfPkgPrice${i}`, pkg.price, 'number')}
              ${field('Price display', `welfPkgPriceDisplay${i}`, pkg.priceDisplay)}
              ${field('Period', `welfPkgPeriod${i}`, pkg.period || 'year')}
              ${field('Highlight (popular)', `welfPkgHighlight${i}`, pkg.highlight === true, 'checkbox')}
              ${field('Benefits (one per line)', `welfPkgBenefits${i}`, (pkg.benefits || []).join('\n'), 'textarea', { full: true })}
            </div>
          </div>
        `).join('')}</div>
      </div>
      <div class="card"><h3>Page intro &amp; CTA</h3><div class="form-grid">
        ${field('Intro paragraph', 'welfareIntro', p.intro, 'textarea', { full: true })}
        ${field('CTA title', 'welfareCtaTitle', p.cta?.title)}
        ${field('CTA description', 'welfareCtaDesc', p.cta?.description, 'textarea')}
        ${field('CTA button', 'welfareCtaBtn', p.cta?.button)}
        ${field('CTA URL', 'welfareCtaUrl', p.cta?.buttonUrl)}
      </div></div>
      <div class="card"><h3>Section headers</h3><div class="form-grid">
        ${field('Initiatives tag', 'welfareInitTag', p.initiativesHeader?.tag)}
        ${field('Initiatives title', 'welfareInitTitle', p.initiativesHeader?.title)}
        ${field('Initiatives description', 'welfareInitDesc', p.initiativesHeader?.description, 'textarea')}
        ${field('News tag', 'welfareNewsTag', p.newsHeader?.tag)}
        ${field('News title', 'welfareNewsTitle', p.newsHeader?.title)}
        ${field('News description', 'welfareNewsDesc', p.newsHeader?.description, 'textarea')}
      </div></div>
      <div class="card">
        <div class="list-item__header"><h3>Welfare initiatives (${w.initiatives.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addWelfareInitiative">+ Add initiative</button>
        </div>
        <div id="welfareInitiativesList">${w.initiatives.map((item, i) => `
          <div class="list-item" data-welfare-init-index="${i}">
            <div class="list-item__header">
              <h4>${escapeHtml(item.title)}</h4>
              <button type="button" class="btn btn--danger btn--sm" data-remove-welfare-init="${i}">Remove</button>
            </div>
            <div class="form-grid">
              ${field('Title', `welfInitTitle${i}`, item.title)}
              ${field('Description', `welfInitDesc${i}`, item.description, 'textarea', { full: true })}
              ${field('Link URL', `welfInitLink${i}`, item.link)}
              ${field('Link label', `welfInitLinkLabel${i}`, item.linkLabel)}
              ${field('Icon', `welfInitIcon${i}`, item.icon, 'select', { options: [
                { value: 'heart', label: 'Heart' },
                { value: 'support', label: 'Support' },
                { value: 'health', label: 'Health' },
                { value: 'family', label: 'Family' },
                { value: 'building', label: 'Building' }
              ]})}
            </div>
          </div>
        `).join('')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Welfare news (${w.news.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addWelfareNews">+ Add news</button>
        </div>
        <div id="welfareNewsList">${w.news.map((item, i) => hubNewsItemHtml(item, i, 'welfNews', 'data-remove-welfare-news')).join('')}</div>
      </div>
    `;
  }

  function renderSportsPanel() {
    ensureHubContent();
    const p = content.pages?.sports || {};
    const s = content.sports;
    return `
      <div class="card card--notice">
        <p><strong>Public page:</strong> <a href="../sports.html" target="_blank" rel="noopener">sports.html</a> — vlogs, planned sports events, and sports news.</p>
      </div>
      <div class="card"><h3>Section headers</h3><div class="form-grid">
        ${field('Vlog tag', 'sportsVlogTag', p.vlogHeader?.tag)}
        ${field('Vlog title', 'sportsVlogTitle', p.vlogHeader?.title)}
        ${field('Vlog description', 'sportsVlogDesc', p.vlogHeader?.description, 'textarea')}
        ${field('Events tag', 'sportsEventsTag', p.eventsHeader?.tag)}
        ${field('Events title', 'sportsEventsTitle', p.eventsHeader?.title)}
        ${field('Events description', 'sportsEventsDesc', p.eventsHeader?.description, 'textarea')}
        ${field('News tag', 'sportsNewsTag', p.newsHeader?.tag)}
        ${field('News title', 'sportsNewsTitle', p.newsHeader?.title)}
        ${field('News description', 'sportsNewsDesc', p.newsHeader?.description, 'textarea')}
      </div></div>
      <div class="card">
        <div class="list-item__header"><h3>Sports vlog (${s.vlogs.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addSportsVlog">+ Add vlog</button>
        </div>
        <div id="sportsVlogList">${s.vlogs.map((item, i) => hubVlogItemHtml(item, i, 'sportVlog', 'data-remove-sports-vlog')).join('')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Planned sports events (${s.events.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addSportsEvent">+ Add event</button>
        </div>
        <div id="sportsEventsList">${s.events.map((item, i) => `
          <div class="list-item" data-sports-event-index="${i}">
            <div class="list-item__header">
              <h4>${escapeHtml(item.title)} <span class="form-hint">(${item.status || 'upcoming'})</span></h4>
              <button type="button" class="btn btn--danger btn--sm" data-remove-sports-event="${i}">Remove</button>
            </div>
            <div class="form-grid">
              ${field('Title', `sportEvtTitle${i}`, item.title)}
              ${field('Date pill', `sportEvtPill${i}`, item.datePill)}
              ${field('Full date', `sportEvtDate${i}`, item.date)}
              ${field('Location', `sportEvtLocation${i}`, item.location)}
              ${field('Summary', `sportEvtSummary${i}`, item.summary, 'textarea')}
              ${field('Image path', `sportEvtImage${i}`, item.image)}
              ${field('Status', `sportEvtStatus${i}`, item.status || 'upcoming', 'select', { options: [
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' }
              ]})}
              ${field('Link URL', `sportEvtLink${i}`, item.link)}
              ${field('Link label', `sportEvtLinkLabel${i}`, item.linkLabel)}
            </div>
          </div>
        `).join('')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Sports news (${s.news.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addSportsNews">+ Add news</button>
        </div>
        <div id="sportsNewsList">${s.news.map((item, i) => hubNewsItemHtml(item, i, 'sportNews', 'data-remove-sports-news')).join('')}</div>
      </div>
    `;
  }

  function renderBusinessPanel() {
    ensureHubContent();
    const p = content.pages?.business || {};
    const b = content.business;
    return `
      <div class="card card--notice">
        <p><strong>Public page:</strong> <a href="../business.html" target="_blank" rel="noopener">business.html</a> — vlogs, member adverts, investments, and business news.</p>
      </div>
      <div class="card"><h3>Section headers</h3><div class="form-grid">
        ${field('Vlog tag', 'bizVlogTag', p.vlogHeader?.tag)}
        ${field('Vlog title', 'bizVlogTitle', p.vlogHeader?.title)}
        ${field('Vlog description', 'bizVlogDesc', p.vlogHeader?.description, 'textarea')}
        ${field('Adverts tag', 'bizAdvertsTag', p.advertsHeader?.tag)}
        ${field('Adverts title', 'bizAdvertsTitle', p.advertsHeader?.title)}
        ${field('Adverts description', 'bizAdvertsDesc', p.advertsHeader?.description, 'textarea')}
        ${field('Investments tag', 'bizInvTag', p.investmentsHeader?.tag)}
        ${field('Investments title', 'bizInvTitle', p.investmentsHeader?.title)}
        ${field('Investments description', 'bizInvDesc', p.investmentsHeader?.description, 'textarea')}
        ${field('News tag', 'bizNewsTag', p.newsHeader?.tag)}
        ${field('News title', 'bizNewsTitle', p.newsHeader?.title)}
        ${field('News description', 'bizNewsDesc', p.newsHeader?.description, 'textarea')}
      </div></div>
      <div class="card">
        <div class="list-item__header"><h3>Business vlog (${b.vlogs.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addBusinessVlog">+ Add vlog</button>
        </div>
        <div id="businessVlogList">${b.vlogs.map((item, i) => hubVlogItemHtml(item, i, 'bizVlog', 'data-remove-business-vlog')).join('')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Business adverts (${b.adverts.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addBusinessAdvert">+ Add advert</button>
        </div>
        <div id="businessAdvertsList">${b.adverts.map((item, i) => `
          <div class="list-item" data-business-advert-index="${i}">
            <div class="list-item__header">
              <h4>${escapeHtml(item.title)}</h4>
              <button type="button" class="btn btn--danger btn--sm" data-remove-business-advert="${i}">Remove</button>
            </div>
            <div class="form-grid">
              ${field('Title', `bizAdTitle${i}`, item.title)}
              ${field('Description', `bizAdDesc${i}`, item.description, 'textarea', { full: true })}
              ${field('Category', `bizAdCategory${i}`, item.category)}
              ${field('Image path', `bizAdImage${i}`, item.image)}
              ${field('Website URL', `bizAdLink${i}`, item.link)}
              ${field('Contact email', `bizAdEmail${i}`, item.contactEmail)}
              ${field('Published', `bizAdPublished${i}`, item.published !== false, 'checkbox')}
            </div>
          </div>
        `).join('')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Investments (${b.investments.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addBusinessInvestment">+ Add investment</button>
        </div>
        <div id="businessInvestmentsList">${b.investments.map((item, i) => `
          <div class="list-item" data-business-inv-index="${i}">
            <div class="list-item__header">
              <h4>${escapeHtml(item.title)}</h4>
              <button type="button" class="btn btn--danger btn--sm" data-remove-business-inv="${i}">Remove</button>
            </div>
            <div class="form-grid">
              ${field('Title', `bizInvTitle${i}`, item.title)}
              ${field('Summary', `bizInvSummary${i}`, item.summary, 'textarea', { full: true })}
              ${field('Amount / scale', `bizInvAmount${i}`, item.amount)}
              ${field('Deadline', `bizInvDeadline${i}`, item.deadline)}
              ${field('Image path', `bizInvImage${i}`, item.image)}
              ${field('Status', `bizInvStatus${i}`, item.status || 'open', 'select', { options: [
                { value: 'open', label: 'Open' },
                { value: 'closed', label: 'Closed' }
              ]})}
              ${field('Link URL', `bizInvLink${i}`, item.link)}
              ${field('Link label', `bizInvLinkLabel${i}`, item.linkLabel)}
            </div>
          </div>
        `).join('')}</div>
      </div>
      <div class="card">
        <div class="list-item__header"><h3>Business news (${b.news.length})</h3>
          <button type="button" class="btn btn--outline btn--sm" id="addBusinessNews">+ Add news</button>
        </div>
        <div id="businessNewsList">${b.news.map((item, i) => hubNewsItemHtml(item, i, 'bizNews', 'data-remove-business-news')).join('')}</div>
      </div>
    `;
  }

  function renderPagesPanel() {
    const pages = ['programs', 'welfare', 'sports', 'business', 'events', 'leadership', 'gallery', 'contact', 'join', 'privacy', 'terms'];
    return pages.map(key => {
      const h = content.pages[key]?.hero || {};
      return `
        <div class="card"><h3>${key.charAt(0).toUpperCase() + key.slice(1)} hero</h3><div class="form-grid">
          ${field('Tag', `heroTag_${key}`, h.tag)}
          ${field('Title', `heroTitle_${key}`, h.title)}
          ${field('Description', `heroDesc_${key}`, h.description, 'textarea', { full: true })}
        </div></div>
      `;
    }).join('');
  }

  function renderSection(section) {
    activeSection = section;
    els.sectionTitle.textContent = SECTION_TITLES[section] || section;

    const iconEl = document.getElementById('sectionIcon');
    if (iconEl) {
      const icon = SECTION_ICONS[section] || 'dashboard';
      iconEl.className = `topbar__icon nav-item__icon nav-item__icon--${icon}`;
    }

    document.querySelectorAll('.sidebar__nav button[data-section]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.section === section);
    });

    document.querySelectorAll('[data-panel]').forEach(panel => {
      const isActive = panel.dataset.panel === section;
      panel.hidden = !isActive;
      if (isActive && section !== 'dashboard') {
        if (section === 'inbox') {
          renderInboxSection(panel);
          return;
        }
        const renderers = {
          site: renderSitePanel,
          home: renderHomePanel,
          about: renderAboutPanel,
          programs: renderProgramsPanel,
          welfare: renderWelfarePanel,
          sports: renderSportsPanel,
          business: renderBusinessPanel,
          events: renderEventsPanel,
          leadership: renderLeadershipPanel,
          gallery: renderGalleryPanel,
          contact: renderContactPanel,
          membership: renderMembershipPanel,
          memberPortal: renderMemberPortalPanel,
          ailcd: renderAilcdPanel,
          pages: renderPagesPanel
        };
        panel.innerHTML = renderers[section]?.() || '';
        bindListActions(section);
        if (section === 'membership') loadMembershipRegistrationsPanel();
        if (section === 'welfare') loadWelfareRegistrationsPanel();
        if (section === 'ailcd') loadAilcdApplicationsPanel();
      }
    });
  }

  function bindListActions(section) {
    if (section === 'programs') {
      document.getElementById('addProgram')?.addEventListener('click', () => {
        content.programs.push({
          id: `prog-${Date.now()}`,
          title: 'New Program',
          description: '',
          icon: 'education',
          link: 'contact.html',
          showOnHome: false
        });
        renderSection('programs');
      });
      document.querySelectorAll('[data-remove-program]').forEach(btn => {
        btn.addEventListener('click', () => {
          content.programs.splice(+btn.dataset.removeProgram, 1);
          renderSection('programs');
        });
      });
    }

    if (section === 'welfare') {
      document.getElementById('addWelfarePackage')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.welfare.membership.packages.push({
          id: `welf-pkg-${Date.now()}`,
          title: 'New Package',
          description: '',
          price: 0,
          priceDisplay: '$0 AUD / year',
          period: 'year',
          highlight: false,
          benefits: []
        });
        renderSection('welfare');
      });
      document.querySelectorAll('[data-remove-welfare-pkg]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.welfare.membership.packages.splice(+btn.dataset.removeWelfarePkg, 1);
          renderSection('welfare');
        });
      });

      document.getElementById('addWelfareInitiative')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.welfare.initiatives.push({
          id: `welf-${Date.now()}`,
          title: 'New Initiative',
          description: '',
          icon: 'heart',
          link: 'contact.html',
          linkLabel: 'Learn more'
        });
        renderSection('welfare');
      });
      document.querySelectorAll('[data-remove-welfare-init]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.welfare.initiatives.splice(+btn.dataset.removeWelfareInit, 1);
          renderSection('welfare');
        });
      });
      document.getElementById('addWelfareNews')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.welfare.news.push({
          id: `welf-news-${Date.now()}`,
          title: 'New update',
          date: new Date().toISOString().slice(0, 7),
          summary: '',
          link: '',
          image: '',
          published: true
        });
        renderSection('welfare');
      });
      document.querySelectorAll('[data-remove-welfare-news]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.welfare.news.splice(+btn.dataset.removeWelfareNews, 1);
          renderSection('welfare');
        });
      });
    }

    if (section === 'sports') {
      document.getElementById('addSportsVlog')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.sports.vlogs.push({
          id: `sport-vlog-${Date.now()}`,
          title: 'New vlog',
          date: '',
          summary: '',
          videoUrl: '',
          thumbnail: 'assets/hero/kokwet-sports-day.png',
          published: true
        });
        renderSection('sports');
      });
      document.querySelectorAll('[data-remove-sports-vlog]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.sports.vlogs.splice(+btn.dataset.removeSportsVlog, 1);
          renderSection('sports');
        });
      });
      document.getElementById('addSportsEvent')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.sports.events.push({
          id: `sport-evt-${Date.now()}`,
          title: 'New sports event',
          date: '',
          datePill: '',
          location: '',
          summary: '',
          status: 'upcoming',
          link: 'contact.html',
          linkLabel: 'Register',
          image: 'assets/hero/kokwet-sports-day.png'
        });
        renderSection('sports');
      });
      document.querySelectorAll('[data-remove-sports-event]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.sports.events.splice(+btn.dataset.removeSportsEvent, 1);
          renderSection('sports');
        });
      });
      document.getElementById('addSportsNews')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.sports.news.push({
          id: `sport-news-${Date.now()}`,
          title: 'New sports news',
          date: '',
          summary: '',
          link: '',
          image: '',
          published: true
        });
        renderSection('sports');
      });
      document.querySelectorAll('[data-remove-sports-news]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.sports.news.splice(+btn.dataset.removeSportsNews, 1);
          renderSection('sports');
        });
      });
    }

    if (section === 'business') {
      document.getElementById('addBusinessVlog')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.business.vlogs.push({
          id: `biz-vlog-${Date.now()}`,
          title: 'New vlog',
          date: '',
          summary: '',
          videoUrl: '',
          thumbnail: 'assets/hero/page/stage-address.png',
          published: true
        });
        renderSection('business');
      });
      document.querySelectorAll('[data-remove-business-vlog]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.business.vlogs.splice(+btn.dataset.removeBusinessVlog, 1);
          renderSection('business');
        });
      });
      document.getElementById('addBusinessAdvert')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.business.adverts.push({
          id: `biz-ad-${Date.now()}`,
          title: 'New advert',
          description: '',
          category: 'Services',
          image: 'assets/logo-round.png',
          link: '',
          contactEmail: '',
          published: true
        });
        renderSection('business');
      });
      document.querySelectorAll('[data-remove-business-advert]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.business.adverts.splice(+btn.dataset.removeBusinessAdvert, 1);
          renderSection('business');
        });
      });
      document.getElementById('addBusinessInvestment')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.business.investments.push({
          id: `biz-inv-${Date.now()}`,
          title: 'New opportunity',
          summary: '',
          amount: '',
          deadline: '',
          link: 'contact.html',
          linkLabel: 'Express interest',
          status: 'open',
          image: 'assets/hero/page/gala-celebration.png'
        });
        renderSection('business');
      });
      document.querySelectorAll('[data-remove-business-inv]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.business.investments.splice(+btn.dataset.removeBusinessInv, 1);
          renderSection('business');
        });
      });
      document.getElementById('addBusinessNews')?.addEventListener('click', () => {
        collectFromForm();
        ensureHubContent();
        content.business.news.push({
          id: `biz-news-${Date.now()}`,
          title: 'New business news',
          date: '',
          summary: '',
          link: '',
          image: '',
          published: true
        });
        renderSection('business');
      });
      document.querySelectorAll('[data-remove-business-news]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.business.news.splice(+btn.dataset.removeBusinessNews, 1);
          renderSection('business');
        });
      });
    }

    if (section === 'memberPortal') {
      bindMemberPortalTabs();

      document.getElementById('addMemberFeed')?.addEventListener('click', () => {
        collectFromForm();
        if (!content.memberPortal) content.memberPortal = defaultMemberPortal();
        content.memberPortal.feeds.push({
          id: `feed-${Date.now()}`,
          category: 'news',
          title: 'New post',
          body: '',
          publishedAt: new Date().toISOString().slice(0, 10),
          link: ''
        });
        memberPortalActiveTab = 'feeds';
        renderSection('memberPortal');
      });
      document.querySelectorAll('[data-remove-feed]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.memberPortal.feeds.splice(+btn.dataset.removeFeed, 1);
          renderSection('memberPortal');
        });
      });

      document.getElementById('addMemberExplore')?.addEventListener('click', () => {
        collectFromForm();
        if (!content.memberPortal) content.memberPortal = defaultMemberPortal();
        if (!content.memberPortal.exploreLinks) content.memberPortal.exploreLinks = defaultExploreLinks();
        content.memberPortal.exploreLinks.push({
          href: 'contact.html',
          label: 'New link',
          desc: 'Description'
        });
        memberPortalActiveTab = 'explore';
        renderSection('memberPortal');
      });

      document.querySelectorAll('[data-remove-explore]').forEach(btn => {
        btn.addEventListener('click', () => {
          collectFromForm();
          content.memberPortal.exploreLinks.splice(+btn.dataset.removeExplore, 1);
          renderSection('memberPortal');
        });
      });

      function addGovernancePosition(key) {
        collectFromForm();
        if (!content.memberPortal) content.memberPortal = defaultMemberPortal();
        if (!content.memberPortal.elections) content.memberPortal.elections = defaultMemberPortal().elections;
        const list = content.memberPortal.elections[key];
        list.push({
          id: `pos-${Date.now()}`,
          title: 'New position',
          description: ''
        });
        memberPortalActiveTab = 'governance';
        renderSection('memberPortal');
      }

      function removeGovernancePosition(key, index) {
        collectFromForm();
        content.memberPortal.elections[key].splice(index, 1);
        memberPortalActiveTab = 'governance';
        renderSection('memberPortal');
      }

      function applyGovernanceBulk(key, idPrefix) {
        collectFromForm();
        const bulk = parsePositionLines(val(`mp${idPrefix}PositionsBulk`));
        if (!bulk.length) {
          showStatus('Add at least one position line before applying bulk list.', 'error');
          return;
        }
        content.memberPortal.elections[key] = bulk;
        memberPortalActiveTab = 'governance';
        renderSection('memberPortal');
        showStatus(`Applied ${bulk.length} position(s).`, 'success');
      }

      document.getElementById('addNomPosition')?.addEventListener('click', () => {
        addGovernancePosition('nominationPositions');
      });

      document.getElementById('addElePosition')?.addEventListener('click', () => {
        addGovernancePosition('electionPositions');
      });

      document.querySelectorAll('[data-remove-nom-pos]').forEach(btn => {
        btn.addEventListener('click', () => {
          removeGovernancePosition('nominationPositions', +btn.dataset.removeNomPos);
        });
      });

      document.querySelectorAll('[data-remove-ele-pos]').forEach(btn => {
        btn.addEventListener('click', () => {
          removeGovernancePosition('electionPositions', +btn.dataset.removeElePos);
        });
      });

      document.getElementById('mpNomApplyBulk')?.addEventListener('click', () => {
        applyGovernanceBulk('nominationPositions', 'Nom');
      });

      document.getElementById('mpEleApplyBulk')?.addEventListener('click', () => {
        applyGovernanceBulk('electionPositions', 'Ele');
      });
    }

    if (section === 'events') {
      loadEventBookingsPanel();

      document.getElementById('addEvent')?.addEventListener('click', () => {
        const id = `evt-${Date.now()}`;
        content.events.unshift({
          id,
          title: 'New Event',
          date: '',
          datePill: '',
          time: '',
          location: '',
          meta: '',
          image: 'assets/hero/taunet-cultural-dance.png',
          status: 'upcoming',
          category: 'community',
          summary: '',
          description: '',
          bookingEnabled: true,
          bookingLabel: 'Book Now',
          ticketPriceNote: 'Free registration — secure payment coming soon',
          bookingUrl: `book.html?id=${id}`,
          registerUrl: `book.html?id=${id}`,
          registerLabel: 'Book Now'
        });
        renderSection('events');
      });

      document.getElementById('addPastEvent')?.addEventListener('click', () => {
        content.events.push({
          id: `evt-${Date.now()}`,
          title: 'Past Event',
          date: '',
          datePill: '',
          time: '',
          location: '',
          meta: '',
          image: 'assets/hero/taunet-cultural-dance.png',
          status: 'past',
          category: 'community',
          summary: '',
          description: '',
          bookingEnabled: false,
          registerUrl: 'gallery.html',
          registerLabel: 'See Photos'
        });
        renderSection('events');
      });

      document.querySelectorAll('[data-remove-event]').forEach(btn => {
        btn.addEventListener('click', () => {
          content.events.splice(+btn.dataset.removeEvent, 1);
          renderSection('events');
        });
      });
    }

    if (section === 'leadership') {
      document.getElementById('addLeader')?.addEventListener('click', () => {
        content.leadership.push({
          id: `ldr-${Date.now()}`,
          name: 'New Leader',
          role: '',
          initials: 'NL',
          photo: ''
        });
        renderSection('leadership');
      });
      document.querySelectorAll('[data-remove-leader]').forEach(btn => {
        btn.addEventListener('click', () => {
          content.leadership.splice(+btn.dataset.removeLeader, 1);
          renderSection('leadership');
        });
      });
    }

    if (section === 'gallery') {
      document.querySelectorAll('.gallery-admin-album').forEach(details => {
        details.addEventListener('toggle', () => {
          const id = details.dataset.eventId;
          if (!id) return;
          if (details.open) openGalleryAlbums.add(id);
          else openGalleryAlbums.delete(id);
        });
      });

      document.querySelectorAll('.gallery-bulk-input').forEach(input => {
        input.addEventListener('change', () => {
          const eventId = input.dataset.eventId;
          openGalleryAlbums.add(eventId);
          const statusEl = document.getElementById(`galleryUploadStatus-${eventId}`);
          handleGalleryBulkUpload(eventId, input.files, statusEl);
          input.value = '';
        });
      });

      document.querySelectorAll('[data-add-gallery-photo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const eventId = btn.dataset.addGalleryPhoto;
          openGalleryAlbums.add(eventId);
          content.gallery.push({
            id: `gal-${Date.now()}`,
            eventId,
            image: 'assets/hero/taunet-cultural-dance.png',
            alt: 'New photo',
            caption: 'New photo',
            wide: false
          });
          renderSection('gallery');
        });
      });

      document.querySelectorAll('[data-remove-gallery]').forEach(btn => {
        btn.addEventListener('click', () => {
          content.gallery.splice(+btn.dataset.removeGallery, 1);
          renderSection('gallery');
        });
      });
    }
  }

  function val(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }

  function collectFromForm() {
    if (!content) return;

    if (activeSection === 'site' || document.querySelector('[data-panel="site"] input')) {
      if (!content.site) content.site = {};
      content.site.siteName = val('siteName');
      content.site.siteUrl = val('siteUrl');
      content.site.tagline = val('tagline');
      content.site.contactEmail = val('contactEmail');
      content.site.copyrightYear = parseInt(val('copyrightYear'), 10) || content.site.copyrightYear;
      content.site.affiliationText = val('affiliationText');
      content.site.affiliationUrl = val('affiliationUrl');
      content.site.social = {
        facebook: val('socialFacebook'),
        tiktok: val('socialTiktok'),
        instagram: val('socialInstagram'),
        whatsapp: val('socialWhatsapp'),
        youtube: val('socialYoutube')
      };
      if (document.getElementById('payPayId')) {
        if (!content.payment) content.payment = defaultPayment();
        const p = content.payment;
        p.enabled = val('payEnabled');
        p.legalName = val('payLegalName');
        p.abn = val('payAbn');
        p.payId = val('payPayId');
        p.bsb = val('payBsb');
        p.accountNumber = val('payAccountNumber');
        p.accountName = val('payAccountName');
        p.receiptEmail = val('payReceiptEmail');
        p.instructions = val('payInstructions');
        p.gstNote = val('payGstNote');
      }
    }

    const h = content.pages?.home;
    if (h && document.getElementById('homeBadge')) {
      h.hero.badge = val('homeBadge');
      h.hero.title = val('homeTitle');
      h.hero.titleEm = val('homeTitleEm');
      h.hero.subtitle = val('homeSubtitle');
      h.hero.description = val('homeDesc');
      h.hero.ctaPrimary = val('homeCtaPrimary');
      h.hero.ctaPrimaryUrl = val('homeCtaPrimaryUrl');
      h.hero.ctaSecondary = val('homeCtaSecondary');
      h.hero.ctaSecondaryUrl = val('homeCtaSecondaryUrl');
      h.hero.slides = val('homeSlides').split('\n').map(s => s.trim()).filter(Boolean);
      h.impact.forEach((stat, i) => {
        stat.number = val(`impactNum${i}`);
        stat.label = val(`impactLabel${i}`);
      });
      h.aboutPreview.tag = val('homeAboutTag');
      h.aboutPreview.title = val('homeAboutTitle');
      h.aboutPreview.paragraphs[0] = val('homeAboutP1');
      h.aboutPreview.paragraphs[1] = val('homeAboutP2');
      h.aboutPreview.cta = val('homeAboutCta');
      h.aboutPreview.caption = val('homeAboutCaption');
      h.cta.title = val('homeCtaTitle');
      h.cta.description = val('homeCtaDesc');
      h.cta.button = val('homeCtaBtn');
      h.cta.buttonUrl = val('homeCtaBtnUrl');
    }

    if (document.getElementById('aboutLead') && content.pages?.about) {
      const a = content.pages.about;
      a.lead = val('aboutLead');
      a.mission = val('aboutMission');
      a.vision = val('aboutVision');
      a.quote = val('aboutQuote');
      a.image = val('aboutImage');
      a.cities = val('aboutCities').split(',').map(s => s.trim()).filter(Boolean);
      a.cta.title = val('aboutCtaTitle');
      a.cta.description = val('aboutCtaDesc');
      a.cta.button = val('aboutCtaBtn');
    }

    (content.programs || []).forEach((p, i) => {
      if (document.getElementById(`progTitle${i}`)) {
        p.title = val(`progTitle${i}`);
        p.link = val(`progLink${i}`);
        p.icon = val(`progIcon${i}`);
        p.description = val(`progDesc${i}`);
        p.showOnHome = val(`progHome${i}`);
      }
    });

    if (document.getElementById('featuredEventId')) {
      content.featuredEventId = val('featuredEventId');
    }

    (content.events || []).forEach((e, i) => {
      if (document.getElementById(`evtTitle${i}`)) {
        e.title = val(`evtTitle${i}`);
        e.datePill = val(`evtPill${i}`);
        e.date = val(`evtDate${i}`);
        e.time = val(`evtTime${i}`);
        e.location = val(`evtLocation${i}`);
        e.meta = val(`evtMeta${i}`);
        e.image = val(`evtImage${i}`);
        e.status = val(`evtStatus${i}`);
        e.category = val(`evtCategory${i}`);
        e.summary = val(`evtSummary${i}`);
        e.description = val(`evtDesc${i}`);
        if (e.status === 'upcoming') {
          e.bookingEnabled = val(`evtBooking${i}`);
          e.bookingLabel = val(`evtBookingLabel${i}`);
          e.ticketAmount = parseFloat(val(`evtTicketAmount${i}`)) || 0;
          e.ticketPriceNote = val(`evtPriceNote${i}`);
          e.bookingUrl = val(`evtBookingUrl${i}`);
          e.registerUrl = e.bookingUrl || `book.html?id=${e.id}`;
          e.registerLabel = e.bookingLabel || 'Book Now';
        } else {
          e.registerUrl = val(`evtRegUrl${i}`);
          e.registerLabel = val(`evtRegLabel${i}`);
          e.bookingEnabled = false;
        }
      }
    });

    (content.leadership || []).forEach((l, i) => {
      if (document.getElementById(`ldrName${i}`)) {
        l.name = val(`ldrName${i}`);
        l.role = val(`ldrRole${i}`);
        l.initials = val(`ldrInitials${i}`);
        l.photo = val(`ldrPhoto${i}`);
      }
    });

    (content.gallery || []).forEach((g, i) => {
      if (document.getElementById(`galImage${i}`)) {
        g.eventId = val(`galEvent${i}`);
        g.image = val(`galImage${i}`);
        g.alt = val(`galAlt${i}`);
        g.caption = val(`galCaption${i}`);
        g.wide = val(`galWide${i}`);
      }
    });

    if (document.getElementById('contactIntro') && content.contact) {
      content.contact.intro = val('contactIntro');
      content.contact.location = val('contactLocation');
      content.contact.officeHours = val('contactHours');
    }

    if (document.getElementById('memFeeAmount')) {
      if (!content.membership) content.membership = defaultMembership();
      const m = content.membership;
      m.enabled = val('memEnabled');
      m.feeAmount = parseFloat(val('memFeeAmount')) || 0;
      m.feeCurrency = val('memFeeCurrency') || 'AUD';
      m.feePeriod = val('memFeePeriod') || 'year';
      m.feeDisplay = val('memFeeDisplay');
      m.feeNote = val('memFeeNote');
      m.paymentPlaceholder = val('memPaymentPlaceholder');
      m.intro = val('memIntro');
      m.image = val('memImage');
      m.benefits = val('memBenefits').split('\n').map(s => s.trim()).filter(Boolean);
      m.types = val('memTypes').split('\n').map(s => s.trim()).filter(Boolean).map((label, i) => ({
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `type-${i}`,
        label
      }));
      if (!content.pages) content.pages = {};
      if (!content.pages.join) content.pages.join = { hero: {} };
      content.pages.join.hero = {
        tag: val('heroTag_join'),
        title: val('heroTitle_join'),
        description: val('heroDesc_join')
      };
    }

    if (document.getElementById('mpWelcomeTitle')) {
      if (!content.memberPortal) content.memberPortal = defaultMemberPortal();
      const mp = content.memberPortal;
      mp.welcomeTitle = val('mpWelcomeTitle');
      mp.welcomeMessage = val('mpWelcomeMessage');
      mp.eventsIntro = val('mpEventsIntro');
      mp.photosIntro = val('mpPhotosIntro');
      mp.exploreIntro = val('mpExploreIntro');

      const feeds = [];
      for (let i = 0; document.getElementById(`mpFeedTitle_${i}`); i += 1) {
        feeds.push({
          id: mp.feeds?.[i]?.id || `feed-${i}`,
          category: val(`mpFeedCat_${i}`) || 'news',
          title: val(`mpFeedTitle_${i}`),
          publishedAt: val(`mpFeedDate_${i}`),
          link: val(`mpFeedLink_${i}`),
          body: val(`mpFeedBody_${i}`)
        });
      }
      mp.feeds = feeds;

      const exploreLinks = [];
      for (let i = 0; document.getElementById(`mpExploreLabel_${i}`); i += 1) {
        exploreLinks.push({
          href: val(`mpExploreHref_${i}`),
          label: val(`mpExploreLabel_${i}`),
          desc: val(`mpExploreDesc_${i}`)
        });
      }
      mp.exploreLinks = exploreLinks;

      mp.elections = {
        ...mp.elections,
        nominationOpen: val('mpNomOpen'),
        nominationTitle: val('mpNomTitle'),
        nominationPeriod: val('mpNomPeriod'),
        nominationMessage: val('mpNomMessage'),
        nominationClosedMessage: val('mpNomClosedMessage'),
        nominationUrl: val('mpNomUrl'),
        nominationButtonLabel: val('mpNomButtonLabel'),
        nominationPositions: collectGovernancePositions('Nom', mp.elections?.nominationPositions),
        electionOpen: val('mpEleOpen'),
        electionTitle: val('mpEleTitle'),
        electionPeriod: val('mpElePeriod'),
        electionMessage: val('mpEleMessage'),
        electionClosedMessage: val('mpEleClosedMessage'),
        electionUrl: val('mpEleUrl'),
        electionButtonLabel: val('mpEleButtonLabel'),
        electionPositions: collectGovernancePositions('Ele', mp.elections?.electionPositions)
      };
    }

    if (document.getElementById('welfareIntro')) {
      ensureHubContent();
      if (!content.pages.welfare) content.pages.welfare = {};
      const p = content.pages.welfare;
      p.intro = val('welfareIntro');
      if (!p.cta) p.cta = {};
      p.cta.title = val('welfareCtaTitle');
      p.cta.description = val('welfareCtaDesc');
      p.cta.button = val('welfareCtaBtn');
      p.cta.buttonUrl = val('welfareCtaUrl');
      p.initiativesHeader = {
        tag: val('welfareInitTag'),
        title: val('welfareInitTitle'),
        description: val('welfareInitDesc')
      };
      p.newsHeader = {
        tag: val('welfareNewsTag'),
        title: val('welfareNewsTitle'),
        description: val('welfareNewsDesc')
      };

      if (!content.welfare.membership) content.welfare.membership = { packages: [] };
      const m = content.welfare.membership;
      m.enabled = val('welfMemEnabled');
      m.intro = val('welfMemIntro');
      m.feeNote = val('welfMemFeeNote');
      m.signInIntro = val('welfMemSignInIntro');
      m.communityAlertMessage = val('welfMemAlertMsg');
      m.packagesHeader = {
        tag: val('welfPkgTag'),
        title: val('welfPkgSectionTitle'),
        description: val('welfPkgSectionDesc')
      };

      m.packages.forEach((pkg, i) => {
        if (document.getElementById(`welfPkgTitle${i}`)) {
          pkg.title = val(`welfPkgTitle${i}`);
          pkg.description = val(`welfPkgItemDesc${i}`);
          pkg.price = parseFloat(val(`welfPkgPrice${i}`)) || 0;
          pkg.priceDisplay = val(`welfPkgPriceDisplay${i}`);
          pkg.period = val(`welfPkgPeriod${i}`) || 'year';
          pkg.highlight = val(`welfPkgHighlight${i}`);
          pkg.benefits = val(`welfPkgBenefits${i}`).split('\n').map(s => s.trim()).filter(Boolean);
        }
      });

      content.welfare.initiatives.forEach((item, i) => {
        if (document.getElementById(`welfInitTitle${i}`)) {
          item.title = val(`welfInitTitle${i}`);
          item.description = val(`welfInitDesc${i}`);
          item.link = val(`welfInitLink${i}`);
          item.linkLabel = val(`welfInitLinkLabel${i}`);
          item.icon = val(`welfInitIcon${i}`);
        }
      });

      content.welfare.news.forEach((item, i) => {
        if (document.getElementById(`welfNewsTitle${i}`)) {
          item.title = val(`welfNewsTitle${i}`);
          item.date = val(`welfNewsDate${i}`);
          item.summary = val(`welfNewsSummary${i}`);
          item.link = val(`welfNewsLink${i}`);
          item.image = val(`welfNewsImage${i}`);
          item.published = val(`welfNewsPublished${i}`);
        }
      });
    }

    if (document.getElementById('sportsVlogTag')) {
      ensureHubContent();
      if (!content.pages.sports) content.pages.sports = {};
      const p = content.pages.sports;
      p.vlogHeader = { tag: val('sportsVlogTag'), title: val('sportsVlogTitle'), description: val('sportsVlogDesc') };
      p.eventsHeader = { tag: val('sportsEventsTag'), title: val('sportsEventsTitle'), description: val('sportsEventsDesc') };
      p.newsHeader = { tag: val('sportsNewsTag'), title: val('sportsNewsTitle'), description: val('sportsNewsDesc') };

      content.sports.vlogs.forEach((item, i) => {
        if (document.getElementById(`sportVlogTitle${i}`)) {
          item.title = val(`sportVlogTitle${i}`);
          item.date = val(`sportVlogDate${i}`);
          item.summary = val(`sportVlogSummary${i}`);
          item.videoUrl = val(`sportVlogVideo${i}`);
          item.thumbnail = val(`sportVlogThumb${i}`);
          item.published = val(`sportVlogPublished${i}`);
        }
      });

      content.sports.events.forEach((item, i) => {
        if (document.getElementById(`sportEvtTitle${i}`)) {
          item.title = val(`sportEvtTitle${i}`);
          item.datePill = val(`sportEvtPill${i}`);
          item.date = val(`sportEvtDate${i}`);
          item.location = val(`sportEvtLocation${i}`);
          item.summary = val(`sportEvtSummary${i}`);
          item.image = val(`sportEvtImage${i}`);
          item.status = val(`sportEvtStatus${i}`);
          item.link = val(`sportEvtLink${i}`);
          item.linkLabel = val(`sportEvtLinkLabel${i}`);
        }
      });

      content.sports.news.forEach((item, i) => {
        if (document.getElementById(`sportNewsTitle${i}`)) {
          item.title = val(`sportNewsTitle${i}`);
          item.date = val(`sportNewsDate${i}`);
          item.summary = val(`sportNewsSummary${i}`);
          item.link = val(`sportNewsLink${i}`);
          item.image = val(`sportNewsImage${i}`);
          item.published = val(`sportNewsPublished${i}`);
        }
      });
    }

    if (document.getElementById('bizVlogTag')) {
      ensureHubContent();
      if (!content.pages.business) content.pages.business = {};
      const p = content.pages.business;
      p.vlogHeader = { tag: val('bizVlogTag'), title: val('bizVlogTitle'), description: val('bizVlogDesc') };
      p.advertsHeader = { tag: val('bizAdvertsTag'), title: val('bizAdvertsTitle'), description: val('bizAdvertsDesc') };
      p.investmentsHeader = { tag: val('bizInvTag'), title: val('bizInvTitle'), description: val('bizInvDesc') };
      p.newsHeader = { tag: val('bizNewsTag'), title: val('bizNewsTitle'), description: val('bizNewsDesc') };

      content.business.vlogs.forEach((item, i) => {
        if (document.getElementById(`bizVlogTitle${i}`)) {
          item.title = val(`bizVlogTitle${i}`);
          item.date = val(`bizVlogDate${i}`);
          item.summary = val(`bizVlogSummary${i}`);
          item.videoUrl = val(`bizVlogVideo${i}`);
          item.thumbnail = val(`bizVlogThumb${i}`);
          item.published = val(`bizVlogPublished${i}`);
        }
      });

      content.business.adverts.forEach((item, i) => {
        if (document.getElementById(`bizAdTitle${i}`)) {
          item.title = val(`bizAdTitle${i}`);
          item.description = val(`bizAdDesc${i}`);
          item.category = val(`bizAdCategory${i}`);
          item.image = val(`bizAdImage${i}`);
          item.link = val(`bizAdLink${i}`);
          item.contactEmail = val(`bizAdEmail${i}`);
          item.published = val(`bizAdPublished${i}`);
        }
      });

      content.business.investments.forEach((item, i) => {
        if (document.getElementById(`bizInvTitle${i}`)) {
          item.title = val(`bizInvTitle${i}`);
          item.summary = val(`bizInvSummary${i}`);
          item.amount = val(`bizInvAmount${i}`);
          item.deadline = val(`bizInvDeadline${i}`);
          item.image = val(`bizInvImage${i}`);
          item.status = val(`bizInvStatus${i}`);
          item.link = val(`bizInvLink${i}`);
          item.linkLabel = val(`bizInvLinkLabel${i}`);
        }
      });

      content.business.news.forEach((item, i) => {
        if (document.getElementById(`bizNewsTitle${i}`)) {
          item.title = val(`bizNewsTitle${i}`);
          item.date = val(`bizNewsDate${i}`);
          item.summary = val(`bizNewsSummary${i}`);
          item.link = val(`bizNewsLink${i}`);
          item.image = val(`bizNewsImage${i}`);
          item.published = val(`bizNewsPublished${i}`);
        }
      });
    }

    ['programs', 'welfare', 'sports', 'business', 'events', 'leadership', 'gallery', 'contact', 'join', 'privacy', 'terms'].forEach(key => {
      if (document.getElementById(`heroTag_${key}`) && content.pages?.[key]?.hero) {
        content.pages[key].hero.tag = val(`heroTag_${key}`);
        content.pages[key].hero.title = val(`heroTitle_${key}`);
        content.pages[key].hero.description = val(`heroDesc_${key}`);
      }
    });
  }

  async function publish() {
    if (isPreviewMode) {
      showStatus('Sign in with your admin password to publish. Preview mode can only export JSON.', 'error');
      return;
    }

    collectFromForm();
    const token = getToken();

    if (!token) {
      showStatus('Not authenticated. Sign in again.', 'error');
      return;
    }

    els.publishBtn.disabled = true;
    els.publishBtn.textContent = 'Publishing…';

    try {
      const res = await authFetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Publish failed');
      }

      content.meta.updatedAt = data.updatedAt || new Date().toISOString();
      updateMeta();
      if (data.savedToSupabase && !data.savedToGithub) {
        showStatus('Published to Supabase! Changes are live immediately.', 'success');
      } else if (data.savedToSupabase && data.savedToGithub) {
        showStatus('Published to Supabase and GitHub. Live now; Vercel may redeploy in 1–2 minutes.', 'success');
      } else {
        showStatus('Published to GitHub! Vercel will redeploy in 1–2 minutes.', 'success');
      }
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      els.publishBtn.disabled = false;
      els.publishBtn.textContent = 'Publish Changes';
    }
  }

  function exportJson() {
    collectFromForm();
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showStatus('JSON exported — place in data/content.json and commit.', 'success');
  }

  async function login(password) {
    let res;
    try {
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });
    } catch {
      throw new Error('Cannot reach /api/login. Redeploy on Vercel after adding ADMIN_PASSWORD.');
    }

    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Login API error (${res.status}). Check Vercel deployment logs.`);
    }

    if (!res.ok) {
      const msg = data.error || data.detail || `Login failed (${res.status})`;
      if (res.status === 401) {
        throw new Error(`${msg} — check ADMIN_PASSWORD in Vercel matches exactly (no extra spaces).`);
      }
      throw new Error(msg);
    }

    if (!data.token) {
      throw new Error('Login succeeded but no token returned.');
    }

    setToken(data.token);
    return true;
  }

  function openSectionFromHash() {
    const section = location.hash.replace('#', '');
    if (!section || !SECTION_TITLES[section]) return;
    try {
      collectFromForm();
      renderSection(section);
    } catch (err) {
      console.error('openSectionFromHash:', err);
      renderSection('dashboard');
    }
  }

  function showApp() {
    if (els.loginScreen) {
      els.loginScreen.hidden = true;
      els.loginScreen.classList.add('is-hidden');
    }
    if (els.app) {
      els.app.hidden = false;
      els.app.classList.add('is-visible');
      els.app.removeAttribute('hidden');
    }
  }

  function showLogin(message) {
    if (els.loginScreen) {
      els.loginScreen.hidden = false;
      els.loginScreen.classList.remove('is-hidden');
      els.loginScreen.removeAttribute('hidden');
    }
    if (els.app) {
      els.app.hidden = true;
      els.app.classList.remove('is-visible');
      els.app.setAttribute('hidden', '');
    }
    setToken(null);
    setPreviewMode(false);
    if (message) showLoginError(message);
  }

  async function bootAuthenticated() {
    if (!getToken()) return;

    setLoginStatus('Loading dashboard…');
    try {
      const valid = await verifyAdminSession();
      if (!valid) {
        showLogin('Your admin session expired. Please sign in again.');
        return;
      }

      await loadContent();
      setPreviewMode(false);
      clearLoginMessages();
      showApp();
      openSectionFromHash();
    } catch (err) {
      showLogin(err.message || 'Could not load dashboard. Sign in again.');
    }
  }

  if (!els.loginForm) {
    console.error('Admin login form not found');
    return;
  }

  els.loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearLoginMessages();
    const btn = els.loginSubmitBtn;
    const originalLabel = btn?.textContent || 'Sign In';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Signing in…';
    }
    setLoginStatus('Checking password…');

    try {
      await login(els.password.value);
      sessionStorage.removeItem(PREVIEW_KEY);
      setLoginStatus('Signed in! Opening dashboard…');
      window.location.reload();
    } catch (err) {
      showLoginError(err.message || 'Sign in failed');
      setLoginStatus('');
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    }
  });

  els.logoutBtn.addEventListener('click', () => showLogin());
  els.previewBtn?.addEventListener('click', enterPreview);
  els.publishBtn.addEventListener('click', publish);
  els.exportBtn.addEventListener('click', exportJson);

  document.getElementById('seedSupabaseBtn')?.addEventListener('click', async () => {
    if (isPreviewMode) {
      showStatus('Sign in to load content into Supabase.', 'error');
      return;
    }
    const token = getToken();
    if (!token) return;

    const btn = document.getElementById('seedSupabaseBtn');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/seed-content', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || 'Seed failed');
      showStatus(data.message || 'Content loaded into Supabase.', 'success');
      await loadContent();
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  els.sidebarNav.addEventListener('click', e => {
    const btn = e.target.closest('button[data-section]');
    if (!btn) return;
    collectFromForm();
    renderSection(btn.dataset.section);
    closeAdminSidebar();
  });

  document.getElementById('contentArea')?.addEventListener('click', e => {
    const goto = e.target.closest('[data-goto]');
    if (goto) {
      collectFromForm();
      renderSection(goto.dataset.goto);
      closeAdminSidebar();
    }
  });

  function closeAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open menu');
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function openAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar?.classList.add('is-open');
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.setAttribute('aria-label', 'Close menu');
    if (overlay) {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
    }
  }

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar?.classList.contains('is-open')) closeAdminSidebar();
    else openAdminSidebar();
  });

  document.getElementById('sidebarOverlay')?.addEventListener('click', closeAdminSidebar);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAdminSidebar();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeAdminSidebar();
  });

  if (getToken()) {
    bootAuthenticated();
  } else if (new URLSearchParams(location.search).get('preview') === '1') {
    enterPreview().then(() => openSectionFromHash());
  }
})();

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
    site: 'Site Settings',
    home: 'Home Page',
    about: 'About Page',
    programs: 'Programs',
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
    els.statsGrid.innerHTML = `
      <div class="stat-card"><strong>${upcoming}</strong><span>Upcoming Events</span></div>
      <div class="stat-card"><strong>${past}</strong><span>Past Events</span></div>
      <div class="stat-card"><strong>${content.programs?.length || 0}</strong><span>Programs</span></div>
      <div class="stat-card"><strong>${content.leadership?.length || 0}</strong><span>Leaders</span></div>
    `;
  }

  function renderSitePanel() {
    const s = content.site;
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
        <p><strong>Public site:</strong> Events appear in <strong>Upcoming</strong> and <strong>Past</strong> groups on <a href="../events.html" target="_blank" rel="noopener">events.html</a>. Upcoming events link to the <a href="../book.html" target="_blank" rel="noopener">booking portal</a> (payments coming later).</p>
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
      feeNote: 'Annual membership fee — secure online payment will be integrated in a future update.',
      paymentPlaceholder: 'Online payment (card, bank transfer) coming soon. Submit this form to register — our team will follow up by email.',
      intro: 'Join our growing community across Australia.',
      image: 'assets/hero/brisbane-team.png',
      benefits: ['Chapter events and gatherings', 'Cultural and youth programs', 'Community support network'],
      types: [
        { id: 'full', label: 'Full Member' },
        { id: 'associate', label: 'Associate Member' },
        { id: 'youth', label: 'Youth Member' },
        { id: 'family', label: 'Family Membership' }
      ]
    };
  }

  function getMemberMeta(row) {
    const data = row?.data || {};
    return {
      membershipId: row?.membership_id || data._membershipId || null,
      memberStatus: row?.member_status || data._memberStatus || 'pending'
    };
  }

  function renderMembershipPanel() {
    if (!content.membership) content.membership = defaultMembership();
    const m = content.membership;
    const typeLines = (m.types || []).map(t => t.label).join('\n');
    const benefitLines = (m.benefits || []).join('\n');

    return `
      <div class="card card--notice">
        <p><strong>Public portal:</strong> Members register at <a href="../join.html" target="_blank" rel="noopener">join.html</a>. Approved members sign in at <a href="../members.html" target="_blank" rel="noopener">members.html</a> with their membership ID. <a href="../members.html?preview=1" target="_blank" rel="noopener" class="btn btn--outline btn--sm" style="margin-left:8px">Preview dashboard</a></p>
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

  function defaultExploreLinks() {
    return [
      { href: 'index.html', label: 'Home', desc: 'Chapter homepage' },
      { href: 'about.html', label: 'About', desc: 'Our story and mission' },
      { href: 'programs.html', label: 'Programs', desc: 'Education, culture, and outreach' },
      { href: 'events.html', label: 'Events', desc: 'Public events calendar' },
      { href: 'leadership.html', label: 'Leadership', desc: 'Chapter board and team' },
      { href: 'gallery.html', label: 'Gallery', desc: 'Public photo gallery' },
      { href: 'contact.html', label: 'Contact', desc: 'Get in touch with the chapter' },
      { href: 'book.html', label: 'Book events', desc: 'Reserve places at gatherings' }
    ];
  }

  function defaultMemberPortal() {
    return {
      welcomeTitle: 'Welcome to the Members Dashboard',
      welcomeMessage: 'Access chapter news, event updates, photo albums, and governance portals.',
      feeds: [],
      eventsIntro: 'View upcoming chapter events and manage your bookings.',
      photosIntro: 'Download photos from chapter events. Albums match events on the public gallery.',
      exploreIntro: 'Quick links to public chapter pages and resources.',
      exploreLinks: defaultExploreLinks(),
      elections: {
        nominationOpen: false,
        nominationTitle: 'Nomination Portal',
        nominationPeriod: '',
        nominationMessage: 'Submit your nomination for chapter leadership positions during the nomination period.',
        nominationClosedMessage: 'Nominations are currently closed. You will be notified when the next nomination period opens.',
        nominationUrl: '',
        nominationButtonLabel: 'Open nomination portal',
        nominationPositions: [],
        electionOpen: false,
        electionTitle: 'Election Portal',
        electionPeriod: '',
        electionMessage: 'Cast your vote for chapter leadership during the election period.',
        electionClosedMessage: 'Elections are currently closed. Check back during the election period.',
        electionUrl: '',
        electionButtonLabel: 'Open election portal',
        electionPositions: []
      }
    };
  }

  function renderGovernanceAdminCard(title, idPrefix, dataPrefix, data) {
    const isOpen = Boolean(data[`${dataPrefix}Open`]);
    const positions = data[`${dataPrefix}Positions`] || [];
    const positionLines = positionsToLines(positions);
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
        <details class="mp-admin-accordion governance-admin-positions">
          <summary>
            <span class="mp-admin-accordion__title">Positions list</span>
            <span class="mp-admin-accordion__meta">${positions.length} position(s)</span>
          </summary>
          <div class="mp-admin-accordion__body">
            <p class="form-hint">Enter one position per line. Optional description after a pipe, e.g. <code>Secretary General | Administration and records</code></p>
            ${field('Bulk positions', `mp${idPrefix}Positions`, positionLines, 'textarea', { full: true })}
          </div>
        </details>
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
      </div>
      <div class="card" id="ailcdApplicationsCard">
        <h3>Leadership EOI submissions</h3>
        <p class="form-hint">Loading…</p>
      </div>
    `;
  }

  async function loadEventBookings() {
    const token = getToken();
    if (!token) return [];

    const res = await authFetch('/api/event-bookings');

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not load bookings');
    }

    const data = await res.json();
    return data.bookings || [];
  }

  function renderEventBookingsPanel(bookings, errorMsg) {
    if (errorMsg) {
      return `<h3>Recent bookings</h3><p class="form-hint">${escapeHtml(errorMsg)}</p>`;
    }
    if (!bookings.length) {
      return `<h3>Recent bookings</h3><p class="form-hint">No booking requests yet. Submissions from the booking portal appear here when Supabase is connected.</p>`;
    }

    return `
      <h3>Recent bookings (${bookings.length})</h3>
      <div id="bookingsList">
        ${bookings.slice(0, 20).map(b => `
          <div class="list-item inbox-item ${b.read ? 'inbox-item--read' : ''}" data-id="${escapeHtml(b.id)}">
            <div class="list-item__header">
              <h4>${escapeHtml(b.event_title)}</h4>
              <span class="inbox-item__date">${new Date(b.created_at).toLocaleString()}</span>
            </div>
            <p><strong>${escapeHtml(b.name)}</strong> · ${escapeHtml(b.email)}${b.phone ? ` · ${escapeHtml(b.phone)}` : ''}</p>
            <p class="form-hint">${b.tickets} place(s)${b.notes ? ` · ${escapeHtml(b.notes)}` : ''}</p>
            <button type="button" class="btn btn--outline btn--sm booking-mark-read" data-id="${escapeHtml(b.id)}" data-read="${b.read ? '0' : '1'}">
              ${b.read ? 'Mark unread' : 'Mark read'}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function loadEventBookingsPanel() {
    const card = document.getElementById('eventBookingsCard');
    if (!card) return;

    if (isPreviewMode || !getToken()) {
      card.innerHTML = renderEventBookingsPanel([], 'Sign in to view event bookings.');
      return;
    }

    card.innerHTML = '<h3>Recent bookings</h3><p class="form-hint">Loading…</p>';

    try {
      const bookings = await loadEventBookings();
      card.innerHTML = renderEventBookingsPanel(bookings);
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
          loadEventBookingsPanel();
        });
      });
    } catch (err) {
      if (isAuthError(err)) return;
      card.innerHTML = renderEventBookingsPanel([], err.message);
    }
  }

  async function loadMembershipRegistrations() {
    const token = getToken();
    if (!token) return [];

    const res = await authFetch('/api/membership-registrations');

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Could not load registrations');
    }

    const data = await res.json();
    return data.registrations || [];
  }

  function downloadMembershipCsvClient(registrations) {
    const headers = [
      'Date', 'Name', 'Email', 'Phone', 'State/Chapter', 'Membership Type',
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

  function renderMembershipRegistrationsPanel(registrations, errorMsg) {
    if (errorMsg) {
      return `<h3>Member registrations</h3><p class="form-hint">${escapeHtml(errorMsg)}</p>`;
    }
    if (!registrations.length) {
      return `<h3>Member registrations</h3><p class="form-hint">No registrations yet. Submissions from the join portal appear here when Supabase is connected.</p>`;
    }

    const unread = registrations.filter(r => !r.read).length;

    return `
      <div class="list-item__header">
        <h3>Member registrations (${registrations.length}${unread ? ` · ${unread} new` : ''})</h3>
        <button type="button" class="btn btn--outline btn--sm" id="exportMembershipCsv">Download CSV</button>
      </div>
      <p class="form-hint">View full registration details below. Data is only visible to signed-in admins — use Download CSV to export.</p>
      <div id="membershipRegistrationsList">
        ${registrations.map(r => {
          const meta = getMemberMeta(r);
          return `
          <details class="list-item inbox-item membership-reg-item ${r.read ? 'inbox-item--read' : ''}" data-id="${escapeHtml(r.id)}">
            <summary class="membership-reg-item__summary">
              <span class="membership-reg-item__name">${escapeHtml(r.name)}</span>
              <span class="membership-reg-item__meta">${escapeHtml(r.membership_type || 'Member')} · ${escapeHtml(r.state_chapter || '—')}${meta.membershipId ? ` · ${escapeHtml(meta.membershipId)}` : ''}</span>
              <span class="inbox-item__date">${new Date(r.created_at).toLocaleString()}</span>
            </summary>
            <div class="membership-reg-item__body">
              <div class="form-grid membership-reg-item__grid">
                <p><strong>Email:</strong> ${escapeHtml(r.email)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(r.phone || '—')}</p>
                <p><strong>Membership ID:</strong> ${meta.membershipId ? `<code>${escapeHtml(meta.membershipId)}</code>` : '— (not issued)'}</p>
                <p><strong>Member status:</strong> ${escapeHtml(meta.memberStatus)}</p>
                <p><strong>State / chapter:</strong> ${escapeHtml(r.state_chapter || '—')}</p>
                <p><strong>Membership type:</strong> ${escapeHtml(r.membership_type || '—')}</p>
                <p><strong>Address:</strong> ${escapeHtml(r.address || '—')}</p>
                <p><strong>Date of birth:</strong> ${escapeHtml(r.date_of_birth || '—')}</p>
                <p><strong>Referral:</strong> ${escapeHtml(r.referral_source || '—')}</p>
                <p><strong>Fee at registration:</strong> ${escapeHtml(r.fee_display || '—')}</p>
                <p><strong>Payment status:</strong> ${escapeHtml(r.payment_status || 'pending')}${r.payment_method ? ` (${escapeHtml(r.payment_method)})` : ''}</p>
                ${r.notes ? `<p class="form-field--full"><strong>Notes:</strong> ${escapeHtml(r.notes)}</p>` : ''}
              </div>
              <div class="inbox-item__actions">
                ${!meta.membershipId ? `<button type="button" class="btn btn--primary btn--sm membership-approve" data-id="${escapeHtml(r.id)}">Approve &amp; issue ID</button>` : ''}
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

  async function loadMembershipRegistrationsPanel() {
    const card = document.getElementById('membershipRegistrationsCard');
    if (!card) return;

    if (isPreviewMode || !getToken()) {
      card.innerHTML = renderMembershipRegistrationsPanel([], 'Sign in to view member registrations.');
      return;
    }

    card.innerHTML = '<h3>Member registrations</h3><p class="form-hint">Loading…</p>';

    try {
      const registrations = await loadMembershipRegistrations();
      card.innerHTML = renderMembershipRegistrationsPanel(registrations);

      card.querySelector('#exportMembershipCsv')?.addEventListener('click', () => {
        downloadMembershipCsvClient(registrations);
        showStatus('Membership registrations exported as CSV.', 'success');
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
          loadMembershipRegistrationsPanel();
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

  function renderPagesPanel() {
    const pages = ['programs', 'events', 'leadership', 'gallery', 'contact', 'join', 'privacy', 'terms'];
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

    document.querySelectorAll('.sidebar__nav button').forEach(btn => {
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
        nominationOpen: val('mpNomOpen'),
        nominationTitle: val('mpNomTitle'),
        nominationPeriod: val('mpNomPeriod'),
        nominationMessage: val('mpNomMessage'),
        nominationClosedMessage: val('mpNomClosedMessage'),
        nominationUrl: val('mpNomUrl'),
        nominationButtonLabel: val('mpNomButtonLabel'),
        nominationPositions: parsePositionLines(val('mpNomPositions')),
        electionOpen: val('mpEleOpen'),
        electionTitle: val('mpEleTitle'),
        electionPeriod: val('mpElePeriod'),
        electionMessage: val('mpEleMessage'),
        electionClosedMessage: val('mpEleClosedMessage'),
        electionUrl: val('mpEleUrl'),
        electionButtonLabel: val('mpEleButtonLabel'),
        electionPositions: parsePositionLines(val('mpElePositions'))
      };
    }

    ['programs', 'events', 'leadership', 'gallery', 'contact', 'join', 'privacy', 'terms'].forEach(key => {
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

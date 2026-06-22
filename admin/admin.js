/**
 * Gotabgaa Australia — Admin Dashboard
 */
(function () {
  const TOKEN_KEY = 'gaa_admin_token';
  const PREVIEW_KEY = 'gaa_admin_preview';
  let content = null;
  let activeSection = 'dashboard';
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

  function renderGalleryPanel() {
    const upcoming = content.events.filter(e => e.status === 'upcoming');
    const past = content.events.filter(e => e.status === 'past');

    const renderAlbumSection = (events, label) => {
      if (!events.length) return `<p class="form-hint">No ${label.toLowerCase()} events defined yet — add them in Events.</p>`;
      return events.map(event => renderGalleryEventAlbum(event)).join('');
    };

    return `
      <div class="card card--notice">
        <p><strong>Public site:</strong> Photos are grouped by event on <a href="../gallery.html" target="_blank" rel="noopener">gallery.html</a> (upcoming vs past). Visitors can download photos from the website. Publish after uploading.</p>
        <p class="form-hint">Bulk upload requires Supabase Storage bucket <strong>gallery</strong> (public), or GitHub token for auto-commit to <code>assets/gallery/</code>.</p>
      </div>
      <div class="card">
        <h3>Upcoming event albums</h3>
        ${renderAlbumSection(upcoming, 'Upcoming')}
      </div>
      <div class="card">
        <h3>Past event albums</h3>
        ${renderAlbumSection(past, 'Past')}
      </div>
      <div class="card">
        <h3>All photos (${content.gallery.length})</h3>
        <div id="galleryList">${content.gallery.map((g, i) => galleryItemHtml(g, i)).join('')}</div>
      </div>
    `;
  }

  function renderGalleryEventAlbum(event) {
    const photos = content.gallery.filter(g => g.eventId === event.id);
    const preview = photos.slice(0, 4).map(p =>
      `<img src="../${p.image.replace(/^\//, '')}" alt="" class="gallery-admin-thumb">`
    ).join('');

    return `
      <div class="gallery-admin-album" data-event-id="${escapeHtml(event.id)}">
        <div class="list-item__header">
          <div>
            <h4>${escapeHtml(event.title)}</h4>
            <p class="form-hint">${photos.length} photo(s) · ${event.status}</p>
          </div>
          <div class="gallery-admin-album__actions">
            <label class="btn btn--outline btn--sm">
              Bulk upload
              <input type="file" class="gallery-bulk-input" data-event-id="${escapeHtml(event.id)}" accept="image/*" multiple hidden>
            </label>
            <button type="button" class="btn btn--outline btn--sm" data-add-gallery-photo="${escapeHtml(event.id)}">+ Add photo</button>
          </div>
        </div>
        ${preview ? `<div class="gallery-admin-album__preview">${preview}${photos.length > 4 ? `<span class="form-hint">+${photos.length - 4} more</span>` : ''}</div>` : '<p class="form-hint">No photos for this event yet.</p>'}
        <p class="gallery-admin-upload-status form-hint" id="galleryUploadStatus-${escapeHtml(event.id)}" hidden></p>
      </div>
    `;
  }

  function galleryItemHtml(g, i) {
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

  async function loadEventBookings() {
    const token = getToken();
    if (!token) return [];

    const res = await fetch('/api/event-bookings', {
      headers: { Authorization: `Bearer ${token}` }
    });

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
      card.innerHTML = renderEventBookingsPanel([], err.message);
    }
  }

  async function loadSubmissions() {
    const token = getToken();
    if (!token) return [];

    const res = await fetch('/api/contact-submissions', {
      headers: { Authorization: `Bearer ${token}` }
    });

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
      panel.innerHTML = renderInboxPanel([], err.message);
    }
  }

  function renderPagesPanel() {
    const pages = ['programs', 'events', 'leadership', 'gallery', 'contact', 'privacy', 'terms'];
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
          pages: renderPagesPanel
        };
        panel.innerHTML = renderers[section]?.() || '';
        bindListActions(section);
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
      document.querySelectorAll('.gallery-bulk-input').forEach(input => {
        input.addEventListener('change', () => {
          const eventId = input.dataset.eventId;
          const statusEl = document.getElementById(`galleryUploadStatus-${eventId}`);
          handleGalleryBulkUpload(eventId, input.files, statusEl);
          input.value = '';
        });
      });

      document.querySelectorAll('[data-add-gallery-photo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const eventId = btn.dataset.addGalleryPhoto;
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

    ['programs', 'events', 'leadership', 'gallery', 'contact', 'privacy', 'terms'].forEach(key => {
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
      const res = await fetch('/api/content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
  });

  document.getElementById('contentArea')?.addEventListener('click', e => {
    const goto = e.target.closest('[data-goto]');
    if (goto) {
      collectFromForm();
      renderSection(goto.dataset.goto);
    }
  });

  if (getToken()) {
    bootAuthenticated();
  } else if (new URLSearchParams(location.search).get('preview') === '1') {
    enterPreview().then(() => openSectionFromHash());
  }
})();

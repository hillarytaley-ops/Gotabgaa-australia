/**
 * Registered members dashboard — sign in, feeds, events, photos, governance
 */
(function () {
  const SESSION_KEY = 'gaa_member_session';
  const ADMIN_TOKEN_KEY = 'gaa_admin_token';
  const FEED_LABELS = { news: 'News', sports: 'Sports', business: 'Business', social: 'Social' };

  let siteContent = null;
  let activeFeed = 'all';
  let memberSession = null;
  let isPreviewMode = false;

  const els = {
    gate: document.getElementById('memberGate'),
    dashboard: document.getElementById('memberDashboard'),
    previewBanner: document.getElementById('memberPreviewBanner'),
    previewBtn: document.getElementById('memberPreviewBtn'),
    loginForm: document.getElementById('memberLoginForm'),
    loginError: document.getElementById('memberLoginError'),
    loginBtn: document.getElementById('memberLoginBtn'),
    signOut: document.getElementById('memberSignOut'),
    welcomeTitle: document.getElementById('memberWelcomeTitle'),
    welcomeMessage: document.getElementById('memberWelcomeMessage'),
    memberBadge: document.getElementById('memberBadge'),
    feedList: document.getElementById('feedList'),
    feedFilters: document.getElementById('feedFilters'),
    membershipCard: document.getElementById('membershipCard'),
    eventsList: document.getElementById('eventsList'),
    bookingsList: document.getElementById('bookingsList'),
    photoAlbums: document.getElementById('photoAlbums'),
    governanceCards: document.getElementById('governanceCards'),
    exploreLinks: document.getElementById('exploreLinks'),
    eventsIntro: document.getElementById('eventsIntro'),
    photosIntro: document.getElementById('photosIntro'),
    exploreIntro: document.getElementById('exploreIntro'),
    tabs: document.getElementById('memberTabs')
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    memberSession = session;
    if (isPreviewMode) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    memberSession = null;
    isPreviewMode = false;
    localStorage.removeItem(SESSION_KEY);
  }

  function getAdminToken() {
    try {
      return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  function isPreviewRequested() {
    return new URLSearchParams(window.location.search).get('preview') === '1';
  }

  function setPreviewBanner(visible) {
    if (els.previewBanner) els.previewBanner.hidden = !visible;
  }

  async function enterDeveloperPreview() {
    const token = getAdminToken();
    if (!token) {
      showError('Sign in to the admin panel first, then open preview again.');
      return false;
    }

    const res = await fetch('/api/member-preview', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showError(data.error || 'Could not start developer preview.');
      return false;
    }

    isPreviewMode = true;
    memberSession = data.member;
    showError('');
    setPreviewBanner(true);
    showDashboard();
    return true;
  }

  function showError(msg) {
    if (!els.loginError) return;
    els.loginError.textContent = msg;
    els.loginError.hidden = !msg;
    if (msg) {
      els.loginError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function isPlaceholderMembershipId(id) {
    const value = String(id || '').trim().toUpperCase();
    return !value
      || value === 'GAA-MEM-XXXXXXXX'
      || /X{4,}/.test(value)
      || value.length < 12;
  }

  function showGate() {
    if (els.gate) els.gate.hidden = false;
    if (els.dashboard) els.dashboard.hidden = true;
    setPreviewBanner(false);
  }

  function showDashboard() {
    if (els.gate) els.gate.hidden = true;
    if (els.dashboard) els.dashboard.hidden = false;
    renderDashboard();
  }

  async function fetchContent() {
    if (siteContent) return siteContent;

    const res = await fetch('/api/content').catch(() => fetch('data/content.json'));
    if (!res.ok) throw new Error('Could not load site content');
    siteContent = await res.json();
    return siteContent;
  }

  async function verifyMember(email, membershipId) {
    const params = new URLSearchParams({ email, id: membershipId });
    const res = await fetch(`/api/member-status?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not verify membership');
    return data.member;
  }

  async function fetchBookings(email, membershipId) {
    const params = new URLSearchParams({ email, id: membershipId });
    const res = await fetch(`/api/member-bookings?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return data.bookings || [];
  }

  function downloadPhoto(url, filename) {
    fetch(url, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename || 'gotabgaa-photo.jpg';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => window.open(url, '_blank', 'noopener'));
  }

  function renderFeeds(portal) {
    const feeds = (portal?.feeds || []).slice().sort((a, b) => {
      const da = new Date(a.publishedAt || 0).getTime();
      const db = new Date(b.publishedAt || 0).getTime();
      return db - da;
    });

    const filtered = activeFeed === 'all'
      ? feeds
      : feeds.filter(f => f.category === activeFeed);

    if (!filtered.length) {
      els.feedList.innerHTML = '<p class="members-empty">No posts in this feed yet. Check back soon.</p>';
      return;
    }

    els.feedList.innerHTML = filtered.map(feed => `
      <article class="members-feed-item">
        <div class="members-feed-item__meta">
          <span class="members-feed-item__cat">${escapeHtml(FEED_LABELS[feed.category] || feed.category || 'News')}</span>
          <time datetime="${escapeHtml(feed.publishedAt || '')}">${formatDate(feed.publishedAt)}</time>
        </div>
        <h3>${escapeHtml(feed.title)}</h3>
        <p>${escapeHtml(feed.body).replace(/\n/g, '<br>')}</p>
        ${feed.link ? `<a href="${escapeHtml(feed.link)}" class="members-feed-item__link" target="_blank" rel="noopener">Read more</a>` : ''}
      </article>
    `).join('');
  }

  function renderMembershipCard(member) {
    const statusClass = member.memberStatus === 'active' ? 'is-active' : 'is-pending';
    els.membershipCard.innerHTML = `
      <h3>${escapeHtml(member.name)}</h3>
      <dl class="members-dl">
        <div><dt>Membership ID</dt><dd><code>${escapeHtml(member.membershipId)}</code></dd></div>
        <div><dt>Status</dt><dd><span class="members-status ${statusClass}">${escapeHtml(member.memberStatus || 'pending')}</span></dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(member.email)}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHtml(member.phone || '—')}</dd></div>
        <div><dt>Chapter</dt><dd>${escapeHtml(member.stateChapter || '—')}</dd></div>
        <div><dt>Membership type</dt><dd>${escapeHtml(member.membershipType || '—')}</dd></div>
        <div><dt>Payment</dt><dd>${escapeHtml(member.paymentStatus || 'pending')}</dd></div>
        <div><dt>Fee</dt><dd>${escapeHtml(member.feeDisplay || '—')}</dd></div>
        <div><dt>Registered</dt><dd>${formatDate(member.joinedAt)}</dd></div>
      </dl>
    `;
  }

  function renderEvents(content) {
    const events = (content.events || []).filter(e => e.showOnSite !== false);
    if (!events.length) {
      els.eventsList.innerHTML = '<p class="members-empty">No upcoming events listed.</p>';
      return;
    }

    els.eventsList.innerHTML = events.map(evt => `
      <div class="members-event-item">
        <div class="members-event-item__pill">${escapeHtml(evt.datePill || evt.date || 'Event')}</div>
        <h4>${escapeHtml(evt.title)}</h4>
        <p class="members-event-item__meta">${escapeHtml(evt.time || '')}${evt.location ? ` · ${escapeHtml(evt.location)}` : ''}</p>
        <a href="book.html?id=${encodeURIComponent(evt.id)}" class="btn btn--outline btn--sm">Book / register</a>
      </div>
    `).join('');
  }

  async function renderBookings() {
    if (!memberSession) return;

    if (isPreviewMode) {
      els.bookingsList.innerHTML = '<p class="members-empty">No sample bookings in preview mode. Real members see their event bookings here.</p>';
      return;
    }

    els.bookingsList.innerHTML = '<p class="members-empty">Loading bookings…</p>';

    const bookings = await fetchBookings(memberSession.email, memberSession.membershipId);
    if (!bookings.length) {
      els.bookingsList.innerHTML = '<p class="members-empty">No bookings yet. <a href="book.html">Book an event</a>.</p>';
      return;
    }

    els.bookingsList.innerHTML = bookings.map(b => `
      <div class="members-booking-item">
        <h4>${escapeHtml(b.event_title)}</h4>
        <p class="members-event-item__meta">${formatDate(b.created_at)} · ${b.tickets} place(s)</p>
        ${b.notes ? `<p>${escapeHtml(b.notes)}</p>` : ''}
      </div>
    `).join('');
  }

  function renderPhotos(content) {
    const gallery = content.gallery || [];
    const events = content.events || [];
    const byEvent = {};

    gallery.forEach(item => {
      const key = item.eventId || 'general';
      if (!byEvent[key]) byEvent[key] = [];
      byEvent[key].push(item);
    });

    const keys = Object.keys(byEvent);
    if (!keys.length) {
      els.photoAlbums.innerHTML = '<p class="members-empty">No event photos available yet.</p>';
      return;
    }

    els.photoAlbums.innerHTML = keys.map(eventId => {
      const evt = events.find(e => e.id === eventId);
      const title = evt?.title || eventId.replace(/^evt-/, '').replace(/-/g, ' ');
      const photos = byEvent[eventId];

      return `
        <details class="members-album" open>
          <summary class="members-album__summary">
            <span>${escapeHtml(title)}</span>
            <span class="members-album__count">${photos.length} photo(s)</span>
          </summary>
          <div class="members-album__grid">
            ${photos.map((p, i) => {
              const filename = `${eventId}-${i + 1}.jpg`;
              return `
                <figure class="members-photo">
                  <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.alt || p.caption || 'Event photo')}" loading="lazy">
                  <figcaption>
                    <span>${escapeHtml(p.caption || p.alt || 'Photo')}</span>
                    <button type="button" class="btn btn--outline btn--sm" data-photo-url="${escapeHtml(p.image)}" data-photo-name="${escapeHtml(filename)}">Download</button>
                  </figcaption>
                </figure>
              `;
            }).join('')}
          </div>
        </details>
      `;
    }).join('');

    els.photoAlbums.querySelectorAll('[data-photo-url]').forEach(btn => {
      btn.addEventListener('click', () => {
        downloadPhoto(btn.dataset.photoUrl, btn.dataset.photoName);
      });
    });
  }

  function renderGovernance(portal) {
    const elections = portal?.elections || {};

    function renderPortalCard(type) {
      const isNom = type === 'nomination';
      const open = isNom ? elections.nominationOpen : elections.electionOpen;
      const title = isNom ? elections.nominationTitle : elections.electionTitle;
      const period = isNom ? elections.nominationPeriod : elections.electionPeriod;
      const message = isNom ? elections.nominationMessage : elections.electionMessage;
      const closedMessage = isNom ? elections.nominationClosedMessage : elections.electionClosedMessage;
      const url = isNom ? elections.nominationUrl : elections.electionUrl;
      const buttonLabel = isNom ? elections.nominationButtonLabel : elections.electionButtonLabel;
      const positions = isNom ? elections.nominationPositions : elections.electionPositions;
      const defaultTitle = isNom ? 'Nomination Portal' : 'Election Portal';
      const defaultClosed = isNom
        ? 'Nominations are currently closed. You will be notified when the next nomination period opens.'
        : 'Elections are currently closed. Check back during the election period.';
      const defaultButton = isNom ? 'Open nomination portal' : 'Open election portal';
      const positionsHeading = isNom ? 'Positions open for nomination' : 'Positions open for election';
      const positionsHtml = (positions || []).length
        ? `
          <div class="members-governance-positions">
            <h4>${positionsHeading}</h4>
            <ul class="members-governance-positions__list">
              ${(positions || []).map(p => `
                <li>
                  <strong>${escapeHtml(p.title)}</strong>
                  ${p.description ? `<span>${escapeHtml(p.description)}</span>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        `
        : '';

      if (open) {
        return `
          <div class="members-card members-card--highlight">
            <span class="members-card__badge">Open</span>
            <h3>${escapeHtml(title || defaultTitle)}</h3>
            ${period ? `<p class="members-governance-period">${escapeHtml(period)}</p>` : ''}
            <p>${escapeHtml(message || '')}</p>
            ${positionsHtml}
            ${url
              ? `<a href="${escapeHtml(url)}" class="btn btn--primary" target="_blank" rel="noopener">${escapeHtml(buttonLabel || defaultButton)}</a>`
              : '<p class="members-empty">Portal link will be posted here when available.</p>'}
          </div>
        `;
      }

      return `
        <div class="members-card members-card--muted">
          <h3>${escapeHtml(title || defaultTitle)}</h3>
          ${period ? `<p class="members-governance-period">${escapeHtml(period)}</p>` : ''}
          <p>${escapeHtml(closedMessage || defaultClosed)}</p>
        </div>
      `;
    }

    els.governanceCards.innerHTML = [
      renderPortalCard('nomination'),
      renderPortalCard('election')
    ].join('');
  }

  function renderExploreLinks(portal) {
    const links = portal?.exploreLinks?.length ? portal.exploreLinks : [
      { href: 'index.html', label: 'Home', desc: 'Chapter homepage' },
      { href: 'about.html', label: 'About', desc: 'Our story and mission' },
      { href: 'programs.html', label: 'Programs', desc: 'Education, culture, and outreach' },
      { href: 'events.html', label: 'Events', desc: 'Public events calendar' },
      { href: 'leadership.html', label: 'Leadership', desc: 'Chapter board and team' },
      { href: 'gallery.html', label: 'Gallery', desc: 'Public photo gallery' },
      { href: 'contact.html', label: 'Contact', desc: 'Get in touch with the chapter' },
      { href: 'book.html', label: 'Book events', desc: 'Reserve places at gatherings' }
    ];

    els.exploreLinks.innerHTML = links.map(link => `
      <a href="${link.href}" class="members-quicklink">
        <strong>${escapeHtml(link.label)}</strong>
        <span>${escapeHtml(link.desc)}</span>
      </a>
    `).join('');
  }

  async function renderDashboard() {
    if (!memberSession) return;

    const content = await fetchContent();
    const portal = content.memberPortal || {};

    els.welcomeTitle.textContent = portal.welcomeTitle || `Welcome, ${memberSession.name.split(' ')[0]}`;
    els.welcomeMessage.textContent = portal.welcomeMessage || 'Your member updates and chapter resources.';
    els.memberBadge.textContent = memberSession.membershipId;

    if (els.eventsIntro) {
      els.eventsIntro.textContent = portal.eventsIntro || 'View upcoming chapter events and manage your bookings.';
    }
    if (els.photosIntro) {
      els.photosIntro.textContent = portal.photosIntro || 'Download photos from chapter events. Albums match events on the public gallery.';
    }
    if (els.exploreIntro) {
      els.exploreIntro.textContent = portal.exploreIntro || 'Quick links to public chapter pages and resources.';
    }

    renderFeeds(portal);
    renderMembershipCard(memberSession);
    renderEvents(content);
    renderPhotos(content);
    renderGovernance(portal);
    renderExploreLinks(portal);
    await renderBookings();
  }

  function switchTab(tab) {
    document.querySelectorAll('.members-tabs__btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.members-panel').forEach(panel => {
      const active = panel.dataset.panel === tab;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
  }

  async function handleLogin(e) {
    e.preventDefault();
    showError('');

    const email = document.getElementById('memberEmail')?.value.trim();
    const membershipId = document.getElementById('memberId')?.value.trim().toUpperCase();

    if (!email || !membershipId) {
      showError('Please enter your email and membership ID.');
      return;
    }

    if (isPlaceholderMembershipId(membershipId)) {
      showError('Enter your real membership ID (e.g. GAA-MEM-ABC12345) from admin approval — not the placeholder text.');
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = 'Verifying…';

    try {
      const member = await verifyMember(email, membershipId);
      if (member.memberStatus === 'inactive') {
        showError('Your membership is inactive. Contact the chapter if you believe this is an error.');
        return;
      }
      saveSession(member);
      showDashboard();
    } catch (err) {
      showError(err.message || 'Could not sign in.');
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Access Dashboard';
    }
  }

  async function init() {
    memberSession = loadSession();

    els.loginForm?.addEventListener('submit', handleLogin);

    els.signOut?.addEventListener('click', () => {
      const hadPreviewUrl = isPreviewRequested();
      clearSession();
      setPreviewBanner(false);
      if (hadPreviewUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete('preview');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
      showGate();
      showError('');
    });

    els.previewBtn?.addEventListener('click', async () => {
      els.previewBtn.disabled = true;
      try {
        await enterDeveloperPreview();
      } finally {
        els.previewBtn.disabled = false;
      }
    });

    els.tabs?.addEventListener('click', e => {
      const btn = e.target.closest('.members-tabs__btn');
      if (!btn) return;
      switchTab(btn.dataset.tab);
    });

    els.feedFilters?.addEventListener('click', e => {
      const btn = e.target.closest('[data-feed]');
      if (!btn) return;
      activeFeed = btn.dataset.feed;
      els.feedFilters.querySelectorAll('[data-feed]').forEach(b => {
        b.classList.toggle('is-active', b.dataset.feed === activeFeed);
      });
      fetchContent().then(content => renderFeeds(content.memberPortal));
    });

    if (isPreviewRequested()) {
      const ok = await enterDeveloperPreview();
      if (ok) return;
    }

    if (getAdminToken()) {
      fetch('/api/member-preview', {
        headers: { Authorization: `Bearer ${getAdminToken()}` }
      }).then(res => {
        if (res.ok && els.previewBtn) els.previewBtn.hidden = false;
      }).catch(() => {});
    }

    if (memberSession?.email && memberSession?.membershipId) {
      try {
        const member = await verifyMember(memberSession.email, memberSession.membershipId);
        saveSession(member);
        showDashboard();
      } catch {
        clearSession();
        showGate();
      }
    } else {
      showGate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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
  let welfareData = null;
  let isPreviewMode = false;

  const els = {
    dashboard: document.getElementById('memberDashboard'),
    previewBanner: document.getElementById('memberPreviewBanner'),
    signOut: document.getElementById('memberSignOut'),
    welcomeTitle: document.getElementById('memberWelcomeTitle'),
    welcomeMessage: document.getElementById('memberWelcomeMessage'),
    memberBadge: document.getElementById('memberBadge'),
    memberAvatar: document.getElementById('memberAvatar'),
    memberStats: document.getElementById('memberStats'),
    feedList: document.getElementById('feedList'),
    feedFilters: document.getElementById('feedFilters'),
    membershipCard: document.getElementById('membershipCard'),
    memberPaymentInstructions: document.getElementById('memberPaymentInstructions'),
    eventsList: document.getElementById('eventsList'),
    bookingsList: document.getElementById('bookingsList'),
    photoAlbums: document.getElementById('photoAlbums'),
    governanceCards: document.getElementById('governanceCards'),
    exploreLinks: document.getElementById('exploreLinks'),
    eventsIntro: document.getElementById('eventsIntro'),
    photosIntro: document.getElementById('photosIntro'),
    exploreIntro: document.getElementById('exploreIntro'),
    tabs: document.getElementById('memberTabs'),
    welfareTabBtn: document.getElementById('welfareTabBtn'),
    welfareMemberStatus: document.getElementById('welfareMemberStatus'),
    welfareCommunityAlerts: document.getElementById('welfareCommunityAlerts'),
    welfareReimbursementFormCard: document.getElementById('welfareReimbursementFormCard'),
    welfareReimbursementForm: document.getElementById('welfareReimbursementForm'),
    welfareReimbursementList: document.getElementById('welfareReimbursementList')
  };

  const REIMBURSEMENT_LABELS = {
    submitted: 'Submitted',
    under_review: 'Under review',
    approved: 'Approved',
    paid: 'Paid',
    declined: 'Declined'
  };

  const REIMBURSEMENT_STEPS = ['submitted', 'under_review', 'approved', 'paid'];

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
      window.location.replace('login.html?tab=leadership&return=members&preview=1');
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

  function redirectToLogin() {
    window.location.replace('login.html?return=members');
  }

  function showError(msg) {
    if (msg) console.warn('[members]', msg);
  }

  function showDashboard() {
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

  async function fetchWelfareMember(email, membershipId) {
    if (isPreviewMode) {
      return {
        welfare: {
          packageTitle: 'Family Package (preview)',
          welfareStatus: 'active',
          paymentStatus: 'paid',
          feeDisplay: '$200 AUD / year'
        },
        reimbursements: [],
        alerts: [],
        hasWelfareAccess: true
      };
    }

    const params = new URLSearchParams({ email, id: membershipId });
    const res = await fetch(`/api/welfare-member?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        welfare: null,
        reimbursements: [],
        alerts: [],
        hasWelfareAccess: false,
        apiError: data.error || data.apiError || 'Could not load social welfare data',
        setupRequired: res.status === 500 || res.status === 503 || data.setupRequired
      };
    }
    if (data.setupRequired && data.apiError) {
      return {
        welfare: null,
        reimbursements: [],
        alerts: [],
        hasWelfareAccess: false,
        apiError: data.apiError,
        setupRequired: true
      };
    }
    return data;
  }

  function renderReimbursementProgress(status) {
    if (status === 'declined') {
      return '<p class="members-welfare-progress members-welfare-progress--declined">This request was declined. Contact the welfare team if you have questions.</p>';
    }

    const currentIndex = REIMBURSEMENT_STEPS.indexOf(status);
    return `
      <ol class="members-welfare-progress">
        ${REIMBURSEMENT_STEPS.map((step, i) => {
          const done = currentIndex >= i;
          const active = status === step;
          return `<li class="${done ? 'is-done' : ''}${active ? ' is-active' : ''}">${escapeHtml(REIMBURSEMENT_LABELS[step])}</li>`;
        }).join('')}
      </ol>
    `;
  }

  function renderWelfareDashboard() {
    if (els.welfareTabBtn) els.welfareTabBtn.hidden = false;

    if (!welfareData) {
      if (els.welfareMemberStatus) {
        els.welfareMemberStatus.innerHTML = '<p class="members-empty">Loading social welfare information…</p>';
      }
      return;
    }

    if (welfareData.apiError) {
      if (els.welfareMemberStatus) {
        els.welfareMemberStatus.innerHTML = `
          <h3>Social Welfare</h3>
          <p class="members-empty">${escapeHtml(welfareData.apiError)}</p>
          ${welfareData.setupRequired ? '<p class="form-hint">The site admin may need to run <code>supabase/migrate-welfare.sql</code> in Supabase. You can still <a href="welfare.html">register on the welfare page</a>.</p>' : ''}
        `;
      }
      if (els.welfareCommunityAlerts) els.welfareCommunityAlerts.hidden = true;
      if (els.welfareReimbursementFormCard) els.welfareReimbursementFormCard.hidden = true;
      if (els.welfareReimbursementList) {
        els.welfareReimbursementList.innerHTML = '<p class="members-empty">Reimbursement tracking will appear once welfare is configured.</p>';
      }
      return;
    }

    if (!welfareData.welfare) {
      if (els.welfareMemberStatus) {
        els.welfareMemberStatus.innerHTML = `
          <h3>Social Welfare Membership</h3>
          <p class="members-panel__intro">You are not enrolled in the Gotabgaa Australia Social Welfare program yet. Enrol to access bereavement reimbursement support and confidential community alerts.</p>
          <a href="welfare.html" class="btn btn--primary">Enrol on Welfare Page</a>
          <p class="form-hint" style="margin-top:1rem">Choose a package, complete registration, and pay via PayID. The welfare team will activate your membership after payment is confirmed.</p>
        `;
      }
      if (els.welfareCommunityAlerts) els.welfareCommunityAlerts.hidden = true;
      if (els.welfareReimbursementFormCard) els.welfareReimbursementFormCard.hidden = true;
      if (els.welfareReimbursementList) {
        els.welfareReimbursementList.innerHTML = '<p class="members-empty">Reimbursement requests are available after you enrol and your welfare membership is active.</p>';
      }
      return;
    }

    const w = welfareData.welfare;

    if (w.welfareStatus === 'inactive') {
      if (els.welfareMemberStatus) {
        els.welfareMemberStatus.innerHTML = `
          <h3>Social Welfare Membership</h3>
          <p class="members-empty">Your social welfare membership is inactive. Contact the welfare team at <a href="contact.html">contact.html</a> for assistance.</p>
        `;
      }
      if (els.welfareCommunityAlerts) els.welfareCommunityAlerts.hidden = true;
      if (els.welfareReimbursementFormCard) els.welfareReimbursementFormCard.hidden = true;
      if (els.welfareReimbursementList) els.welfareReimbursementList.innerHTML = '';
      return;
    }

    const statusClass = w.welfareStatus === 'active' ? 'is-active' : 'is-pending';
    const payClass = w.paymentStatus === 'paid' ? 'is-active' : 'is-pending';

    if (els.welfareMemberStatus) {
      els.welfareMemberStatus.innerHTML = `
        <div class="members-profile">
          <div class="members-profile__info">
            <h3>Social Welfare Membership</h3>
            <p class="members-profile__meta">${escapeHtml(w.packageTitle || 'Welfare member')}</p>
          </div>
          <span class="members-status ${statusClass}">${escapeHtml(w.welfareStatus || 'pending')}</span>
        </div>
        <dl class="members-dl members-dl--grid">
          <div><dt>Package</dt><dd>${escapeHtml(w.packageTitle || '—')}</dd></div>
          <div><dt>Welfare status</dt><dd><span class="members-status ${statusClass}">${escapeHtml(w.welfareStatus || 'pending')}</span></dd></div>
          <div><dt>Payment</dt><dd><span class="members-status ${payClass}">${escapeHtml(w.paymentStatus || 'pending')}</span></dd></div>
          <div><dt>Fee</dt><dd>${escapeHtml(w.feeDisplay || '—')}</dd></div>
          ${w.paymentReference && w.paymentStatus !== 'paid' ? `<div><dt>Payment ref</dt><dd><code>${escapeHtml(w.paymentReference)}</code></dd></div>` : ''}
          <div><dt>Enrolled</dt><dd>${formatDate(w.joinedAt)}</dd></div>
        </dl>
        ${w.welfareStatus !== 'active' ? '<p class="members-empty">Your welfare membership is pending activation by the welfare team after payment is confirmed.</p>' : ''}
      `;
    }

    const alerts = welfareData.alerts || [];
    if (els.welfareCommunityAlerts) {
      if (w.welfareStatus === 'active' && alerts.length) {
        els.welfareCommunityAlerts.hidden = false;
        els.welfareCommunityAlerts.innerHTML = `
          <h3>Community alerts</h3>
          ${alerts.map(alert => `
            <div class="members-welfare-alert">
              <span class="members-welfare-alert__icon" aria-hidden="true"></span>
              <div>
                <p>${escapeHtml(alert.message)}</p>
                <time class="members-welfare-alert__time">${formatDate(alert.created_at)}</time>
              </div>
            </div>
          `).join('')}
          <p class="form-hint">Alerts are anonymous — no member details are shared.</p>
        `;
      } else {
        els.welfareCommunityAlerts.hidden = true;
        els.welfareCommunityAlerts.innerHTML = '';
      }
    }

    const isActive = w.welfareStatus === 'active';
    if (els.welfareReimbursementFormCard) {
      els.welfareReimbursementFormCard.hidden = !isActive || isPreviewMode;
    }

    const requests = welfareData.reimbursements || [];
    const hasOpen = requests.some(r => ['submitted', 'under_review', 'approved'].includes(r.status));

    if (els.welfareReimbursementFormCard && hasOpen) {
      els.welfareReimbursementFormCard.hidden = true;
    }

    if (els.welfareReimbursementList) {
      if (!requests.length) {
        els.welfareReimbursementList.innerHTML = '<p class="members-empty">No reimbursement requests yet.</p>';
      } else {
        els.welfareReimbursementList.innerHTML = requests.map(req => `
          <article class="members-welfare-request">
            <div class="members-welfare-request__header">
              <h4>${escapeHtml(req.deceased_name || 'Reimbursement request')}</h4>
              <span class="members-status ${req.status === 'paid' ? 'is-active' : req.status === 'declined' ? 'is-pending' : 'is-pending'}">${escapeHtml(REIMBURSEMENT_LABELS[req.status] || req.status)}</span>
            </div>
            <p class="members-event-item__meta">${escapeHtml(req.relationship || '')}${req.date_of_loss ? ` · ${escapeHtml(req.date_of_loss)}` : ''}</p>
            ${req.summary ? `<p>${escapeHtml(req.summary)}</p>` : ''}
            ${renderReimbursementProgress(req.status)}
            ${req.status_message ? `<p class="form-hint"><strong>Update:</strong> ${escapeHtml(req.status_message)}</p>` : ''}
            <time class="members-welfare-request__date">Submitted ${formatDate(req.created_at)}</time>
          </article>
        `).join('');
      }
    }
  }

  async function submitReimbursementRequest(e) {
    e.preventDefault();
    if (!memberSession || isPreviewMode) return;

    const success = document.getElementById('welfareReimbSuccess');
    const error = document.getElementById('welfareReimbError');
    const btn = document.getElementById('welfareReimbSubmitBtn');

    success.hidden = true;
    error.hidden = true;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    }

    try {
      const res = await fetch('/api/welfare-reimbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: memberSession.email,
          membershipId: memberSession.membershipId,
          deceasedName: document.getElementById('welfDeceasedName').value,
          relationship: document.getElementById('welfRelationship').value,
          dateOfLoss: document.getElementById('welfDateOfLoss').value,
          summary: document.getElementById('welfReimbSummary').value
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit request');

      success.textContent = data.message || 'Request submitted.';
      success.hidden = false;
      els.welfareReimbursementForm?.reset();

      welfareData = await fetchWelfareMember(memberSession.email, memberSession.membershipId);
      renderWelfareDashboard();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit request';
      }
    }
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

  function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'GA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderMemberStats(member, content) {
    if (!els.memberStats) return;
    const upcoming = (content.events || []).filter(e => e.status === 'upcoming' && e.showOnSite !== false).length;
    const payStatus = member.paymentStatus || 'pending';
    const memberStatus = member.memberStatus || 'pending';
    const welfareLabel = getWelfareStatusLabel();

    els.memberStats.innerHTML = `
      <div class="members-stat members-stat--events">
        <span class="members-stat__icon" aria-hidden="true"></span>
        <strong>${upcoming}</strong>
        <span>Upcoming events</span>
      </div>
      <div class="members-stat members-stat--status">
        <span class="members-stat__icon" aria-hidden="true"></span>
        <strong>${escapeHtml(memberStatus)}</strong>
        <span>Member status</span>
      </div>
      <div class="members-stat members-stat--payment">
        <span class="members-stat__icon" aria-hidden="true"></span>
        <strong>${escapeHtml(payStatus)}</strong>
        <span>Payment</span>
      </div>
      <div class="members-stat members-stat--welfare">
        <span class="members-stat__icon" aria-hidden="true"></span>
        <strong>${escapeHtml(welfareLabel)}</strong>
        <span>Social welfare</span>
      </div>
    `;
  }

  function getWelfareStatusLabel() {
    if (!welfareData) return '…';
    if (welfareData.apiError) return 'Unavailable';
    if (!welfareData.welfare) return 'Not enrolled';
    if (welfareData.welfare.welfareStatus === 'active') return 'Active';
    if (welfareData.welfare.welfareStatus === 'inactive') return 'Inactive';
    return 'Pending';
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

    els.feedList.innerHTML = filtered.map(feed => {
      const cat = feed.category || 'news';
      return `
      <article class="members-feed-item members-feed-item--${escapeHtml(cat)}">
        <div class="members-feed-item__accent" aria-hidden="true"></div>
        <div class="members-feed-item__body">
          <div class="members-feed-item__meta">
            <span class="members-feed-item__cat">${escapeHtml(FEED_LABELS[cat] || cat || 'News')}</span>
            <time datetime="${escapeHtml(feed.publishedAt || '')}">${formatDate(feed.publishedAt)}</time>
          </div>
          <h3>${escapeHtml(feed.title)}</h3>
          <p>${escapeHtml(feed.body).replace(/\n/g, '<br>')}</p>
          ${feed.link ? `<a href="${escapeHtml(feed.link)}" class="members-feed-item__link" target="_blank" rel="noopener">Read more →</a>` : ''}
        </div>
      </article>
    `}).join('');
  }

  function renderMembershipCard(member) {
    const statusClass = member.memberStatus === 'active' ? 'is-active' : 'is-pending';
    const payStatus = member.paymentStatus || 'pending';
    const payClass = payStatus === 'paid' ? 'is-active' : 'is-pending';
    els.membershipCard.innerHTML = `
      <div class="members-profile">
        <div class="members-profile__avatar">${escapeHtml(getInitials(member.name))}</div>
        <div class="members-profile__info">
          <h3>${escapeHtml(member.name)}</h3>
          <p class="members-profile__meta">${escapeHtml(member.membershipType || 'Member')} · ${escapeHtml(member.stateChapter || 'Australia')}</p>
        </div>
        <span class="members-status ${statusClass} members-profile__status">${escapeHtml(member.memberStatus || 'pending')}</span>
      </div>
      <dl class="members-dl members-dl--grid">
        <div><dt>Membership ID</dt><dd><code>${escapeHtml(member.membershipId)}</code></dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(member.email)}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHtml(member.phone || '—')}</dd></div>
        <div><dt>State</dt><dd>${escapeHtml(member.stateChapter || '—')}</dd></div>
        <div><dt>Payment</dt><dd><span class="members-status ${payClass}">${escapeHtml(payStatus)}</span></dd></div>
        <div><dt>Fee</dt><dd>${escapeHtml(member.feeDisplay || '—')}</dd></div>
        <div><dt>Registered</dt><dd>${formatDate(member.joinedAt)}</dd></div>
      </dl>
    `;

    const payWrap = els.memberPaymentInstructions;
    if (!payWrap || isPreviewMode) return;

    if (payStatus === 'pending' && member.paymentReference && window.PaymentInstructions) {
      payWrap.hidden = false;
      const payment = siteContent?.payment || {};
      window.PaymentInstructions.render(payWrap, {
        payment,
        amount: member.feeDisplay,
        reference: member.paymentReference,
        title: 'Membership payment pending',
        subtitle: payment.instructions
      });
    } else if (payWrap) {
      payWrap.hidden = true;
      payWrap.innerHTML = '';
    }
  }

  function renderEvents(content) {
    const events = (content.events || []).filter(e => e.showOnSite !== false);
    if (!events.length) {
      els.eventsList.innerHTML = '<p class="members-empty">No upcoming events listed.</p>';
      return;
    }

    els.eventsList.innerHTML = events.map(evt => `
      <div class="members-event-item">
        <div class="members-event-item__date">${escapeHtml(evt.datePill || evt.date || 'Event')}</div>
        <div class="members-event-item__content">
          <h4>${escapeHtml(evt.title)}</h4>
          <p class="members-event-item__meta">${escapeHtml(evt.time || '')}${evt.location ? ` · ${escapeHtml(evt.location)}` : ''}</p>
          <a href="book.html?id=${encodeURIComponent(evt.id)}" class="btn btn--outline btn--sm">Book / register</a>
        </div>
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

    els.bookingsList.innerHTML = bookings.map(b => {
      const payStatus = b.payment_status || (Number(b.fee_amount) > 0 ? 'pending' : 'n/a');
      const ref = b.payment_reference || b.data?.paymentReference || '';
      return `
      <div class="members-booking-item">
        <h4>${escapeHtml(b.event_title)}</h4>
        <p class="members-event-item__meta">${formatDate(b.created_at)} · ${b.tickets} place(s)${b.fee_display ? ` · ${escapeHtml(b.fee_display)}` : ''}</p>
        ${payStatus !== 'n/a' ? `<p class="members-event-item__meta">Payment: ${escapeHtml(payStatus)}${ref ? ` · Ref: <code>${escapeHtml(ref)}</code>` : ''}</p>` : ''}
        ${b.notes ? `<p>${escapeHtml(b.notes)}</p>` : ''}
      </div>
    `}).join('');
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
      { href: 'index.html', label: 'Home', desc: 'Gotabgaa Australia homepage' },
      { href: 'about.html', label: 'About', desc: 'Our story and mission' },
      { href: 'programs.html', label: 'Programs', desc: 'Education, culture, and outreach' },
      { href: 'events.html', label: 'Events', desc: 'Public events calendar' },
      { href: 'leadership.html', label: 'Leadership', desc: 'Board and leadership team' },
      { href: 'gallery.html', label: 'Gallery', desc: 'Public photo gallery' },
      { href: 'contact.html', label: 'Contact', desc: 'Get in touch with us' },
      { href: 'book.html', label: 'Book events', desc: 'Reserve places at gatherings' }
    ];

    els.exploreLinks.innerHTML = links.map(link => `
      <a href="${link.href}" class="members-quicklink">
        <span class="members-quicklink__icon" aria-hidden="true"></span>
        <span class="members-quicklink__text">
          <strong>${escapeHtml(link.label)}</strong>
          <span>${escapeHtml(link.desc)}</span>
        </span>
      </a>
    `).join('');
  }

  async function renderDashboard() {
    if (!memberSession) return;

    const content = await fetchContent();
    const portal = content.memberPortal || {};

    const firstName = memberSession.name.split(' ')[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    els.welcomeTitle.textContent = portal.welcomeTitle || `${greeting}, ${firstName}`;
    els.welcomeMessage.textContent = portal.welcomeMessage || 'Your member updates, events, and community resources in one place.';
    els.memberBadge.textContent = memberSession.membershipId;
    if (els.memberAvatar) {
      els.memberAvatar.textContent = getInitials(memberSession.name);
    }

    renderWelfareDashboard();

    if (els.eventsIntro) {
      els.eventsIntro.textContent = portal.eventsIntro || 'View upcoming Gotabgaa Australia events and manage your bookings.';
    }
    if (els.photosIntro) {
      els.photosIntro.textContent = portal.photosIntro || 'Download photos from community events. Albums match events on the public gallery.';
    }
    if (els.exploreIntro) {
      els.exploreIntro.textContent = portal.exploreIntro || 'Quick links to public Gotabgaa Australia pages and resources.';
    }

    renderFeeds(portal);
    renderMembershipCard(memberSession);
    renderEvents(content);
    renderPhotos(content);
    renderGovernance(portal);
    renderExploreLinks(portal);

    if (memberSession?.email && memberSession?.membershipId) {
      welfareData = await fetchWelfareMember(memberSession.email, memberSession.membershipId);
    }
    renderMemberStats(memberSession, content);
    renderWelfareDashboard();

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

  async function init() {
    memberSession = loadSession();

    els.signOut?.addEventListener('click', () => {
      clearSession();
      setPreviewBanner(false);
      redirectToLogin();
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

    els.welfareReimbursementForm?.addEventListener('submit', submitReimbursementRequest);

    if (isPreviewRequested()) {
      const ok = await enterDeveloperPreview();
      if (ok) return;
    }

    if (memberSession?.email && memberSession?.membershipId) {
      try {
        const member = await verifyMember(memberSession.email, memberSession.membershipId);
        saveSession(member);
        showDashboard();
      } catch {
        clearSession();
        redirectToLogin();
      }
    } else {
      redirectToLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

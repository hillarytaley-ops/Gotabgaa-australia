/**
 * Unified sign-in — members dashboard + leadership admin
 */
(function () {
  const SESSION_KEY = 'gaa_member_session';
  const ADMIN_TOKEN_KEY = 'gaa_admin_token';

  const els = {
    tabs: document.querySelectorAll('.signin-hub__tab'),
    panels: document.querySelectorAll('.signin-hub__panel'),
    memberForm: document.getElementById('memberLoginForm'),
    memberError: document.getElementById('memberLoginError'),
    memberBtn: document.getElementById('memberLoginBtn'),
    adminForm: document.getElementById('adminLoginForm'),
    adminError: document.getElementById('adminLoginError'),
    adminBtn: document.getElementById('adminLoginBtn')
  };

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function loadMemberSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveMemberSession(member) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(member));
  }

  function saveAdminToken(token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function isPlaceholderMembershipId(id) {
    const value = String(id || '').trim().toUpperCase();
    return !value
      || value === 'GAA-MEM-XXXXXXXX'
      || /X{4,}/.test(value)
      || value.length < 12;
  }

  async function verifyMember(email, membershipId) {
    const params = new URLSearchParams({ email, id: membershipId });
    const res = await fetch(`/api/member-status?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not verify membership');
    return data.member;
  }

  function switchTab(tab) {
    const isLeadership = tab === 'leadership';
    els.tabs.forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    els.panels.forEach(panel => {
      const show = panel.id === (isLeadership ? 'panelLeadership' : 'panelMember');
      panel.hidden = !show;
      panel.classList.toggle('is-active', show);
    });
    showError(els.memberError, '');
    showError(els.adminError, '');
  }

  function initTabFromUrl() {
    const tab = getParams().get('tab');
    if (tab === 'leadership' || tab === 'admin') {
      switchTab('leadership');
      return;
    }
    switchTab('member');
  }

  async function redirectIfAlreadySignedIn() {
    const session = loadMemberSession();
    if (session?.email && session?.membershipId) {
      try {
        await verifyMember(session.email, session.membershipId);
        window.location.replace('members.html');
        return true;
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const tab = getParams().get('tab');
    if (token && (tab === 'leadership' || tab === 'admin')) {
      window.location.replace('admin/');
      return true;
    }

    return false;
  }

  async function handleMemberLogin(e) {
    e.preventDefault();
    showError(els.memberError, '');

    const email = document.getElementById('memberEmail')?.value.trim();
    const membershipId = document.getElementById('memberId')?.value.trim().toUpperCase();

    if (!email || !membershipId) {
      showError(els.memberError, 'Please enter your email and membership ID.');
      return;
    }

    if (isPlaceholderMembershipId(membershipId)) {
      showError(els.memberError, 'Enter your real membership ID from admin approval — not the placeholder text.');
      return;
    }

    els.memberBtn.disabled = true;
    els.memberBtn.textContent = 'Verifying…';

    try {
      const member = await verifyMember(email, membershipId);
      if (member.memberStatus === 'inactive') {
        showError(els.memberError, 'Your membership is inactive. Contact Gotabgaa Australia if you believe this is an error.');
        return;
      }
      saveMemberSession(member);
      const dest = getParams().get('return') === 'members' ? 'members.html' : 'members.html';
      window.location.href = dest;
    } catch (err) {
      showError(els.memberError, err.message || 'Could not sign in.');
    } finally {
      els.memberBtn.disabled = false;
      els.memberBtn.textContent = 'Access Dashboard';
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    showError(els.adminError, '');

    const password = document.getElementById('adminPassword')?.value;
    if (!password?.trim()) {
      showError(els.adminError, 'Please enter the admin password.');
      return;
    }

    els.adminBtn.disabled = true;
    els.adminBtn.textContent = 'Signing in…';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Login failed (${res.status})`);
      }
      if (!data.token) {
        throw new Error('Login succeeded but no token returned.');
      }

      saveAdminToken(data.token);

      const params = getParams();
      if (params.get('preview') === '1' || params.get('return') === 'members') {
        window.location.href = 'members.html?preview=1';
        return;
      }
      window.location.href = 'admin/';
    } catch (err) {
      showError(els.adminError, err.message || 'Could not sign in.');
    } finally {
      els.adminBtn.disabled = false;
      els.adminBtn.textContent = 'Open Admin Dashboard';
    }
  }

  async function init() {
    if (await redirectIfAlreadySignedIn()) return;

    initTabFromUrl();

    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', btn.dataset.tab);
        window.history.replaceState(null, '', url.pathname + url.search);
      });
    });

    els.memberForm?.addEventListener('submit', handleMemberLogin);
    els.adminForm?.addEventListener('submit', handleAdminLogin);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

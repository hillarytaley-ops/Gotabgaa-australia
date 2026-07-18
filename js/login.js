/**
 * Unified sign-in — members dashboard + leadership admin
 */
(function () {
  const SESSION_KEY = 'gaa_member_session';
  const ADMIN_TOKEN_KEY = 'gaa_admin_token';
  const REMEMBER_EMAIL_KEY = 'gaa_member_remember_email';

  const els = {
    tabs: document.querySelectorAll('.auth-card__tab, .signin-hub__tab'),
    panels: document.querySelectorAll('.auth-card__panel, .signin-hub__panel'),
    memberForm: document.getElementById('memberLoginForm'),
    memberError: document.getElementById('memberLoginError'),
    memberBtn: document.getElementById('memberLoginBtn'),
    memberEmail: document.getElementById('memberEmail'),
    memberId: document.getElementById('memberId'),
    rememberEmail: document.getElementById('rememberMemberEmail'),
    adminForm: document.getElementById('adminLoginForm'),
    adminError: document.getElementById('adminLoginError'),
    adminBtn: document.getElementById('adminLoginBtn'),
    adminPassword: document.getElementById('adminPassword'),
    togglePassword: document.getElementById('toggleAdminPassword')
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

    window.setTimeout(() => {
      if (isLeadership) els.adminPassword?.focus();
      else els.memberEmail?.focus();
    }, 0);
  }

  function initTabFromUrl() {
    const tab = getParams().get('tab');
    if (tab === 'leadership' || tab === 'admin') {
      switchTab('leadership');
      return;
    }
    switchTab('member');
  }

  function restoreRememberedEmail() {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved && els.memberEmail) {
        els.memberEmail.value = saved;
        if (els.rememberEmail) els.rememberEmail.checked = true;
      }
    } catch {
      /* ignore */
    }
  }

  function persistRememberedEmail(email) {
    try {
      if (els.rememberEmail?.checked && email) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  function initPasswordToggle() {
    if (!els.togglePassword || !els.adminPassword) return;

    els.togglePassword.addEventListener('click', () => {
      const showing = els.adminPassword.type === 'text';
      els.adminPassword.type = showing ? 'password' : 'text';
      els.togglePassword.setAttribute('aria-pressed', showing ? 'false' : 'true');
      els.togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      const showLabel = els.togglePassword.querySelector('[data-show]');
      const hideLabel = els.togglePassword.querySelector('[data-hide]');
      if (showLabel) showLabel.hidden = !showing;
      if (hideLabel) hideLabel.hidden = showing;
    });
  }

  async function redirectIfAlreadySignedIn() {
    const params = getParams();
    const tab = params.get('tab');
    const isLeadership = tab === 'leadership' || tab === 'admin';
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);

    if (isLeadership && token) {
      if (params.get('preview') === '1') {
        window.location.replace('members.html?preview=1');
      } else {
        window.location.replace('admin/');
      }
      return true;
    }

    if (isLeadership) {
      return false;
    }

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

    return false;
  }

  async function handleMemberLogin(e) {
    e.preventDefault();
    showError(els.memberError, '');

    const email = els.memberEmail?.value.trim().toLowerCase();
    const membershipId = els.memberId?.value.trim().toUpperCase();

    if (!email || !membershipId) {
      showError(els.memberError, 'Please enter your email and membership ID.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(els.memberError, 'Please enter a valid email address.');
      els.memberEmail?.focus();
      return;
    }

    if (isPlaceholderMembershipId(membershipId)) {
      showError(els.memberError, 'Enter your real membership ID from admin approval — not the placeholder text.');
      els.memberId?.focus();
      return;
    }

    els.memberBtn.disabled = true;
    els.memberBtn.textContent = 'Signing in…';

    try {
      const member = await verifyMember(email, membershipId);
      if (member.memberStatus === 'inactive') {
        showError(els.memberError, 'Your membership is inactive. Contact Gotabgaa Australia if you believe this is an error.');
        return;
      }
      persistRememberedEmail(email);
      saveMemberSession(member);
      window.location.href = 'members.html';
    } catch (err) {
      showError(els.memberError, err.message || 'Could not sign in. Check your email and membership ID.');
    } finally {
      els.memberBtn.disabled = false;
      els.memberBtn.textContent = 'Sign in';
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    showError(els.adminError, '');

    const password = els.adminPassword?.value;
    if (!password?.trim()) {
      showError(els.adminError, 'Please enter your password.');
      els.adminPassword?.focus();
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
        throw new Error(data.error || `Sign in failed (${res.status})`);
      }
      if (!data.token) {
        throw new Error('Sign in succeeded but no token returned.');
      }

      saveAdminToken(data.token);

      if (getParams().get('preview') === '1') {
        window.location.href = 'members.html?preview=1';
        return;
      }
      window.location.href = 'admin/';
    } catch (err) {
      showError(els.adminError, err.message || 'Could not sign in. Check your password and try again.');
    } finally {
      els.adminBtn.disabled = false;
      els.adminBtn.textContent = 'Sign in';
    }
  }

  async function init() {
    if (await redirectIfAlreadySignedIn()) return;

    initTabFromUrl();
    restoreRememberedEmail();
    initPasswordToggle();

    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', btn.dataset.tab);
        if (btn.dataset.tab === 'leadership') {
          url.searchParams.delete('return');
        }
        window.history.replaceState(null, '', url.pathname + url.search);
      });
    });

    els.memberForm?.addEventListener('submit', handleMemberLogin);
    els.adminForm?.addEventListener('submit', handleAdminLogin);

    if (els.memberId) {
      els.memberId.addEventListener('input', () => {
        const start = els.memberId.selectionStart;
        const end = els.memberId.selectionEnd;
        els.memberId.value = els.memberId.value.toUpperCase();
        if (typeof start === 'number' && typeof end === 'number') {
          els.memberId.setSelectionRange(start, end);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

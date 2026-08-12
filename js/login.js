/**
 * Unified sign-in — Supabase Auth (members) + leadership admin
 */
(function () {
  const SESSION_KEY = 'gaa_member_session';
  const ADMIN_TOKEN_KEY = 'gaa_admin_token';
  const REMEMBER_EMAIL_KEY = 'gaa_member_remember_email';

  const els = {
    tabs: document.querySelectorAll('.auth-card__tab'),
    panels: document.querySelectorAll('.auth-card__panel'),
    memberForm: document.getElementById('memberLoginForm'),
    memberError: document.getElementById('memberLoginError'),
    memberSuccess: document.getElementById('memberLoginSuccess'),
    memberBtn: document.getElementById('memberLoginBtn'),
    memberEmail: document.getElementById('memberEmail'),
    memberPassword: document.getElementById('memberPassword'),
    rememberEmail: document.getElementById('rememberMemberEmail'),
    forgotBtn: document.getElementById('forgotPasswordBtn'),
    toggleMemberPassword: document.getElementById('toggleMemberPassword'),
    adminForm: document.getElementById('adminLoginForm'),
    adminError: document.getElementById('adminLoginError'),
    adminBtn: document.getElementById('adminLoginBtn'),
    adminPassword: document.getElementById('adminPassword'),
    toggleAdminPassword: document.getElementById('toggleAdminPassword'),
    forgotAdminBtn: document.getElementById('forgotAdminPasswordBtn'),
    adminPasswordHelp: document.getElementById('adminPasswordHelp'),
    switchToMemberForgot: document.getElementById('switchToMemberForgot')
  };

  function getParams() {
    return new URLSearchParams(window.location.search);
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

  function showSuccess(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function bindPasswordToggle(button, input) {
    if (!button || !input) return;
    button.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.setAttribute('aria-pressed', showing ? 'false' : 'true');
      button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      const showLabel = button.querySelector('[data-show]');
      const hideLabel = button.querySelector('[data-hide]');
      if (showLabel) showLabel.hidden = !showing;
      if (hideLabel) hideLabel.hidden = showing;
    });
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
    showSuccess(els.memberSuccess, '');
    setAdminPasswordHelp(false);

    window.setTimeout(() => {
      if (isLeadership) els.adminPassword?.focus();
      else els.memberEmail?.focus();
    }, 0);
  }

  function setAdminPasswordHelp(open) {
    if (!els.adminPasswordHelp || !els.forgotAdminBtn) return;
    els.adminPasswordHelp.hidden = !open;
    els.forgotAdminBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
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

  async function fetchMemberProfile(accessToken) {
    const res = await fetch('/api/member-status', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not load membership profile');
    return data.member;
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

    if (isLeadership) return false;

    if (!window.GaaAuth) return false;

    try {
      const session = await window.GaaAuth.getSession();
      if (!session?.access_token) return false;
      const member = await fetchMemberProfile(session.access_token);
      saveMemberSession(member);
      window.location.replace('members.html');
      return true;
    } catch {
      try { await window.GaaAuth.signOut(); } catch { /* ignore */ }
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
  }

  async function handleMemberLogin(e) {
    e.preventDefault();
    showError(els.memberError, '');
    showSuccess(els.memberSuccess, '');

    const email = els.memberEmail?.value.trim().toLowerCase();
    const password = els.memberPassword?.value || '';

    if (!email || !password) {
      showError(els.memberError, 'Please enter your email and password.');
      return;
    }

    if (!window.GaaAuth) {
      showError(els.memberError, 'Sign-in is not ready. Refresh the page and try again.');
      return;
    }

    els.memberBtn.disabled = true;
    els.memberBtn.textContent = 'Signing in…';

    try {
      const { data, error } = await window.GaaAuth.signInWithPassword(email, password);
      if (error) throw error;
      if (!data?.session?.access_token) throw new Error('Sign in succeeded but no session was created.');

      const member = await fetchMemberProfile(data.session.access_token);
      if (member.memberStatus === 'inactive') {
        await window.GaaAuth.signOut();
        showError(els.memberError, 'Your membership is inactive. Contact Gotabgaa Australia if you believe this is an error.');
        return;
      }

      persistRememberedEmail(email);
      saveMemberSession(member);
      window.location.href = 'members.html';
    } catch (err) {
      const msg = String(err.message || '');
      if (/invalid login credentials/i.test(msg)) {
        showError(els.memberError, 'Incorrect email or password. Use Forgot password if you still need to set one up.');
      } else if (/Auth is not configured|SUPABASE_ANON/i.test(msg)) {
        showError(els.memberError, 'Member sign-in is not configured yet. Ask an admin to add SUPABASE_ANON_KEY in Vercel.');
      } else {
        showError(els.memberError, msg || 'Could not sign in.');
      }
    } finally {
      els.memberBtn.disabled = false;
      els.memberBtn.textContent = 'Sign in';
    }
  }

  async function handleForgotPassword() {
    showError(els.memberError, '');
    showSuccess(els.memberSuccess, '');

    const email = els.memberEmail?.value.trim().toLowerCase();
    if (!email) {
      showError(els.memberError, 'Enter your email address first, then click Forgot password.');
      els.memberEmail?.focus();
      return;
    }

    if (!window.GaaAuth) {
      showError(els.memberError, 'Sign-in is not ready. Refresh the page and try again.');
      return;
    }

    els.forgotBtn.disabled = true;
    try {
      const { error } = await window.GaaAuth.resetPasswordForEmail(email);
      if (error) throw error;
      showSuccess(els.memberSuccess, 'If that email has a member account, we sent a password reset link. Check your inbox.');
    } catch (err) {
      showError(els.memberError, err.message || 'Could not send reset email.');
    } finally {
      els.forgotBtn.disabled = false;
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
      if (!res.ok) throw new Error(data.error || `Sign in failed (${res.status})`);
      if (!data.token) throw new Error('Sign in succeeded but no token returned.');

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
    if (getParams().get('password') === 'updated') {
      showSuccess(els.memberSuccess, 'Password updated. Sign in with your email and new password.');
    }

    if (await redirectIfAlreadySignedIn()) return;

    initTabFromUrl();
    restoreRememberedEmail();
    bindPasswordToggle(els.toggleMemberPassword, els.memberPassword);
    bindPasswordToggle(els.toggleAdminPassword, els.adminPassword);

    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', btn.dataset.tab);
        if (btn.dataset.tab === 'leadership') url.searchParams.delete('return');
        window.history.replaceState(null, '', url.pathname + url.search);
      });
    });

    els.memberForm?.addEventListener('submit', handleMemberLogin);
    els.adminForm?.addEventListener('submit', handleAdminLogin);
    els.forgotBtn?.addEventListener('click', handleForgotPassword);
    els.forgotAdminBtn?.addEventListener('click', () => {
      const open = els.adminPasswordHelp?.hidden !== false;
      setAdminPasswordHelp(open);
      if (open) {
        els.adminPasswordHelp?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    els.switchToMemberForgot?.addEventListener('click', () => {
      switchTab('member');
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'member');
      window.history.replaceState(null, '', url.pathname + url.search);
      els.memberEmail?.focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

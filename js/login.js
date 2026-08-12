/**
 * Unified sign-in — one email/password for members.
 * Leadership admin access is granted in the admin Membership panel;
 * those users choose Members or Admin after signing in.
 */
(function () {
  const SESSION_KEY = 'gaa_member_session';
  const ADMIN_TOKEN_KEY = 'gaa_admin_token';
  const REMEMBER_EMAIL_KEY = 'gaa_member_remember_email';
  const PENDING_ADMIN_KEY = 'gaa_pending_admin_choice';

  const els = {
    panelSignIn: document.getElementById('panelSignIn'),
    panelRoleSelect: document.getElementById('panelRoleSelect'),
    memberForm: document.getElementById('memberLoginForm'),
    memberError: document.getElementById('memberLoginError'),
    memberSuccess: document.getElementById('memberLoginSuccess'),
    memberBtn: document.getElementById('memberLoginBtn'),
    memberEmail: document.getElementById('memberEmail'),
    memberPassword: document.getElementById('memberPassword'),
    rememberEmail: document.getElementById('rememberMemberEmail'),
    forgotBtn: document.getElementById('forgotPasswordBtn'),
    toggleMemberPassword: document.getElementById('toggleMemberPassword'),
    roleSelectHint: document.getElementById('roleSelectHint'),
    roleSelectError: document.getElementById('roleSelectError'),
    goMembersDash: document.getElementById('goMembersDash'),
    goAdminDash: document.getElementById('goAdminDash'),
    roleSelectBack: document.getElementById('roleSelectBack')
  };

  let pendingMember = null;
  let pendingAccessToken = null;

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

  function clearAdminToken() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
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

  function showSignInPanel() {
    if (els.panelSignIn) {
      els.panelSignIn.hidden = false;
      els.panelSignIn.classList.add('is-active');
    }
    if (els.panelRoleSelect) {
      els.panelRoleSelect.hidden = true;
      els.panelRoleSelect.classList.remove('is-active');
    }
    showError(els.roleSelectError, '');
  }

  function showRoleChooser(member) {
    pendingMember = member;
    if (els.panelSignIn) {
      els.panelSignIn.hidden = true;
      els.panelSignIn.classList.remove('is-active');
    }
    if (els.panelRoleSelect) {
      els.panelRoleSelect.hidden = false;
      els.panelRoleSelect.classList.add('is-active');
    }
    if (els.roleSelectHint) {
      els.roleSelectHint.textContent = member?.name
        ? `Welcome, ${member.name}. You can open the members area or the leadership admin dashboard.`
        : 'You have access to both areas. Pick a dashboard to continue.';
    }
    const adminOnly = member?.membershipId === 'ADMIN';
    if (els.goMembersDash) {
      els.goMembersDash.disabled = adminOnly;
      els.goMembersDash.hidden = adminOnly;
    }
    showError(els.roleSelectError, '');
    try { sessionStorage.setItem(PENDING_ADMIN_KEY, '1'); } catch { /* ignore */ }
  }

  function preferredDestination(member) {
    const params = getParams();
    const wantAdmin = params.get('tab') === 'leadership'
      || params.get('tab') === 'admin'
      || params.get('dest') === 'admin';
    if (wantAdmin && member?.adminAccess) return 'admin';
    if (params.get('preview') === '1') return 'members-preview';
    return 'members';
  }

  function goMembers(preview) {
    window.location.href = preview ? 'members.html?preview=1' : 'members.html';
  }

  async function openAdminDashboard() {
    showError(els.roleSelectError, '');
    if (!pendingAccessToken && window.GaaAuth) {
      const session = await window.GaaAuth.getSession();
      pendingAccessToken = session?.access_token || null;
    }
    if (!pendingAccessToken) {
      showError(els.roleSelectError, 'Your session expired. Sign in again.');
      showSignInPanel();
      return;
    }

    if (els.goAdminDash) els.goAdminDash.disabled = true;

    try {
      const res = await fetch('/api/admin-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pendingAccessToken}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not open admin dashboard');
      if (!data.token) throw new Error('Admin session was not created.');
      saveAdminToken(data.token);
      try { sessionStorage.removeItem(PENDING_ADMIN_KEY); } catch { /* ignore */ }
      window.location.href = 'admin/';
    } catch (err) {
      showError(els.roleSelectError, err.message || 'Could not open admin dashboard.');
      if (els.goAdminDash) els.goAdminDash.disabled = false;
    }
  }

  function continueAfterLogin(member, accessToken) {
    pendingAccessToken = accessToken;
    saveMemberSession(member);
    const dest = preferredDestination(member);
    const adminOnly = member?.membershipId === 'ADMIN' || member?.allowlistedAdminOnly;

    if (member.adminAccess) {
      if (dest === 'admin' || adminOnly) {
        openAdminDashboard();
        return;
      }
      showRoleChooser(member);
      return;
    }

    goMembers(dest === 'members-preview');
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
    if (!window.GaaAuth) return false;

    try {
      const session = await window.GaaAuth.getSession();
      if (!session?.access_token) return false;
      const member = await fetchMemberProfile(session.access_token);
      saveMemberSession(member);
      pendingAccessToken = session.access_token;

      const dest = preferredDestination(member);
      if (member.adminAccess && dest === 'admin') {
        openAdminDashboard();
        return true;
      }
      if (member.adminAccess && dest !== 'members-preview') {
        showRoleChooser(member);
        return true;
      }

      window.location.replace(dest === 'members-preview' ? 'members.html?preview=1' : 'members.html');
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
      continueAfterLogin(member, data.session.access_token);
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
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send reset email.');
      showSuccess(
        els.memberSuccess,
        data.message || 'If that email has an account, we sent a password link. Check inbox and spam.'
      );
    } catch (err) {
      showError(els.memberError, err.message || 'Could not send reset email.');
    } finally {
      els.forgotBtn.disabled = false;
    }
  }

  async function handleRoleBack() {
    try { sessionStorage.removeItem(PENDING_ADMIN_KEY); } catch { /* ignore */ }
    clearAdminToken();
    localStorage.removeItem(SESSION_KEY);
    pendingMember = null;
    pendingAccessToken = null;
    try { await window.GaaAuth?.signOut(); } catch { /* ignore */ }
    showSignInPanel();
    els.memberPassword && (els.memberPassword.value = '');
    els.memberEmail?.focus();
  }

  async function init() {
    if (getParams().get('password') === 'updated') {
      showSuccess(els.memberSuccess, 'Password updated. Sign in with your email and new password.');
    }

    if (await redirectIfAlreadySignedIn()) return;

    showSignInPanel();
    restoreRememberedEmail();
    bindPasswordToggle(els.toggleMemberPassword, els.memberPassword);

    els.memberForm?.addEventListener('submit', handleMemberLogin);
    els.forgotBtn?.addEventListener('click', handleForgotPassword);
    els.goMembersDash?.addEventListener('click', () => {
      try { sessionStorage.removeItem(PENDING_ADMIN_KEY); } catch { /* ignore */ }
      goMembers(getParams().get('preview') === '1');
    });
    els.goAdminDash?.addEventListener('click', openAdminDashboard);
    els.roleSelectBack?.addEventListener('click', handleRoleBack);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

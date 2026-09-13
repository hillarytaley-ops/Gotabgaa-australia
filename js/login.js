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

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      if (showLabel && hideLabel) {
        showLabel.hidden = !showing;
        hideLabel.hidden = showing;
      } else {
        button.textContent = showing ? 'Show' : 'Hide';
      }
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
    // Review-pass / dual-role users keep both choices visible
    if (els.goMembersDash) {
      els.goMembersDash.disabled = false;
      els.goMembersDash.hidden = false;
    }
    if (els.goAdminDash) {
      els.goAdminDash.disabled = false;
      els.goAdminDash.hidden = !member?.adminAccess;
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

    if (member.adminAccess) {
      if (dest === 'admin') {
        openAdminDashboard();
        return;
      }
      // Dual access (including founder review pass): choose Members or Admin
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
        showError(els.memberError, 'Incorrect email or password. Use Reset or set password if you still need to set one up.');
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

  function renderSetupLink(message, setupLink, emailSent) {
    if (!els.memberSuccess || !setupLink) return;
    showSuccess(els.memberSuccess, '');
    els.memberSuccess.hidden = false;
    els.memberSuccess.innerHTML = `
      <span>${escapeHtml(message || 'Use this link to set your password.')}</span>
      <p style="margin:12px 0 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <a href="${escapeHtml(setupLink)}" class="auth-glass__submit" style="display:inline-block;width:auto;padding:10px 16px;text-decoration:none;text-align:center">Set password now →</a>
        <button type="button" class="auth-glass__link" id="copySetupLinkBtn">Copy link</button>
      </p>
      ${emailSent ? '<p style="margin:8px 0 0;opacity:.85">We also emailed this link — check inbox and spam.</p>' : ''}
    `;
    document.getElementById('copySetupLinkBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(setupLink);
        els.memberSuccess.hidden = false;
        els.memberSuccess.innerHTML = `
          <span>Link copied — open it or paste into a browser.</span>
          <p style="margin:12px 0 0">
            <a href="${escapeHtml(setupLink)}" class="auth-glass__submit" style="display:inline-block;width:auto;padding:10px 16px;text-decoration:none;text-align:center">Set password now →</a>
          </p>
        `;
      } catch {
        window.prompt('Copy this link:', setupLink);
      }
    });
  }

  async function handleForgotPassword(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    showError(els.memberError, '');
    showSuccess(els.memberSuccess, '');

    const email = els.memberEmail?.value.trim().toLowerCase();
    if (!email) {
      showError(els.memberError, 'Enter your email address first, then click Reset or set password.');
      els.memberEmail?.focus();
      return;
    }

    if (els.forgotBtn) {
      els.forgotBtn.disabled = true;
      els.forgotBtn.textContent = 'Sending link…';
    }
    try {
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send reset email.');

      if (data.setupLink) {
        renderSetupLink(data.message, data.setupLink, data.emailSent);
        return;
      }

      showSuccess(
        els.memberSuccess,
        data.message || 'If that email has an account, we sent a password link. Check inbox and spam.'
      );
    } catch (err) {
      showError(els.memberError, err.message || 'Could not send reset email.');
    } finally {
      if (els.forgotBtn) {
        els.forgotBtn.disabled = false;
        els.forgotBtn.textContent = 'Reset or set password';
      }
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
    // Bind UI handlers first — never wait on Auth/session before Forgot password works.
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

    if (getParams().get('password') === 'updated') {
      showSuccess(els.memberSuccess, 'Password updated. Sign in with your email and new password.');
    }

    try {
      await redirectIfAlreadySignedIn();
    } catch {
      /* stay on sign-in form */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

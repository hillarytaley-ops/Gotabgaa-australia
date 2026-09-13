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
    panelAdmin: document.getElementById('panelAdmin'),
    panelRoleSelect: document.getElementById('panelRoleSelect'),
    tabSignIn: document.getElementById('tabSignIn'),
    tabAdmin: document.getElementById('tabAdmin'),
    signInLead: document.getElementById('signInLead'),
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
    roleSelectBack: document.getElementById('roleSelectBack'),
    adminUseMemberSignInBtn: document.getElementById('adminUseMemberSignInBtn'),
    continueMemberAdminBtn: document.getElementById('continueMemberAdminBtn'),
    memberAdminHint: document.getElementById('memberAdminHint'),
    adminBootstrapForm: document.getElementById('adminBootstrapForm'),
    adminBootstrapPassword: document.getElementById('adminBootstrapPassword'),
    adminBootstrapError: document.getElementById('adminBootstrapError'),
    adminBootstrapBtn: document.getElementById('adminBootstrapBtn'),
    adminPreviewBtn: document.getElementById('adminPreviewBtn'),
    bootstrapDetails: document.getElementById('bootstrapDetails')
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

  function friendlyClientError(err, fallback) {
    const raw = String(err?.message || err || '');
    if (/fetch failed|Failed to fetch|NetworkError|Load failed|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
      return 'Cannot reach the member login service (Supabase). In Vercel, check SUPABASE_URL — the project must still exist at that address — then Redeploy.';
    }
    return raw || fallback;
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

  function setAuthTab(which) {
    const isAdmin = which === 'admin';
    els.tabSignIn?.classList.toggle('is-active', !isAdmin);
    els.tabAdmin?.classList.toggle('is-active', isAdmin);
    if (els.tabSignIn) {
      if (!isAdmin) els.tabSignIn.setAttribute('aria-current', 'page');
      else els.tabSignIn.removeAttribute('aria-current');
    }
    if (els.tabAdmin) {
      if (isAdmin) els.tabAdmin.setAttribute('aria-current', 'page');
      else els.tabAdmin.removeAttribute('aria-current');
    }
  }

  function hideAllAuthPanels() {
    [els.panelSignIn, els.panelAdmin, els.panelRoleSelect].forEach(panel => {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove('is-active');
    });
  }

  function showSignInPanel(opts = {}) {
    hideAllAuthPanels();
    setAuthTab('signin');
    if (els.panelSignIn) {
      els.panelSignIn.hidden = false;
      els.panelSignIn.classList.add('is-active');
    }
    if (opts.forAdmin && els.signInLead) {
      els.signInLead.innerHTML = 'Sign in with your member email to open <strong>Leadership admin</strong>. First time? Use <strong>Reset or set password</strong> below.';
    } else if (els.signInLead) {
      els.signInLead.innerHTML = 'Sign in with the email from your Gotabgaa Australia registration. First time? Use <strong>Reset or set password</strong> below.';
    }
    showError(els.roleSelectError, '');
  }

  function showAdminPanel() {
    hideAllAuthPanels();
    setAuthTab('admin');
    if (els.panelAdmin) {
      els.panelAdmin.hidden = false;
      els.panelAdmin.classList.add('is-active');
    }
    offerMemberAdminContinue();
  }

  function showRoleChooser(member) {
    pendingMember = member;
    hideAllAuthPanels();
    setAuthTab('signin');
    if (els.panelRoleSelect) {
      els.panelRoleSelect.hidden = false;
      els.panelRoleSelect.classList.add('is-active');
    }
    if (els.roleSelectHint) {
      els.roleSelectHint.textContent = member?.name
        ? `Welcome, ${member.name}. You can open the members area or the leadership admin dashboard.`
        : 'You have access to both areas. Pick a dashboard to continue.';
    }
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
    const errEl = (els.panelRoleSelect && !els.panelRoleSelect.hidden)
      ? els.roleSelectError
      : els.adminBootstrapError;
    showError(errEl, '');
    if (!pendingAccessToken && window.GaaAuth) {
      const session = await window.GaaAuth.getSession();
      pendingAccessToken = session?.access_token || null;
    }
    if (!pendingAccessToken) {
      showError(errEl, 'Your session expired. Sign in again.');
      showSignInPanel({ forAdmin: true });
      return;
    }

    if (els.goAdminDash) els.goAdminDash.disabled = true;
    if (els.continueMemberAdminBtn) els.continueMemberAdminBtn.disabled = true;

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
      showError(errEl, friendlyClientError(err, 'Could not open admin dashboard.'));
      if (els.goAdminDash) els.goAdminDash.disabled = false;
      if (els.continueMemberAdminBtn) {
        els.continueMemberAdminBtn.disabled = false;
        els.continueMemberAdminBtn.textContent = 'Continue with my member sign-in';
      }
    }
  }

  function continueAfterLogin(member, accessToken) {
    pendingAccessToken = accessToken;
    saveMemberSession(member);
    const dest = preferredDestination(member);

    if (dest === 'admin' && !member.adminAccess) {
      showError(
        els.memberError,
        'Signed in, but this account does not have leadership admin access yet. Ask an admin to grant access, or use Members dashboard.'
      );
      return;
    }

    if (member.adminAccess) {
      if (dest === 'admin') {
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
        showError(els.memberError, 'Incorrect email or password. Use Reset or set password if you still need to set one up.');
      } else if (/Auth is not configured|SUPABASE_ANON/i.test(msg)) {
        showError(els.memberError, 'Member sign-in is not configured yet. Ask an admin to add SUPABASE_ANON_KEY in Vercel.');
      } else {
        showError(els.memberError, friendlyClientError(err, 'Could not sign in.'));
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
      showError(els.memberError, friendlyClientError(err, 'Could not send reset email.'));
    } finally {
      if (els.forgotBtn) {
        els.forgotBtn.disabled = false;
        els.forgotBtn.textContent = 'Reset or set password';
      }
    }
  }

  async function offerMemberAdminContinue() {
    const btn = els.continueMemberAdminBtn;
    const hint = els.memberAdminHint;
    if (!btn) return;
    btn.hidden = true;
    if (hint) hint.hidden = true;
    if (!window.GaaAuth) return;
    try {
      const session = await window.GaaAuth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) return;
      pendingAccessToken = session.access_token;
      btn.hidden = false;
      if (hint) hint.hidden = false;
    } catch {
      /* ignore */
    }
  }

  async function handleContinueMemberAdmin() {
    showError(els.adminBootstrapError, '');
    if (els.continueMemberAdminBtn) {
      els.continueMemberAdminBtn.disabled = true;
      els.continueMemberAdminBtn.textContent = 'Opening…';
    }
    try {
      if (!pendingAccessToken && window.GaaAuth) {
        const session = await window.GaaAuth.getSession();
        pendingAccessToken = session?.access_token || null;
      }
      if (!pendingAccessToken) throw new Error('No member session found. Sign in with email & password first.');
      await openAdminDashboard();
    } catch (err) {
      showError(els.adminBootstrapError, friendlyClientError(err, 'Could not open admin.'));
      if (els.continueMemberAdminBtn) {
        els.continueMemberAdminBtn.disabled = false;
        els.continueMemberAdminBtn.textContent = 'Continue with my member sign-in';
      }
    }
  }

  async function handleBootstrapLogin(e) {
    e?.preventDefault?.();
    showError(els.adminBootstrapError, '');
    const password = els.adminBootstrapPassword?.value || '';
    if (!password.trim()) {
      showError(els.adminBootstrapError, 'Enter the bootstrap admin password.');
      return;
    }
    if (els.adminBootstrapBtn) {
      els.adminBootstrapBtn.disabled = true;
      els.adminBootstrapBtn.textContent = 'Signing in…';
    }
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Bootstrap sign in failed');
      }
      if (!data.token) throw new Error('Login succeeded but no token returned.');
      saveAdminToken(data.token);
      window.location.href = 'admin/';
    } catch (err) {
      showError(els.adminBootstrapError, friendlyClientError(err, 'Bootstrap sign in failed.'));
      if (els.adminBootstrapBtn) {
        els.adminBootstrapBtn.disabled = false;
        els.adminBootstrapBtn.textContent = 'Sign in with bootstrap password';
      }
    }
  }

  function wantAdminFromUrl() {
    const params = getParams();
    return params.get('dest') === 'admin'
      || params.get('tab') === 'admin'
      || params.get('tab') === 'leadership';
  }

  async function handleRoleBack() {
    try { sessionStorage.removeItem(PENDING_ADMIN_KEY); } catch { /* ignore */ }
    clearAdminToken();
    localStorage.removeItem(SESSION_KEY);
    pendingMember = null;
    pendingAccessToken = null;
    try { await window.GaaAuth?.signOut(); } catch { /* ignore */ }
    showSignInPanel({ forAdmin: wantAdminFromUrl() });
    els.memberPassword && (els.memberPassword.value = '');
    els.memberEmail?.focus();
  }

  async function init() {
    // Bind UI handlers first — never wait on Auth/session before Forgot password works.
    const startOnAdmin = wantAdminFromUrl();
    if (startOnAdmin) showAdminPanel();
    else showSignInPanel();
    restoreRememberedEmail();
    bindPasswordToggle(els.toggleMemberPassword, els.memberPassword);

    els.tabSignIn?.addEventListener('click', () => showSignInPanel());
    els.tabAdmin?.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('dest', 'admin');
      window.history.replaceState({}, '', url);
      showAdminPanel();
    });
    els.adminUseMemberSignInBtn?.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('dest', 'admin');
      window.history.replaceState({}, '', url);
      showSignInPanel({ forAdmin: true });
      els.memberEmail?.focus();
    });
    els.continueMemberAdminBtn?.addEventListener('click', handleContinueMemberAdmin);
    els.adminBootstrapForm?.addEventListener('submit', handleBootstrapLogin);
    els.adminPreviewBtn?.addEventListener('click', () => {
      window.location.href = 'admin/?preview=1';
    });

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
      showSignInPanel({ forAdmin: startOnAdmin });
    }

    const notice = getParams().get('notice');
    if (notice) {
      showError(els.adminBootstrapError, notice);
      showAdminPanel();
    }

    if (getParams().get('preview') === '1' && startOnAdmin) {
      window.location.href = 'admin/?preview=1';
      return;
    }

    try {
      await redirectIfAlreadySignedIn();
    } catch {
      /* stay on sign-in form */
    }

    if (startOnAdmin) offerMemberAdminContinue();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

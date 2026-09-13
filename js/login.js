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
    panelJoin: document.getElementById('panelJoin'),
    panelAdmin: document.getElementById('panelAdmin'),
    panelRoleSelect: document.getElementById('panelRoleSelect'),
    tabSignIn: document.getElementById('tabSignIn'),
    tabJoin: document.getElementById('tabJoin'),
    tabAdmin: document.getElementById('tabAdmin'),
    signInLead: document.getElementById('signInLead'),
    memberForm: document.getElementById('memberLoginForm'),
    memberError: document.getElementById('memberLoginError'),
    memberSuccess: document.getElementById('memberLoginSuccess'),
    memberBtn: document.getElementById('memberLoginBtn'),
    memberEmail: document.getElementById('memberEmail'),
    memberPassword: document.getElementById('memberPassword'),
    forgotBtn: document.getElementById('forgotPasswordBtn'),
    toggleMemberPassword: document.getElementById('toggleMemberPassword'),
    roleSelectHint: document.getElementById('roleSelectHint'),
    roleSelectError: document.getElementById('roleSelectError'),
    goMembersDash: document.getElementById('goMembersDash'),
    goAdminDash: document.getElementById('goAdminDash'),
    roleSelectBack: document.getElementById('roleSelectBack'),
    adminAuthForm: document.getElementById('adminAuthForm'),
    adminEmail: document.getElementById('adminEmail'),
    adminPassword: document.getElementById('adminPassword'),
    adminAuthError: document.getElementById('adminAuthError'),
    adminAuthSuccess: document.getElementById('adminAuthSuccess'),
    adminAuthBtn: document.getElementById('adminAuthBtn'),
    adminForgotBtn: document.getElementById('adminForgotPasswordBtn'),
    toggleAdminPassword: document.getElementById('toggleAdminPassword'),
    adminBootstrapPassword: document.getElementById('adminBootstrapPassword'),
    adminBootstrapError: document.getElementById('adminBootstrapError'),
    adminBootstrapBtn: document.getElementById('adminBootstrapBtn'),
    adminPreviewBtn: document.getElementById('adminPreviewBtn')
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
      const eye = button.querySelector('.icon-eye');
      const eyeOff = button.querySelector('.icon-eye-off');
      if (eye && eyeOff) {
        eye.hidden = !showing;
        eyeOff.hidden = showing;
      }
    });
  }

  function setAuthTab(which) {
    const tabs = [
      { el: els.tabSignIn, key: 'signin' },
      { el: els.tabJoin, key: 'join' },
      { el: els.tabAdmin, key: 'admin' }
    ];
    tabs.forEach(({ el, key }) => {
      if (!el) return;
      const on = key === which;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function hideAllAuthPanels() {
    [els.panelSignIn, els.panelJoin, els.panelAdmin, els.panelRoleSelect].forEach(panel => {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove('is-active');
    });
  }

  function showAuthPanel(which, opts = {}) {
    hideAllAuthPanels();
    const map = {
      signin: els.panelSignIn,
      join: els.panelJoin,
      admin: els.panelAdmin
    };
    const panel = map[which] || els.panelSignIn;
    setAuthTab(which === 'join' || which === 'admin' ? which : 'signin');
    if (panel) {
      panel.hidden = false;
      panel.classList.add('is-active');
    }
    if (which === 'signin' && els.signInLead) {
      els.signInLead.textContent = opts.forAdmin
        ? 'Sign in with your member email to open Leadership admin. Use Forgot password if you have not chosen a password yet.'
        : 'Sign in with the email from your Gotabgaa Australia registration. Use Forgot password if you have not chosen a password yet.';
    }
    const url = new URL(window.location.href);
    if (which === 'admin') {
      url.searchParams.set('tab', 'admin');
      url.searchParams.set('dest', 'admin');
    } else if (which === 'join') {
      url.searchParams.set('tab', 'join');
      url.searchParams.delete('dest');
    } else {
      url.searchParams.set('tab', 'signin');
      if (!opts.keepDest) url.searchParams.delete('dest');
    }
    window.history.replaceState({}, '', url);
    document.title = (which === 'join' ? 'Join' : which === 'admin' ? 'Admin' : 'Sign in') + ' | Gotabgaa Australia';
  }

  function showSignInPanel(opts = {}) {
    showAuthPanel('signin', opts);
    showError(els.roleSelectError, '');
  }

  function showJoinPanel() {
    showAuthPanel('join');
  }

  function showAdminPanel() {
    showAuthPanel('admin');
    if (els.memberEmail?.value && els.adminEmail && !els.adminEmail.value) {
      els.adminEmail.value = els.memberEmail.value;
    }
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
      : (els.panelAdmin && !els.panelAdmin.hidden ? els.adminAuthError : els.memberError);
    showError(errEl, '');
    if (!pendingAccessToken && window.GaaAuth) {
      const session = await window.GaaAuth.getSession();
      pendingAccessToken = session?.access_token || null;
    }
    if (!pendingAccessToken) {
      showError(errEl, 'Your session expired. Sign in again.');
      showAdminPanel();
      return;
    }

    if (els.goAdminDash) els.goAdminDash.disabled = true;
    if (els.adminAuthBtn) els.adminAuthBtn.disabled = true;

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
      if (els.adminAuthBtn) els.adminAuthBtn.disabled = false;
    }
  }

  function continueAfterLogin(member, accessToken, opts = {}) {
    pendingAccessToken = accessToken;
    saveMemberSession(member);
    const dest = preferredDestination(member);
    const errEl = opts.fromAdmin ? els.adminAuthError : els.memberError;

    if (dest === 'admin' && !member.adminAccess) {
      showError(
        errEl,
        'Signed in, but this email is not on the leadership admin list. Ask an admin to grant access, then try again.'
      );
      return;
    }

    if (member.adminAccess) {
      if (dest === 'admin' || opts.fromAdmin) {
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
      if (saved) {
        if (els.memberEmail) els.memberEmail.value = saved;
        if (els.adminEmail) els.adminEmail.value = saved;
      }
    } catch {
      /* ignore */
    }
  }

  function persistRememberedEmail(email) {
    try {
      if (email) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
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
        showError(els.memberError, friendlyClientError(err, 'Could not sign in.'));
      }
    } finally {
      els.memberBtn.disabled = false;
      els.memberBtn.textContent = 'Sign in';
    }
  }

  function renderSetupLink(message, setupLink, emailSent, targetEl) {
    const el = targetEl || els.memberSuccess;
    if (!el || !setupLink) return;
    showSuccess(el, '');
    el.hidden = false;
    el.innerHTML = `
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
        el.hidden = false;
        el.innerHTML = `
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

  async function handleForgotPassword(e, source = 'member') {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const isAdmin = source === 'admin';
    const errEl = isAdmin ? els.adminAuthError : els.memberError;
    const okEl = isAdmin ? els.adminAuthSuccess : els.memberSuccess;
    const emailEl = isAdmin ? els.adminEmail : els.memberEmail;
    const btn = isAdmin ? els.adminForgotBtn : els.forgotBtn;

    showError(errEl, '');
    showSuccess(okEl, '');

    const email = emailEl?.value.trim().toLowerCase();
    if (!email) {
      showError(errEl, 'Enter your email address first, then click Forgot password.');
      emailEl?.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
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
        renderSetupLink(data.message, data.setupLink, data.emailSent, okEl);
        return;
      }

      showSuccess(
        okEl,
        data.message || 'If that email has an account, we sent a password link. Check inbox and spam.'
      );
    } catch (err) {
      showError(errEl, friendlyClientError(err, 'Could not send reset email.'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Forgot password?';
      }
    }
  }

  async function handleAdminAuth(e) {
    e.preventDefault();
    showError(els.adminAuthError, '');
    showSuccess(els.adminAuthSuccess, '');

    const email = els.adminEmail?.value.trim().toLowerCase();
    const password = els.adminPassword?.value || '';
    if (!email || !password) {
      showError(els.adminAuthError, 'Please enter your email and password.');
      return;
    }
    if (!window.GaaAuth) {
      showError(els.adminAuthError, 'Sign-in is not ready. Refresh the page and try again.');
      return;
    }

    if (els.adminAuthBtn) {
      els.adminAuthBtn.disabled = true;
      els.adminAuthBtn.textContent = 'Signing in…';
    }

    try {
      const { data, error } = await window.GaaAuth.signInWithPassword(email, password);
      if (error) throw error;
      if (!data?.session?.access_token) throw new Error('Sign in succeeded but no session was created.');

      const member = await fetchMemberProfile(data.session.access_token);
      persistRememberedEmail(email);
      const url = new URL(window.location.href);
      url.searchParams.set('dest', 'admin');
      window.history.replaceState({}, '', url);
      continueAfterLogin(member, data.session.access_token, { fromAdmin: true });
    } catch (err) {
      const msg = String(err.message || '');
      if (/invalid login credentials/i.test(msg)) {
        showError(
          els.adminAuthError,
          'Invalid email or password. Use the eye icon to check what was typed. If it still fails, use Forgot password.'
        );
      } else {
        showError(els.adminAuthError, friendlyClientError(err, 'Could not sign in.'));
      }
    } finally {
      if (els.adminAuthBtn) {
        els.adminAuthBtn.disabled = false;
        els.adminAuthBtn.textContent = 'Enter admin portal';
      }
    }
  }

  async function handleBootstrapLogin() {
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
      if (!res.ok) throw new Error(data.error || data.detail || 'Bootstrap sign in failed');
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

  function tabFromUrl() {
    const params = getParams();
    let tab = String(params.get('tab') || '').toLowerCase();
    if (tab === 'committee' || tab === 'leadership') tab = 'admin';
    if (params.get('dest') === 'admin') tab = 'admin';
    if (tab === 'join' || tab === 'admin' || tab === 'signin') return tab;
    return 'signin';
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
    const startTab = tabFromUrl();
    if (startTab === 'admin') showAdminPanel();
    else if (startTab === 'join') showJoinPanel();
    else showSignInPanel();

    restoreRememberedEmail();
    bindPasswordToggle(els.toggleMemberPassword, els.memberPassword);
    bindPasswordToggle(els.toggleAdminPassword, els.adminPassword);

    document.querySelectorAll('[data-auth-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-auth-tab');
        if (tab === 'join') showJoinPanel();
        else if (tab === 'admin') showAdminPanel();
        else showSignInPanel();
      });
    });

    els.adminAuthForm?.addEventListener('submit', handleAdminAuth);
    els.adminForgotBtn?.addEventListener('click', e => handleForgotPassword(e, 'admin'));
    els.adminBootstrapBtn?.addEventListener('click', handleBootstrapLogin);
    els.adminPreviewBtn?.addEventListener('click', () => {
      window.location.href = 'admin/?preview=1';
    });

    els.memberForm?.addEventListener('submit', handleMemberLogin);
    els.forgotBtn?.addEventListener('click', e => handleForgotPassword(e, 'member'));
    els.goMembersDash?.addEventListener('click', () => {
      try { sessionStorage.removeItem(PENDING_ADMIN_KEY); } catch { /* ignore */ }
      goMembers(getParams().get('preview') === '1');
    });
    els.goAdminDash?.addEventListener('click', openAdminDashboard);
    els.roleSelectBack?.addEventListener('click', handleRoleBack);

    if (getParams().get('password') === 'updated') {
      showSuccess(els.memberSuccess, 'Password updated. Sign in with your email and new password.');
      showSignInPanel();
    }

    const notice = getParams().get('notice');
    if (notice) {
      showError(els.adminAuthError, notice);
      showAdminPanel();
    }

    if (getParams().get('preview') === '1' && startTab === 'admin') {
      window.location.href = 'admin/?preview=1';
      return;
    }

    try {
      await redirectIfAlreadySignedIn();
    } catch {
      /* stay on form */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * Set / reset member password after approval or forgot-password email.
 */
(function () {
  const form = document.getElementById('setPasswordForm');
  const errorEl = document.getElementById('setPasswordError');
  const successEl = document.getElementById('setPasswordSuccess');
  const btn = document.getElementById('setPasswordBtn');
  const passwordInput = document.getElementById('newPassword');
  const confirmInput = document.getElementById('confirmPassword');
  const toggleBtn = document.getElementById('toggleNewPassword');
  const subtitle = document.getElementById('setPasswordSubtitle');

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    errorEl.hidden = !msg;
    if (successEl) successEl.hidden = true;
  }

  function showSuccess(msg) {
    if (!successEl) return;
    successEl.textContent = msg || '';
    successEl.hidden = !msg;
    if (errorEl) errorEl.hidden = true;
  }

  function bindToggle(button, input) {
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

  function cleanAuthParamsFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('token_hash') || url.searchParams.has('type') || window.location.hash) {
        window.history.replaceState({}, document.title, url.pathname);
      }
    } catch {
      /* ignore */
    }
  }

  async function establishRecoverySession(client) {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type') || 'recovery';

    if (tokenHash) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type
      });
      if (error) throw error;
      cleanAuthParamsFromUrl();
      return data?.session || null;
    }

    // Supabase recovery redirects may place tokens in the URL hash
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session) {
      cleanAuthParamsFromUrl();
      return data.session;
    }
    return null;
  }

  async function init() {
    if (!window.GaaAuth) {
      showError('Auth library failed to load. Refresh and try again.');
      return;
    }

    bindToggle(toggleBtn, passwordInput);

    try {
      const client = await window.GaaAuth.getClient();
      const session = await establishRecoverySession(client);
      if (!session) {
        if (subtitle) {
          subtitle.textContent = 'Open the link from your invitation or reset email first. If it expired, ask an admin to resend the invite or use Forgot password on the sign-in page.';
        }
        showError('No active reset session found. Open the Create password link from your email again, or request a new one.');
        if (btn) btn.disabled = true;
        return;
      }
      if (subtitle) {
        subtitle.textContent = 'Choose a secure password for your Gotabgaa Australia account.';
      }
    } catch (err) {
      showError(err.message || 'Could not start password setup. The email link may have expired — ask for a new invitation.');
      if (btn) btn.disabled = true;
      return;
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      showSuccess('');

      const password = passwordInput?.value || '';
      const confirm = confirmInput?.value || '';

      if (password.length < 8) {
        showError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Saving…';

      try {
        const { error } = await window.GaaAuth.updatePassword(password);
        if (error) throw error;
        showSuccess('Password saved. Redirecting to sign in…');
        window.setTimeout(() => {
          window.location.href = 'login.html?dest=admin&password=updated';
        }, 1200);
      } catch (err) {
        showError(err.message || 'Could not save password. Request a new reset link and try again.');
        btn.disabled = false;
        btn.textContent = 'Save password';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

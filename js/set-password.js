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

  async function init() {
    if (!window.GaaAuth) {
      showError('Auth library failed to load. Refresh and try again.');
      return;
    }

    bindToggle(toggleBtn, passwordInput);

    try {
      const client = await window.GaaAuth.getClient();
      // Recovery / invite links land with tokens in the URL hash
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data?.session) {
        if (subtitle) {
          subtitle.textContent = 'Open the link from your approval or reset email first. If it expired, use Forgot password on the sign-in page.';
        }
        showError('No active reset session found. Request a new password link from the sign-in page.');
        if (btn) btn.disabled = true;
        return;
      }
    } catch (err) {
      showError(err.message || 'Could not start password setup.');
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
          window.location.href = 'login.html?password=updated';
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

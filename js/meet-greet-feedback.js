(function () {
  const form = document.getElementById('meetGreetFeedbackForm');
  if (!form) return;

  const DONE_KEY = 'gaa_meet_greet_feedback_done';
  const successEl = document.getElementById('feedbackSuccess');
  const alreadyEl = document.getElementById('feedbackAlreadyDone');
  const errorEl = document.getElementById('feedbackError');
  const requiredSingle = ['attended', 'overall', 'useful', 'come_again'];

  function markDoneLocally(email) {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify({
        at: new Date().toISOString(),
        email: String(email || '').toLowerCase()
      }));
    } catch {
      /* ignore */
    }
  }

  function alreadyDoneLocally() {
    try {
      return Boolean(localStorage.getItem(DONE_KEY));
    } catch {
      return false;
    }
  }

  function lockForm(messageEl) {
    form.querySelectorAll('input, button').forEach(el => {
      el.disabled = true;
    });
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.hidden = true;
    if (messageEl) {
      messageEl.hidden = false;
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  if (alreadyDoneLocally()) {
    lockForm(alreadyEl);
  }

  // "Tick one" groups: only one box stays checked
  form.querySelectorAll('fieldset[data-single]').forEach(fieldset => {
    fieldset.addEventListener('change', e => {
      const input = e.target;
      if (!input || input.type !== 'checkbox' || !input.checked) return;
      fieldset.querySelectorAll('input[type="checkbox"]').forEach(box => {
        if (box !== input) box.checked = false;
      });
    });
  });

  function checkedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
  }

  function showError(msg) {
    if (!errorEl) {
      alert(msg);
      return;
    }
    errorEl.textContent = msg;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearError() {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();

    if (alreadyDoneLocally()) {
      lockForm(alreadyEl);
      return;
    }

    const name = form.querySelector('[name="name"]')?.value.trim() || '';
    const email = form.querySelector('[name="email"]')?.value.trim() || '';
    if (!email) {
      showError('Email is required so we can send your thank-you note.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    for (const field of requiredSingle) {
      if (!checkedValues(field).length) {
        showError('Please tick an answer for every question marked with *.');
        return;
      }
    }

    const answers = {
      name,
      email,
      attended: checkedValues('attended')[0] || '',
      state: checkedValues('state')[0] || '',
      overall: checkedValues('overall')[0] || '',
      useful: checkedValues('useful')[0] || '',
      topics: checkedValues('topics'),
      time_ok: checkedValues('time_ok')[0] || '',
      zoom: checkedValues('zoom')[0] || '',
      come_again: checkedValues('come_again')[0] || '',
      next: checkedValues('next')
    };

    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.textContent = 'Sending...';
      btn.disabled = true;
      btn.classList.add('btn--loading');
    }

    try {
      const res = await fetch('/api/meet-greet-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        markDoneLocally(email);
        lockForm(alreadyEl);
        showError(data.error || 'This email has already submitted feedback.');
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not save feedback');
      }

      markDoneLocally(email);
      form.reset();
      lockForm(successEl);
    } catch (err) {
      showError(err.message || 'Failed to send. Please try again or email info@gotabgaaaustralia.org.');
      if (btn) {
        btn.textContent = 'Submit feedback';
        btn.disabled = false;
        btn.classList.remove('btn--loading');
      }
    }
  });
})();

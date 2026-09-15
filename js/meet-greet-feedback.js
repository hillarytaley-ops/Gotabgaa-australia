(function () {
  const form = document.getElementById('meetGreetFeedbackForm');
  if (!form) return;

  const successEl = document.getElementById('feedbackSuccess');
  const errorEl = document.getElementById('feedbackError');
  const requiredSingle = ['attended', 'overall', 'useful', 'come_again'];

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

    for (const name of requiredSingle) {
      if (!checkedValues(name).length) {
        showError('Please tick an answer for every question marked with *.');
        return;
      }
    }

    const name = form.querySelector('[name="name"]')?.value.trim() || '';
    const email = form.querySelector('[name="email"]')?.value.trim() || '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email, or leave it blank.');
      return;
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
      if (!res.ok) {
        throw new Error(data.error || 'Could not save feedback');
      }

      form.reset();
      if (successEl) {
        successEl.hidden = false;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      showError(err.message || 'Failed to send. Please try again or email info@gotabgaaaustralia.org.');
    } finally {
      if (btn) {
        btn.textContent = 'Submit feedback';
        btn.disabled = false;
        btn.classList.remove('btn--loading');
      }
    }
  });
})();

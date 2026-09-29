(function () {
  const form = document.getElementById('efareVoteForm');
  if (!form) return;

  const DONE_KEY = 'gaa_efare_vote';
  const successEl = document.getElementById('voteSuccess');
  const alreadyEl = document.getElementById('voteAlready');
  const errorEl = document.getElementById('voteError');

  function lockForm(messageEl) {
    form.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; });
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.hidden = true;
    if (messageEl) messageEl.hidden = false;
  }

  try {
    if (localStorage.getItem(DONE_KEY)) lockForm(alreadyEl);
  } catch { /* ignore */ }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const name = form.querySelector('[name="name"]')?.value.trim() || '';
    const email = form.querySelector('[name="email"]')?.value.trim() || '';
    const vote = form.querySelector('[name="vote"]:checked')?.value || '';
    const suggestion = form.querySelector('[name="suggestion"]')?.value.trim() || '';

    if (!name) return showError('Please enter your name.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError('Please enter a valid email.');
    }
    if (vote !== 'aye' && vote !== 'nay') {
      return showError('Please choose Aye or Nay.');
    }
    if (suggestion && suggestion.length < 8) {
      return showError('Please write your idea in a few words, or leave it blank.');
    }

    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    try {
      const res = await fetch('/api/efare-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, vote, suggestion })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
        lockForm(alreadyEl);
        showError(data.error || 'This email has already voted.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Could not save your vote');

      try { localStorage.setItem(DONE_KEY, vote); } catch { /* ignore */ }
      if (successEl) {
        const voteLine = vote === 'aye'
          ? 'Aye recorded. Thank you — your vote is to adopt the E-Fare proposal.'
          : 'Nay recorded. Thank you — your vote is not to adopt the E-Fare proposal.';
        successEl.textContent = suggestion
          ? `${voteLine} Your idea was sent with it.`
          : voteLine;
      }
      form.reset();
      lockForm(successEl);
    } catch (err) {
      showError(err.message || 'Could not save your vote. Please try again.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit';
      }
    }
  });
})();

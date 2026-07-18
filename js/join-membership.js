/**
 * Membership registration portal — PayID / bank transfer after submit
 */
(function () {
  let membershipConfig = null;
  let paymentConfig = null;

  function populateMembershipTypes(types) {
    const select = document.getElementById('memberType');
    if (!select) return;

    const list = types?.length ? types : [
      { id: 'full', label: 'Full Member' },
      { id: 'associate', label: 'Associate Member' },
      { id: 'youth', label: 'Youth Member' },
      { id: 'family', label: 'Family Membership' }
    ];

    select.innerHTML = '<option value="">— Select —</option>' + list.map(t =>
      `<option value="${escapeHtml(t.label || t.id)}">${escapeHtml(t.label || t.id)}</option>`
    ).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyMembershipConfig(m) {
    membershipConfig = m;
    if (!m || m.enabled === false) {
      document.getElementById('membershipDisabled').hidden = false;
      document.getElementById('membershipLayout').hidden = true;
      return;
    }

    document.getElementById('membershipDisabled').hidden = true;
    document.getElementById('membershipLayout').hidden = false;

    const intro = document.getElementById('membershipIntro');
    if (intro && m.intro) intro.textContent = m.intro;

    const fee = document.getElementById('membershipFee');
    if (fee && m.feeDisplay) fee.textContent = m.feeDisplay;

    const feeNote = document.getElementById('membershipFeeNote');
    if (feeNote && m.feeNote) feeNote.textContent = m.feeNote;

    const paymentPlaceholder = document.getElementById('membershipPaymentPlaceholder');
    if (paymentPlaceholder && m.paymentPlaceholder) {
      paymentPlaceholder.innerHTML = `<p class="form-hint"><strong>Payment:</strong> ${escapeHtml(m.paymentPlaceholder)}</p>
        <p class="form-hint" style="margin-top:12px">Already approved? <a href="login.html">Sign in to the members dashboard</a>.</p>`;
    }

    const benefitsList = document.getElementById('membershipBenefits');
    if (benefitsList && m.benefits?.length) {
      benefitsList.innerHTML = m.benefits.map(text => `
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>
          <span>${escapeHtml(text)}</span>
        </li>
      `).join('');
    }

    if (m.image && !document.querySelector('#membershipPortal [data-city-slider]')) {
      const img = document.getElementById('membershipImage');
      if (img) {
        img.src = m.image;
        img.alt = 'Gotabgaa Australia membership';
      }
    }

    populateMembershipTypes(m.types);
  }

  function showPaymentInstructions(data) {
    const wrap = document.getElementById('membershipPaymentInstructions');
    if (!wrap || !window.PaymentInstructions) return;

    wrap.hidden = false;
    window.PaymentInstructions.render(wrap, {
      payment: data.payment || paymentConfig,
      amount: data.amount || membershipConfig?.feeDisplay,
      reference: data.paymentReference,
      title: 'Complete your membership payment',
      subtitle: (data.payment || paymentConfig)?.instructions
    });
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let formInitialized = false;

  function initMembershipForm() {
    const form = document.getElementById('membershipForm');
    if (!form || formInitialized) return;
    formInitialized = true;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const success = document.getElementById('membershipSuccess');
      const error = document.getElementById('membershipError');
      const btn = document.getElementById('membershipSubmitBtn');
      const payWrap = document.getElementById('membershipPaymentInstructions');

      success.hidden = true;
      error.hidden = true;
      if (payWrap) payWrap.hidden = true;

      if (!membershipConfig || membershipConfig.enabled === false) {
        error.textContent = 'Registration is currently unavailable.';
        error.hidden = false;
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting…';
      }

      try {
        const res = await fetch('/api/membership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('memberName').value,
            email: document.getElementById('memberEmail').value,
            phone: document.getElementById('memberPhone').value,
            stateChapter: document.getElementById('memberState').value,
            membershipType: document.getElementById('memberType').value,
            address: document.getElementById('memberAddress').value,
            dateOfBirth: document.getElementById('memberDob').value,
            referralSource: document.getElementById('memberReferral').value,
            notes: document.getElementById('memberNotes').value,
            feeAmount: membershipConfig.feeAmount,
            feeCurrency: membershipConfig.feeCurrency || 'AUD',
            feeDisplay: membershipConfig.feeDisplay
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail && data.detail !== data.error ? ` (${data.detail})` : '';
          throw new Error((data.error || 'Registration failed') + detail);
        }

        success.textContent = data.message || 'Registration received!';
        success.hidden = false;
        if (data.paymentReference) showPaymentInstructions(data);
        form.reset();
      } catch (err) {
        error.textContent = err.message || 'Could not submit registration. Please contact us directly.';
        error.hidden = false;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit Registration';
        }
      }
    });
  }

  function loadMembership() {
    const content = window.CMS_CONTENT;
    paymentConfig = content?.payment || null;

    if (!content?.membership) {
      applyMembershipConfig({
        enabled: true,
        feeAmount: 50,
        feeCurrency: 'AUD',
        feeDisplay: '$50 AUD / year',
        feeNote: 'Annual membership fee — pay via PayID or bank transfer after registering.',
        paymentPlaceholder: 'After you submit this form, you will receive PayID and bank details with a unique payment reference.',
        intro: 'Join our growing community across Australia — access events, programs, and cultural initiatives.'
      });
    } else {
      applyMembershipConfig(content.membership);
    }
    initMembershipForm();
  }

  document.addEventListener('cms-ready', loadMembership);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMembership);
  } else {
    loadMembership();
  }
})();

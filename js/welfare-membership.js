/**
 * Social welfare membership registration on welfare.html
 */
(function () {
  let welfareConfig = null;
  let paymentConfig = null;
  let packages = [];

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPackages(list) {
    const grid = document.getElementById('welfarePackagesGrid');
    if (!grid) return;

    packages = list || [];
    if (!packages.length) {
      grid.innerHTML = '<p class="hub-empty">Welfare packages will appear here once configured in the admin dashboard.</p>';
      return;
    }

    grid.innerHTML = packages.map(pkg => `
      <article class="welfare-package-card${pkg.highlight ? ' welfare-package-card--highlight' : ''}">
        ${pkg.highlight ? '<span class="welfare-package-card__badge">Popular</span>' : ''}
        <h3>${escapeHtml(pkg.title)}</h3>
        <p class="welfare-package-card__price">${escapeHtml(pkg.priceDisplay || `$${pkg.price} AUD / ${pkg.period || 'year'}`)}</p>
        <p class="welfare-package-card__desc">${escapeHtml(pkg.description || '')}</p>
        ${(pkg.benefits || []).length ? `
          <ul class="welfare-package-card__benefits">
            ${pkg.benefits.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        ` : ''}
        <button type="button" class="btn btn--outline btn--sm welfare-package-card__select" data-package-id="${escapeHtml(pkg.id)}">Select package</button>
      </article>
    `).join('');

    grid.querySelectorAll('[data-package-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const select = document.getElementById('welfPackage');
        if (select) {
          select.value = btn.dataset.packageId;
          select.dispatchEvent(new Event('change'));
        }
        document.getElementById('welfarePortalSection')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function populatePackageSelect(list) {
    const select = document.getElementById('welfPackage');
    if (!select) return;

    select.innerHTML = '<option value="">— Select package —</option>' + (list || []).map(pkg =>
      `<option value="${escapeHtml(pkg.id)}" data-price="${escapeHtml(pkg.priceDisplay || '')}" data-amount="${pkg.price ?? ''}" data-title="${escapeHtml(pkg.title)}">${escapeHtml(pkg.title)} — ${escapeHtml(pkg.priceDisplay || `$${pkg.price}`)}</option>`
    ).join('');
  }

  function updateSelectedFee() {
    const select = document.getElementById('welfPackage');
    const feeEl = document.getElementById('welfareSelectedFee');
    if (!select || !feeEl) return;

    const opt = select.selectedOptions[0];
    if (!opt?.value) {
      feeEl.textContent = '';
      return;
    }
    feeEl.textContent = opt.dataset.price || '';
  }

  function applyConfig(welfare) {
    welfareConfig = welfare?.membership || {};
    paymentConfig = window.CMS_CONTENT?.payment || null;

    const m = welfareConfig;
    const enabled = m.enabled !== false;

    document.getElementById('welfareRegIntro')?.textContent && enabled && m.intro
      && (document.getElementById('welfareRegIntro').textContent = m.intro);

    const signInIntro = document.getElementById('welfareSignInIntro');
    if (signInIntro && m.signInIntro) signInIntro.textContent = m.signInIntro;

    const feeNote = document.getElementById('welfareFeeNote');
    if (feeNote && m.feeNote) feeNote.textContent = m.feeNote;

    const disabled = document.getElementById('welfareRegDisabled');
    const form = document.getElementById('welfareForm');
    if (!enabled) {
      if (disabled) disabled.hidden = false;
      if (form) form.hidden = true;
    } else {
      if (disabled) disabled.hidden = true;
      if (form) form.hidden = false;
    }

    renderPackages(m.packages);
    populatePackageSelect(m.packages);
  }

  function showPaymentInstructions(data) {
    const wrap = document.getElementById('welfarePaymentInstructions');
    if (!wrap || !window.PaymentInstructions) return;

    wrap.hidden = false;
    window.PaymentInstructions.render(wrap, {
      payment: data.payment || paymentConfig,
      amount: data.amount,
      reference: data.paymentReference,
      title: 'Complete your welfare membership payment',
      subtitle: (data.payment || paymentConfig)?.instructions
    });
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let formInitialized = false;

  function initForm() {
    const form = document.getElementById('welfareForm');
    if (!form || formInitialized) return;
    formInitialized = true;

    document.getElementById('welfPackage')?.addEventListener('change', updateSelectedFee);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const success = document.getElementById('welfareSuccess');
      const error = document.getElementById('welfareError');
      const btn = document.getElementById('welfareSubmitBtn');
      const payWrap = document.getElementById('welfarePaymentInstructions');

      success.hidden = true;
      error.hidden = true;
      if (payWrap) payWrap.hidden = true;

      if (!welfareConfig || welfareConfig.enabled === false) {
        error.textContent = 'Welfare registration is currently unavailable.';
        error.hidden = false;
        return;
      }

      const packageSelect = document.getElementById('welfPackage');
      const opt = packageSelect?.selectedOptions[0];
      if (!opt?.value) {
        error.textContent = 'Please select a welfare package.';
        error.hidden = false;
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting…';
      }

      try {
        const res = await fetch('/api/welfare-membership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('welfName').value,
            email: document.getElementById('welfEmail').value,
            phone: document.getElementById('welfPhone').value,
            membershipId: document.getElementById('welfMemberId').value,
            stateChapter: document.getElementById('welfState').value,
            packageId: opt.value,
            packageTitle: opt.dataset.title || opt.textContent,
            feeAmount: opt.dataset.amount,
            feeCurrency: 'AUD',
            feeDisplay: opt.dataset.price,
            notes: document.getElementById('welfNotes').value
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.detail || 'Registration failed');

        success.textContent = data.message || 'Welfare registration received!';
        success.hidden = false;
        if (data.paymentReference) showPaymentInstructions(data);
        form.reset();
        updateSelectedFee();
      } catch (err) {
        error.textContent = err.message || 'Could not submit registration.';
        error.hidden = false;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit Welfare Registration';
        }
      }
    });
  }

  function load() {
    const welfare = window.CMS_CONTENT?.welfare;
    if (welfare) applyConfig(welfare);
    initForm();
  }

  document.addEventListener('cms-ready', load);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

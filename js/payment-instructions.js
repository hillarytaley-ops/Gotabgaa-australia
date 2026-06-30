/**
 * Shared PayID / bank transfer instructions UI
 */
(function () {
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = prev; }, 1600);
      }
    } catch {
      window.prompt('Copy this reference:', text);
    }
  }

  function row(label, value, copyable) {
    if (!value) return '';
    const copyBtn = copyable
      ? `<button type="button" class="payment-instructions__copy btn btn--outline btn--sm" data-copy="${escapeHtml(value)}">Copy</button>`
      : '';
    return `
      <div class="payment-instructions__row">
        <span class="payment-instructions__label">${escapeHtml(label)}</span>
        <span class="payment-instructions__value">${escapeHtml(value)}</span>
        ${copyBtn}
      </div>
    `;
  }

  function render(container, options) {
    if (!container) return;

    const payment = options.payment || {};
    const amount = options.amount || '';
    const reference = options.reference || '';
    const title = options.title || 'Complete your payment';
    const subtitle = options.subtitle || payment.instructions || 'Pay via PayID or bank transfer using the details below.';

    if (!payment.enabled && !payment.payId && !payment.bsb) {
      container.innerHTML = `
        <div class="payment-instructions payment-instructions--muted">
          <h4>${escapeHtml(title)}</h4>
          <p>Payment details will be sent by email. Our team will confirm once received.</p>
          ${reference ? `<p><strong>Reference:</strong> <code>${escapeHtml(reference)}</code></p>` : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="payment-instructions">
        <h4>${escapeHtml(title)}</h4>
        <p class="payment-instructions__intro">${escapeHtml(subtitle)}</p>
        <div class="payment-instructions__grid">
          ${row('Amount', amount, false)}
          ${row('Reference', reference, true)}
          ${row('PayID', payment.payId, true)}
          ${row('BSB', payment.bsb, false)}
          ${row('Account', payment.accountNumber, false)}
          ${row('Account name', payment.accountName || payment.legalName, false)}
          ${payment.abn ? row('ABN', payment.abn, false) : ''}
        </div>
        ${payment.gstNote ? `<p class="payment-instructions__gst">${escapeHtml(payment.gstNote)}</p>` : ''}
        <p class="payment-instructions__footer">Include the <strong>reference exactly</strong> when paying. Contact <a href="mailto:${escapeHtml(payment.receiptEmail || 'info@gotabgaaaustralia.org')}">${escapeHtml(payment.receiptEmail || 'info@gotabgaaaustralia.org')}</a> if you need help.</p>
      </div>
    `;

    container.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copyText(btn.dataset.copy, btn));
    });
  }

  window.PaymentInstructions = { render, copyText };
})();

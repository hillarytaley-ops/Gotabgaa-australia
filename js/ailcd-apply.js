/**
 * Gotabgaa Interim Leadership Expression of Interest — multi-step form
 */
(function () {
  const STEPS = [
    'Personal details',
    'Position of interest',
    'Leadership experience',
    'Declaration'
  ];

  const STATUS_STORAGE_KEY = 'gotabgaaEoiStatus';

  let currentStep = 0;
  let signaturePad = null;
  let activeStatusSession = null;

  function getStatusSession() {
    try {
      const raw = localStorage.getItem(STATUS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveStatusSession(email, reference) {
    const session = {
      email: String(email || '').trim().toLowerCase(),
      reference: String(reference || '').trim().toUpperCase()
    };
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(session));
    activeStatusSession = session;
    return session;
  }

  function statusLabel(status) {
    const labels = {
      pending: 'Under review',
      approved: 'Approved',
      rejected: 'Not successful'
    };
    return labels[status] || 'Under review';
  }

  function statusDescription(status) {
    if (status === 'approved') {
      return 'Your expression of interest has been approved. Our team may contact you with next steps.';
    }
    if (status === 'rejected') {
      return 'Your expression of interest was not successful at this time.';
    }
    return 'Your application is under review. Return to this page anytime to check for updates.';
  }

  function renderStatusDisplay(application) {
    const status = application.status || 'pending';
    const updated = application.updatedAt
      ? new Date(application.updatedAt).toLocaleString()
      : '—';

    return `
      <div class="eoi-status-result">
        <p class="eoi-status-result__name"><strong>${escapeHtml(application.fullName || 'Applicant')}</strong></p>
        <p class="eoi-status-result__ref">Reference: <strong>${escapeHtml(application.referenceCode || '—')}</strong></p>
        <p class="eoi-status-result__badge-wrap">
          <span class="eoi-status-badge eoi-status-badge--${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
        </p>
        <p class="eoi-status-result__message">${escapeHtml(statusDescription(status))}</p>
        ${application.statusMessage ? `<p class="eoi-status-result__note"><strong>Note from the team:</strong> ${escapeHtml(application.statusMessage)}</p>` : ''}
        <p class="form-hint eoi-status-result__updated">Last updated: ${escapeHtml(updated)}</p>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showApplicationSection(show) {
    const section = document.getElementById('ailcdApplicationSection');
    if (section) section.hidden = !show;
  }

  function showStatusPortal(show) {
    const portal = document.getElementById('ailcdStatusPortal');
    const check = document.getElementById('ailcdStatusCheck');
    if (portal) portal.hidden = !show;
    if (check) check.hidden = show;
  }

  async function fetchApplicationStatus(email, reference) {
    const params = new URLSearchParams({
      email: String(email || '').trim().toLowerCase()
    });
    const ref = String(reference || '').trim().toUpperCase();
    if (ref) params.set('ref', ref);

    const res = await fetch(`/api/ailcd-status?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not load application status');
    return data.application;
  }

  async function tryShowExistingApplication(email, reference) {
    const application = await fetchApplicationStatus(email, reference);
    const ref = application.referenceCode || reference;
    await displayApplicationStatus(email, ref);
    return true;
  }

  async function displayApplicationStatus(email, reference) {
    const display = document.getElementById('ailcdStatusDisplay');
    const checkError = document.getElementById('ailcdCheckError');
    if (checkError) checkError.hidden = true;

    if (display) {
      display.innerHTML = '<p class="form-hint">Loading status…</p>';
    }

    const application = await fetchApplicationStatus(email, reference);
    saveStatusSession(email, application.referenceCode || reference);

    if (display) {
      display.innerHTML = renderStatusDisplay(application);
    }

    showApplicationSection(false);
    showStatusPortal(true);
    return application;
  }

  async function refreshSavedStatus() {
    const session = activeStatusSession || getStatusSession();
    if (!session?.email || !session?.reference) return null;
    return displayApplicationStatus(session.email, session.reference);
  }

  function val(name) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return '';
    if (el.type === 'radio') {
      const checked = document.querySelector(`[name="${name}"]:checked`);
      return checked ? checked.value : '';
    }
    if (el.type === 'checkbox' && el.name !== 'skills') {
      return el.checked;
    }
    return el.value.trim();
  }

  function checkedValues(name) {
    return [...document.querySelectorAll(`[name="${name}"]:checked`)].map(el => el.value);
  }

  function initSignaturePad(canvas) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasStroke = false;
    let lastX = 0;
    let lastY = 0;
    let displayWidth = 0;
    let displayHeight = 0;

    canvas.style.touchAction = 'none';

    function applyBrush() {
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2a1f17';
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) return false;

      const ratio = window.devicePixelRatio || 1;
      const backup = hasStroke && canvas.width > 0 ? canvas.toDataURL('image/png') : null;

      displayWidth = rect.width;
      displayHeight = rect.height;
      canvas.width = Math.floor(displayWidth * ratio);
      canvas.height = Math.floor(displayHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      applyBrush();

      if (backup) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
        img.src = backup;
      }

      return true;
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    function startDraw(e) {
      if (!resize()) return;
      drawing = true;
      const { x, y } = getPos(e);
      lastX = x;
      lastY = y;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
      hasStroke = true;
      if (canvas.setPointerCapture && e.pointerId != null) {
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      e.preventDefault();
    }

    function draw(e) {
      if (!drawing) return;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x;
      lastY = y;
      hasStroke = true;
      e.preventDefault();
    }

    function endDraw(e) {
      drawing = false;
      if (canvas.releasePointerCapture && e?.pointerId != null) {
        try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    }

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
    canvas.addEventListener('pointerleave', endDraw);

    window.addEventListener('resize', () => {
      if (currentStep === 3) resize();
    });

    return {
      isEmpty: () => !hasStroke,
      resize,
      clear: () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        const ratio = window.devicePixelRatio || 1;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        applyBrush();
        hasStroke = false;
      },
      toDataURL: () => (hasStroke ? canvas.toDataURL('image/png') : '')
    };
  }

  function ensureSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    if (!signaturePad) {
      signaturePad = initSignaturePad(canvas);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => signaturePad?.resize());
    });
  }

  function collectFormData() {
    const position = val('position');
    const otherText = val('positionOther');
    const positions = position === 'Other'
      ? (otherText ? [`Other: ${otherText}`] : ['Other'])
      : (position ? [position] : []);

    return {
      formType: 'gotabgaa-interim-leadership-eoi',
      personal: {
        fullName: val('fullName'),
        gender: val('gender'),
        dateOfBirth: val('dateOfBirth'),
        stateTerritory: val('stateTerritory'),
        address: val('address'),
        suburb: val('suburb'),
        mobile: val('mobile'),
        email: val('email'),
        occupation: val('occupation')
      },
      position: {
        positions,
        positionOther: otherText
      },
      experience: {
        previousLeadership: val('previousLeadership'),
        previousDetails: val('previousDetails'),
        experienceDescription: val('experienceDescription'),
        skills: checkedValues('skills')
      },
      declaration: {
        agreed: val('agreed'),
        fullName: val('declarationName'),
        signatureImage: signaturePad?.toDataURL() || '',
        date: val('declarationDate')
      }
    };
  }

  function showStep(step) {
    currentStep = step;
    document.querySelectorAll('.ailcd-step').forEach((el, i) => {
      el.hidden = i !== step;
    });

    const progress = ((step + 1) / STEPS.length) * 100;
    const bar = document.getElementById('ailcdProgressBar');
    const label = document.getElementById('ailcdStepLabel');
    if (bar) bar.style.width = `${progress}%`;
    if (label) {
      label.textContent = step < 3
        ? `Section ${String.fromCharCode(65 + step)} of 3 — ${STEPS[step]}`
        : 'Declaration — please review and submit';
    }

    document.getElementById('ailcdPrev').hidden = step === 0;
    document.getElementById('ailcdNext').hidden = step === STEPS.length - 1;
    document.getElementById('ailcdSubmit').hidden = step !== STEPS.length - 1;

    if (step === 3) {
      const nameField = document.getElementById('iName');
      const fullName = val('fullName');
      if (nameField && fullName && !nameField.value.trim()) {
        nameField.value = fullName;
      }
      ensureSignaturePad();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateCheckboxGroup(fieldset, name) {
    return fieldset.querySelectorAll(`[name="${name}"]:checked`).length > 0;
  }

  function validateCurrentStep() {
    const fieldset = document.querySelector(`.ailcd-step[data-step="${currentStep}"]`);
    if (!fieldset) return true;

    const required = fieldset.querySelectorAll('[required]');
    for (const el of required) {
      if (el.type === 'radio') {
        const group = fieldset.querySelectorAll(`[name="${el.name}"]`);
        if (![...group].some(r => r.checked)) {
          alert('Please complete all required fields in this section.');
          return false;
        }
      } else if (el.type === 'checkbox') {
        if (!el.checked) {
          alert('Please agree to the declaration to continue.');
          return false;
        }
      } else if (!el.value.trim()) {
        el.reportValidity();
        el.focus();
        return false;
      }
    }

    if (currentStep === 1) {
      const position = val('position');
      if (!position) {
        alert('Please select one interim leadership position.');
        return false;
      }
      if (position === 'Other' && !val('positionOther').trim()) {
        alert('Please specify the position under Other.');
        document.getElementById('positionOtherText')?.focus();
        return false;
      }
    }

    if (currentStep === 2 && !validateCheckboxGroup(fieldset, 'skills')) {
      alert('Please select at least one skill or strength.');
      return false;
    }

    if (currentStep === 3) {
      ensureSignaturePad();
      if (!signaturePad || signaturePad.isEmpty()) {
        alert('Please sign in the signature box before submitting.');
        document.getElementById('signatureCanvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }

    return true;
  }

  function init() {
    const form = document.getElementById('ailcdForm');
    const checkForm = document.getElementById('ailcdCheckForm');

    document.getElementById('clearSignature')?.addEventListener('click', () => {
      if (!signaturePad) ensureSignaturePad();
      signaturePad?.clear();
    });

    const dateField = document.getElementById('iDate');
    if (dateField && !dateField.value) {
      dateField.value = new Date().toISOString().slice(0, 10);
    }

    document.getElementById('ailcdNext')?.addEventListener('click', () => {
      if (!validateCurrentStep()) return;
      if (currentStep < STEPS.length - 1) showStep(currentStep + 1);
    });

    document.getElementById('ailcdPrev')?.addEventListener('click', () => {
      if (currentStep > 0) showStep(currentStep - 1);
    });

    checkForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const error = document.getElementById('ailcdCheckError');
      const btn = document.getElementById('ailcdCheckBtn');
      if (error) error.hidden = true;

      const email = document.getElementById('checkEmail')?.value?.trim();
      const reference = document.getElementById('checkReference')?.value?.trim();
      if (!email) {
        if (error) {
          error.textContent = 'Please enter the email address you used when applying.';
          error.hidden = false;
        }
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Looking up…';
      }

      try {
        await tryShowExistingApplication(email, reference);
      } catch (err) {
        if (error) {
          error.textContent = err.message || 'Could not find that application.';
          error.hidden = false;
        }
        showStatusPortal(false);
        showApplicationSection(true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'View my application';
        }
      }
    });

    document.getElementById('aEmail')?.addEventListener('blur', async e => {
      const email = e.target.value?.trim();
      if (!email || getStatusSession()?.email === email.toLowerCase()) return;

      const formError = document.getElementById('ailcdError');
      try {
        const found = await tryShowExistingApplication(email);
        if (found && formError) {
          formError.textContent = 'You have already applied with this email. The application form is closed for you — use the status section above to track your progress.';
          formError.hidden = false;
        }
      } catch {
        /* No existing application — allow new submission */
      }
    });

    document.getElementById('ailcdRefreshStatus')?.addEventListener('click', async () => {
      const btn = document.getElementById('ailcdRefreshStatus');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Refreshing…';
      }

      try {
        await refreshSavedStatus();
      } catch (err) {
        const error = document.getElementById('ailcdCheckError');
        if (error) {
          error.textContent = err.message || 'Could not refresh status.';
          error.hidden = false;
        }
        showStatusPortal(false);
        showApplicationSection(!getStatusSession());
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Refresh status';
        }
      }
    });

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const success = document.getElementById('ailcdSuccess');
      const error = document.getElementById('ailcdError');
      const btn = document.getElementById('ailcdSubmit');

      success.hidden = true;
      error.hidden = true;

      if (!validateCurrentStep()) return;

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting…';
      }

      try {
        const res = await fetch('/api/ailcd-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collectFormData())
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          const email = val('email');
          if (data.referenceCode && email) {
            saveStatusSession(email, data.referenceCode);
            try {
              await displayApplicationStatus(email, data.referenceCode);
            } catch {
              showApplicationSection(false);
              showStatusPortal(false);
            }
          }
          throw new Error(data.error || 'You have already submitted an application.');
        }
        if (!res.ok) throw new Error(data.error || data.detail || 'Submission failed');

        const email = val('email');
        const reference = data.referenceCode;

        if (reference && email) {
          saveStatusSession(email, reference);
          success.innerHTML = `${escapeHtml(data.message || 'Expression of interest received. Thank you!')}<br><br><strong>Your reference number:</strong> ${escapeHtml(reference)}<br>Save this number — you will need it with your email to check your application status on this page.`;
          success.hidden = false;
          form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = true; });

          try {
            await displayApplicationStatus(email, reference);
          } catch {
            showApplicationSection(false);
            showStatusPortal(false);
          }
        } else {
          success.textContent = data.message || 'Expression of interest received. Thank you!';
          success.hidden = false;
          form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = true; });
        }
      } catch (err) {
        error.textContent = err.message || 'Could not submit. Please try again or contact us.';
        error.hidden = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit Expression';
        }
      }
    });

    const savedSession = getStatusSession();
    if (savedSession?.email && savedSession?.reference) {
      activeStatusSession = savedSession;
      refreshSavedStatus().catch(() => {
        showStatusPortal(false);
        showApplicationSection(true);
      });
    } else {
      showStatusPortal(false);
      showApplicationSection(true);
    }

    showStep(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

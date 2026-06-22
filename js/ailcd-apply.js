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

  let currentStep = 0;
  let signaturePad = null;

  function val(name) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return '';
    if (el.type === 'radio') {
      const checked = document.querySelector(`[name="${name}"]:checked`);
      return checked ? checked.value : '';
    }
    if (el.type === 'checkbox' && el.name !== 'positions' && el.name !== 'skills') {
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

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2a1f17';
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      return {
        x: point.clientX - rect.left,
        y: point.clientY - rect.top
      };
    }

    function startDraw(e) {
      drawing = true;
      const { x, y } = getPos(e);
      lastX = x;
      lastY = y;
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

    function endDraw() {
      drawing = false;
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    window.addEventListener('resize', () => {
      if (hasStroke) return;
      resize();
    });

    resize();

    return {
      isEmpty: () => !hasStroke,
      clear: () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStroke = false;
      },
      toDataURL: () => (hasStroke ? canvas.toDataURL('image/png') : '')
    };
  }

  function collectFormData() {
    const positions = checkedValues('positions');
    const otherText = val('positionOther');
    if (positions.includes('Other') && otherText) {
      positions.push(`Other: ${otherText}`);
    }

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

    if (currentStep === 1 && !validateCheckboxGroup(fieldset, 'positions')) {
      alert('Please select at least one interim leadership position.');
      return false;
    }

    if (currentStep === 2 && !validateCheckboxGroup(fieldset, 'skills')) {
      alert('Please select at least one skill or strength.');
      return false;
    }

    if (currentStep === 3 && signaturePad?.isEmpty()) {
      alert('Please sign in the signature box before submitting.');
      document.getElementById('signatureCanvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    return true;
  }

  function init() {
    const form = document.getElementById('ailcdForm');
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) signaturePad = initSignaturePad(canvas);

    document.getElementById('clearSignature')?.addEventListener('click', () => {
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
        if (!res.ok) throw new Error(data.error || data.detail || 'Submission failed');

        success.textContent = data.message || 'Expression of interest received. Thank you!';
        success.hidden = false;
        form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = true; });
      } catch (err) {
        error.textContent = err.message || 'Could not submit. Please try again or contact us.';
        error.hidden = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit expression of interest';
        }
      }
    });

    showStep(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

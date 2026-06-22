/**
 * AILCD program — multi-step online application
 */
(function () {
  const STEPS = [
    'Section A — Personal details',
    'Section B — Current employment',
    'Section C — Leadership experience',
    'Section D — Community involvement',
    'Section E — Motivation and vision',
    'Section F — Commitment',
    'Section G — Community engagement',
    'Section H — Referees',
    'Section I — Declaration'
  ];

  let currentStep = 0;

  function val(name) {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return '';
    if (el.type === 'radio') {
      const checked = document.querySelector(`[name="${name}"]:checked`);
      return checked ? checked.value : '';
    }
    if (el.type === 'checkbox') return el.checked;
    return el.value.trim();
  }

  function collectRepeat(prefix, count) {
    const items = [];
    for (let i = 0; i < count; i++) {
      const role = val(`${prefix}Role${i}`);
      const org = val(`${prefix}Org${i}`);
      const dates = val(`${prefix}Dates${i}`);
      const achievements = val(`${prefix}Achieve${i}`);
      if (role || org || dates || achievements) {
        items.push({ role, organisation: org, dates, achievements });
      }
    }
    return items;
  }

  function collectFormData() {
    return {
      personal: {
        title: val('title'),
        surname: val('surname'),
        givenNames: val('givenNames'),
        gender: val('gender'),
        dateOfBirth: val('dateOfBirth'),
        address: val('address'),
        suburb: val('suburb'),
        state: val('state'),
        postcode: val('postcode'),
        countryOfResidence: val('countryOfResidence'),
        phone: val('phone'),
        mobile: val('mobile'),
        email: val('email'),
        languageGroup: val('languageGroup'),
        citizenship: val('citizenship'),
        countryOfBirth: val('countryOfBirth'),
        yearOfArrival: val('yearOfArrival'),
        residentialStatus: val('residentialStatus')
      },
      employment: {
        employer: val('employer'),
        position: val('position'),
        dateCommenced: val('dateCommenced'),
        responsibilities: val('responsibilities'),
        workAddress: val('workAddress'),
        workSuburb: val('workSuburb'),
        workState: val('workState'),
        workPostcode: val('workPostcode'),
        workPhone: val('workPhone'),
        workEmail: val('workEmail'),
        highestQualification: val('highestQualification'),
        fieldOfStudy: val('fieldOfStudy'),
        institution: val('institution'),
        yearQualified: val('yearQualified')
      },
      leadership: collectRepeat('leadership', 3),
      communityInvolvement: collectRepeat('community', 3),
      motivation: {
        whyParticipate: val('whyParticipate'),
        leadershipGoals: val('leadershipGoals')
      },
      commitment: {
        attendSessions: val('attendSessions'),
        attendSessionsExplain: val('attendSessionsExplain'),
        employerSupport: val('employerSupport'),
        employerSupportExplain: val('employerSupportExplain'),
        preparedFee: val('preparedFee'),
        hoursPerWeek: val('hoursPerWeek')
      },
      community: {
        communityBenefit: val('communityBenefit'),
        communityIssues: val('communityIssues'),
        orgMemberships: val('orgMemberships'),
        boardRoles: val('boardRoles')
      },
      referees: [
        {
          name: val('ref1Name'),
          position: val('ref1Position'),
          organisation: val('ref1Org'),
          phone: val('ref1Phone'),
          email: val('ref1Email')
        },
        {
          name: val('ref2Name'),
          position: val('ref2Position'),
          organisation: val('ref2Org'),
          phone: val('ref2Phone'),
          email: val('ref2Email')
        }
      ].filter(r => r.name || r.email),
      declaration: {
        agreed: val('agreed'),
        fullName: val('declarationName'),
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
    if (label) label.textContent = `Section ${String.fromCharCode(65 + step)} of ${STEPS.length} — ${STEPS[step].replace(/^Section [A-I] — /, '')}`;

    document.getElementById('ailcdPrev').hidden = step === 0;
    document.getElementById('ailcdNext').hidden = step === STEPS.length - 1;
    document.getElementById('ailcdSubmit').hidden = step !== STEPS.length - 1;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateCurrentStep() {
    const fieldset = document.querySelector(`.ailcd-step[data-step="${currentStep}"]`);
    if (!fieldset) return true;
    const required = fieldset.querySelectorAll('[required]');
    for (const el of required) {
      if (el.type === 'radio') {
        const group = fieldset.querySelectorAll(`[name="${el.name}"]`);
        if (![...group].some(r => r.checked)) {
          el.focus();
          return false;
        }
      } else if (el.type === 'checkbox') {
        if (!el.checked) {
          el.focus();
          return false;
        }
      } else if (!el.value.trim()) {
        el.reportValidity();
        el.focus();
        return false;
      }
    }
    return true;
  }

  function init() {
    const form = document.getElementById('ailcdForm');
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

        success.textContent = data.message || 'Application received. Thank you!';
        success.hidden = false;
        form.querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = true; });
      } catch (err) {
        error.textContent = err.message || 'Could not submit. Please try again or contact us.';
        error.hidden = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Submit application';
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

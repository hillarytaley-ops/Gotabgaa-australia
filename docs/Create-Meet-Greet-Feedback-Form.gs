/**
 * OPTIONAL / LEGACY — prefer the website form instead:
 *   https://gotabgaaaustralia.org/meet-greet-feedback.html
 * (plain tick boxes, no Google Forms editor chrome)
 *
 * Gotabgaa Australia — Meet & Greet feedback form (Google Forms)
 * 1. Set FORM_ID from your form /edit URL
 * 2. Save → Run buildMeetGreetFeedbackForm
 */
var FORM_ID = '1evAVsKOBAH24o5Pcvz1YluTKRDm8ekYpEHpf_0RI9Kc';

function buildMeetGreetFeedbackForm() {
  const title = 'Gotabgaa Australia — Meet & Greet Feedback';
  const description = [
    'Kongoi Bik Chok! 🇰🇪🇦🇺',
    '',
    'Thank you for joining the Meet & Greet with Hon. Dr. Bishop Emeritus Jackson Kosgei.',
    'Please tick the boxes that apply. This takes about 1 minute.'
  ].join('\n');

  const form = openOrCreateForm(title);
  form.setTitle(title);
  form.setDescription(description);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Kongoi bik chok. Thank you — your feedback helps Gotabgaa Australia.'
  );

  clearFormItems(form);

  // All questions = tick boxes only (no dropdowns, no 1–5 scales)

  form.addCheckboxItem()
    .setTitle('1. Did you attend? (tick one)')
    .setChoiceValues([
      'Yes — joined live on Zoom',
      'Yes — watched later',
      'No — could not attend'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('2. Your state / territory (tick one)')
    .setChoiceValues([
      'NSW',
      'VIC',
      'QLD',
      'WA',
      'SA',
      'ACT',
      'TAS',
      'NT',
      'Other / Overseas'
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('3. Overall, how was the Meet & Greet? (tick one)')
    .setChoiceValues([
      'Excellent',
      'Good',
      'Okay',
      'Poor'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('4. Was the discussion useful for our community? (tick one)')
    .setChoiceValues([
      'Very useful',
      'Useful',
      'A little useful',
      'Not useful'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('5. Which topics mattered to you? (tick all that apply)')
    .setChoiceValues([
      'Mental health & wellbeing',
      'Alcohol & substance misuse',
      'Investment & economic empowerment',
      'Identity, culture & heritage',
      'Spirit of togetherness',
      'Political awareness & civic discussion',
      'Hearing Bishop Kosgei',
      'Hearing other members'
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('6. Was 8:00 pm okay? (tick one)')
    .setChoiceValues([
      'Yes',
      'Too late',
      'Too early',
      'I did not attend live'
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('7. How was Zoom? (tick one)')
    .setChoiceValues([
      'Easy',
      'Okay',
      'Difficult',
      'I did not use Zoom'
    ])
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle('8. Would you come to another Meet & Greet? (tick one)')
    .setChoiceValues([
      'Yes',
      'Maybe',
      'No'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('9. What should we do next? (tick all that apply)')
    .setChoiceValues([
      'Another Meet & Greet soon',
      'More youth / family topics',
      'More business / investment topics',
      'More culture & heritage topics',
      'In-person gatherings as well as Zoom',
      'Shorter sessions'
    ])
    .setRequired(false);

  const url = form.getPublishedUrl();
  const editUrl = form.getEditUrl();
  Logger.log('Share this link with members: ' + url);
  Logger.log('Edit the form here: ' + editUrl);
  return { url: url, editUrl: editUrl };
}

function createMeetGreetFeedbackForm() {
  return buildMeetGreetFeedbackForm();
}

function openOrCreateForm(title) {
  const id = String(FORM_ID || '').replace(/\s+/g, '').trim();
  if (id) {
    Logger.log('Opening existing form: ' + id);
    try {
      return FormApp.openById(id);
    } catch (err) {
      throw new Error(
        'Could not open FORM_ID "' + id + '". ' +
        'Copy the ID from the form /edit URL (same Google account, no spaces). ' +
        'Google said: ' + err
      );
    }
  }

  const maxTries = 5;
  var lastError;
  for (var i = 1; i <= maxTries; i++) {
    try {
      return FormApp.create(title);
    } catch (err) {
      lastError = err;
      if (i < maxTries) Utilities.sleep(3000 * i);
    }
  }
  throw new Error('FormApp.create failed. Set FORM_ID from a blank form. Last error: ' + lastError);
}

function clearFormItems(form) {
  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i--) {
    form.deleteItem(items[i]);
  }
}

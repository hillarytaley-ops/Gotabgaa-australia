/**
 * Generates Gotabgaa Empowerment Fare (E-Fare) programme document as a branded PDF.
 * Run: node scripts/generate-efare-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'assets', 'logo-round.png');
const outPath = path.join(root, 'docs', 'Gotabgaa-Empowerment-Fare-E-Fare.pdf');

const BRAND = {
  brown900: [42, 31, 23],
  brown800: [61, 43, 31],
  tan: [184, 134, 75],
  cream: [248, 244, 238],
  muted: [92, 67, 50],
  border: [221, 213, 200],
  white: [255, 255, 255]
};

const PAGE = { w: 210, h: 297, margin: 20, footer: 282 };
const CONTENT_BOTTOM = PAGE.footer - 6;
const PAGE_BODY_TOP = PAGE.margin + 8;
const PAGE_BODY_H = CONTENT_BOTTOM - PAGE_BODY_TOP;

function sanitizePdfText(text) {
  return String(text)
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u2192|\u21D2/g, '->')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ');
}

function setFill(doc, rgb) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
function setDraw(doc, rgb) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }
function setText(doc, rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }

/** Move to a new page if `needed` cannot fit on the current page (keep blocks together). */
function keepTogether(doc, y, needed) {
  const need = Math.min(needed, PAGE_BODY_H);
  if (y + need > CONTENT_BOTTOM) {
    doc.addPage();
    return PAGE_BODY_TOP;
  }
  return y;
}

function measureParagraphs(doc, paragraphs, maxWidth) {
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  let h = 0;
  paragraphs.forEach(text => {
    const lines = doc.splitTextToSize(sanitizePdfText(text), maxWidth);
    h += lines.length * 5.2 + 4;
  });
  return h;
}

function measureHighlightBox(doc, text, maxWidth) {
  const pad = 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  const textLines = doc.splitTextToSize(sanitizePdfText(text), maxWidth - pad * 2);
  return 10 + textLines.length * 4.8 + pad * 2 + 6;
}

function measureInfoBox(doc, heading, items, maxWidth) {
  const pad = 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  let contentH = heading
    ? doc.splitTextToSize(sanitizePdfText(heading), maxWidth - pad * 2 - 2).length * 4.8 + 6
    : 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  items.forEach(item => {
    const lines = doc.splitTextToSize(sanitizePdfText(`- ${item}`), maxWidth - pad * 2 - 4);
    contentH += lines.length * 4.4 + 2;
  });
  contentH += pad * 2 + 4;
  return contentH + 6;
}

function measureStepItem(doc, text, maxWidth) {
  const pad = 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const stepW = doc.getTextWidth('Step 9') + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const bodyLines = doc.splitTextToSize(sanitizePdfText(text), maxWidth - pad * 2 - stepW - 6);
  return Math.max(12, bodyLines.length * 4.2 + pad * 2 + 4) + 3;
}

function measureSectionTitle() {
  return 14;
}

/** Draw paragraphs without page breaks (keep-together is handled by startTopic). */
function addParagraphs(doc, paragraphs, startY, maxWidth) {
  let y = startY;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  setText(doc, BRAND.brown900);
  paragraphs.forEach(text => {
    const lines = doc.splitTextToSize(sanitizePdfText(text), maxWidth);
    const lineH = lines.length * 5.2 + 4;
    doc.text(lines, PAGE.margin, y);
    y += lineH;
  });
  return y;
}

function addSectionTitle(doc, title, startY, maxWidth) {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, BRAND.brown800);
  doc.text(sanitizePdfText(title), PAGE.margin, y);
  y += 4;
  setFill(doc, BRAND.cream);
  doc.rect(PAGE.margin, y, maxWidth, 0.4, 'F');
  return y + 8;
}

function addHighlightBox(doc, label, text, startY, maxWidth) {
  const pad = 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  const textLines = doc.splitTextToSize(sanitizePdfText(text), maxWidth - pad * 2);
  const boxH = 10 + textLines.length * 4.8 + pad * 2;

  const y = startY;
  setFill(doc, BRAND.cream);
  doc.roundedRect(PAGE.margin, y, maxWidth, boxH, 2, 2, 'F');
  setFill(doc, BRAND.tan);
  doc.rect(PAGE.margin, y, 2, boxH, 'F');

  let innerY = y + pad + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BRAND.tan);
  doc.text(sanitizePdfText(label), PAGE.margin + pad + 2, innerY);
  innerY += 7;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  setText(doc, BRAND.brown900);
  doc.text(textLines, PAGE.margin + pad + 2, innerY);

  return y + boxH + 6;
}

function addInfoBox(doc, heading, items, startY, maxWidth) {
  const pad = 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const headingLines = heading ? doc.splitTextToSize(sanitizePdfText(heading), maxWidth - pad * 2 - 2) : [];
  let contentH = heading ? headingLines.length * 4.8 + 6 : 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const itemLines = items.map(item =>
    doc.splitTextToSize(sanitizePdfText(`- ${item}`), maxWidth - pad * 2 - 4)
  );
  itemLines.forEach(lines => {
    contentH += lines.length * 4.4 + 2;
  });
  contentH += pad * 2 + 4;

  const y = startY;
  setFill(doc, BRAND.cream);
  doc.roundedRect(PAGE.margin, y, maxWidth, contentH, 2, 2, 'F');
  setFill(doc, BRAND.tan);
  doc.rect(PAGE.margin, y, 2, contentH, 'F');

  let innerY = y + pad + 4;
  if (heading) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(doc, BRAND.brown800);
    doc.text(headingLines, PAGE.margin + pad + 2, innerY);
    innerY += headingLines.length * 4.8 + 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.brown900);
  itemLines.forEach(lines => {
    doc.text(lines, PAGE.margin + pad + 2, innerY);
    innerY += lines.length * 4.4 + 2;
  });

  return y + contentH + 6;
}

function addStepItem(doc, stepNum, text, startY, maxWidth) {
  const pad = 3;
  const stepLabel = `Step ${stepNum}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const stepW = doc.getTextWidth(stepLabel) + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const bodyLines = doc.splitTextToSize(sanitizePdfText(text), maxWidth - pad * 2 - stepW - 6);
  const boxH = Math.max(12, bodyLines.length * 4.2 + pad * 2 + 4);

  const y = startY;
  setFill(doc, BRAND.white);
  setDraw(doc, BRAND.border);
  doc.roundedRect(PAGE.margin + 2, y, maxWidth - 4, boxH, 1.5, 1.5, 'FD');

  const innerY = y + pad + 5;
  setFill(doc, BRAND.tan);
  doc.roundedRect(PAGE.margin + pad + 4, innerY - 3.5, stepW, 5.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setText(doc, BRAND.white);
  doc.text(stepLabel, PAGE.margin + pad + 4 + 3, innerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.brown900);
  doc.text(bodyLines, PAGE.margin + pad + 4 + stepW + 4, innerY);

  return y + boxH + 3;
}

/** Start a topic only where the full title + body can fit on one page. */
function startTopic(doc, y, maxWidth, title, estimateBodyHeight) {
  const total = measureSectionTitle() + estimateBodyHeight;
  y = keepTogether(doc, y, Math.min(total, PAGE_BODY_H));
  return addSectionTitle(doc, title, y, maxWidth);
}

function buildPdf() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const maxWidth = PAGE.w - PAGE.margin * 2;
  let y = PAGE.margin;

  const logoSize = 28;
  const logoX = (PAGE.w - logoSize) / 2;
  if (fs.existsSync(logoPath)) {
    const logoB64 = fs.readFileSync(logoPath).toString('base64');
    doc.addImage(`data:image/png;base64,${logoB64}`, 'PNG', logoX, y, logoSize, logoSize);
  }
  y += logoSize + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setText(doc, BRAND.brown900);
  doc.text('Gotabgaa Australia', PAGE.w / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, BRAND.tan);
  doc.text('UNITY . HERITAGE . EXCELLENCE', PAGE.w / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  setText(doc, BRAND.muted);
  doc.text('A warm invitation to review and vote', PAGE.w / 2, y, { align: 'center' });
  y += 8;

  setFill(doc, BRAND.brown800);
  doc.rect(PAGE.margin, y, maxWidth, 0.8, 'F');
  y += 8;

  setFill(doc, BRAND.brown800);
  doc.roundedRect(PAGE.margin, y, maxWidth, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, BRAND.white);
  doc.text('Together we grow - through trust, unity, and shared opportunity', PAGE.w / 2, y + 7, { align: 'center' });
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.muted);
  doc.text('Date: July 2026  |  Status: Proposal for Interim Leadership review and vote', PAGE.margin, y);
  y += 4.5;
  doc.text('To: All Members of the Interim Leadership Team', PAGE.margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText(doc, BRAND.brown800);
  doc.text('Empowerment Fare (E-Fare)', PAGE.w / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, BRAND.tan);
  doc.text('Interest-free support, shared by our community', PAGE.w / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  setText(doc, BRAND.muted);
  doc.text('When we pool our strength, we lift one another.', PAGE.w / 2, y, { align: 'center' });
  y += 10;

  {
    const dear = 'Thank you for taking time to read this. We offer E-Fare for your open discussion, kind feedback, and a clear vote. Our hope is simple: a programme our community can trust - fair to those who receive help, protective of the shared fund, and true to Gotabgaa\'s non-profit spirit.';
    y = keepTogether(doc, y, measureHighlightBox(doc, dear, maxWidth));
    y = addHighlightBox(doc, 'DEAR INTERIM LEADERS', dear, y, maxWidth);
  }

  // --- Section 1 ---
  {
    const paras = [
      'Empowerment Fare (E-Fare) is a warm, practical way for members of Gotabgaa Australia to support one another financially - without bank interest, and without leaving anyone behind.',
      'Members contribute a modest fee into a shared pool. When the programme is ready, selected members may receive interest-free support to start a business, invest wisely, study, or take another approved step towards a stronger future. In time, they return what they borrowed so the next family of members can be lifted too.',
      'It is the spirit of kimnatet ak kibagenge - unity and coming together - expressed in a simple, careful system.'
    ];
    const nutshell = 'Join with a modest fee. Receive support in small groups of 2-3 members every six months. Return what you borrowed. Then another 2-3 members take their turn. Every dollar stays with the community. Gotabgaa does not profit.';
    const bodyH = measureParagraphs(doc, paras, maxWidth) + measureHighlightBox(doc, nutshell, maxWidth);
    y = startTopic(doc, y, maxWidth, '1. What Is E-Fare?', bodyH);
    y = addParagraphs(doc, paras, y, maxWidth);
    y = addHighlightBox(doc, 'IN A NUTSHELL', nutshell, y, maxWidth);
  }

  // --- Section 2 ---
  {
    const paras = [
      'Many of us arrived in Australia with talent, courage, and big dreams. Yet starting a business, buying tools, or building stability can be hard when formal lending feels expensive or out of reach.',
      'E-Fare offers a friendlier path: community support rooted in dignity and trust. As a non-profit, Gotabgaa\'s aim is not personal gain. It is to strengthen our people - in line with Empowerment and Growth and Investment Welfare.'
    ];
    y = startTopic(doc, y, maxWidth, '2. Why E-Fare Matters', measureParagraphs(doc, paras, maxWidth));
    y = addParagraphs(doc, paras, y, maxWidth);
  }

  // --- Section 3 ---
  {
    const intro = ['Six clear steps. Easy to follow. Fair for everyone.'];
    const steps = [
      'Join. Register for E-Fare by paying a modest participation fee (amount to be agreed by leadership). This builds the shared fund and shows your commitment.',
      'Grow the fund. As more members join, the pool grows. We start granting support only when the fund is strong enough to do so safely.',
      'Apply with a plan. Only 2-3 members receive support in each six-month cycle. Every applicant submits a clear Statement of Investment plus supporting evidence.',
      'Fair review. The E-Fare committee reviews plans and documents on merit. Incomplete applications, or ones without evidence, will not be approved.',
      'Use and repay. Those 2-3 members repay within the six-month module. There is no interest.',
      'Pass it on. When amounts are returned, the next 2-3 members can be supported. The circle continues gently and continuously.'
    ];
    let bodyH = measureParagraphs(doc, intro, maxWidth);
    steps.forEach(t => { bodyH += measureStepItem(doc, t, maxWidth); });
    bodyH += 4;
    y = startTopic(doc, y, maxWidth, '3. How E-Fare Works', bodyH);
    y = addParagraphs(doc, intro, y, maxWidth);
    steps.forEach((text, i) => {
      y = addStepItem(doc, i + 1, text, y, maxWidth);
    });
    y += 4;
  }

  // --- Section 4 ---
  {
    const paras = [
      'We will keep the number of people receiving support carefully limited. This protects the fund, builds confidence, and gives each borrower the care they deserve.'
    ];
    const circle = [
      'Six-month modules: Each round lasts six months.',
      'Small groups only: At the start of a module, strictly 2-3 members may receive funds.',
      'Return what you borrow: Those members are expected to repay in full by the end of the module.',
      'Next round opens: As money returns, the next 2-3 members may be supported.',
      'It keeps going: Module 1 (2-3 members) -> repayment -> Module 2 (next 2-3) -> and so on.',
      'Friendly waiting list: Members not chosen this round stay on a clear queue for a later turn.',
      'No overcrowding: We do not start a new full group while the previous group is still fully unpaid - unless the committee records a clear, written exception.'
    ];
    const why = 'Beginning with 2-3 members helps us learn, protect community money, and show that trust works. If leaders later agree by vote, we may grow the numbers thoughtfully.';
    const bodyH = measureParagraphs(doc, paras, maxWidth)
      + measureInfoBox(doc, 'The continuous circle', circle, maxWidth)
      + measureHighlightBox(doc, why, maxWidth);
    y = startTopic(doc, y, maxWidth, '4. Sharing Fairly - Only 2-3 Members at a Time', bodyH);
    y = addParagraphs(doc, paras, y, maxWidth);
    y = addInfoBox(doc, 'The continuous circle', circle, y, maxWidth);
    y = addHighlightBox(doc, 'WHY START SMALL?', why, y, maxWidth);
  }

  // --- Section 5 ---
  {
    const paras1 = [
      'We gladly support real plans. Before money is released, every applicant must explain clearly what they will invest in and provide evidence. The community trusts you; your plan helps us trust the purpose.'
    ];
    const items = [
      'Statement of Investment: A short written plan covering what the money is for, expected benefit, a simple budget, and timeline.',
      'Evidence: Documents that support your plan. No statement, or no evidence, means the application cannot proceed.',
      'If it is a business: Please provide business registration (or proof that registration is underway), ABN where relevant, and related papers such as a brief plan, quotes, or lease/supplier documents as asked.',
      'If it is something else: Education, tools, or similar goals need matching evidence - for example enrolment, quotes, invoices, or licences.',
      'Extra help if needed: The committee may kindly ask for more documents, or decline applications that are unclear.'
    ];
    const paras2 = ['This keeps E-Fare honest, protective of the fund, and focused on genuine empowerment.'];
    const bodyH = measureParagraphs(doc, paras1, maxWidth)
      + measureInfoBox(doc, 'What you need to include', items, maxWidth)
      + measureParagraphs(doc, paras2, maxWidth);
    y = startTopic(doc, y, maxWidth, '5. Tell Us Your Plan - Statement of Investment', bodyH);
    y = addParagraphs(doc, paras1, y, maxWidth);
    y = addInfoBox(doc, 'What you need to include', items, y, maxWidth);
    y = addParagraphs(doc, paras2, y, maxWidth);
  }

  // --- Section 6 ---
  {
    const paras = [
      'E-Fare does not charge interest. That is a deliberate choice. We want empowerment to feel light on the shoulders, not heavy with debt.',
      'Grant amounts and detailed rules will be published openly for all members, and refined with care as the programme grows.'
    ];
    y = startTopic(doc, y, maxWidth, '6. Our Promise - Interest-Free Support', measureParagraphs(doc, paras, maxWidth));
    y = addParagraphs(doc, paras, y, maxWidth);
  }

  // --- Section 7 ---
  {
    const paras1 = [
      'Timely repayment keeps the door open for the next members. We ask every borrower to honour the trust they have been given - and we will meet genuine hardship with listening and kindness first.'
    ];
    const terms = [
      'Timeframe: Usually six months from when funds are received (unless another plan is agreed in writing).',
      'Instalments: Clear, scheduled repayments set out in each member\'s agreement.',
      'Interest: None.',
      'Late admin fee: If repayment is overdue, a small fee of 1% to 2% of the outstanding amount may apply - only to encourage fairness, cover light admin costs, and protect the fund. It is not for profit.',
      'Hardship: Please contact the committee early. We will seek a caring solution before any penalty.'
    ];
    const delay = [
      'Stage 1: Friendly reminders and the small admin fee if overdue.',
      'Stage 2: If delay continues, or repayment seems avoided after a fair chance to arrange a plan, we escalate.',
      'Stage 3: A designated recovery body (or recovery officer) helps recover funds fairly, respectfully, and on record.',
      'Stage 4: In serious cases, E-Fare membership may be suspended for a set period, or ended - while recovery of the money continues. This is a last resort to protect everyone who plays fairly.'
    ];
    const close = ['Firm where we must be. Friendly where we can be. Always fair.'];
    const bodyH = measureParagraphs(doc, paras1, maxWidth)
      + measureInfoBox(doc, 'Simple repayment terms', terms, maxWidth)
      + measureInfoBox(doc, 'If repayment is delayed too long', delay, maxWidth)
      + measureParagraphs(doc, close, maxWidth);
    y = startTopic(doc, y, maxWidth, '7. Paying Back with Care', bodyH);
    y = addParagraphs(doc, paras1, y, maxWidth);
    y = addInfoBox(doc, 'Simple repayment terms', terms, y, maxWidth);
    y = addInfoBox(doc, 'If repayment is delayed too long', delay, y, maxWidth);
    y = addParagraphs(doc, close, y, maxWidth);
  }

  // --- Section 8 ---
  {
    const paras = [
      'Because Gotabgaa is a non-profit serving members - not investors - E-Fare will run in the open:'
    ];
    const items = [
      'A dedicated E-Fare committee with clear duties',
      'Published rules on joining, grant limits, fees, and repayment',
      'Regular updates to members on the fund, grants given, and repayments received',
      'Fair decisions based on purpose and readiness - not personal favour',
      'Careful oversight under Gotabgaa\'s constitution and Australian law'
    ];
    const bodyH = measureParagraphs(doc, paras, maxWidth) + measureInfoBox(doc, null, items, maxWidth);
    y = startTopic(doc, y, maxWidth, '8. Open and Accountable', bodyH);
    y = addParagraphs(doc, paras, y, maxWidth);
    y = addInfoBox(doc, null, items, y, maxWidth);
  }

  // --- Section 9 ---
  {
    const paras = [
      'E-Fare welcomes Gotabgaa Australia members in good standing across NSW, SA, VIC, QLD, NT, TAS, ACT, and WA - whether you are new to the country, growing a trade, or investing in learning.'
    ];
    const items = [
      'Starting or growing a small business (stock, equipment, licensing)',
      'Training and professional development',
      'Tools, transport, or assets that help you earn',
      'Community-minded enterprise',
      'Other purposes the committee agrees support self-reliance and growth'
    ];
    const bodyH = measureParagraphs(doc, paras, maxWidth)
      + measureInfoBox(doc, 'Examples of welcome purposes', items, maxWidth);
    y = startTopic(doc, y, maxWidth, '9. Who Can Take Part?', bodyH);
    y = addParagraphs(doc, paras, y, maxWidth);
    y = addInfoBox(doc, 'Examples of welcome purposes', items, y, maxWidth);
  }

  // --- Section 10 ---
  {
    const paras = [
      'Gotabgaa Australia will remain a non-profit. E-Fare is not a money-making scheme for anyone. Fees, repaid funds, and any small late fees return only to the empowerment fund and careful running of the programme.',
      'Success is not measured in profit. It is measured in businesses started, families strengthened, and a community that chose to stand together.'
    ];
    y = startTopic(doc, y, maxWidth, '10. Our Non-Profit Promise', measureParagraphs(doc, paras, maxWidth));
    y = addParagraphs(doc, paras, y, maxWidth);
  }

  // --- Section 11 ---
  {
    const paras1 = [
      'Dear colleagues: please read this with an open heart, share your thoughts freely, and help us decide together.'
    ];
    const ask = [
      'Read the full proposal (including the 2-3 member circle, investment plans, repayment, and recovery)',
      'Discuss any questions or improvements in an Interim Leadership meeting',
      'Vote to: (a) Approve as presented; (b) Approve with amendments; or (c) Defer for more discussion',
      'Record the outcome clearly so next steps are transparent'
    ];
    const motion = 'That the Interim Leadership Team of Gotabgaa Australia adopts the Empowerment Fare (E-Fare) proposal - including six-month modules limited to 2-3 members at a time, with the next group supported only after repayments return; a mandatory Statement of Investment with evidence (including business registration for business plans); interest-free support; a 1%-2% late admin fee if overdue; recovery action where repayment is delayed too long or avoided; and the power to suspend or end E-Fare membership in such cases - with detailed operating rules to be finalised by the E-Fare committee.';
    const paras2 = [
      'Thank you for walking this path with us. May our decision serve our people - in peace, love, and unity.'
    ];
    const bodyH = measureParagraphs(doc, paras1, maxWidth)
      + measureInfoBox(doc, 'We kindly ask each interim leader to', ask, maxWidth)
      + measureHighlightBox(doc, motion, maxWidth)
      + measureParagraphs(doc, paras2, maxWidth);
    y = startTopic(doc, y, maxWidth, '11. Your Review and Vote', bodyH);
    y = addParagraphs(doc, paras1, y, maxWidth);
    y = addInfoBox(doc, 'We kindly ask each interim leader to', ask, y, maxWidth);
    y = addHighlightBox(doc, 'SUGGESTED WORDING FOR THE VOTE', motion, y, maxWidth);
    y = addParagraphs(doc, paras2, y, maxWidth);
  }

  y += 8;
  y = keepTogether(doc, y, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, BRAND.brown900);
  doc.text('Presented for Interim Leadership review and vote', PAGE.margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, BRAND.muted);
  doc.text('Gotabgaa Australia - Interim Leadership Team', PAGE.margin, y);

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    setText(doc, BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Gotabgaa Australia - E-Fare Proposal (Interim Leadership Vote)', PAGE.margin, PAGE.footer);
    doc.text(`Page ${p} of ${pageCount}`, PAGE.w - PAGE.margin, PAGE.footer, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

const pdf = buildPdf();
fs.writeFileSync(outPath, pdf);
console.log(`PDF written to ${outPath} (${pdf.length} bytes)`);

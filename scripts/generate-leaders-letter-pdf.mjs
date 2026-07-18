/**
 * Generates the Kalenjin community leaders invitation letter as a branded PDF.
 * Run: node scripts/generate-leaders-letter-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'assets', 'logo-round.png');
const outPath = path.join(root, 'docs', 'Gotabgaa-Community-Leaders-Invitation-Letter.pdf');

const BRAND = {
  brown900: [42, 31, 23],
  brown800: [61, 43, 31],
  tan: [184, 134, 75],
  cream: [248, 244, 238],
  muted: [92, 67, 50],
  white: [255, 255, 255]
};

const PAGE = { w: 210, h: 297, margin: 20, footer: 282 };

function setFill(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE.footer - 6) {
    doc.addPage();
    return PAGE.margin + 8;
  }
  return y;
}

function addParagraphs(doc, paragraphs, startY, maxWidth) {
  let y = startY;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  setText(doc, BRAND.brown900);

  paragraphs.forEach(text => {
    const lines = doc.splitTextToSize(text, maxWidth);
    const blockH = lines.length * 5.2 + 4;
    y = ensureSpace(doc, y, blockH);
    doc.text(lines, PAGE.margin, y);
    y += blockH;
  });
  return y;
}

function addSectionTitle(doc, title, startY, maxWidth) {
  let y = ensureSpace(doc, startY, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, BRAND.brown800);
  doc.text(title, PAGE.margin, y);
  y += 4;
  setFill(doc, BRAND.cream);
  doc.rect(PAGE.margin, y, maxWidth, 0.4, 'F');
  return y + 8;
}

function addPurposeBox(doc, startY, maxWidth) {
  const label = 'PURPOSE OF THIS LETTER';
  const text = 'To respectfully invite you to a leaders’ dialogue, following the public participation meeting of 4 July 2026, where members asked us to reach out in friendship and seek unity together.';
  const pad = 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const labelLines = doc.splitTextToSize(label, maxWidth - pad * 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const textLines = doc.splitTextToSize(text, maxWidth - pad * 2);
  const boxH = labelLines.length * 4 + textLines.length * 4.4 + pad * 2 + 6;

  let y = ensureSpace(doc, startY, boxH);
  setFill(doc, BRAND.cream);
  doc.roundedRect(PAGE.margin, y, maxWidth, boxH, 2, 2, 'F');

  let innerY = y + pad + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BRAND.tan);
  doc.text(labelLines, PAGE.margin + pad, innerY);
  innerY += labelLines.length * 4 + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(doc, BRAND.brown900);
  doc.text(textLines, PAGE.margin + pad, innerY);

  return y + boxH + 8;
}

function addInfoBox(doc, heading, items, startY, maxWidth, numbered = false) {
  const pad = 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const headingLines = doc.splitTextToSize(heading, maxWidth - pad * 2 - 2);
  let contentH = headingLines.length * 4.8 + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  items.forEach(item => {
    const prefix = numbered ? `${item.index}. ` : '• ';
    const lines = doc.splitTextToSize(`${prefix}${item.text || item}`, maxWidth - pad * 2 - 4);
    contentH += lines.length * 4.4 + 2;
  });
  contentH += pad * 2 + 4;

  let y = ensureSpace(doc, startY, contentH);
  setFill(doc, BRAND.cream);
  doc.roundedRect(PAGE.margin, y, maxWidth, contentH, 2, 2, 'F');
  setFill(doc, BRAND.tan);
  doc.rect(PAGE.margin, y, 2, contentH, 'F');

  let innerY = y + pad + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setText(doc, BRAND.brown800);
  doc.text(headingLines, PAGE.margin + pad + 2, innerY);
  innerY += headingLines.length * 4.8 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.brown900);
  items.forEach((item, idx) => {
    const prefix = numbered ? `${idx + 1}. ` : '• ';
    const lines = doc.splitTextToSize(`${prefix}${item.text || item}`, maxWidth - pad * 2 - 4);
    innerY = ensureSpace(doc, innerY, lines.length * 4.4);
    if (innerY === PAGE.margin + 8) {
      setFill(doc, BRAND.cream);
      doc.roundedRect(PAGE.margin, innerY - 4, maxWidth, 8, 2, 2, 'F');
    }
    doc.text(lines, PAGE.margin + pad + 2, innerY);
    innerY += lines.length * 4.4 + 2;
  });

  return y + contentH + 6;
}

function addThemeGrid(doc, themes, startY, maxWidth) {
  let y = startY;
  themes.forEach(theme => {
    const pad = 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const titleLines = doc.splitTextToSize(theme.title, maxWidth - pad * 2 - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    const bodyLines = doc.splitTextToSize(theme.text, maxWidth - pad * 2 - 4);
    const boxH = titleLines.length * 4 + bodyLines.length * 4.1 + pad * 2 + 4;

    y = ensureSpace(doc, y, boxH + 2);
    setFill(doc, BRAND.white);
    doc.roundedRect(PAGE.margin + 2, y, maxWidth - 4, boxH, 1.5, 1.5, 'F');
    setFill(doc, BRAND.border || [221, 213, 200]);
    doc.roundedRect(PAGE.margin + 2, y, maxWidth - 4, boxH, 1.5, 1.5, 'S');

    let innerY = y + pad + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, BRAND.brown800);
    doc.text(titleLines, PAGE.margin + pad + 4, innerY);
    innerY += titleLines.length * 4 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    setText(doc, BRAND.brown900);
    doc.text(bodyLines, PAGE.margin + pad + 4, innerY);

    y += boxH + 3;
  });
  return y + 2;
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
  doc.text('UNITY • HERITAGE • EXCELLENCE', PAGE.w / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  setText(doc, BRAND.muted);
  doc.text('From the Interim Leadership Team', PAGE.w / 2, y, { align: 'center' });
  y += 8;
  setFill(doc, BRAND.brown800);
  doc.rect(PAGE.margin, y, maxWidth, 0.8, 'F');
  y += 8;

  setFill(doc, BRAND.brown800);
  doc.roundedRect(PAGE.margin, y, maxWidth, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setText(doc, BRAND.white);
  const banner = 'In the spirit of our community — love, peace, reconciliation, and unity — for the greater good and progress of our people across Australia';
  doc.text(doc.splitTextToSize(banner, maxWidth - 8), PAGE.margin + 4, y + 6);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(doc, BRAND.muted);
  doc.text('Date: 6 July 2026', PAGE.margin, y);
  y += 4.5;
  doc.text('To: Leaders and Executive Committees of Kalenjin Community Associations across Australia', PAGE.margin, y);
  y += 4.5;
  doc.text('From: Interim Leadership Team, Gotabgaa Australia', PAGE.margin, y);
  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setText(doc, BRAND.brown800);
  const subject = 'Re: A Warm Invitation to Collaborative Dialogue — Building a United Kalenjin Umbrella Association in Australia';
  doc.text(doc.splitTextToSize(subject, maxWidth), PAGE.margin, y);
  y += 12;

  y = addPurposeBox(doc, y, maxWidth);

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  setText(doc, BRAND.brown900);
  doc.text('Dear Respected Leaders and Elders,', PAGE.margin, y);
  y += 10;

  y = addSectionTitle(doc, '1. Greetings and Background', y, maxWidth);
  y = addParagraphs(doc, [
    'We write to you with warm greetings, goodwill, and deep respect. On behalf of the Interim Leadership Team of Gotabgaa Australia, we share the outcomes of our Public Participation Meeting held on Saturday, 4 July 2026 — and extend a sincere invitation to walk this journey with us.',
    'That gathering was held in a spirit of openness, listening, and shared responsibility. Members from across our communities — representing many states and associations — spoke thoughtfully about unity, representation, governance, and the future of our people in Australia. What emerged was a clear and heartfelt message: a large majority of members present requested that we formally invite leaders of Kalenjin community associations nationwide to join a structured, respectful dialogue on the formation of an umbrella association.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '2. The Voice of Our Members', y, maxWidth);
  y = addParagraphs(doc, [
    'Our members spoke with one voice on what matters most. We share their message with you in good faith, not as demands, but as a shared aspiration for our community.'
  ], y, maxWidth);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setText(doc, BRAND.brown800);
  doc.text('Key themes raised at the public participation meeting', PAGE.margin + 2, y);
  y += 6;

  y = addThemeGrid(doc, [
    { title: 'Unity begins with leaders', text: 'Leaders should come together around one table for honest, good-faith dialogue — to build trust, not to assign blame.' },
    { title: 'Work together at the drawing board', text: 'We are still at the drawing board. All associations must be genuinely included in a consultative process before any major decisions — with transparency, public participation, and patience over haste.' },
    { title: 'Respect existing associations', text: 'An umbrella body should complement, not compete with or undermine, the work of state and local associations. Each association’s identity, history, and autonomy must be honoured.' },
    { title: 'Individual and collective participation', text: 'Members may participate on their own merit, while associations retain their own structures and leadership.' },
    { title: 'Merit-based, cooperative governance', text: 'A structure that encourages ideas on their merit, limits personality politics, and avoids the divisions of the past.' },
    { title: 'Inclusivity for all', text: 'A welcoming community for all Kalenjin members — youth and elders, all backgrounds — where everyone is heard and mentored.' },
    { title: 'Focus on community priorities', text: 'Advocacy, legal support, mental health, youth engagement, cultural preservation, investment welfare, sports, and pastoral knowledge exchange.' },
    { title: 'Accountability and clarity', text: 'Transparent governance, defined objectives, and responsible stewardship of community resources.' },
    { title: 'A moderated leaders’ summit', text: 'A meeting of association leaders — with agreed ground rules and neutral facilitation — as the most constructive next step.' }
  ], y, maxWidth);

  y = addSectionTitle(doc, '3. A Note of Reconciliation', y, maxWidth);
  y = addParagraphs(doc, [
    'It is in the spirit of love for our community, peace among our leaders, reconciliation where there has been distance, and unity for the greater good that we reach out to you today.',
    'We acknowledge, with humility and sincerity, that our earlier interaction as leaders did not bear any fruits. We do not write now to reopen old wounds, revisit past disagreements, or question anyone’s sincerity or leadership. We write because our members have asked us, clearly and kindly, to try again — and because we believe our community is always stronger when leaders choose conversation over separation.',
    'We fully understand the concerns you may hold. Many associations have served their members faithfully for years, often with limited resources and great personal sacrifice. Questions of governance, representation, identity, autonomy, and how an umbrella body relates to existing structures are legitimate and deserve careful, honest discussion — not rushed decisions. As our members reminded us: true unity is not declared — it is built, through consultation, transparency, and good intentions.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '4. Our Assurance to You', y, maxWidth);
  y = addParagraphs(doc, [
    'We wish to be clear and reassuring on what this invitation is — and what it is not.'
  ], y, maxWidth);

  y = addInfoBox(doc, 'What we are offering', [
    'Dialogue first — consultation before any major decision.',
    'Full respect for each association’s name, history, and independence.',
    'A national umbrella platform with unique and greater objectives — one that strengthens state association goals while advancing national progress for our community.',
    'Openness to your conditions, concerns, and suggestions.'
  ], y, maxWidth);

  y = addInfoBox(doc, 'What we are not seeking', [
    'We are not asking any association to surrender its identity or autonomy.',
    'Gotabgaa Australia does not seek to undermine, replace, or interfere with any association or its leadership.',
    'We do not seek to impose decisions — we seek to build understanding together.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '5. A Shared Vision We Invite You to Consider', y, maxWidth);
  y = addParagraphs(doc, [
    'Gotabgaa Australia is envisioned as an umbrella national body with unique and greater objectives — not to duplicate the work of state associations, but to strengthen their objectives and achieve national progress for our community across Australia.',
    'We believe that individuals and leaders from different backgrounds can come together, contribute their ideas, and speak with one voice in pursuit of solutions that benefit everyone. At the national level, Gotabgaa would serve as a coordinating body that lifts what each state association does well, while pursuing broader goals that no single state can achieve alone. Together, we might build a shared platform that:'
  ], y, maxWidth);

  y = addInfoBox(doc, 'Shared platform goals', [
    'Strengthens state association objectives while advancing national progress for our community;',
    'Provides a united national voice and coordination across all states in Australia;',
    'Supports coordination on investment welfare, culture, sports, youth mentorship, and community development;',
    'Addresses advocacy, legal guidance, mental health support, and cultural preservation;',
    'Honours the dignity and distinctiveness of each member association; and',
    'Reflects the will of the people we all serve — in peace, love and unity.'
  ], y, maxWidth);

  y = addParagraphs(doc, [
    'The Interim Leadership Team does not claim to speak for every Kalenjin person in Australia. We speak as servants of a process our members have entrusted to us: to bring leaders to the table and to seek a path forward that is inclusive, transparent, and worthy of our community.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '6. Our Invitation and Proposed Way Forward', y, maxWidth);
  y = addParagraphs(doc, [
    'In response to the meeting’s outcome, we would be honoured if you would agree to meet with us — formally or informally — at a time and in a manner that respects your schedules and concerns.'
  ], y, maxWidth);

  y = addInfoBox(doc, 'Members specifically requested the following', [
    'A roundtable or summit of association leaders, with neutral moderation and agreed ground rules;',
    'Representation from each association’s leadership to meet with the interim team and chart a way forward together;',
    'Written submissions ahead of a meeting, if that is your preference;',
    'A jointly developed agenda focused on vision, mission, structure, and governance — before any further steps; and',
    'A neutral venue and a process that values listening as much as speaking.'
  ], y, maxWidth);

  y = addParagraphs(doc, [
    'Our request is simple in heart, though we know it is significant in substance: let us talk. Let us listen to one another with the maturity, patience, and goodwill that our community deserves. If there are conditions under which you would be willing to engage, we are ready to hear them with an open mind. If there are leaders you believe should be included, we warmly welcome your guidance.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '7. Closing Words', y, maxWidth);
  y = addParagraphs(doc, [
    'We remain committed to diplomacy, respect, and reconciliation. When Kalenjin leaders sit together in good faith — guided by love for our people and a shared desire for peace and progress — we are always stronger than when we stand apart.',
    'We thank you sincerely for taking the time to read this letter and for considering our invitation. May our next steps be marked by unity, understanding, and the greater good of our community across Australia.',
    'Looking forward to hearing from you soon.',
    'With warm respect, peace, love, and unity in purpose,'
  ], y, maxWidth);

  y += 6;
  y = ensureSpace(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, BRAND.brown900);
  doc.text('The Interim Leadership Team', PAGE.margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, BRAND.muted);
  doc.text('Gotabgaa Australia', PAGE.margin, y);

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    setText(doc, BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Gotabgaa Australia — Interim Leadership Team', PAGE.margin, PAGE.footer);
    doc.text(`Page ${p} of ${pageCount}`, PAGE.w - PAGE.margin, PAGE.footer, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

const pdf = buildPdf();
fs.writeFileSync(outPath, pdf);
console.log(`PDF written to ${outPath} (${pdf.length} bytes)`);

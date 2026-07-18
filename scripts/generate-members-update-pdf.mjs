/**
 * Generates the members update letter (leaders invitation sent) as a branded PDF.
 * Run: node scripts/generate-members-update-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'assets', 'logo-round.png');
const outPath = path.join(root, 'docs', 'Gotabgaa-Members-Update-Letter.pdf');

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

function setFill(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc, rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
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
  const text = 'To warmly update you, our members, that we have acted on your request from the public participation meeting of 4 July 2026 and have formally invited the leaders of Kalenjin community associations across Australia to a collaborative dialogue.';
  const pad = 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const textLines = doc.splitTextToSize(text, maxWidth - pad * 2);
  const boxH = 4 + textLines.length * 4.4 + pad * 2 + 6;

  let y = ensureSpace(doc, startY, boxH);
  setFill(doc, BRAND.cream);
  doc.roundedRect(PAGE.margin, y, maxWidth, boxH, 2, 2, 'F');

  let innerY = y + pad + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BRAND.tan);
  doc.text(label, PAGE.margin + pad, innerY);
  innerY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(doc, BRAND.brown900);
  doc.text(textLines, PAGE.margin + pad, innerY);

  return y + boxH + 8;
}

function addInfoBox(doc, heading, items, startY, maxWidth) {
  const pad = 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const headingLines = doc.splitTextToSize(heading, maxWidth - pad * 2 - 2);
  let contentH = headingLines.length * 4.8 + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  items.forEach(item => {
    const lines = doc.splitTextToSize(`• ${item}`, maxWidth - pad * 2 - 4);
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
  items.forEach(item => {
    const lines = doc.splitTextToSize(`• ${item}`, maxWidth - pad * 2 - 4);
    innerY = ensureSpace(doc, innerY, lines.length * 4.4);
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
    setDraw(doc, BRAND.border);
    doc.roundedRect(PAGE.margin + 2, y, maxWidth - 4, boxH, 1.5, 1.5, 'FD');

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
  doc.text('Date: 7 July 2026', PAGE.margin, y);
  y += 4.5;
  doc.text('To: All Members and Well-Wishers of Gotabgaa Australia', PAGE.margin, y);
  y += 4.5;
  doc.text('From: Interim Leadership Team, Gotabgaa Australia', PAGE.margin, y);
  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setText(doc, BRAND.brown800);
  const subject = 'Re: Update on Your Request — We Have Written to the Leaders of Our Community Associations';
  doc.text(doc.splitTextToSize(subject, maxWidth), PAGE.margin, y);
  y += 12;

  y = addPurposeBox(doc, y, maxWidth);

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  setText(doc, BRAND.brown900);
  doc.text('Dear Members and Friends,', PAGE.margin, y);
  y += 10;

  y = addSectionTitle(doc, '1. With Gratitude and Good News', y, maxWidth);
  y = addParagraphs(doc, [
    'We write to you with warm greetings, deep gratitude, and encouraging news. At our Public Participation Meeting held on Saturday, 4 July 2026, you spoke with clarity and heart. A large majority of you asked us to reach out, in friendship and humility, to the leaders of Kalenjin community associations across the states, and to invite them into a shared conversation about the future of our people in Australia.',
    'We are pleased to inform you that we have done exactly as you requested. A formal letter of invitation has now been written and extended to the leaders and executive committees of Kalenjin community associations nationwide, inviting them to a collaborative dialogue on building a united umbrella association.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '2. What We Shared With the Leaders', y, maxWidth);
  y = addParagraphs(doc, [
    'In that letter, we carried your voice faithfully. We did not write as leaders imposing our will, but as servants of a process you have entrusted to us. We highlighted the very themes and requests you raised at the meeting — the same points we now share with you here.'
  ], y, maxWidth);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setText(doc, BRAND.brown800);
  doc.text('Key points we conveyed on your behalf', PAGE.margin + 2, y);
  y += 6;

  y = addThemeGrid(doc, [
    { title: 'Unity begins with leaders', text: 'We invited leaders to come together around one table for honest, good-faith dialogue — to build trust, not to assign blame.' },
    { title: 'Work together at the drawing board', text: 'We affirmed that we are still at the drawing board, and that all associations must be genuinely included before any major decisions — with transparency, public participation, and patience over haste.' },
    { title: 'Respect existing associations', text: 'We assured them that an umbrella body should complement, not compete with or undermine, the work of state and local associations, and that each association’s identity, history, and autonomy must be honoured.' },
    { title: 'Individual and collective participation', text: 'We conveyed that members may participate on their own merit, while associations retain their own structures and leadership.' },
    { title: 'Merit-based, cooperative governance', text: 'We called for a structure that encourages ideas on their merit, limits personality politics, and avoids the divisions of the past.' },
    { title: 'Inclusivity for all', text: 'We emphasised a welcoming community for all Kalenjin members — youth and elders, all backgrounds — where everyone is heard and mentored.' },
    { title: 'Focus on community priorities', text: 'We highlighted advocacy, legal support, mental health, youth engagement, cultural preservation, investment welfare, sports, and pastoral knowledge exchange.' },
    { title: 'Accountability and clarity', text: 'We stressed transparent governance, defined objectives, and responsible stewardship of community resources.' },
    { title: 'A moderated leaders’ summit', text: 'We proposed a meeting of association leaders — with agreed ground rules and neutral facilitation — as the most constructive next step.' }
  ], y, maxWidth);

  y = addSectionTitle(doc, '3. Our Shared Vision', y, maxWidth);
  y = addParagraphs(doc, [
    'We also shared with the leaders the vision that unites us: that Gotabgaa Australia is envisioned as an umbrella national body with unique and greater objectives — not to duplicate the work of state associations, but to strengthen their objectives and achieve national progress for our community across Australia.',
    'We reassured them, as we reassure you, that this is an invitation to dialogue — not an imposition. We are not asking any association to surrender its name, history, or independence, and Gotabgaa Australia does not seek to undermine, replace, or interfere with any association or its leadership.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '4. A Word of Appreciation', y, maxWidth);
  y = addParagraphs(doc, [
    'To every member who attended, contributed, listened, and prayed for unity — thank you. Your maturity, patience, and goodwill are the true strength of our community. As you reminded us, true unity is not declared — it is built, through consultation, transparency, and good intentions.',
    'We ask that we continue this journey together in the same spirit of love, peace, reconciliation, and unity. We will keep you informed of any response and of the next steps as they unfold.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '5. Closing Words', y, maxWidth);
  y = addParagraphs(doc, [
    'We remain committed to serving you faithfully and to keeping the door of dialogue open to all. When our community stands together — guided by love for our people and a shared desire for peace and progress — we are always stronger than when we stand apart.',
    'May our next steps be marked by unity, understanding, and the greater good of our community across Australia.',
    'With warm respect, peace, love, and unity in purpose,'
  ], y, maxWidth);

  y += 6;
  y = ensureSpace(doc, y, 20);
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

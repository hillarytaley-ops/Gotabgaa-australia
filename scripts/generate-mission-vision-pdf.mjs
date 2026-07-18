/**
 * Generates Gotabgaa Australia Mission & Vision document as a branded PDF.
 * Run: node scripts/generate-mission-vision-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'assets', 'logo-round.png');
const outPath = path.join(root, 'docs', 'Gotabgaa-Australia-Mission-Vision.pdf');

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

function setFill(doc, rgb) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
function setDraw(doc, rgb) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }
function setText(doc, rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }

function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE.footer - 6) {
    doc.addPage();
    return PAGE.margin + 8;
  }
  return y;
}

function addParagraphs(doc, paragraphs, startY, maxWidth, fontSize = 11) {
  let y = startY;
  doc.setFont('times', 'normal');
  doc.setFontSize(fontSize);
  setText(doc, BRAND.brown900);
  paragraphs.forEach(text => {
    const lines = doc.splitTextToSize(text, maxWidth);
    const blockH = lines.length * (fontSize * 0.47) + 4;
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

function addVisionMissionBox(doc, label, text, startY, maxWidth) {
  const pad = 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const labelW = doc.getTextWidth(label);
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  const textLines = doc.splitTextToSize(text, maxWidth - pad * 2);
  const boxH = 8 + textLines.length * 4.8 + pad * 2;

  let y = ensureSpace(doc, startY, boxH);
  setFill(doc, BRAND.cream);
  doc.roundedRect(PAGE.margin, y, maxWidth, boxH, 2, 2, 'F');
  setFill(doc, BRAND.tan);
  doc.rect(PAGE.margin, y, 2, boxH, 'F');

  let innerY = y + pad + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BRAND.tan);
  doc.text(label, PAGE.margin + pad + 2, innerY);
  innerY += 7;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  setText(doc, BRAND.brown900);
  doc.text(textLines, PAGE.margin + pad + 2, innerY);

  return y + boxH + 6;
}

function addPillarItem(doc, title, text, startY, maxWidth) {
  const pad = 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const titleLines = doc.splitTextToSize(title, maxWidth - pad * 2 - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const bodyLines = doc.splitTextToSize(text, maxWidth - pad * 2 - 4);
  const boxH = titleLines.length * 4.2 + bodyLines.length * 4.2 + pad * 2 + 6;

  let y = ensureSpace(doc, startY, boxH + 2);
  setFill(doc, BRAND.white);
  setDraw(doc, BRAND.border);
  doc.roundedRect(PAGE.margin + 2, y, maxWidth - 4, boxH, 1.5, 1.5, 'FD');

  let innerY = y + pad + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, BRAND.brown800);
  doc.text(titleLines, PAGE.margin + pad + 4, innerY);
  innerY += titleLines.length * 4.2 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.brown900);
  doc.text(bodyLines, PAGE.margin + pad + 4, innerY);

  return y + boxH + 3;
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
  doc.text('National Umbrella Association — Draft for Community Review', PAGE.w / 2, y, { align: 'center' });
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
  doc.setFontSize(9);
  setText(doc, BRAND.muted);
  doc.text('Date: July 2026  |  Status: Draft — subject to consultation and approval', PAGE.margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText(doc, BRAND.brown800);
  doc.text('Mission & Vision Statement', PAGE.w / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setText(doc, BRAND.muted);
  doc.text('A national framework for unity, heritage, and progress across all Australian states and territories', PAGE.w / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text('Serving Kalenjin communities in NSW, SA, VIC, QLD, NT, TAS, ACT, and WA', PAGE.w / 2, y, { align: 'center' });
  y += 12;

  y = addSectionTitle(doc, '1. Our Vision', y, maxWidth);
  y = addVisionMissionBox(doc, 'VISION', 'To be the premier unifying force for the Kalenjin community in Australia — fostering a resilient, culturally proud, and economically empowered diaspora that honours our roots while building a connected and prosperous future for present and future generations across every state and territory.', y, maxWidth);
  y = addParagraphs(doc, [
    'Our vision is of a united Kalenjin people in Australia who stand together in mutual respect, preserve what makes us who we are, and create lasting opportunities for our children and grandchildren — in peace, love, and unity.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '2. Our Mission', y, maxWidth);
  y = addVisionMissionBox(doc, 'MISSION', 'To provide a national umbrella platform that promotes unity, collaboration, advocacy, cultural preservation, mentorship, investment welfare, and community empowerment among Kalenjin people and organisations across Australia — strengthening state association objectives while advancing national progress for our community.', y, maxWidth);
  y = addParagraphs(doc, [
    'Gotabgaa Australia exists to bring Kalenjin communities together at the national level — not to replace or compete with state associations, but to complement their work with unique and greater objectives that serve the whole diaspora.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '3. Core Pillars of Our Vision', y, maxWidth);
  y = addParagraphs(doc, [
    'These five pillars guide everything we do and resonate with Kalenjin communities across all states and territories.'
  ], y, maxWidth);

  const pillars = [
    ['1. Unity — Kimnatet ak Kibagenge', 'Gotabgaa will foster mutual respect, inclusivity, collaboration, and a strong sense of belonging. By standing together, supporting one another, and embracing our diversity, we become stronger as a community — better equipped to preserve our heritage, empower our members, and create opportunities for future generations.'],
    ['2. Cultural Preservation', 'Creating spaces to celebrate Kalenjin traditions, language, and values — ensuring they are passed down to the next generation, even in a new environment. Through language literacy, traditional ceremonies, and cultural gatherings, we keep our identity alive and meaningful.'],
    ['3. Empowerment and Growth', 'Providing mentorship, educational resources, and networking opportunities that equip members to succeed in their professional and personal lives within Australia. Connecting established professionals with newcomers to support integration, career growth, and leadership development.'],
    ['4. National Connectivity — Gotab Gaa', 'Bridging the distance between states through digital platforms and annual gatherings that strengthen the Gotab Gaa spirit — the coming together of families and friends — nationally and globally. A central, easy-to-use hub for all Australian Kalenjins to connect, find resources, and stay informed, regardless of location.'],
    ['5. Emergency Response & National Solidarity', 'Uniting all Australian states and territories to respond promptly, compassionately, and effectively to emergencies affecting members of the Kalenjin community — including bereavement, serious illness, accidents, natural disasters, and other humanitarian crises through coordinated nationwide solidarity.']
  ];
  pillars.forEach(([title, text]) => {
    y = addPillarItem(doc, title, text, y, maxWidth);
  });
  y += 4;

  y = addSectionTitle(doc, '4. Strategic Objectives', y, maxWidth);
  y = addParagraphs(doc, [
    'To fulfil our mission and vision, Gotabgaa Australia will pursue the following strategic objectives:'
  ], y, maxWidth);
  y = addInfoBox(doc, 'Strategic objectives', [
    'Strengthen unity and cooperation among Kalenjin organisations nationally;',
    'Promote and preserve Kalenjin culture, language, and heritage for present and future generations;',
    'Support youth empowerment, leadership development, and mentorship initiatives;',
    'Encourage professional networking, investment welfare, and economic collaboration;',
    'Advocate for community welfare, social cohesion, and mental health support;',
    'Foster positive engagement with Australian institutions and multicultural communities;',
    'Provide a coordinated national voice on matters affecting the Kalenjin community in Australia;',
    'Coordinate compassionate, effective emergency and humanitarian response across all states and territories.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '5. Key Programmes & Initiatives', y, maxWidth);
  y = addParagraphs(doc, [
    'Our mission will be delivered through practical programmes that serve members wherever they live in Australia.'
  ], y, maxWidth);
  y = addInfoBox(doc, 'Priority initiatives', [
    'Unified Digital Hub — A central platform for connection, resources, and community news across all states and territories;',
    'Mentorship Programmes — Pairing established professionals with newcomers and youth for integration and career growth;',
    'Cultural Heritage Events — Biannual or annual gatherings featuring language literacy, traditional ceremonies, and social celebrations;',
    'Advocacy & Representation — Representing Kalenjin community interests within the broader Australian multicultural society;',
    'Investment Welfare — Coordinated support for members in times of bereavement, illness, and hardship;',
    'Sports & Youth Development — Building healthy, engaged communities through sport and youth leadership;',
    'Pastoral & Knowledge Exchange — Linking Kalenjin and Australian pastoral communities for mutual learning and opportunity.'
  ], y, maxWidth);

  y = addSectionTitle(doc, '6. Our Commitment', y, maxWidth);
  y = addParagraphs(doc, [
    'Gotabgaa Australia is still at the drawing board — and we are committed to building this vision together, with full consultation, transparency, and the genuine inclusion of all associations and members. True unity is not declared; it is built through good faith, patience, and shared purpose.',
    'We invite every Kalenjin community across Australia to walk this journey with us — in peace, love, and unity — for the greater good of our people.'
  ], y, maxWidth);

  y += 8;
  y = ensureSpace(doc, y, 16);
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
    doc.text('Gotabgaa Australia — Mission & Vision (Draft)', PAGE.margin, PAGE.footer);
    doc.text(`Page ${p} of ${pageCount}`, PAGE.w - PAGE.margin, PAGE.footer, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

const pdf = buildPdf();
fs.writeFileSync(outPath, pdf);
console.log(`PDF written to ${outPath} (${pdf.length} bytes)`);

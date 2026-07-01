import { jsPDF } from 'jspdf';

const BRAND = {
  brown900: [42, 31, 23],
  brown800: [61, 43, 31],
  brown700: [78, 56, 40],
  tan: [184, 134, 75],
  tanLight: [212, 165, 116],
  cream: [250, 247, 242],
  creamDark: [240, 235, 227],
  white: [255, 255, 255],
  muted: [107, 91, 79],
  text: [42, 31, 23],
  pending: [140, 98, 57],
  approved: [46, 125, 74],
  rejected: [139, 0, 0]
};

const PAGE = { w: 210, h: 297, margin: 14, footer: 284 };

function formatAilcdStatusLabel(status) {
  const labels = {
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return labels[status] || 'Under review';
}

function statusColor(status) {
  if (status === 'approved') return BRAND.approved;
  if (status === 'rejected') return BRAND.rejected;
  return BRAND.pending;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateOnly(iso) {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
    const [y, m, d] = iso.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
  return formatDateTime(iso);
}

function displayText(value) {
  const text = String(value ?? '').trim();
  if (!text || /^n\/?a$/i.test(text) || text === 'xxxxxxxxxx') return '';
  return text;
}

function positionSummary(app) {
  const pos = app.data?.position || {};
  const list = (pos.positions || []).filter(Boolean);
  if (list.length) return list.join(', ');
  if (pos.positionOther) return pos.positionOther;
  return '—';
}

function setFill(doc, rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc, rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function drawPageFooter(doc, pageNum, subtitle = 'Interim Leadership — Expressions of Interest') {
  setDraw(doc, BRAND.creamDark);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, PAGE.footer - 4, PAGE.w - PAGE.margin, PAGE.footer - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, BRAND.muted);
  doc.text('Gotabgaa Australia', PAGE.margin, PAGE.footer);
  doc.text(subtitle, PAGE.w / 2, PAGE.footer, { align: 'center' });
  doc.text(`Page ${pageNum}`, PAGE.w - PAGE.margin, PAGE.footer, { align: 'right' });
}

function drawCoverPage(doc, applications, generatedAt) {
  setFill(doc, BRAND.brown800);
  doc.rect(0, 0, PAGE.w, 52, 'F');

  setFill(doc, BRAND.tan);
  doc.rect(0, 52, PAGE.w, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setText(doc, BRAND.white);
  doc.text('Gotabgaa Australia', PAGE.margin, 24);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Interim Leadership', PAGE.margin, 34);
  doc.text('Expressions of Interest', PAGE.margin, 41);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, BRAND.tanLight);
  doc.text('Official EOI Register', PAGE.w - PAGE.margin, 24, { align: 'right' });

  let y = 68;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, BRAND.muted);
  doc.text(`Generated ${formatDateTime(generatedAt)} (AEST)`, PAGE.margin, y);
  y += 10;

  const stats = [
    ['Total applications', String(applications.length)],
    ['Under review', String(applications.filter(a => (a.status || 'pending') === 'pending').length)],
    ['Approved', String(applications.filter(a => a.status === 'approved').length)],
    ['Rejected', String(applications.filter(a => a.status === 'rejected').length)]
  ];

  const boxW = (PAGE.w - PAGE.margin * 2 - 9) / 4;
  stats.forEach(([label, value], i) => {
    const x = PAGE.margin + i * (boxW + 3);
    setFill(doc, BRAND.cream);
    setDraw(doc, BRAND.creamDark);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, boxW, 22, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    setText(doc, BRAND.brown800);
    doc.text(value, x + boxW / 2, y + 11, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setText(doc, BRAND.muted);
    doc.text(label.toUpperCase(), x + boxW / 2, y + 18, { align: 'center' });
  });

  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setText(doc, BRAND.brown800);
  doc.text('Applicant index', PAGE.margin, y);
  y += 8;

  drawIndexTable(doc, applications, y);
  drawPageFooter(doc, 1);
}

function drawIndexTable(doc, applications, startY) {
  const headers = ['#', 'Applicant', 'Reference', 'Position', 'State', 'Status'];
  const colWidths = [8, 42, 28, 48, 14, 28];
  const rowH = 7.5;
  let y = startY;

  const drawHeader = () => {
    let x = PAGE.margin;
    setFill(doc, BRAND.brown800);
    doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setText(doc, BRAND.white);
    headers.forEach((header, i) => {
      doc.text(header, x + 2, y + 5);
      x += colWidths[i];
    });
    y += rowH;
  };

  drawHeader();

  applications.forEach((app, index) => {
    if (y + rowH > PAGE.footer - 12) {
      doc.addPage();
      y = 24;
      drawHeader();
    }

    const fill = index % 2 === 0 ? BRAND.white : BRAND.cream;
    setFill(doc, fill);
    setDraw(doc, BRAND.creamDark);
    doc.setLineWidth(0.2);
    doc.rect(PAGE.margin, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'FD');

    const cells = [
      String(index + 1),
      app.full_name || '—',
      app.reference_code || '—',
      positionSummary(app),
      app.state || app.data?.personal?.stateTerritory || '—',
      formatAilcdStatusLabel(app.status)
    ];

    let x = PAGE.margin;
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    doc.setFontSize(7);
    setText(doc, BRAND.text);

    cells.forEach((cell, i) => {
      const maxW = colWidths[i] - 3;
      const lines = doc.splitTextToSize(String(cell), maxW);
      doc.text(lines[0] || '', x + 2, y + 5);
      x += colWidths[i];
    });

    y += rowH;
  });
}

function drawApplicationHeader(doc, app, index, total) {
  setFill(doc, BRAND.brown800);
  doc.rect(0, 0, PAGE.w, 28, 'F');
  setFill(doc, BRAND.tan);
  doc.rect(0, 28, PAGE.w, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, BRAND.tanLight);
  doc.text('GOTABGAA AUSTRALIA — INTERIM LEADERSHIP EOI', PAGE.margin, 10);

  doc.setFontSize(14);
  setText(doc, BRAND.white);
  const name = app.full_name || app.data?.personal?.fullName || 'Applicant';
  doc.text(name, PAGE.margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.tanLight);
  doc.text(`Application ${index + 1} of ${total}`, PAGE.w - PAGE.margin, 10, { align: 'right' });
  doc.text(app.reference_code || '—', PAGE.w - PAGE.margin, 20, { align: 'right' });

  return 36;
}

function drawMetaBar(doc, y, app) {
  const barH = 16;
  setFill(doc, BRAND.cream);
  setDraw(doc, BRAND.creamDark);
  doc.setLineWidth(0.4);
  doc.roundedRect(PAGE.margin, y, PAGE.w - PAGE.margin * 2, barH, 2, 2, 'FD');

  const status = app.status || 'pending';
  const items = [
    ['Reference', app.reference_code || '—'],
    ['Submitted', formatDateTime(app.created_at)],
    ['State', app.state || app.data?.personal?.stateTerritory || '—']
  ];

  const colW = (PAGE.w - PAGE.margin * 2) / 4;
  items.forEach(([label, value], i) => {
    const x = PAGE.margin + 4 + i * colW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, BRAND.muted);
    doc.text(label.toUpperCase(), x, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, BRAND.brown800);
    doc.text(String(value).slice(0, 36), x, y + 11.5);
  });

  const statusX = PAGE.margin + 4 + 3 * colW;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setText(doc, BRAND.muted);
  doc.text('STATUS', statusX, y + 5.5);
  const sc = statusColor(status);
  setFill(doc, sc);
  doc.roundedRect(statusX, y + 7.5, 32, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setText(doc, BRAND.white);
  doc.text(formatAilcdStatusLabel(status), statusX + 16, y + 11.5, { align: 'center' });

  if (app.status_message) {
    return y + barH + 4;
  }
  return y + barH + 6;
}

function drawSectionTitle(doc, y, letter, title) {
  setFill(doc, BRAND.brown800);
  doc.roundedRect(PAGE.margin, y, PAGE.w - PAGE.margin * 2, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, BRAND.white);
  doc.text(`Section ${letter}`, PAGE.margin + 4, y + 6);
  doc.text(title, PAGE.margin + 28, y + 6);
  return y + 12;
}

function drawFieldGrid(doc, y, fields, pageNumRef) {
  const contentW = PAGE.w - PAGE.margin * 2;
  const colW = contentW / 2 - 2;
  const rowGap = 2;
  let rowY = y;
  let col = 0;
  let maxRowEnd = y;

  const ensureSpace = (need) => {
    if (rowY + need > PAGE.footer - 8) {
      drawPageFooter(doc, pageNumRef.value);
      doc.addPage();
      pageNumRef.value += 1;
      rowY = 24;
      maxRowEnd = rowY;
      col = 0;
    }
  };

  fields.forEach(({ label, value, fullWidth }) => {
    const text = displayText(value);
    if (!text) return;

    const x = fullWidth ? PAGE.margin : PAGE.margin + col * (colW + 4);
    const w = fullWidth ? contentW : colW;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, BRAND.muted);
    const labelLines = doc.splitTextToSize(label.toUpperCase(), w);
    const valueLines = doc.splitTextToSize(text, w);
    const blockH = labelLines.length * 3.2 + valueLines.length * 4.2 + 4;

    ensureSpace(blockH + 2);

    if (fullWidth) {
      col = 0;
      rowY = maxRowEnd + rowGap;
    }

    setFill(doc, BRAND.white);
    setDraw(doc, BRAND.creamDark);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, rowY, w, blockH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, BRAND.muted);
    doc.text(labelLines, x + 3, rowY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, BRAND.text);
    doc.text(valueLines, x + 3, rowY + 4.5 + labelLines.length * 3.2 + 3.5);

    if (fullWidth) {
      maxRowEnd = rowY + blockH;
      rowY = maxRowEnd;
      col = 0;
    } else {
      if (col === 0) {
        col = 1;
      } else {
        col = 0;
        maxRowEnd = Math.max(maxRowEnd, rowY + blockH);
        rowY = maxRowEnd + rowGap;
      }
    }
  });

  if (col === 1) {
    maxRowEnd += 18;
  }

  return Math.max(maxRowEnd, rowY) + 6;
}

function drawProseBlock(doc, y, label, value, pageNumRef) {
  const text = displayText(value);
  if (!text) return y;

  const contentW = PAGE.w - PAGE.margin * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const bodyLines = doc.splitTextToSize(text, contentW - 8);
  const blockH = bodyLines.length * 4.4 + 14;

  if (y + blockH > PAGE.footer - 8) {
    drawPageFooter(doc, pageNumRef.value);
    doc.addPage();
    pageNumRef.value += 1;
    y = 24;
  }

  setFill(doc, BRAND.cream);
  setDraw(doc, BRAND.tanLight);
  doc.setLineWidth(0.35);
  doc.roundedRect(PAGE.margin, y, contentW, blockH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BRAND.brown700);
  doc.text(label.toUpperCase(), PAGE.margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, BRAND.text);
  doc.text(bodyLines, PAGE.margin + 4, y + 12);

  return y + blockH + 5;
}

function drawSkillsTags(doc, y, skills, pageNumRef) {
  const list = (skills || []).filter(Boolean);
  if (!list.length) return y;

  const contentW = PAGE.w - PAGE.margin * 2;
  let x = PAGE.margin + 2;
  let rowY = y + 8;
  const tagH = 6;
  const gap = 2;

  if (y + 20 > PAGE.footer - 8) {
    drawPageFooter(doc, pageNumRef.value);
    doc.addPage();
    pageNumRef.value += 1;
    y = 24;
    rowY = y + 8;
    x = PAGE.margin + 2;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, BRAND.brown700);
  doc.text('SKILLS & STRENGTHS', PAGE.margin + 2, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  list.forEach(skill => {
    const tw = doc.getTextWidth(skill) + 6;
    if (x + tw > PAGE.margin + contentW - 2) {
      x = PAGE.margin + 2;
      rowY += tagH + gap;
    }
    if (rowY + tagH > PAGE.footer - 8) {
      drawPageFooter(doc, pageNumRef.value);
      doc.addPage();
      pageNumRef.value += 1;
      rowY = 28;
      x = PAGE.margin + 2;
    }
    setFill(doc, BRAND.white);
    setDraw(doc, BRAND.tan);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, rowY, tw, tagH, 2, 2, 'FD');
    setText(doc, BRAND.brown800);
    doc.text(skill, x + 3, rowY + 4.2);
    x += tw + gap;
  });

  return rowY + tagH + 8;
}

function drawDeclaration(doc, y, dec, pageNumRef) {
  if (y + 50 > PAGE.footer - 8) {
    drawPageFooter(doc, pageNumRef.value);
    doc.addPage();
    pageNumRef.value += 1;
    y = 24;
  }

  y = drawSectionTitle(doc, y, 'D', 'Declaration');

  y = drawFieldGrid(doc, y, [
    { label: 'Printed name', value: dec.fullName },
    { label: 'Date signed', value: formatDateOnly(dec.date) },
    { label: 'Agreed to declaration', value: dec.agreed ? 'Yes' : 'No' }
  ], pageNumRef);

  const sig = dec.signatureImage;
  if (sig && String(sig).startsWith('data:image')) {
    const contentW = PAGE.w - PAGE.margin * 2;
    const sigH = 32;
    if (y + sigH + 10 > PAGE.footer - 8) {
      drawPageFooter(doc, pageNumRef.value);
      doc.addPage();
      pageNumRef.value += 1;
      y = 24;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(doc, BRAND.brown700);
    doc.text('SIGNATURE', PAGE.margin + 2, y + 4);

    setFill(doc, BRAND.white);
    setDraw(doc, BRAND.creamDark);
    doc.setLineWidth(0.4);
    doc.roundedRect(PAGE.margin, y + 6, contentW * 0.55, sigH, 2, 2, 'FD');

    try {
      doc.addImage(sig, 'PNG', PAGE.margin + 4, y + 8, contentW * 0.55 - 8, sigH - 4);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      setText(doc, BRAND.muted);
      doc.text('Signature image could not be embedded', PAGE.margin + 6, y + 22);
    }
    y += sigH + 14;
  }

  return y;
}

function drawApplication(doc, app, index, total, pageNumRef) {
  doc.addPage();
  pageNumRef.value += 1;

  let y = drawApplicationHeader(doc, app, index, total);
  y = drawMetaBar(doc, y, app);

  if (app.status_message) {
    y = drawProseBlock(doc, y, 'Message to applicant', app.status_message, pageNumRef);
  }

  const d = app.data || {};
  const p = d.personal || {};
  const pos = d.position || {};
  const exp = d.experience || {};
  const dec = d.declaration || {};
  const positions = (pos.positions || []).filter(Boolean);
  const positionText = positions.length ? positions.join(', ') : displayText(pos.positionOther);

  y = drawSectionTitle(doc, y, 'A', 'Personal details');
  y = drawFieldGrid(doc, y, [
    { label: 'Full name', value: p.fullName || app.full_name },
    { label: 'Gender', value: p.gender },
    { label: 'Date of birth', value: formatDateOnly(p.dateOfBirth) },
    { label: 'State / territory', value: p.stateTerritory || app.state },
    { label: 'Mobile', value: p.mobile || app.phone },
    { label: 'Email', value: p.email || app.email },
    { label: 'Occupation', value: p.occupation },
    { label: 'Suburb / city', value: p.suburb },
    { label: 'Address', value: p.address, fullWidth: true }
  ], pageNumRef);

  y = drawSectionTitle(doc, y, 'B', 'Position of interest');
  y = drawFieldGrid(doc, y, [
    { label: 'Position applied for', value: positionText, fullWidth: true },
    ...(pos.positionOther && !positions.some(p => String(p).toLowerCase().includes('other'))
      ? [{ label: 'Other (specify)', value: pos.positionOther, fullWidth: true }]
      : [])
  ], pageNumRef);

  y = drawSectionTitle(doc, y, 'C', 'Leadership experience');
  y = drawFieldGrid(doc, y, [
    { label: 'Previous leadership roles', value: exp.previousLeadership === 'yes' ? 'Yes' : exp.previousLeadership === 'no' ? 'No' : exp.previousLeadership }
  ], pageNumRef);

  y = drawProseBlock(doc, y, 'Previous leadership details', exp.previousDetails, pageNumRef);
  y = drawProseBlock(doc, y, 'Experience and achievements', exp.experienceDescription, pageNumRef);
  y = drawSkillsTags(doc, y, exp.skills, pageNumRef);

  y = drawDeclaration(doc, y, dec, pageNumRef);

  drawPageFooter(doc, pageNumRef.value);
}

export function buildAilcdApplicationsPdf(applications) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generatedAt = new Date();
  const sorted = [...applications].sort((a, b) => {
    const da = new Date(a.created_at || 0).getTime();
    const db = new Date(b.created_at || 0).getTime();
    return da - db;
  });

  drawCoverPage(doc, sorted, generatedAt);

  const pageNumRef = { value: 1 };
  sorted.forEach((app, index) => {
    drawApplication(doc, app, index, sorted.length, pageNumRef);
  });

  return Buffer.from(doc.output('arraybuffer'));
}

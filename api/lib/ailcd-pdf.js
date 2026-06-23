import { jsPDF } from 'jspdf';

function formatAilcdStatusLabel(status) {
  const labels = {
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return labels[status] || 'Under review';
}

export function buildAilcdApplicationsPdf(applications) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const ensureSpace = (height = 12) => {
    if (y + height > 285) {
      doc.addPage();
      y = 20;
    }
  };

  const addHeading = (text, size = 12) => {
    ensureSpace(size + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size * 0.45 + 5;
    doc.setFont('helvetica', 'normal');
  };

  const addField = (label, value) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    ensureSpace(10);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(`${label}: ${text}`, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  };

  addHeading('Gotabgaa Australia', 16);
  addHeading('Interim Leadership Expressions of Interest', 13);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 6;
  doc.text(`Total applications: ${applications.length}`, margin, y);
  y += 12;

  applications.forEach((app, index) => {
    if (index > 0) {
      doc.addPage();
      y = 20;
    }

    const d = app.data || {};
    const p = d.personal || {};
    const pos = d.position || {};
    const exp = d.experience || {};
    const dec = d.declaration || {};
    const positions = (pos.positions || []).join(', ');
    const skills = (exp.skills || []).join(', ');

    addHeading(`Application ${index + 1}: ${app.full_name || 'Applicant'}`, 12);
    addField('Reference', app.reference_code);
    addField('Status', formatAilcdStatusLabel(app.status));
    addField('Submitted', app.created_at ? new Date(app.created_at).toLocaleString() : '');
    if (app.status_message) addField('Admin message', app.status_message);
    y += 3;

    addHeading('Section A — Personal details', 11);
    addField('Full name', p.fullName || app.full_name);
    addField('Gender', p.gender);
    addField('Date of birth', p.dateOfBirth);
    addField('State / territory', p.stateTerritory || app.state);
    addField('Address', p.address);
    addField('Suburb / city', p.suburb);
    addField('Mobile', p.mobile || app.phone);
    addField('Email', p.email || app.email);
    addField('Occupation', p.occupation);
    y += 3;

    addHeading('Section B — Position of interest', 11);
    addField('Position applied for', positions);
    if (pos.positionOther) addField('Other (specify)', pos.positionOther);
    y += 3;

    addHeading('Section C — Leadership experience', 11);
    addField('Previous leadership', exp.previousLeadership);
    addField('Previous leadership details', exp.previousDetails);
    addField('Experience and achievements', exp.experienceDescription);
    addField('Skills and strengths', skills);
    y += 3;

    addHeading('Declaration', 11);
    addField('Printed name', dec.fullName);
    addField('Date', dec.date);
    addField('Agreed to declaration', dec.agreed ? 'Yes' : 'No');

    const sig = dec.signatureImage;
    if (sig && String(sig).startsWith('data:image')) {
      ensureSpace(38);
      doc.setFontSize(10);
      doc.text('Signature:', margin, y);
      y += 5;
      try {
        doc.addImage(sig, 'PNG', margin, y, 58, 24);
        y += 28;
      } catch {
        addField('Signature', '(image could not be embedded)');
      }
    }
  });

  return Buffer.from(doc.output('arraybuffer'));
}

import { toPng, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const SOLID_WHITE = '#FFFFFF';

/**
 * Capture a card DOM element as high-resolution PNG dataUrl
 */
export async function captureCardImage(elementId, pixelRatio = 3) {
  const node = document.getElementById(elementId);
  if (!node) throw new Error(`Export element "${elementId}" not found`);

  // Ensure all fonts are completely ready before capture
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // fallback if fonts.ready fails
    }
  }

  const options = {
    pixelRatio,
    cacheBust: true,
    quality: 1,
    backgroundColor: SOLID_WHITE,
  };

  // Warm-up pass to ensure images, QR code & fonts are settled
  await toPng(node, options).catch(() => {});

  return await toPng(node, options);
}

/**
 * Export a DOM element (front, back, or pair) as a PNG or JPG download.
 */
export async function exportCardImage(elementId, fileName, format = 'png') {
  const node = document.getElementById(elementId);
  if (!node) throw new Error(`Export element "${elementId}" not found`);

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  const options = {
    pixelRatio: 3, // crisp output (960 x 1500 px per card)
    cacheBust: true,
    quality: 1,
    // Solid background prevents printer auto-contrast blowout and white wash-out
    backgroundColor: SOLID_WHITE,
  };

  await toPng(node, options).catch(() => {});

  const dataUrl = format === 'jpg' ? await toJpeg(node, options) : await toPng(node, options);

  const link = document.createElement('a');
  link.download = `${fileName}.${format}`;
  link.href = dataUrl;
  link.click();
}

/**
 * Export an individual student's ID card as a high-resolution PDF.
 * 
 * Modes:
 * - 'cr80': Standard ISO/IEC 7810 ID-1 (CR80) plastic card dimensions: 54mm x 85.6mm.
 *           Generates a 2-page PDF (Page 1: Front, Page 2: Back) directly compatible with
 *           PVC Card Printers (Evolis, Zebra, Fargo, etc.).
 * - 'a4':   A4 Printable Sheet (210mm x 297mm). Front and Back placed side-by-side with
 *           exact 100% physical scale (54 x 85.6mm) with dashed cut guides/crop marks
 *           ready for printing on photo paper or card stock for pouch lamination.
 * - 'front': Single CR80 page (Front only).
 * - 'back':  Single CR80 page (Back only).
 */
export async function exportStudentCardPDF(student, options = {}) {
  const {
    mode = 'cr80', // 'cr80' | 'a4' | 'front' | 'back'
    schoolName = 'Patimo College',
  } = options;

  const sId = student.id;
  const safeName = `${student.lastName || 'Student'}_${student.firstName || ''}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const admNo = student.admissionNo || 'ID';

  if (mode === 'cr80') {
    // Standard ID Card size: 54mm width x 85.6mm height
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [54, 85.6],
    });

    const frontImg = await captureCardImage(`export-front-${sId}`);
    pdf.addImage(frontImg, 'PNG', 0, 0, 54, 85.6, undefined, 'FAST');

    const backImg = await captureCardImage(`export-back-${sId}`);
    pdf.addPage([54, 85.6], 'portrait');
    pdf.addImage(backImg, 'PNG', 0, 0, 54, 85.6, undefined, 'FAST');

    pdf.save(`${safeName}_${admNo}_IDCard_CR80.pdf`);
    return;
  }

  if (mode === 'front') {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [54, 85.6],
    });
    const frontImg = await captureCardImage(`export-front-${sId}`);
    pdf.addImage(frontImg, 'PNG', 0, 0, 54, 85.6, undefined, 'FAST');
    pdf.save(`${safeName}_${admNo}_IDCard_FRONT.pdf`);
    return;
  }

  if (mode === 'back') {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [54, 85.6],
    });
    const backImg = await captureCardImage(`export-back-${sId}`);
    pdf.addImage(backImg, 'PNG', 0, 0, 54, 85.6, undefined, 'FAST');
    pdf.save(`${safeName}_${admNo}_IDCard_BACK.pdf`);
    return;
  }

  if (mode === 'a4') {
    // A4 Sheet: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const cardW = 54;
    const cardH = 85.6;
    const gap = 12;
    const totalW = cardW * 2 + gap; // 120mm
    const startX = (210 - totalW) / 2; // 45mm left margin
    const startY = 48; // top margin

    // Sheet Header
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(20, 67, 42); // deep forest green
    pdf.text(schoolName.toUpperCase(), 105, 22, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(70, 80, 75);
    pdf.text(`Student Identity Card · Printable Sheet (100% Actual Scale)`, 105, 29, { align: 'center' });

    pdf.setFontSize(9);
    pdf.setTextColor(110, 120, 115);
    pdf.text(`Student: ${student.lastName} ${student.firstName}  |  Adm No: ${admNo}  |  Class: ${student.currentClass?.name || '—'}`, 105, 36, { align: 'center' });

    // Thin separator line
    pdf.setDrawColor(200, 215, 205);
    pdf.setLineWidth(0.3);
    pdf.line(25, 40, 185, 40);

    // Front Card
    const frontImg = await captureCardImage(`export-front-${sId}`);
    pdf.addImage(frontImg, 'PNG', startX, startY, cardW, cardH, undefined, 'FAST');

    // Back Card
    const backImg = await captureCardImage(`export-back-${sId}`);
    pdf.addImage(backImg, 'PNG', startX + cardW + gap, startY, cardW, cardH, undefined, 'FAST');

    // Draw Corner Crop Marks / Cut Lines around Front Card
    drawCropMarks(pdf, startX, startY, cardW, cardH);
    // Draw Corner Crop Marks / Cut Lines around Back Card
    drawCropMarks(pdf, startX + cardW + gap, startY, cardW, cardH);

    // Labels below cards
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(20, 67, 42);
    pdf.text('FRONT SIDE', startX + cardW / 2, startY + cardH + 7, { align: 'center' });
    pdf.text('BACK SIDE', startX + cardW + gap + cardW / 2, startY + cardH + 7, { align: 'center' });

    // Cutting and Printing Instructions Footer
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 130, 125);
    pdf.text('✂ Cut along corner crop marks. Print at 100% scale (Do NOT choose "Fit to Printable Area").', 105, startY + cardH + 18, { align: 'center' });
    pdf.text('Standard CR80 dimensions: 54.0 mm × 85.6 mm (2.13 in × 3.37 in)', 105, startY + cardH + 23, { align: 'center' });

    pdf.save(`${safeName}_${admNo}_IDCard_A4_Sheet.pdf`);
  }
}

/**
 * Export all loaded students as a multi-page PDF.
 * If mode === 'cr80', each student has 2 pages (Front, Back).
 * If mode === 'a4', each student has 1 dedicated A4 sheet.
 */
export async function exportBatchCardsPDF(students, options = {}) {
  const { mode = 'cr80', schoolName = 'Patimo College' } = options;
  if (!students || students.length === 0) return;

  if (mode === 'cr80') {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [54, 85.6],
    });

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (i > 0) pdf.addPage([54, 85.6], 'portrait');
      const frontImg = await captureCardImage(`export-front-${s.id}`);
      pdf.addImage(frontImg, 'PNG', 0, 0, 54, 85.6, undefined, 'FAST');

      pdf.addPage([54, 85.6], 'portrait');
      const backImg = await captureCardImage(`export-back-${s.id}`);
      pdf.addImage(backImg, 'PNG', 0, 0, 54, 85.6, undefined, 'FAST');
    }

    pdf.save(`Students_IDCards_Batch_CR80_${students.length}_Cards.pdf`);
    return;
  }

  if (mode === 'a4') {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const cardW = 54;
    const cardH = 85.6;
    const gap = 12;
    const totalW = cardW * 2 + gap;
    const startX = (210 - totalW) / 2;
    const startY = 48;

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (i > 0) pdf.addPage('a4', 'portrait');

      const admNo = s.admissionNo || 'ID';

      // Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(20, 67, 42);
      pdf.text(schoolName.toUpperCase(), 105, 22, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(70, 80, 75);
      pdf.text(`Student Identity Card · Printable Sheet (100% Actual Scale)`, 105, 29, { align: 'center' });

      pdf.setFontSize(9);
      pdf.setTextColor(110, 120, 115);
      pdf.text(`Student: ${s.lastName} ${s.firstName}  |  Adm No: ${admNo}  |  Class: ${s.currentClass?.name || '—'}`, 105, 36, { align: 'center' });

      // Line
      pdf.setDrawColor(200, 215, 205);
      pdf.setLineWidth(0.3);
      pdf.line(25, 40, 185, 40);

      // Images
      const frontImg = await captureCardImage(`export-front-${s.id}`);
      pdf.addImage(frontImg, 'PNG', startX, startY, cardW, cardH, undefined, 'FAST');

      const backImg = await captureCardImage(`export-back-${s.id}`);
      pdf.addImage(backImg, 'PNG', startX + cardW + gap, startY, cardW, cardH, undefined, 'FAST');

      // Crop Marks
      drawCropMarks(pdf, startX, startY, cardW, cardH);
      drawCropMarks(pdf, startX + cardW + gap, startY, cardW, cardH);

      // Labels
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(20, 67, 42);
      pdf.text('FRONT SIDE', startX + cardW / 2, startY + cardH + 7, { align: 'center' });
      pdf.text('BACK SIDE', startX + cardW + gap + cardW / 2, startY + cardH + 7, { align: 'center' });

      // Footer Instructions
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120, 130, 125);
      pdf.text('✂ Cut along corner crop marks. Print at 100% scale (Do NOT choose "Fit to Printable Area").', 105, startY + cardH + 18, { align: 'center' });
      pdf.text(`Page ${i + 1} of ${students.length}`, 105, startY + cardH + 24, { align: 'center' });
    }

    pdf.save(`Students_IDCards_Batch_A4_${students.length}_Sheets.pdf`);
  }
}

/**
 * Helper to draw corner crop/trim marks around a rectangle
 */
function drawCropMarks(pdf, x, y, w, h, markLen = 4, markDist = 1.5) {
  pdf.setDrawColor(160, 175, 168);
  pdf.setLineWidth(0.2);

  // Top-left
  pdf.line(x - markDist - markLen, y, x - markDist, y);
  pdf.line(x, y - markDist - markLen, x, y - markDist);

  // Top-right
  pdf.line(x + w + markDist, y, x + w + markDist + markLen, y);
  pdf.line(x + w, y - markDist - markLen, x + w, y - markDist);

  // Bottom-left
  pdf.line(x - markDist - markLen, y + h, x - markDist, y + h);
  pdf.line(x, y + h + markDist, x, y + h + markDist + markLen);

  // Bottom-right
  pdf.line(x + w + markDist, y + h, x + w + markDist + markLen, y + h);
  pdf.line(x + w, y + h + markDist, x + w, y + h + markDist + markLen);
}

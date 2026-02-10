import jsPDF from 'jspdf';

export interface ReleasePdfData {
  // Shipment info
  shipmentNumber: string;
  shipmentType: string;
  releaseType: string | null;
  releasedTo: string | null;
  releaseToPhone: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  poNumber: string | null;

  // Account info
  accountName: string | null;
  accountCode: string | null;

  // Company (tenant) info
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;

  // Warehouse
  warehouseName: string | null;

  // Items
  items: ReleasePdfItem[];

  // Signature
  signatureData: string | null;
  signatureName: string;
  signedAt: string;

  // Staff
  completedByName: string | null;
  completedAt: string;
}

export interface ReleasePdfItem {
  itemCode: string;
  description: string | null;
  vendor: string | null;
  sidemark: string | null;
  room: string | null;
  className: string | null;
  location: string | null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function generateReleasePdf(data: ReleasePdfData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors (matching Stride WMS branding)
  const primaryColor: [number, number, number] = [220, 88, 42]; // Stride Orange
  const darkGray: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];
  const veryLightGray: [number, number, number] = [245, 245, 245];

  const setFont = (size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
  };

  const addText = (
    text: string,
    x: number,
    currentY: number,
    options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }
  ) => {
    if (options?.maxWidth) {
      const lines = doc.splitTextToSize(text, options.maxWidth);
      doc.text(lines, x, currentY, { align: options?.align || 'left' });
      return currentY + lines.length * 5;
    }
    doc.text(text, x, currentY, { align: options?.align || 'left' });
    return currentY + 5;
  };

  const checkNewPage = (needed: number) => {
    if (y + needed > pageHeight - 30) {
      doc.addPage();
      y = margin;
    }
  };

  // ============ HEADER ============

  // Company name
  doc.setTextColor(...darkGray);
  setFont(24, 'bold');
  y = addText(data.companyName, margin, y);
  y += 2;

  // Company contact info
  doc.setTextColor(...lightGray);
  setFont(9, 'normal');
  if (data.companyAddress) {
    y = addText(data.companyAddress, margin, y);
  }
  const contactLine: string[] = [];
  if (data.companyPhone) contactLine.push(data.companyPhone);
  if (data.companyEmail) contactLine.push(data.companyEmail);
  if (contactLine.length > 0) {
    y = addText(contactLine.join(' | '), margin, y);
  }

  // Title on the right
  doc.setTextColor(...primaryColor);
  setFont(24, 'bold');
  doc.text('RELEASE DOCUMENT', pageWidth - margin, margin + 5, { align: 'right' });

  // Shipment number below title
  doc.setTextColor(...darkGray);
  setFont(10, 'normal');
  doc.text(`#${data.shipmentNumber}`, pageWidth - margin, margin + 14, { align: 'right' });

  y += 10;

  // ============ DIVIDER ============
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============ RELEASE INFO (two columns) ============

  const leftColX = margin;
  const rightColX = pageWidth / 2 + 10;
  let leftY = y;
  let rightY = y;

  // Left column: Release To
  doc.setTextColor(...lightGray);
  setFont(9, 'bold');
  doc.text('RELEASED TO', leftColX, leftY);
  leftY += 6;

  doc.setTextColor(...darkGray);
  setFont(11, 'bold');
  leftY = addText(data.releasedTo || '-', leftColX, leftY);

  setFont(9, 'normal');
  if (data.releaseToPhone) {
    doc.setTextColor(...lightGray);
    leftY = addText(data.releaseToPhone, leftColX, leftY);
  }

  // Account info
  if (data.accountName) {
    leftY += 3;
    doc.setTextColor(...lightGray);
    setFont(9, 'bold');
    doc.text('ACCOUNT', leftColX, leftY);
    leftY += 6;
    doc.setTextColor(...darkGray);
    setFont(10, 'bold');
    leftY = addText(data.accountName, leftColX, leftY);
    if (data.accountCode) {
      setFont(9, 'normal');
      doc.setTextColor(...lightGray);
      leftY = addText(`Code: ${data.accountCode}`, leftColX, leftY);
    }
  }

  // Right column: Shipment Details
  doc.setTextColor(...lightGray);
  setFont(9, 'bold');
  doc.text('SHIPMENT DETAILS', rightColX, rightY);
  rightY += 6;

  const infoItems: { label: string; value: string }[] = [
    { label: 'Release Date:', value: formatDateTime(data.completedAt) },
    { label: 'Release Type:', value: data.releaseType || '-' },
    { label: 'Carrier:', value: data.carrier || '-' },
    { label: 'Tracking:', value: data.trackingNumber || '-' },
    { label: 'PO Number:', value: data.poNumber || '-' },
    { label: 'Warehouse:', value: data.warehouseName || '-' },
  ];

  doc.setTextColor(...darkGray);
  setFont(9, 'normal');
  for (const item of infoItems) {
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, rightColX, rightY);
    doc.setFont('helvetica', 'normal');
    doc.text(item.value, rightColX + 35, rightY);
    rightY += 5;
  }

  y = Math.max(leftY, rightY) + 15;

  // ============ ITEMS TABLE ============

  checkNewPage(40);

  // Section header
  doc.setTextColor(...darkGray);
  setFont(12, 'bold');
  y = addText(`Items Released (${data.items.length})`, margin, y);
  y += 3;

  // Table header background
  doc.setFillColor(...veryLightGray);
  doc.rect(margin, y - 5, contentWidth, 10, 'F');

  // Table headers
  doc.setTextColor(...darkGray);
  setFont(8, 'bold');
  const colWidths = {
    num: 12,
    code: 40,
    description: 50,
    vendor: 30,
    sidemark: 25,
    room: 20,
    location: contentWidth - 12 - 40 - 50 - 30 - 25 - 20,
  };

  let tableX = margin;
  doc.text('#', tableX + 2, y);
  tableX += colWidths.num;
  doc.text('Item Code', tableX + 2, y);
  tableX += colWidths.code;
  doc.text('Description', tableX + 2, y);
  tableX += colWidths.description;
  doc.text('Vendor', tableX + 2, y);
  tableX += colWidths.vendor;
  doc.text('Sidemark', tableX + 2, y);
  tableX += colWidths.sidemark;
  doc.text('Room', tableX + 2, y);
  tableX += colWidths.room;
  doc.text('Location', tableX + 2, y);

  y += 8;

  // Table rows
  setFont(8, 'normal');
  for (let i = 0; i < data.items.length; i++) {
    checkNewPage(10);

    const item = data.items[i];
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, contentWidth, 7, 'F');
    }

    tableX = margin;
    doc.setTextColor(...darkGray);
    doc.text(String(i + 1), tableX + 2, y);
    tableX += colWidths.num;

    const truncate = (text: string, maxLen: number) =>
      text.length > maxLen ? text.substring(0, maxLen - 2) + '..' : text;

    doc.text(truncate(item.itemCode || '-', 22), tableX + 2, y);
    tableX += colWidths.code;
    doc.text(truncate(item.description || '-', 28), tableX + 2, y);
    tableX += colWidths.description;
    doc.text(truncate(item.vendor || '-', 16), tableX + 2, y);
    tableX += colWidths.vendor;
    doc.text(truncate(item.sidemark || '-', 14), tableX + 2, y);
    tableX += colWidths.sidemark;
    doc.text(truncate(item.room || '-', 10), tableX + 2, y);
    tableX += colWidths.room;
    doc.text(truncate(item.location || '-', 10), tableX + 2, y);

    y += 7;
  }

  // Table bottom border
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Total items
  setFont(10, 'bold');
  doc.setTextColor(...darkGray);
  doc.text(`Total Items Released: ${data.items.length}`, pageWidth - margin, y, { align: 'right' });
  y += 15;

  // ============ SIGNATURE SECTION ============

  checkNewPage(70);

  doc.setTextColor(...darkGray);
  setFont(12, 'bold');
  y = addText('Pickup Signature', margin, y);
  y += 5;

  // Signature box
  const sigBoxHeight = 50;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth * 0.6, sigBoxHeight);

  // Draw the signature image if present
  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', margin + 2, y + 2, contentWidth * 0.6 - 4, sigBoxHeight - 4);
    } catch {
      // If image fails, show typed name in the box
      doc.setTextColor(...darkGray);
      setFont(20, 'bold');
      doc.text(data.signatureName || '-', margin + 10, y + sigBoxHeight / 2 + 5);
    }
  } else if (data.signatureName) {
    // Typed signature
    doc.setTextColor(...darkGray);
    setFont(20, 'bold');
    doc.text(data.signatureName, margin + 10, y + sigBoxHeight / 2 + 5);
  }

  y += sigBoxHeight + 5;

  // Name and date below signature
  doc.setTextColor(...lightGray);
  setFont(9, 'normal');
  y = addText(`Name: ${data.signatureName || data.releasedTo || '-'}`, margin, y);
  y = addText(`Date: ${formatDateTime(data.signedAt)}`, margin, y);

  // Warehouse staff on the right
  if (data.completedByName) {
    const staffY = y - 10;
    doc.setTextColor(...lightGray);
    setFont(9, 'bold');
    doc.text('Warehouse Staff:', pageWidth - margin - 60, staffY);
    setFont(9, 'normal');
    doc.text(data.completedByName, pageWidth - margin, staffY, { align: 'right' });
  }

  y += 10;

  // ============ FOOTER ============

  const footerY = pageHeight - 15;
  doc.setTextColor(...lightGray);
  setFont(8, 'normal');
  doc.text(
    `Release Document | ${data.shipmentNumber} | Generated ${formatDateTime(new Date().toISOString())}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(`${data.companyName}`, pageWidth / 2, footerY + 5, { align: 'center' });

  return doc;
}

export function downloadReleasePdf(data: ReleasePdfData): void {
  const doc = generateReleasePdf(data);
  doc.save(`Release_${data.shipmentNumber}.pdf`);
}

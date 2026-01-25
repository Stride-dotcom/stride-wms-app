import jsPDF from 'jspdf';

export interface InvoicePdfData {
  // Invoice details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  periodStart: string;
  periodEnd: string;
  invoiceType: string;

  // Company (tenant) info
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogo?: string;

  // Account (customer) info
  accountName: string;
  accountCode: string;
  billingContactName?: string;
  billingContactEmail?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;

  // Sidemark (if applicable)
  sidemarkName?: string;

  // Line items
  lines: InvoiceLineItem[];

  // Totals
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;

  // Notes
  notes?: string;
  paymentTerms?: string;
}

export interface InvoiceLineItem {
  serviceCode: string;
  description?: string;
  quantity: number;
  unitRate: number;
  lineTotal: number;
}

/**
 * Generate a professional PDF invoice
 */
export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [220, 88, 42]; // Orange accent (matches Stride WMS)
  const darkGray: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];
  const veryLightGray: [number, number, number] = [245, 245, 245];

  // Helper functions
  const setFont = (size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
  };

  const addText = (text: string, x: number, currentY: number, options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }) => {
    if (options?.maxWidth) {
      const lines = doc.splitTextToSize(text, options.maxWidth);
      doc.text(lines, x, currentY, { align: options?.align || 'left' });
      return currentY + (lines.length * 5);
    }
    doc.text(text, x, currentY, { align: options?.align || 'left' });
    return currentY + 5;
  };

  // ============ HEADER SECTION ============

  // Company name (large, bold)
  doc.setTextColor(...darkGray);
  setFont(24, 'bold');
  y = addText(data.companyName, margin, y);
  y += 2;

  // Company contact info (smaller, gray)
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
  if (data.companyWebsite) {
    y = addText(data.companyWebsite, margin, y);
  }

  // INVOICE title on the right
  doc.setTextColor(...primaryColor);
  setFont(28, 'bold');
  doc.text('INVOICE', pageWidth - margin, margin + 5, { align: 'right' });

  // Invoice number below
  doc.setTextColor(...darkGray);
  setFont(10, 'normal');
  doc.text(`#${data.invoiceNumber}`, pageWidth - margin, margin + 14, { align: 'right' });

  y += 10;

  // ============ DIVIDER LINE ============
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============ BILLING INFO SECTION ============

  // Bill To (left side)
  const leftColX = margin;
  const rightColX = pageWidth / 2 + 10;
  let leftY = y;
  let rightY = y;

  // Bill To header
  doc.setTextColor(...lightGray);
  setFont(9, 'bold');
  doc.text('BILL TO', leftColX, leftY);
  leftY += 6;

  // Customer name
  doc.setTextColor(...darkGray);
  setFont(11, 'bold');
  leftY = addText(data.accountName, leftColX, leftY);

  // Account code
  setFont(9, 'normal');
  doc.setTextColor(...lightGray);
  leftY = addText(`Account: ${data.accountCode}`, leftColX, leftY);

  // Billing contact
  doc.setTextColor(...darkGray);
  setFont(9, 'normal');
  if (data.billingContactName) {
    leftY = addText(`Attn: ${data.billingContactName}`, leftColX, leftY);
  }

  // Billing address
  if (data.billingAddress) {
    leftY = addText(data.billingAddress, leftColX, leftY);
  }
  const cityStateZip: string[] = [];
  if (data.billingCity) cityStateZip.push(data.billingCity);
  if (data.billingState) cityStateZip.push(data.billingState);
  if (data.billingPostalCode) cityStateZip.push(data.billingPostalCode);
  if (cityStateZip.length > 0) {
    leftY = addText(cityStateZip.join(', '), leftColX, leftY);
  }
  if (data.billingCountry && data.billingCountry !== 'USA' && data.billingCountry !== 'US') {
    leftY = addText(data.billingCountry, leftColX, leftY);
  }

  // Sidemark (if applicable)
  if (data.sidemarkName) {
    leftY += 3;
    doc.setTextColor(...primaryColor);
    setFont(9, 'bold');
    leftY = addText(`Sidemark: ${data.sidemarkName}`, leftColX, leftY);
  }

  // Invoice Details (right side)
  doc.setTextColor(...lightGray);
  setFont(9, 'bold');
  doc.text('INVOICE DETAILS', rightColX, rightY);
  rightY += 6;

  // Invoice info table
  const infoItems = [
    { label: 'Invoice Date:', value: formatDate(data.invoiceDate) },
    { label: 'Due Date:', value: data.dueDate ? formatDate(data.dueDate) : 'Upon Receipt' },
    { label: 'Period:', value: `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}` },
    { label: 'Type:', value: formatInvoiceType(data.invoiceType) },
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

  // ============ LINE ITEMS TABLE ============

  // Table header background
  doc.setFillColor(...veryLightGray);
  doc.rect(margin, y - 5, contentWidth, 10, 'F');

  // Table headers
  doc.setTextColor(...darkGray);
  setFont(9, 'bold');
  const colWidths = {
    service: 35,
    description: 70,
    qty: 20,
    rate: 25,
    total: contentWidth - 35 - 70 - 20 - 25,
  };

  let tableX = margin;
  doc.text('Service', tableX + 2, y);
  tableX += colWidths.service;
  doc.text('Description', tableX + 2, y);
  tableX += colWidths.description;
  doc.text('Qty', tableX + colWidths.qty - 2, y, { align: 'right' });
  tableX += colWidths.qty;
  doc.text('Rate', tableX + colWidths.rate - 2, y, { align: 'right' });
  tableX += colWidths.rate;
  doc.text('Total', tableX + colWidths.total - 2, y, { align: 'right' });

  y += 8;

  // Table rows
  setFont(9, 'normal');
  let rowCount = 0;
  for (const line of data.lines) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.height - 60) {
      doc.addPage();
      y = margin;
    }

    // Alternating row background
    if (rowCount % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, contentWidth, 8, 'F');
    }

    tableX = margin;
    doc.setTextColor(...darkGray);
    doc.text(line.serviceCode || '-', tableX + 2, y);
    tableX += colWidths.service;

    // Description (may need to be truncated)
    const descText = line.description || '-';
    const truncatedDesc = descText.length > 45 ? descText.substring(0, 42) + '...' : descText;
    doc.text(truncatedDesc, tableX + 2, y);
    tableX += colWidths.description;

    doc.text(line.quantity.toString(), tableX + colWidths.qty - 2, y, { align: 'right' });
    tableX += colWidths.qty;

    doc.text(`$${line.unitRate.toFixed(2)}`, tableX + colWidths.rate - 2, y, { align: 'right' });
    tableX += colWidths.rate;

    doc.setFont('helvetica', 'bold');
    doc.text(`$${line.lineTotal.toFixed(2)}`, tableX + colWidths.total - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += 7;
    rowCount++;
  }

  // Table bottom border
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============ TOTALS SECTION ============

  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;

  // Subtotal
  setFont(10, 'normal');
  doc.setTextColor(...lightGray);
  doc.text('Subtotal:', totalsX, y, { align: 'right' });
  doc.setTextColor(...darkGray);
  doc.text(`$${data.subtotal.toFixed(2)}`, totalsValueX, y, { align: 'right' });
  y += 6;

  // Tax (if applicable)
  if (data.taxAmount && data.taxAmount > 0) {
    doc.setTextColor(...lightGray);
    doc.text(`Tax (${(data.taxRate || 0) * 100}%):`, totalsX, y, { align: 'right' });
    doc.setTextColor(...darkGray);
    doc.text(`$${data.taxAmount.toFixed(2)}`, totalsValueX, y, { align: 'right' });
    y += 6;
  }

  // Total line
  y += 2;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(totalsX - 20, y, pageWidth - margin, y);
  y += 8;

  // Total amount (large, bold)
  setFont(14, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Total Due:', totalsX, y, { align: 'right' });
  doc.setTextColor(...darkGray);
  doc.text(`$${data.total.toFixed(2)}`, totalsValueX, y, { align: 'right' });

  y += 20;

  // ============ NOTES & PAYMENT TERMS ============

  if (data.notes || data.paymentTerms) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.height - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    if (data.paymentTerms) {
      doc.setTextColor(...lightGray);
      setFont(9, 'bold');
      doc.text('Payment Terms:', margin, y);
      doc.setTextColor(...darkGray);
      setFont(9, 'normal');
      doc.text(data.paymentTerms, margin + 40, y);
      y += 8;
    }

    if (data.notes) {
      doc.setTextColor(...lightGray);
      setFont(9, 'bold');
      doc.text('Notes:', margin, y);
      y += 5;
      doc.setTextColor(...darkGray);
      setFont(9, 'normal');
      const noteLines = doc.splitTextToSize(data.notes, contentWidth);
      doc.text(noteLines, margin, y);
    }
  }

  // ============ FOOTER ============

  const footerY = doc.internal.pageSize.height - 15;
  doc.setTextColor(...lightGray);
  setFont(8, 'normal');
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated by ${data.companyName}`, pageWidth / 2, footerY + 5, { align: 'center' });

  return doc;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format invoice type for display
 */
function formatInvoiceType(type: string): string {
  switch (type) {
    case 'weekly_services':
      return 'Weekly Services';
    case 'monthly_storage':
      return 'Monthly Storage';
    case 'closeout':
      return 'Closeout';
    case 'manual':
      return 'Manual';
    default:
      return type;
  }
}

/**
 * Download the PDF
 */
export function downloadInvoicePdf(data: InvoicePdfData): void {
  const doc = generateInvoicePdf(data);
  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
}

/**
 * Open PDF in new tab for printing
 */
export function printInvoicePdf(data: InvoicePdfData): void {
  const doc = generateInvoicePdf(data);
  const pdfUrl = doc.output('bloburl');
  window.open(pdfUrl.toString(), '_blank');
}

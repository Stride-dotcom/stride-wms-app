import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Quote, QuoteClassLine, QuoteSelectedService } from './types';
import { formatCurrency } from './calculator';

export interface QuotePdfData {
  // Quote details
  quoteNumber: string;
  quoteDate: string;
  expirationDate?: string;
  estimatedStorageDays: number;
  status: string;

  // Company (tenant) info
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogo?: string;

  // Account (customer) info
  accountName: string;
  accountCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Class lines
  classLines: {
    className: string;
    description?: string;
    quantity: number;
  }[];

  // Service lines
  serviceLines: {
    serviceName: string;
    category: string;
    className?: string;
    billingUnit: string;
    rate: number;
    quantity: number;
    lineTotal: number;
    isTaxable: boolean;
  }[];

  // Totals
  subtotal: number;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  grandTotal: number;
  currency: string;

  // Notes
  notes?: string;
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
 * Get billing unit display label
 */
function getBillingUnitLabel(unit: string): string {
  switch (unit) {
    case 'per_piece':
      return '/ piece';
    case 'per_day':
      return '/ day';
    case 'per_hour':
      return '/ hour';
    case 'flat':
      return 'flat';
    case 'per_line_item':
      return '/ line';
    case 'per_class':
      return '/ class';
    default:
      return '';
  }
}

/**
 * Generate a professional PDF quote
 */
export function generateQuotePdf(data: QuotePdfData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue accent
  const darkGray: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];
  const veryLightGray: [number, number, number] = [245, 245, 245];

  // Helper functions
  const setFont = (size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
  };

  // ============ HEADER SECTION ============

  // Company name (large, bold)
  doc.setTextColor(...darkGray);
  setFont(24, 'bold');
  doc.text(data.companyName, margin, y);
  y += 8;

  // Company contact info (smaller, gray)
  doc.setTextColor(...lightGray);
  setFont(9, 'normal');
  if (data.companyAddress) {
    doc.text(data.companyAddress, margin, y);
    y += 5;
  }
  const contactLine: string[] = [];
  if (data.companyPhone) contactLine.push(data.companyPhone);
  if (data.companyEmail) contactLine.push(data.companyEmail);
  if (contactLine.length > 0) {
    doc.text(contactLine.join(' | '), margin, y);
    y += 5;
  }

  // QUOTE title on the right
  doc.setTextColor(...primaryColor);
  setFont(28, 'bold');
  doc.text('QUOTE', pageWidth - margin, margin + 5, { align: 'right' });

  // Quote number below
  doc.setTextColor(...darkGray);
  setFont(10, 'normal');
  doc.text(`#${data.quoteNumber}`, pageWidth - margin, margin + 14, { align: 'right' });

  y += 10;

  // ============ DIVIDER LINE ============
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============ PREPARED FOR & QUOTE DETAILS ============

  const leftColX = margin;
  const rightColX = pageWidth / 2 + 10;
  let leftY = y;
  let rightY = y;

  // Prepared For header
  doc.setTextColor(...lightGray);
  setFont(9, 'bold');
  doc.text('PREPARED FOR', leftColX, leftY);
  leftY += 6;

  // Customer name
  doc.setTextColor(...darkGray);
  setFont(11, 'bold');
  doc.text(data.accountName, leftColX, leftY);
  leftY += 6;

  // Account code
  if (data.accountCode) {
    setFont(9, 'normal');
    doc.setTextColor(...lightGray);
    doc.text(`Account: ${data.accountCode}`, leftColX, leftY);
    leftY += 5;
  }

  // Contact info
  doc.setTextColor(...darkGray);
  setFont(9, 'normal');
  if (data.contactName) {
    doc.text(`Contact: ${data.contactName}`, leftColX, leftY);
    leftY += 5;
  }
  if (data.contactEmail) {
    doc.text(data.contactEmail, leftColX, leftY);
    leftY += 5;
  }
  if (data.contactPhone) {
    doc.text(data.contactPhone, leftColX, leftY);
    leftY += 5;
  }

  // Quote Details (right side)
  doc.setTextColor(...lightGray);
  setFont(9, 'bold');
  doc.text('QUOTE DETAILS', rightColX, rightY);
  rightY += 6;

  // Quote info
  const infoItems = [
    { label: 'Quote Date:', value: formatDate(data.quoteDate) },
    { label: 'Valid Until:', value: data.expirationDate ? formatDate(data.expirationDate) : 'N/A' },
    { label: 'Storage Days:', value: data.estimatedStorageDays.toString() },
    { label: 'Status:', value: data.status.charAt(0).toUpperCase() + data.status.slice(1) },
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

  // ============ CLASS QUANTITIES ============

  if (data.classLines.length > 0) {
    doc.setTextColor(...darkGray);
    setFont(11, 'bold');
    doc.text('Item Quantities by Size Class', margin, y);
    y += 8;

    // Table header background
    doc.setFillColor(...veryLightGray);
    doc.rect(margin, y - 5, contentWidth, 10, 'F');

    // Table headers
    doc.setTextColor(...darkGray);
    setFont(9, 'bold');
    doc.text('Size Class', margin + 2, y);
    doc.text('Description', margin + 50, y);
    doc.text('Quantity', pageWidth - margin - 2, y, { align: 'right' });
    y += 8;

    // Table rows
    setFont(9, 'normal');
    let totalItems = 0;
    for (const line of data.classLines) {
      doc.text(line.className, margin + 2, y);
      doc.text(line.description || '-', margin + 50, y);
      doc.text(line.quantity.toString(), pageWidth - margin - 2, y, { align: 'right' });
      totalItems += line.quantity;
      y += 6;
    }

    // Total row
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    setFont(9, 'bold');
    doc.text('Total Items:', margin + 2, y);
    doc.text(totalItems.toString(), pageWidth - margin - 2, y, { align: 'right' });
    y += 15;
  }

  // ============ SERVICES TABLE ============

  doc.setTextColor(...darkGray);
  setFont(11, 'bold');
  doc.text('Services', margin, y);
  y += 8;

  // Table header background
  doc.setFillColor(...veryLightGray);
  doc.rect(margin, y - 5, contentWidth, 10, 'F');

  // Table headers
  doc.setTextColor(...darkGray);
  setFont(9, 'bold');

  const colWidths = {
    service: 45,
    class: 30,
    rate: 35,
    qty: 20,
    total: contentWidth - 45 - 30 - 35 - 20,
  };

  let tableX = margin;
  doc.text('Service', tableX + 2, y);
  tableX += colWidths.service;
  doc.text('Class', tableX + 2, y);
  tableX += colWidths.class;
  doc.text('Rate', tableX + colWidths.rate - 2, y, { align: 'right' });
  tableX += colWidths.rate;
  doc.text('Qty', tableX + colWidths.qty - 2, y, { align: 'right' });
  tableX += colWidths.qty;
  doc.text('Total', tableX + colWidths.total - 2, y, { align: 'right' });
  y += 8;

  // Table rows
  setFont(9, 'normal');
  let rowCount = 0;
  for (const line of data.serviceLines) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.height - 80) {
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

    // Service name (truncate if needed)
    const serviceName =
      line.serviceName.length > 25 ? line.serviceName.substring(0, 22) + '...' : line.serviceName;
    doc.text(serviceName, tableX + 2, y);
    tableX += colWidths.service;

    // Class
    doc.text(line.className || '-', tableX + 2, y);
    tableX += colWidths.class;

    // Rate with unit
    const rateText = `${formatCurrency(line.rate)} ${getBillingUnitLabel(line.billingUnit)}`;
    doc.text(rateText, tableX + colWidths.rate - 2, y, { align: 'right' });
    tableX += colWidths.rate;

    // Quantity
    doc.text(line.quantity.toString(), tableX + colWidths.qty - 2, y, { align: 'right' });
    tableX += colWidths.qty;

    // Line total
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(line.lineTotal), tableX + colWidths.total - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += 7;
    rowCount++;
  }

  // Table bottom border
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // ============ TOTALS SECTION ============

  const totalsX = pageWidth - margin - 60;
  const totalsValueX = pageWidth - margin;

  // Subtotal
  setFont(10, 'normal');
  doc.setTextColor(...lightGray);
  doc.text('Subtotal:', totalsX, y, { align: 'right' });
  doc.setTextColor(...darkGray);
  doc.text(formatCurrency(data.subtotal, data.currency), totalsValueX, y, { align: 'right' });
  y += 6;

  // Discount (if applicable)
  if (data.discountAmount && data.discountAmount > 0) {
    doc.setTextColor(...lightGray);
    const discountLabel =
      data.discountType === 'percentage'
        ? `Discount (${data.discountValue}%):`
        : 'Discount:';
    doc.text(discountLabel, totalsX, y, { align: 'right' });
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`-${formatCurrency(data.discountAmount, data.currency)}`, totalsValueX, y, {
      align: 'right',
    });
    y += 6;
  }

  // Tax (if applicable)
  if (data.taxAmount && data.taxAmount > 0) {
    doc.setTextColor(...lightGray);
    doc.text(`Tax (${((data.taxRate || 0) * 100).toFixed(1)}%):`, totalsX, y, { align: 'right' });
    doc.setTextColor(...darkGray);
    doc.text(formatCurrency(data.taxAmount, data.currency), totalsValueX, y, { align: 'right' });
    y += 6;
  }

  // Total line
  y += 2;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(totalsX - 20, y, pageWidth - margin, y);
  y += 8;

  // Grand total (large, bold)
  setFont(14, 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Grand Total:', totalsX, y, { align: 'right' });
  doc.setTextColor(...darkGray);
  doc.text(formatCurrency(data.grandTotal, data.currency), totalsValueX, y, { align: 'right' });

  y += 20;

  // ============ NOTES ============

  if (data.notes) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.height - 40) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setTextColor(...lightGray);
    setFont(9, 'bold');
    doc.text('Notes:', margin, y);
    y += 5;
    doc.setTextColor(...darkGray);
    setFont(9, 'normal');
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, y);
  }

  // ============ FOOTER ============

  const footerY = doc.internal.pageSize.height - 15;
  doc.setTextColor(...lightGray);
  setFont(8, 'normal');
  doc.text(
    'This quote is valid for 30 days unless otherwise specified.',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(`Generated by ${data.companyName}`, pageWidth / 2, footerY + 5, { align: 'center' });

  return doc;
}

/**
 * Download the PDF quote
 */
export function downloadQuotePdf(data: QuotePdfData): void {
  const doc = generateQuotePdf(data);
  doc.save(`Quote_${data.quoteNumber}.pdf`);
}

/**
 * Open PDF in new tab for printing
 */
export function printQuotePdf(data: QuotePdfData): void {
  const doc = generateQuotePdf(data);
  const pdfUrl = doc.output('bloburl');
  window.open(pdfUrl.toString(), '_blank');
}

/**
 * Export quote to Excel
 */
export function exportQuoteToExcel(data: QuotePdfData): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Quote Summary'],
    [],
    ['Quote Number', data.quoteNumber],
    ['Quote Date', formatDate(data.quoteDate)],
    ['Valid Until', data.expirationDate ? formatDate(data.expirationDate) : 'N/A'],
    ['Status', data.status],
    [],
    ['Account', data.accountName],
    ['Contact', data.contactName || '-'],
    ['Email', data.contactEmail || '-'],
    ['Phone', data.contactPhone || '-'],
    [],
    ['Storage Duration', `${data.estimatedStorageDays} days`],
    [],
    ['Subtotal', formatCurrency(data.subtotal, data.currency)],
    ['Discount', data.discountAmount ? `-${formatCurrency(data.discountAmount, data.currency)}` : '-'],
    ['Tax', data.taxAmount ? formatCurrency(data.taxAmount, data.currency) : '-'],
    ['Grand Total', formatCurrency(data.grandTotal, data.currency)],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Class quantities sheet
  if (data.classLines.length > 0) {
    const classData = [
      ['Size Class', 'Description', 'Quantity'],
      ...data.classLines.map((line) => [line.className, line.description || '', line.quantity]),
      [],
      ['Total Items', '', data.classLines.reduce((sum, l) => sum + l.quantity, 0)],
    ];
    const classSheet = XLSX.utils.aoa_to_sheet(classData);
    XLSX.utils.book_append_sheet(wb, classSheet, 'Item Quantities');
  }

  // Services sheet
  const servicesData = [
    ['Service', 'Category', 'Class', 'Billing Unit', 'Rate', 'Quantity', 'Taxable', 'Line Total'],
    ...data.serviceLines.map((line) => [
      line.serviceName,
      line.category,
      line.className || '-',
      line.billingUnit,
      line.rate,
      line.quantity,
      line.isTaxable ? 'Yes' : 'No',
      line.lineTotal,
    ]),
  ];
  const servicesSheet = XLSX.utils.aoa_to_sheet(servicesData);
  XLSX.utils.book_append_sheet(wb, servicesSheet, 'Services');

  // Download
  XLSX.writeFile(wb, `Quote_${data.quoteNumber}.xlsx`);
}

/**
 * Transform Quote data to QuotePdfData format
 */
export function transformQuoteToPdfData(
  quote: Quote & {
    account?: { account_name: string; account_code?: string; primary_contact_name?: string; primary_contact_email?: string; primary_contact_phone?: string };
    tenant?: { name: string; address?: string; phone?: string; email?: string };
    quote_class_lines?: (QuoteClassLine & { quote_class?: { name: string; description?: string } })[];
    quote_selected_services?: (QuoteSelectedService & {
      quote_service?: { name: string; category: string; billing_unit: string };
      quote_class?: { name: string };
    })[];
  }
): QuotePdfData {
  return {
    quoteNumber: quote.quote_number,
    quoteDate: quote.created_at,
    expirationDate: quote.expiration_date || undefined,
    estimatedStorageDays: quote.estimated_storage_days || 0,
    status: quote.status,

    companyName: quote.tenant?.name || 'Warehouse Services',
    companyAddress: quote.tenant?.address,
    companyPhone: quote.tenant?.phone,
    companyEmail: quote.tenant?.email,

    accountName: quote.account?.account_name || 'Unknown Account',
    accountCode: quote.account?.account_code,
    contactName: quote.account?.primary_contact_name,
    contactEmail: quote.account?.primary_contact_email,
    contactPhone: quote.account?.primary_contact_phone,

    classLines: (quote.quote_class_lines || []).map((line) => ({
      className: line.quote_class?.name || 'Unknown',
      description: line.quote_class?.description,
      quantity: line.quantity,
    })),

    serviceLines: (quote.quote_selected_services || []).map((service) => ({
      serviceName: service.quote_service?.name || 'Unknown',
      category: service.quote_service?.category || '',
      className: service.quote_class?.name,
      billingUnit: service.quote_service?.billing_unit || 'flat',
      rate: service.rate_amount,
      quantity: service.quantity || 1,
      lineTotal: service.line_total,
      isTaxable: service.is_taxable,
    })),

    subtotal: quote.subtotal || 0,
    discountType: quote.discount_type || undefined,
    discountValue: quote.discount_value || undefined,
    discountAmount: quote.discount_amount || undefined,
    taxRate: quote.tax_rate || undefined,
    taxAmount: quote.tax_amount || undefined,
    grandTotal: quote.grand_total || 0,
    currency: quote.currency || 'USD',

    notes: quote.notes || undefined,
  };
}

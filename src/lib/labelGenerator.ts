import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface LocationLabelData {
  code: string;
  name: string;
  type: string;
  warehouseName: string;
  warehouseCode: string;
}

export interface ItemLabelData {
  id: string;
  itemCode: string;
  description: string;
  vendor: string;
  account: string;
  sidemark?: string;
  room?: string;
  warehouseName?: string;
  locationCode?: string;
}

interface QRPayload {
  type: 'item' | 'location';
  id: string;
  code: string;
  v: number; // version for future compatibility
}

const LABEL_WIDTH_INCHES = 4;
const LABEL_HEIGHT_INCHES = 6;
const DPI = 72; // jsPDF uses 72 DPI

const LABEL_WIDTH = LABEL_WIDTH_INCHES * DPI;
const LABEL_HEIGHT = LABEL_HEIGHT_INCHES * DPI;
const MARGIN = 0.25 * DPI;

// Base URL for deep links - use published URL if available, otherwise preview
const getBaseUrl = (): string => {
  // In production, use the actual domain
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://id-preview--2db8a4a9-ca38-466e-84b2-80e3eeb232e2.lovable.app';
};

async function generateQRDataUrl(data: string): Promise<string> {
  return await QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
}

function createItemQRPayload(item: ItemLabelData): string {
  const payload: QRPayload = {
    type: 'item',
    id: item.id,
    code: item.itemCode,
    v: 1,
  };
  return JSON.stringify(payload);
}

function createLocationQRPayload(location: LocationLabelData): string {
  const payload: QRPayload = {
    type: 'location',
    id: location.code, // Using code as ID for locations
    code: location.code,
    v: 1,
  };
  return JSON.stringify(payload);
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '';
  let truncated = text;
  while (doc.getTextWidth(truncated) > maxWidth && truncated.length > 3) {
    truncated = truncated.slice(0, -4) + '...';
  }
  return truncated;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number, maxLines: number = 2): string[] {
  if (!text) return [''];
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (doc.getTextWidth(testLine) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          // Add ellipsis to last line if we're cutting off
          const lastLine = lines[lines.length - 1];
          lines[lines.length - 1] = truncateText(doc, lastLine, maxWidth);
          return lines;
        }
      }
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(truncateText(doc, currentLine, maxWidth));
  }
  
  return lines.slice(0, maxLines);
}

export async function generateLocationLabelsPDF(locations: LocationLabelData[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [LABEL_WIDTH, LABEL_HEIGHT],
  });

  for (let i = 0; i < locations.length; i++) {
    if (i > 0) {
      doc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
    }

    const location = locations[i];
    const qrPayload = createLocationQRPayload(location);
    const qrDataUrl = await generateQRDataUrl(qrPayload);

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LABEL_WIDTH, LABEL_HEIGHT, 'F');

    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(MARGIN / 2, MARGIN / 2, LABEL_WIDTH - MARGIN, LABEL_HEIGHT - MARGIN, 'S');

    // Location code (large)
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(location.code, LABEL_WIDTH / 2, MARGIN + 45, { align: 'center' });

    // Location name
    if (location.name) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text(location.name, LABEL_WIDTH / 2, MARGIN + 75, { align: 'center' });
    }

    // Type badge
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const typeText = location.type.toUpperCase();
    const typeWidth = doc.getTextWidth(typeText) + 20;
    const typeX = (LABEL_WIDTH - typeWidth) / 2;
    
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(typeX, MARGIN + 90, typeWidth, 26, 4, 4, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(typeText, LABEL_WIDTH / 2, MARGIN + 108, { align: 'center' });

    // QR Code (larger for better scanning)
    const qrSize = 220;
    const qrX = (LABEL_WIDTH - qrSize) / 2;
    const qrY = MARGIN + 135;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Warehouse info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Warehouse: ${location.warehouseName}`, LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 30, {
      align: 'center',
    });

    // Scan instruction
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Scan to update location', LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 10, { align: 'center' });
  }

  return doc.output('blob');
}

export async function generateItemLabelsPDF(items: ItemLabelData[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [LABEL_WIDTH, LABEL_HEIGHT],
  });

  const maxTextWidth = LABEL_WIDTH - MARGIN * 2 - 20;

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      doc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
    }

    const item = items[i];
    const qrPayload = createItemQRPayload(item);
    const qrDataUrl = await generateQRDataUrl(qrPayload);

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LABEL_WIDTH, LABEL_HEIGHT, 'F');

    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(2);
    doc.rect(MARGIN / 2, MARGIN / 2, LABEL_WIDTH - MARGIN, LABEL_HEIGHT - MARGIN, 'S');

    let yPos = MARGIN + 15;

    // 1. Account (large, prominent at top)
    if (item.account) {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      const accountText = truncateText(doc, item.account, maxTextWidth);
      doc.text(accountText, LABEL_WIDTH / 2, yPos + 18, { align: 'center' });
      yPos += 35;
    }

    // 2. Sidemark (prominent)
    if (item.sidemark) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const sidemarkText = truncateText(doc, item.sidemark, maxTextWidth);
      doc.text(sidemarkText, LABEL_WIDTH / 2, yPos, { align: 'center' });
      yPos += 28;
    }

    // 2b. Room (if present)
    if (item.room) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const roomText = truncateText(doc, `Room: ${item.room}`, maxTextWidth);
      doc.text(roomText, LABEL_WIDTH / 2, yPos, { align: 'center' });
      yPos += 22;
    }

    // Horizontal line after account/sidemark/room
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(1);
    doc.line(MARGIN + 20, yPos, LABEL_WIDTH - MARGIN - 20, yPos);
    yPos += 18;

    // 3. Item Code (large, bold)
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(item.itemCode, LABEL_WIDTH / 2, yPos + 20, { align: 'center' });
    yPos += 42;

    // 4. Vendor
    if (item.vendor) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const vendorText = truncateText(doc, item.vendor, maxTextWidth);
      doc.text(vendorText, LABEL_WIDTH / 2, yPos, { align: 'center' });
      yPos += 22;
    }

    // 5. Description (wrapped, 2 lines max)
    if (item.description) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const descLines = wrapText(doc, item.description, maxTextWidth, 2);
      for (const line of descLines) {
        doc.text(line, LABEL_WIDTH / 2, yPos, { align: 'center' });
        yPos += 16;
      }
    }

    // 6. QR Code (centered, large for easy scanning)
    const qrSize = 180;
    const qrX = (LABEL_WIDTH - qrSize) / 2;
    const qrY = yPos + 8;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Scan instruction at bottom
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Scan QR to view item details', LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 8, { align: 'center' });
  }

  return doc.output('blob');
}

/**
 * PRINTING STANDARD (GLOBAL)
 * 
 * 1. Use native browser print dialog only
 * 2. Print must be triggered by direct user click (no auto-print on load)
 * 3. Do not use hidden iframes
 * 4. Use dedicated printable view route (/print-preview)
 * 5. Call window.print() only after user-initiated navigation
 * 
 * If Chrome shows ERR_BLOCKED_BY_CLIENT:
 * - Browser extensions (ad blockers, privacy tools) can block print calls
 * - Provide user guidance via toast notification
 * - Offer download as fallback
 */

// Helper to trigger download
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper to convert blob to base64 for localStorage transfer
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Custom error for popup blocked
export class PrintPopupBlockedError extends Error {
  constructor() {
    super('POPUP_BLOCKED');
    this.name = 'PrintPopupBlockedError';
  }
}

// Helper to print labels using an iframe (avoids popup blockers)
export async function printLabels(blob: Blob, filename: string = 'labels.pdf'): Promise<void> {
  const url = URL.createObjectURL(blob);

  // Use a hidden iframe to trigger print without popup
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.src = url;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.print();
    } catch {
      // If iframe print fails (cross-origin), fall back to download
      downloadLabels(blob, filename);
    }
    // Clean up after a delay to allow print dialog to appear
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };

  iframe.onerror = () => {
    // Fall back to download if iframe fails
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
    downloadLabels(blob, filename);
  };
}

// Download labels as a PDF file (fallback)
export function downloadLabels(blob: Blob, filename: string = 'labels.pdf'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

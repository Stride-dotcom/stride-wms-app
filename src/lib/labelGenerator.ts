import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface LocationLabelData {
  code: string;
  name: string;
  type: string;
  warehouseName: string;
  warehouseCode: string;
}

interface ItemLabelData {
  itemCode: string;
  description: string;
  vendor: string;
  sidemark: string;
  warehouseName: string;
  locationCode: string;
}

const LABEL_WIDTH_INCHES = 4;
const LABEL_HEIGHT_INCHES = 6;
const DPI = 72; // jsPDF uses 72 DPI

const LABEL_WIDTH = LABEL_WIDTH_INCHES * DPI;
const LABEL_HEIGHT = LABEL_HEIGHT_INCHES * DPI;
const MARGIN = 0.25 * DPI;

// Base URL for deep links
const BASE_URL = window.location.origin;

async function generateQRDataUrl(data: string): Promise<string> {
  return await QRCode.toDataURL(data, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
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
    const deepLink = `${BASE_URL}/scan/location/${location.code}`;
    const qrDataUrl = await generateQRDataUrl(deepLink);

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LABEL_WIDTH, LABEL_HEIGHT, 'F');

    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(MARGIN / 2, MARGIN / 2, LABEL_WIDTH - MARGIN, LABEL_HEIGHT - MARGIN, 'S');

    // Location code (large)
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.text(location.code, LABEL_WIDTH / 2, MARGIN + 40, { align: 'center' });

    // Location name
    if (location.name) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text(location.name, LABEL_WIDTH / 2, MARGIN + 70, { align: 'center' });
    }

    // Type badge
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const typeText = location.type.toUpperCase();
    const typeWidth = doc.getTextWidth(typeText) + 16;
    const typeX = (LABEL_WIDTH - typeWidth) / 2;
    
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(typeX, MARGIN + 85, typeWidth, 24, 4, 4, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(typeText, LABEL_WIDTH / 2, MARGIN + 102, { align: 'center' });

    // QR Code
    const qrSize = 180;
    const qrX = (LABEL_WIDTH - qrSize) / 2;
    const qrY = MARGIN + 130;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Warehouse info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Warehouse: ${location.warehouseName}`, LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 40, {
      align: 'center',
    });

    // Deep link text (small)
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(deepLink, LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 15, { align: 'center' });
  }

  return doc.output('blob');
}

export async function generateItemLabelsPDF(items: ItemLabelData[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [LABEL_WIDTH, LABEL_HEIGHT],
  });

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      doc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
    }

    const item = items[i];
    const deepLink = `${BASE_URL}/scan/item/${item.itemCode}`;
    const qrDataUrl = await generateQRDataUrl(deepLink);

    // Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, LABEL_WIDTH, LABEL_HEIGHT, 'F');

    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.rect(MARGIN / 2, MARGIN / 2, LABEL_WIDTH - MARGIN, LABEL_HEIGHT - MARGIN, 'S');

    // Item code (large)
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(item.itemCode, LABEL_WIDTH / 2, MARGIN + 35, { align: 'center' });

    // Description (truncated)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    const maxDescWidth = LABEL_WIDTH - MARGIN * 2;
    let description = item.description;
    while (doc.getTextWidth(description) > maxDescWidth && description.length > 3) {
      description = description.slice(0, -4) + '...';
    }
    doc.text(description, LABEL_WIDTH / 2, MARGIN + 60, { align: 'center' });

    // Vendor & Sidemark
    if (item.vendor || item.sidemark) {
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      const infoLine = [item.vendor, item.sidemark].filter(Boolean).join(' | ');
      doc.text(infoLine, LABEL_WIDTH / 2, MARGIN + 80, { align: 'center' });
    }

    // QR Code
    const qrSize = 200;
    const qrX = (LABEL_WIDTH - qrSize) / 2;
    const qrY = MARGIN + 100;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Location info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    if (item.locationCode) {
      doc.text(`Location: ${item.locationCode}`, LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 55, {
        align: 'center',
      });
    }

    // Warehouse info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(item.warehouseName, LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 35, {
      align: 'center',
    });

    // Deep link text (small)
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(deepLink, LABEL_WIDTH / 2, LABEL_HEIGHT - MARGIN - 15, { align: 'center' });
  }

  return doc.output('blob');
}

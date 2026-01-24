import { supabase } from "@/integrations/supabase/client";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, html },
    });
    
    if (error) {
      console.error("sendEmail error:", error);
      return { ok: false, error: error.message };
    }
    
    return data as { ok: boolean; error?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sendEmail exception:", err);
    return { ok: false, error: message };
  }
}

// Email template helpers for core warehouse alerts

export function buildShipmentReceivedEmail(params: {
  shipmentNumber: string;
  accountName: string;
  itemCount: number;
  receivedDate: string;
  receivedBy?: string;
}): { subject: string; html: string } {
  return {
    subject: `Shipment ${params.shipmentNumber} Received`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Shipment Received</h2>
        <p>Your shipment has been received at the warehouse.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Shipment #:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.shipmentNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Account:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.accountName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Items:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.itemCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Received:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.receivedDate}</td>
          </tr>
          ${params.receivedBy ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Received By:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.receivedBy}</td>
          </tr>
          ` : ''}
        </table>
        <p style="color: #666; font-size: 14px;">This is an automated notification from Stride WMS.</p>
      </div>
    `,
  };
}

export function buildInspectionCompletedEmail(params: {
  itemCode: string;
  itemDescription: string;
  accountName: string;
  inspectionDate: string;
  inspectionNotes?: string;
  hasDamage?: boolean;
}): { subject: string; html: string } {
  return {
    subject: `Inspection Completed: ${params.itemCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Inspection Completed</h2>
        <p>An item inspection has been completed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Item Code:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.itemCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Description:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.itemDescription}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Account:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.accountName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.inspectionDate}</td>
          </tr>
          ${params.hasDamage !== undefined ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Condition:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${params.hasDamage ? '#d9534f' : '#5cb85c'};">
              ${params.hasDamage ? 'Damage Found' : 'No Damage'}
            </td>
          </tr>
          ` : ''}
          ${params.inspectionNotes ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Notes:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.inspectionNotes}</td>
          </tr>
          ` : ''}
        </table>
        <p style="color: #666; font-size: 14px;">This is an automated notification from Stride WMS.</p>
      </div>
    `,
  };
}

export function buildRepairQuoteReadyEmail(params: {
  itemCode: string;
  itemDescription: string;
  accountName: string;
  quoteAmount: number;
  quoteNotes?: string;
  quoteLink?: string;
}): { subject: string; html: string } {
  return {
    subject: `Repair Quote Ready: ${params.itemCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Repair Quote Ready</h2>
        <p>A repair quote has been prepared for your item.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Item Code:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.itemCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Description:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.itemDescription}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Account:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.accountName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quote Amount:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">$${params.quoteAmount.toFixed(2)}</td>
          </tr>
          ${params.quoteNotes ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Notes:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.quoteNotes}</td>
          </tr>
          ` : ''}
        </table>
        ${params.quoteLink ? `
        <p style="margin: 20px 0;">
          <a href="${params.quoteLink}" style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Quote Details</a>
        </p>
        ` : ''}
        <p style="color: #666; font-size: 14px;">This is an automated notification from Stride WMS.</p>
      </div>
    `,
  };
}

export function buildInvoiceSentEmail(params: {
  invoiceNumber: string;
  accountName: string;
  periodStart: string;
  periodEnd: string;
  total: number;
  lineCount: number;
}): { subject: string; html: string } {
  return {
    subject: `Invoice ${params.invoiceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice</h2>
        <p>Please find your invoice details below.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Invoice #:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Account:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.accountName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Period:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.periodStart} to ${params.periodEnd}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Line Items:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${params.lineCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Total:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 18px; font-weight: bold; color: #333;">$${params.total.toFixed(2)}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 14px;">This is an automated notification from Stride WMS.</p>
      </div>
    `,
  };
}

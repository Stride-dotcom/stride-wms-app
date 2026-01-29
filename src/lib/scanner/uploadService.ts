/**
 * Document Upload Service
 * Handles uploading scanned documents to Supabase storage
 */

import { supabase } from '@/integrations/supabase/client';
import type { 
  DocumentContext, 
  DocumentContextType,
  ScanOutput, 
  OcrResult, 
  UploadProgress,
  Document 
} from './types';

export interface UploadOptions {
  fileName?: string;
  label?: string;
  notes?: string;
  isSensitive?: boolean;
  enableOcr?: boolean;
}

export interface UploadResult {
  documentId: string;
  storageKey: string;
  publicUrl?: string;
}

/**
 * Generate storage path for document
 */
function generateStoragePath(
  tenantId: string,
  contextType: DocumentContextType,
  contextId: string | null,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (contextId) {
    return `${tenantId}/${contextType}/${contextId}/${timestamp}_${sanitizedFileName}`;
  }
  return `${tenantId}/${contextType}/general/${timestamp}_${sanitizedFileName}`;
}

/**
 * Extract context ID and type from DocumentContext
 */
function parseContext(context: DocumentContext): {
  type: DocumentContextType;
  id: string | null
} {
  switch (context.type) {
    case 'shipment':
      return { type: 'shipment', id: context.shipmentId };
    case 'employee':
      return { type: 'employee', id: context.employeeId };
    case 'delivery':
      return { type: 'delivery', id: context.deliveryId };
    case 'invoice':
      return { type: 'invoice', id: context.vendorId ?? null };
    case 'item':
      return { type: 'item', id: context.itemId };
    case 'task':
      return { type: 'task', id: context.taskId };
    case 'general':
      return { type: 'general', id: null };
    default:
      return { type: 'general', id: null };
  }
}

/**
 * Get current user's tenant ID
 */
async function getCurrentTenantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data: userData, error } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  
  if (error || !userData) {
    throw new Error('Failed to get tenant ID');
  }
  
  return userData.tenant_id;
}

/**
 * Upload document to storage and create database record
 */
export async function uploadDocument(
  scanOutput: ScanOutput,
  context: DocumentContext,
  ocrResult: OcrResult | null,
  options: UploadOptions = {},
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const { type: contextType, id: contextId } = parseContext(context);
  
  // Get tenant ID
  onProgress?.({ stage: 'preparing', percentage: 0 });
  const tenantId = await getCurrentTenantId();
  
  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Generate file name
  const fileName = options.fileName || `scan_${Date.now()}.pdf`;
  const storageKey = generateStoragePath(tenantId, contextType, contextId, fileName);
  
  // Get the PDF blob
  let pdfBlob: Blob;
  if (scanOutput.pdfBlob) {
    pdfBlob = scanOutput.pdfBlob;
  } else if (scanOutput.pdfUri) {
    // Fetch blob from URI
    const response = await fetch(scanOutput.pdfUri);
    pdfBlob = await response.blob();
  } else {
    throw new Error('No PDF data available');
  }
  
  // Upload to storage
  onProgress?.({ 
    stage: 'uploading', 
    percentage: 25,
    totalBytes: pdfBlob.size 
  });
  
  const { error: uploadError } = await supabase.storage
    .from('documents-private')
    .upload(storageKey, pdfBlob, {
      contentType: 'application/pdf',
      upsert: false,
    });
  
  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(`Failed to upload document: ${uploadError.message}`);
  }
  
  // Create database record
  onProgress?.({ stage: 'saving', percentage: 75 });
  
  // Generate label from context if not provided
  let label = options.label;
  if (!label) {
    switch (context.type) {
      case 'shipment':
        label = context.vendor ? `Shipment - ${context.vendor}` : 'Shipment Document';
        break;
      case 'employee':
        label = context.employeeName ? `${context.employeeName} Document` : 'Employee Document';
        break;
      case 'item':
        label = context.description ? `Item - ${context.description}` : 'Item Document';
        break;
      case 'invoice':
        label = context.invoiceNumber ? `Invoice ${context.invoiceNumber}` : 'Invoice';
        break;
      case 'delivery':
        label = 'Delivery Document';
        break;
      case 'general':
        label = context.label || 'General Document';
        break;
    }
  }
  
  const documentData = {
    tenant_id: tenantId,
    context_type: contextType as string,
    context_id: contextId,
    file_name: fileName,
    storage_key: storageKey,
    file_size: pdfBlob.size,
    page_count: scanOutput.pageCount,
    mime_type: 'application/pdf',
    ocr_text: ocrResult?.fullText || null,
    ocr_pages: ocrResult?.pages ? JSON.parse(JSON.stringify(ocrResult.pages)) : null,
    ocr_status: ocrResult ? 'completed' : 'skipped',
    label,
    notes: options.notes || null,
    is_sensitive: options.isSensitive ?? (contextType === 'employee'),
    created_by: user.id,
  };
  
  const { data: document, error: dbError } = await supabase
    .from('documents')
    .insert(documentData)
    .select()
    .single();
  
  if (dbError) {
    // Try to clean up the uploaded file
    await supabase.storage.from('documents-private').remove([storageKey]);
    console.error('Database insert error:', dbError);
    throw new Error(`Failed to save document record: ${dbError.message}`);
  }
  
  onProgress?.({ stage: 'complete', percentage: 100 });
  
  return {
    documentId: document.id,
    storageKey,
  };
}

/**
 * Get a signed URL for viewing a document
 */
export async function getDocumentSignedUrl(
  storageKey: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents-private')
    .createSignedUrl(storageKey, expiresIn);
  
  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId);
  
  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Permanently delete a document and its storage file
 */
export async function permanentlyDeleteDocument(
  documentId: string,
  storageKey: string
): Promise<void> {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('documents-private')
    .remove([storageKey]);
  
  if (storageError) {
    console.warn('Failed to delete storage file:', storageError);
  }
  
  // Delete from database
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);
  
  if (dbError) {
    throw new Error(`Failed to delete document record: ${dbError.message}`);
  }
}

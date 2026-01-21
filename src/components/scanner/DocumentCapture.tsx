/**
 * DocumentCapture Component
 * Full document capture card with thumbnail grid, Scan and Upload buttons
 * Matches the PhotoCapture component layout
 */

import { useRef, useState, useCallback } from 'react';
import { ScanLine, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useDocuments } from '@/hooks/useDocuments';
import { DocumentThumbnail } from './DocumentThumbnail';
import { DocumentScanner } from './DocumentScanner';
import { uploadDocument } from '@/lib/scanner/uploadService';
import { fileToDataUrl, resizeImage, imagesToPdf, createWebScanOutput } from '@/lib/scanner/webScanner';
import type { DocumentContext, Document } from '@/lib/scanner/types';

interface DocumentCaptureProps {
  context: DocumentContext;
  maxDocuments?: number;
  ocrEnabled?: boolean;
  onDocumentAdded?: (documentId: string) => void;
  onDocumentRemoved?: (documentId: string) => void;
}

export function DocumentCapture({
  context,
  maxDocuments = 10,
  ocrEnabled = true,
  onDocumentAdded,
  onDocumentRemoved,
}: DocumentCaptureProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scannerOpen, setScannerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Get context type and ID for the hook
  const contextType = context.type;
  const contextId = 
    context.type === 'shipment' ? context.shipmentId :
    context.type === 'item' ? context.itemId :
    context.type === 'employee' ? context.employeeId :
    context.type === 'delivery' ? context.deliveryId :
    context.type === 'invoice' ? context.invoiceNumber :
    undefined;

  const { documents, loading, deleteDocument, refetch } = useDocuments({
    contextType,
    contextId,
  });

  const handleScanSuccess = useCallback((documentId: string) => {
    setScannerOpen(false);
    refetch();
    onDocumentAdded?.(documentId);
    toast({
      title: 'Document scanned',
      description: 'The document has been saved.',
    });
  }, [refetch, onDocumentAdded, toast]);

  const handleScanError = useCallback((error: Error) => {
    setScannerOpen(false);
    toast({
      title: 'Scan failed',
      description: error.message,
      variant: 'destructive',
    });
  }, [toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxDocuments - documents.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Maximum documents reached',
        description: `You can only upload up to ${maxDocuments} documents.`,
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      for (const file of filesToUpload) {
        if (file.type.startsWith('image/')) {
          // Convert image to PDF
          const dataUrl = await fileToDataUrl(file);
          const resized = await resizeImage(dataUrl, 1920, 1920, 0.85);
          const scanOutput = await createWebScanOutput([resized]);
          
          await uploadDocument(
            scanOutput,
            context,
            null,
            {
              label: file.name.replace(/\.[^/.]+$/, ''),
              enableOcr: ocrEnabled,
            }
          );
          
          // Cleanup blob URL
          if (scanOutput.pdfUri?.startsWith('blob:')) {
            URL.revokeObjectURL(scanOutput.pdfUri);
          }
        } else if (file.type === 'application/pdf') {
          // Upload PDF directly - create a minimal scan output
          const pdfBlob = file;
          const pdfUri = URL.createObjectURL(pdfBlob);
          
          await uploadDocument(
            {
              pdfUri,
              pageCount: 1, // We don't know actual page count
              pageImageUris: [],
            },
            context,
            null,
            {
              fileName: file.name,
              label: file.name.replace(/\.[^/.]+$/, ''),
              enableOcr: ocrEnabled,
            }
          );
          
          URL.revokeObjectURL(pdfUri);
        } else {
          // For other file types (Word, Excel, etc.)
          const fileUri = URL.createObjectURL(file);
          
          await uploadDocument(
            {
              pdfUri: fileUri,
              pageCount: 1,
              pageImageUris: [],
            },
            context,
            null,
            {
              fileName: file.name,
              label: file.name.replace(/\.[^/.]+$/, ''),
              enableOcr: false, // OCR only works on images/PDFs
            }
          );
          
          URL.revokeObjectURL(fileUri);
        }
      }

      await refetch();
      toast({
        title: 'Upload complete',
        description: `${filesToUpload.length} document(s) uploaded successfully.`,
      });
    } catch (error: any) {
      console.error('Error uploading files:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Some files failed to upload. Please try again.';
      if (error.message?.includes('storage')) {
        errorMessage = 'Storage error: Unable to save files. Please check your connection and try again.';
      } else if (error.message?.includes('size') || error.message?.includes('large')) {
        errorMessage = 'One or more files are too large. Please use smaller files (under 10MB each).';
      } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
        errorMessage = 'Permission denied. Please refresh the page and try again.';
      } else if (error.message) {
        errorMessage = `Upload failed: ${error.message}`;
      }
      
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveDocument = async (doc: Document) => {
    try {
      await deleteDocument(doc.id);
      onDocumentRemoved?.(doc.id);
      toast({
        title: 'Document removed',
        description: 'The document has been deleted.',
      });
    } catch (error) {
      console.error('Error removing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove document.',
        variant: 'destructive',
      });
    }
  };

  const canAddMore = documents.length < maxDocuments;

  return (
    <div className="space-y-3">
      {/* Document Thumbnail Grid */}
      {documents.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {documents.map((doc) => (
            <DocumentThumbnail
              key={doc.id}
              documentId={doc.id}
              storageKey={doc.storage_key}
              fileName={doc.file_name}
              label={doc.label}
              mimeType={doc.mime_type}
              onRemove={() => handleRemoveDocument(doc)}
            />
          ))}
        </div>
      )}

      {/* Upload Buttons */}
      {canAddMore && (
        <div className="flex gap-2">
          {/* Scan Button - Goes directly to camera */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            disabled={uploading}
            className="flex-1"
          >
            <ScanLine className="h-4 w-4 mr-2" />
            Scan
          </Button>

          {/* Upload Button - File picker */}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      )}

      {/* Counter */}
      <p className="text-xs text-muted-foreground">
        {documents.length}/{maxDocuments} documents uploaded
      </p>

      {/* Document Scanner Dialog - Opens directly to camera */}
      <DocumentScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        context={context}
        isSensitive={false}
        enableOcr={ocrEnabled}
        onSuccess={handleScanSuccess}
        onError={handleScanError}
        initialMode="camera"
      />
    </div>
  );
}

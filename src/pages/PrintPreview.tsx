import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, Download, ArrowLeft, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

function base64ToBlob(base64: string, contentType: string): Blob {
  // Handle data URL format
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export default function PrintPreview() {
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('labels.pdf');

  useEffect(() => {
    // Retrieve PDF data from localStorage (shared between tabs, unlike sessionStorage)
    const pdfData = localStorage.getItem('printPreviewPdf');
    const storedFilename = localStorage.getItem('printPreviewFilename');
    
    if (pdfData) {
      try {
        const blob = base64ToBlob(pdfData, 'application/pdf');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        
        if (storedFilename) {
          setFilename(storedFilename);
        }
        
        // Clean up localStorage after reading
        localStorage.removeItem('printPreviewPdf');
        localStorage.removeItem('printPreviewFilename');
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load the PDF. Please try again.');
      }
    } else {
      setError('No PDF data found. Please generate labels again.');
    }

    // Cleanup URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleBack} variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-preview-container min-h-screen bg-background flex flex-col">
      {/* Toolbar - hidden when printing */}
      <div className="no-print border-b bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
        <Button onClick={handleBack} variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleDownload} variant="outline" disabled={!pdfUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button onClick={handlePrint} disabled={!pdfUrl}>
            <Printer className="mr-2 h-4 w-4" />
            Print Labels
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      {pdfUrl ? (
        <div className="flex-1 w-full">
          <embed 
            src={pdfUrl} 
            type="application/pdf" 
            className="w-full h-full min-h-[calc(100vh-73px)]"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading PDF...</p>
        </div>
      )}
    </div>
  );
}

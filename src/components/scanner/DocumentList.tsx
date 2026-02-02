/**
 * DocumentList Component
 * Displays a list of documents for a given context
 */

import { useState } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDocuments } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import type { DocumentContextType, Document } from '@/lib/scanner/types';
import { format } from 'date-fns';

interface DocumentListProps {
  contextType: DocumentContextType;
  contextId?: string;
  showSearch?: boolean;
  compact?: boolean;
  maxItems?: number;
  onViewDocument?: (document: Document) => void;
}

export function DocumentList({
  contextType,
  contextId,
  showSearch = false,
  compact = false,
  maxItems,
  onViewDocument,
}: DocumentListProps) {
  const { documents, loading, error, getSignedUrl, deleteDocument, refetch } = useDocuments({
    contextType,
    contextId,
  });
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  const filteredDocs = documents.filter(doc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.file_name.toLowerCase().includes(query) ||
      doc.label?.toLowerCase().includes(query) ||
      doc.ocr_text?.toLowerCase().includes(query)
    );
  });

  const displayDocs = maxItems ? filteredDocs.slice(0, maxItems) : filteredDocs;

  const handleView = async (doc: Document) => {
    if (onViewDocument) {
      onViewDocument(doc);
      return;
    }

    // Open a blank window immediately (in the trusted click context)
    // This prevents popup blockers from blocking the window
    const newWindow = window.open('about:blank', '_blank');

    setLoadingUrl(doc.id);
    try {
      const url = await getSignedUrl(doc.storage_key);
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        // Fallback if popup was blocked - navigate in same tab
        window.location.href = url;
      }
    } catch (err) {
      // Close the blank window if there was an error
      if (newWindow) {
        newWindow.close();
      }
      toast({
        title: 'Error',
        description: 'Failed to open document',
        variant: 'destructive',
      });
    } finally {
      setLoadingUrl(null);
    }
  };

  const handleDownload = async (doc: Document) => {
    setLoadingUrl(doc.id);
    try {
      const url = await getSignedUrl(doc.storage_key);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      link.click();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    } finally {
      setLoadingUrl(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    
    try {
      await deleteDocument(deletingDoc.id);
      toast({
        title: 'Document deleted',
        description: 'The document has been removed.',
      });
      setDeletingDoc(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const getOcrStatusBadge = (status: Document['ocr_status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="text-green-600">OCR Complete</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing OCR...</Badge>;
      case 'failed':
        return <Badge variant="destructive">OCR Failed</Badge>;
      case 'skipped':
        return null;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <MaterialIcon name="warning" className="mb-2" style={{ fontSize: '32px' }} />
        <p className="text-sm">Failed to load documents</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2">
          Try again
        </Button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <MaterialIcon name="description" className="mb-2" style={{ fontSize: '32px' }} />
        <p className="text-sm">No documents yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showSearch && documents.length > 3 && (
        <div className="relative">
          <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {displayDocs.map((doc) => (
          <div
            key={doc.id}
            className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors ${
              compact ? 'py-2' : ''
            }`}
          >
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MaterialIcon name="description" size="md" className="text-primary" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{doc.label || doc.file_name}</p>
                {doc.is_sensitive && (
                  <Badge variant="destructive" className="text-xs">Sensitive</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                {doc.page_count > 1 && <span>• {doc.page_count} pages</span>}
                {getOcrStatusBadge(doc.ocr_status)}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleView(doc)}
                disabled={loadingUrl === doc.id}
              >
                {loadingUrl === doc.id ? (
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                ) : (
                  <MaterialIcon name="visibility" size="sm" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(doc)}
                disabled={loadingUrl === doc.id}
              >
                <MaterialIcon name="download" size="sm" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingDoc(doc)}
                className="text-destructive hover:text-destructive"
              >
                <MaterialIcon name="delete" size="sm" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {maxItems && filteredDocs.length > maxItems && (
        <p className="text-sm text-muted-foreground text-center">
          + {filteredDocs.length - maxItems} more documents
        </p>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingDoc?.label || deletingDoc?.file_name}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

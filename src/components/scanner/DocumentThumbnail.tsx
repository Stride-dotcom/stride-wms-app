/**
 * DocumentThumbnail Component
 * Displays first-page preview of a document with delete button
 */

import { useState, useEffect } from 'react';
import { FileText, X, Loader2 } from 'lucide-react';
import { getDocumentSignedUrl } from '@/lib/scanner/uploadService';
import { cn } from '@/lib/utils';

interface DocumentThumbnailProps {
  documentId: string;
  storageKey: string;
  fileName: string;
  label?: string | null;
  mimeType?: string;
  onRemove?: () => void;
  className?: string;
}

export function DocumentThumbnail({
  documentId,
  storageKey,
  fileName,
  label,
  mimeType,
  onRemove,
  className,
}: DocumentThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      try {
        setLoading(true);
        setError(false);

        // For images, we can display directly
        if (mimeType?.startsWith('image/')) {
          const url = await getDocumentSignedUrl(storageKey);
          if (mounted) {
            setThumbnailUrl(url);
          }
        } else {
          // For PDFs and other documents, show file icon
          // In the future, we could generate thumbnails server-side
          if (mounted) {
            setThumbnailUrl(null);
          }
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      mounted = false;
    };
  }, [storageKey, mimeType]);

  const displayName = label || fileName;
  const truncatedName = displayName.length > 12 
    ? displayName.substring(0, 10) + '...' 
    : displayName;

  return (
    <div className={cn("relative group", className)}>
      <div className="aspect-square rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : thumbnailUrl && !error ? (
          <img
            src={thumbnailUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-2">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-destructive/90"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      
      {/* File name */}
      <p className="mt-1 text-xs text-muted-foreground text-center truncate" title={displayName}>
        {truncatedName}
      </p>
    </div>
  );
}

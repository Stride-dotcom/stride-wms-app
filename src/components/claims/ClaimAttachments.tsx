import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useClaims, ClaimAttachment } from '@/hooks/useClaims';
import { useAuth } from '@/contexts/AuthContext';
import {
  Upload,
  Download,
  Trash2,
  File,
  Image,
  FileVideo,
  FileText,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { format } from 'date-fns';

interface ClaimAttachmentsProps {
  claimId: string;
  isStaff?: boolean;
  readOnly?: boolean;
}

export function ClaimAttachments({ claimId, isStaff = true, readOnly = false }: ClaimAttachmentsProps) {
  const { fetchAttachments, uploadAttachment, deleteAttachment, toggleAttachmentVisibility } = useClaims();
  const { profile } = useAuth();
  const [attachments, setAttachments] = useState<ClaimAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAttachments();
  }, [claimId]);

  const loadAttachments = async () => {
    setLoading(true);
    const data = await fetchAttachments(claimId);
    // Filter by visibility for clients
    if (!isStaff) {
      setAttachments(data.filter((a) => a.is_public));
    } else {
      setAttachments(data);
    }
    setLoading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment(claimId, file, true);
      }
      await loadAttachments();
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (attachment: ClaimAttachment) => {
    const { data, error } = await supabase.storage
      .from('claims')
      .download(attachment.storage_path);

    if (error) {
      console.error('Download error:', error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.file_name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (attachment: ClaimAttachment) => {
    if (!confirm('Delete this attachment?')) return;
    await deleteAttachment(attachment);
    await loadAttachments();
  };

  const handleToggleVisibility = async (attachment: ClaimAttachment) => {
    await toggleAttachmentVisibility(attachment.id, !attachment.is_public);
    await loadAttachments();
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-5 w-5" />;
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (mimeType.startsWith('video/')) return <FileVideo className="h-5 w-5" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      {!readOnly && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Files
          </Button>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No attachments yet
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="text-muted-foreground">
                  {getFileIcon(attachment.mime_type)}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {attachment.file_name || 'Unnamed file'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size_bytes)} •{' '}
                    {format(new Date(attachment.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Visibility Badge */}
                {isStaff && (
                  <Badge
                    variant="outline"
                    className={attachment.is_public ? 'border-green-500 text-green-500' : 'border-yellow-500 text-yellow-500'}
                  >
                    {attachment.is_public ? (
                      <><Eye className="h-3 w-3 mr-1" /> Public</>
                    ) : (
                      <><EyeOff className="h-3 w-3 mr-1" /> Internal</>
                    )}
                  </Badge>
                )}

                {/* Toggle Visibility (Staff Only) */}
                {isStaff && !readOnly && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={attachment.is_public}
                      onCheckedChange={() => handleToggleVisibility(attachment)}
                    />
                  </div>
                )}

                {/* Download */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(attachment)}
                >
                  <Download className="h-4 w-4" />
                </Button>

                {/* Delete (Staff Only) */}
                {isStaff && !readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(attachment)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

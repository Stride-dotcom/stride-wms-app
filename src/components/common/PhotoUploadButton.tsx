/**
 * PhotoUploadButton Component
 * A button that opens a file picker for uploading photos
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PhotoUploadButtonProps {
  entityType: 'item' | 'shipment' | 'receiving' | 'inspection' | 'repair' | 'task' | 'claim';
  entityId?: string;
  tenantId?: string;
  existingPhotos?: string[];
  maxPhotos?: number;
  onPhotosSaved: (urls: string[]) => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
}

export function PhotoUploadButton({
  entityType,
  entityId,
  tenantId,
  existingPhotos = [],
  maxPhotos = 20,
  onPhotosSaved,
  variant = 'outline',
  size = 'default',
  className,
  label = 'Upload',
}: PhotoUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - existingPhotos.length;
    if (remainingSlots <= 0) {
      toast({
        variant: 'destructive',
        title: 'Maximum photos reached',
        description: `You can only have ${maxPhotos} photos.`,
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadPromises = filesToProcess.map(async (file) => {
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }

        const path = tenantId ? `tenants/${tenantId}` : entityType;
        const fileName = `${path}/${entityId || 'temp'}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);

        return data.publicUrl;
      });

      const newUrls = await Promise.all(uploadPromises);
      const allUrls = [...existingPhotos, ...newUrls];

      onPhotosSaved(allUrls);

      toast({
        title: 'Photos uploaded',
        description: `${newUrls.length} photo(s) uploaded successfully.`,
      });
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload photos.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => fileInputRef.current?.click()}
        className={className}
        disabled={uploading}
      >
        {uploading ? (
          <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
        ) : (
          <MaterialIcon name="upload" size="sm" className="mr-2" />
        )}
        {uploading ? 'Uploading...' : label}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

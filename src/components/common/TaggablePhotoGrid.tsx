/**
 * TaggablePhotoGrid Component
 * Displays a grid of photos with tagging support (primary, needs attention, repair)
 * Supports both simple URL strings and photo objects with metadata
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface TaggablePhoto {
  url: string;
  isPrimary?: boolean;
  needsAttention?: boolean;
  isRepair?: boolean;
}

// Normalize input to TaggablePhoto format
function normalizePhotos(input: (string | TaggablePhoto)[]): TaggablePhoto[] {
  return input.map(item => {
    if (typeof item === 'string') {
      return { url: item, isPrimary: false, needsAttention: false, isRepair: false };
    }
    return {
      url: item.url,
      isPrimary: item.isPrimary || false,
      needsAttention: item.needsAttention || false,
      isRepair: item.isRepair || false,
    };
  });
}

interface TaggablePhotoGridProps {
  photos: (string | TaggablePhoto)[];
  onPhotosChange?: (photos: TaggablePhoto[]) => void;
  readonly?: boolean;
  columns?: 3 | 4;
  enableTagging?: boolean;
}

export function TaggablePhotoGrid({
  photos,
  onPhotosChange,
  readonly = false,
  columns = 4,
  enableTagging = true,
}: TaggablePhotoGridProps) {
  const { toast } = useToast();
  const [lightboxPhoto, setLightboxPhoto] = useState<TaggablePhoto | null>(null);

  const normalizedPhotos = normalizePhotos(photos);

  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `photo-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download failed',
        description: 'Could not download the photo.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (urlToRemove: string) => {
    if (!onPhotosChange) return;

    try {
      // Extract the path from the URL
      const urlParts = urlToRemove.split('/photos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('photos').remove([filePath]);
      }

      const updatedPhotos = normalizedPhotos.filter(p => p.url !== urlToRemove);
      onPhotosChange(updatedPhotos);
    } catch (error) {
      console.error('Error removing photo:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove photo.',
        variant: 'destructive',
      });
    }
  };

  const handleSetPrimary = (url: string) => {
    if (!onPhotosChange || readonly) return;

    const updatedPhotos = normalizedPhotos.map(p => ({
      ...p,
      isPrimary: p.url === url,
    }));
    onPhotosChange(updatedPhotos);
    toast({ title: 'Primary Photo Set' });
  };

  const handleToggleAttention = (url: string) => {
    if (!onPhotosChange || readonly) return;

    const updatedPhotos = normalizedPhotos.map(p =>
      p.url === url ? { ...p, needsAttention: !p.needsAttention } : p
    );
    onPhotosChange(updatedPhotos);

    const photo = updatedPhotos.find(p => p.url === url);
    toast({
      title: photo?.needsAttention ? 'Photo Flagged' : 'Flag Removed',
      description: photo?.needsAttention
        ? 'Photo marked as needing attention.'
        : 'Attention flag removed.',
      variant: photo?.needsAttention ? 'destructive' : 'default',
    });
  };

  const handleToggleRepair = (url: string) => {
    if (!onPhotosChange || readonly) return;

    const updatedPhotos = normalizedPhotos.map(p =>
      p.url === url ? { ...p, isRepair: !p.isRepair } : p
    );
    onPhotosChange(updatedPhotos);

    const photo = updatedPhotos.find(p => p.url === url);
    toast({
      title: photo?.isRepair ? 'Repair Photo Tagged' : 'Tag Removed',
      description: photo?.isRepair
        ? 'Photo marked as repair photo.'
        : 'Repair tag removed.',
    });
  };

  if (normalizedPhotos.length === 0) {
    return null;
  }

  const gridCols = columns === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <>
      <div className={`grid ${gridCols} gap-2`}>
        {normalizedPhotos.map((photo, index) => {
          // Determine border color based on tags
          const borderClass = photo.needsAttention
            ? 'border-red-500 border-2'
            : photo.isRepair
            ? 'border-green-500 border-2'
            : photo.isPrimary
            ? 'border-primary border-2'
            : 'border';

          return (
            <div
              key={photo.url}
              className={`relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer ${borderClass}`}
              onClick={() => setLightboxPhoto(photo)}
            >
              <img
                src={photo.url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Tag badges - visible overlay */}
              {enableTagging && (photo.isPrimary || photo.needsAttention || photo.isRepair) && (
                <div className="absolute top-1 left-1 flex gap-1 flex-wrap">
                  {photo.isPrimary && (
                    <Badge className="h-5 text-[10px] bg-amber-500 text-white px-1.5 shadow-md">
                      <MaterialIcon name="star" className="text-[10px] mr-0.5" />
                      Primary
                    </Badge>
                  )}
                  {photo.needsAttention && (
                    <Badge className="h-5 text-[10px] bg-red-600 text-white px-1.5 shadow-md">
                      <MaterialIcon name="warning" className="text-[10px] mr-0.5" />
                      Attention
                    </Badge>
                  )}
                  {photo.isRepair && (
                    <Badge className="h-5 text-[10px] bg-green-600 text-white px-1.5 shadow-md">
                      <MaterialIcon name="build" className="text-[10px] mr-0.5" />
                      Repair
                    </Badge>
                  )}
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <MaterialIcon name="zoom_in" size="lg" className="text-white" />
              </div>

              {/* Action buttons - visible on mobile, hover on desktop */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1 justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(photo.url, index);
                    }}
                    className="p-1.5 text-white hover:text-blue-400"
                  >
                    <MaterialIcon name="download" className="h-4 w-4" />
                  </button>
                  {enableTagging && !readonly && onPhotosChange && (
                    <>
                      {!photo.isPrimary && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimary(photo.url);
                          }}
                          className="p-1.5 text-amber-400 hover:text-amber-300"
                        >
                          <MaterialIcon name="star" className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleAttention(photo.url);
                        }}
                        className={`p-1.5 ${photo.needsAttention ? 'text-red-400 bg-red-500/20 rounded' : 'text-white'} hover:text-red-400`}
                      >
                        <MaterialIcon name="warning" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRepair(photo.url);
                        }}
                        className={`p-1.5 ${photo.isRepair ? 'text-green-400 bg-green-500/20 rounded' : 'text-white'} hover:text-green-400`}
                      >
                        <MaterialIcon name="build" className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {!readonly && onPhotosChange && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(photo.url);
                      }}
                      className="p-1.5 text-white hover:text-destructive"
                    >
                      <MaterialIcon name="close" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Photo
              {lightboxPhoto?.isPrimary && (
                <Badge className="bg-amber-500 text-white">
                  <MaterialIcon name="star" className="text-[12px] mr-1" />
                  Primary
                </Badge>
              )}
              {lightboxPhoto?.needsAttention && (
                <Badge className="bg-red-600 text-white">
                  <MaterialIcon name="warning" className="text-[12px] mr-1" />
                  Needs Attention
                </Badge>
              )}
              {lightboxPhoto?.isRepair && (
                <Badge className="bg-green-600 text-white">
                  <MaterialIcon name="build" className="text-[12px] mr-1" />
                  Repair
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {lightboxPhoto && (
            <div className="relative">
              <img
                src={lightboxPhoto.url}
                alt="Photo"
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
              <div className="flex gap-2 mt-4 justify-end flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    const index = normalizedPhotos.findIndex(p => p.url === lightboxPhoto.url);
                    handleDownload(lightboxPhoto.url, index >= 0 ? index : 0);
                  }}
                >
                  <MaterialIcon name="download" size="sm" className="mr-2" />
                  Download
                </Button>
                {enableTagging && !readonly && onPhotosChange && (
                  <>
                    {!lightboxPhoto.isPrimary && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleSetPrimary(lightboxPhoto.url);
                          setLightboxPhoto(null);
                        }}
                      >
                        <MaterialIcon name="star" size="sm" className="mr-2" />
                        Set as Primary
                      </Button>
                    )}
                    <Button
                      variant={lightboxPhoto.needsAttention ? 'secondary' : 'outline'}
                      onClick={() => {
                        handleToggleAttention(lightboxPhoto.url);
                        setLightboxPhoto(null);
                      }}
                    >
                      <MaterialIcon name="warning" size="sm" className="mr-2" />
                      {lightboxPhoto.needsAttention ? 'Remove Attention Flag' : 'Mark Needs Attention'}
                    </Button>
                    <Button
                      variant={lightboxPhoto.isRepair ? 'secondary' : 'outline'}
                      className={lightboxPhoto.isRepair ? 'bg-green-100 hover:bg-green-200 text-green-700' : ''}
                      onClick={() => {
                        handleToggleRepair(lightboxPhoto.url);
                        setLightboxPhoto(null);
                      }}
                    >
                      <MaterialIcon name="build" size="sm" className="mr-2" />
                      {lightboxPhoto.isRepair ? 'Remove Repair Tag' : 'Mark as Repair'}
                    </Button>
                  </>
                )}
                {!readonly && onPhotosChange && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(lightboxPhoto.url);
                      setLightboxPhoto(null);
                    }}
                  >
                    <MaterialIcon name="close" size="sm" className="mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export helper to convert TaggablePhoto[] back to simple string[] if needed
export function getPhotoUrls(photos: (string | TaggablePhoto)[]): string[] {
  return photos.map(p => (typeof p === 'string' ? p : p.url));
}

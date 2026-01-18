import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useItemPhotos, ItemPhoto } from '@/hooks/useItemPhotos';
import {
  Camera,
  Upload,
  Star,
  AlertTriangle,
  X,
  Loader2,
  ZoomIn,
  Filter,
} from 'lucide-react';

interface ItemPhotoGalleryProps {
  itemId: string;
  isClientUser?: boolean;
}

export function ItemPhotoGallery({ itemId, isClientUser = false }: ItemPhotoGalleryProps) {
  const {
    photos,
    primaryPhoto,
    needsAttentionPhotos,
    loading,
    addPhoto,
    setPrimaryPhoto,
    toggleNeedsAttention,
    deletePhoto,
  } = useItemPhotos(itemId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<ItemPhoto | null>(null);
  const [photoType, setPhotoType] = useState<ItemPhoto['photo_type']>('general');
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      await addPhoto(file, photoType);
    }
    setUploading(false);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev =>
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleSetPrimary = async (photoId: string) => {
    await setPrimaryPhoto(photoId);
  };

  const handleToggleAttention = async (photoId: string, current: boolean) => {
    await toggleNeedsAttention(photoId, !current);
  };

  const handleDelete = async (photoId: string) => {
    await deletePhoto(photoId);
  };

  // Filter photos by type and attention flag
  const getFilteredPhotos = (type?: ItemPhoto['photo_type']) => {
    let filtered = type ? photos.filter(p => p.photo_type === type) : photos;
    if (filterNeedsAttention) {
      filtered = filtered.filter(p => p.needs_attention);
    }
    return filtered;
  };

  const renderPhotoGrid = (photosToRender: ItemPhoto[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
      {photosToRender.map((photo) => (
        <div
          key={photo.id}
          className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-muted cursor-pointer group ${
            photo.needs_attention ? 'border-red-500' : 'border-transparent'
          } ${photo.is_primary ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setLightboxPhoto(photo)}
        >
          <img
            src={photo.storage_url || ''}
            alt={photo.file_name}
            className="w-full h-full object-cover"
          />

          {/* Overlay badges */}
          <div className="absolute top-1 left-1 flex gap-1 flex-wrap">
            {photo.is_primary && (
              <Badge className="h-5 text-[10px] sm:text-xs bg-primary px-1 sm:px-2">
                <Star className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Primary</span>
              </Badge>
            )}
            {photo.needs_attention && (
              <Badge variant="destructive" className="h-5 text-[10px] sm:text-xs px-1 sm:px-2">
                <AlertTriangle className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Attention</span>
              </Badge>
            )}
          </div>

          {/* Selection checkbox (for staff) */}
          {!isClientUser && (
            <div
              className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                togglePhotoSelection(photo.id);
              }}
            >
              <Checkbox
                checked={selectedPhotos.includes(photo.id)}
                className="bg-background"
              />
            </div>
          )}

          {/* Hover actions (for staff) - always visible on mobile */}
          {!isClientUser && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1 justify-end">
                {!photo.is_primary && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 sm:h-6 sm:w-6 text-white hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(photo.id);
                    }}
                  >
                    <Star className="h-4 w-4 sm:h-3 sm:w-3" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-7 w-7 sm:h-6 sm:w-6 ${photo.needs_attention ? 'text-red-500' : 'text-white'} hover:text-red-500`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAttention(photo.id, photo.needs_attention);
                  }}
                >
                  <AlertTriangle className="h-4 w-4 sm:h-3 sm:w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 sm:h-6 sm:w-6 text-white hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(photo.id);
                  }}
                >
                  <X className="h-4 w-4 sm:h-3 sm:w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Zoom icon - hidden on mobile for cleaner UI */}
          <div className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Photos ({photos.length})
              {needsAttentionPhotos.length > 0 && (
                <Badge variant="destructive">
                  {needsAttentionPhotos.length} need attention
                </Badge>
              )}
            </CardTitle>

            {!isClientUser && (
              <div className="flex flex-wrap gap-2">
                {/* Filter toggle */}
                <Button
                  variant={filterNeedsAttention ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterNeedsAttention(!filterNeedsAttention)}
                  className="text-xs sm:text-sm"
                >
                  <Filter className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Needs Attention</span>
                </Button>

                {/* Upload buttons */}
                <Input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs sm:text-sm"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 sm:mr-1" />
                  )}
                  <span className="hidden sm:inline">Camera</span>
                </Button>

                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs sm:text-sm"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 sm:mr-1" />
                  )}
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {photos.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {isClientUser
                  ? 'No photos available for this item.'
                  : 'No photos yet. Take a photo or upload one.'}
              </p>
            </div>
          ) : (
            <Tabs defaultValue="all" onValueChange={(v) => setPhotoType(v as ItemPhoto['photo_type'])}>
              <div className="overflow-x-auto -mx-1 px-1 pb-2">
                <TabsList className="w-full min-w-max grid grid-cols-4 mb-4">
                  <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3">
                    All ({photos.length})
                  </TabsTrigger>
                  <TabsTrigger value="general" className="text-xs sm:text-sm px-2 sm:px-3">
                    General ({photos.filter(p => p.photo_type === 'general').length})
                  </TabsTrigger>
                  <TabsTrigger value="inspection" className="text-xs sm:text-sm px-2 sm:px-3">
                    Inspect ({photos.filter(p => p.photo_type === 'inspection').length})
                  </TabsTrigger>
                  <TabsTrigger value="repair" className="text-xs sm:text-sm px-2 sm:px-3">
                    Repair ({photos.filter(p => p.photo_type === 'repair').length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all">
                {renderPhotoGrid(getFilteredPhotos())}
              </TabsContent>
              <TabsContent value="general">
                {renderPhotoGrid(getFilteredPhotos('general'))}
              </TabsContent>
              <TabsContent value="inspection">
                {renderPhotoGrid(getFilteredPhotos('inspection'))}
              </TabsContent>
              <TabsContent value="repair">
                {renderPhotoGrid(getFilteredPhotos('repair'))}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {lightboxPhoto?.file_name}
              {lightboxPhoto?.is_primary && (
                <Badge><Star className="h-3 w-3 mr-1" />Primary</Badge>
              )}
              {lightboxPhoto?.needs_attention && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />Needs Attention
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {lightboxPhoto && (
            <div className="relative">
              <img
                src={lightboxPhoto.storage_url || ''}
                alt={lightboxPhoto.file_name}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
              {!isClientUser && (
                <div className="flex gap-2 mt-4 justify-end">
                  {!lightboxPhoto.is_primary && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleSetPrimary(lightboxPhoto.id);
                        setLightboxPhoto(null);
                      }}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Set as Primary
                    </Button>
                  )}
                  <Button
                    variant={lightboxPhoto.needs_attention ? 'secondary' : 'outline'}
                    onClick={() => {
                      handleToggleAttention(lightboxPhoto.id, lightboxPhoto.needs_attention);
                      setLightboxPhoto(null);
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {lightboxPhoto.needs_attention ? 'Remove Attention Flag' : 'Mark Needs Attention'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(lightboxPhoto.id);
                      setLightboxPhoto(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

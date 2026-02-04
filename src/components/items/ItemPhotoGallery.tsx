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
import { PhotoScanner } from '@/components/common/PhotoScanner';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ItemPhotoGalleryProps {
  itemId: string;
  isClientUser?: boolean;
}

export function ItemPhotoGallery({ itemId, isClientUser = false }: ItemPhotoGalleryProps) {
  const { profile } = useAuth();
  const {
    photos,
    taskPhotos,
    allPhotos,
    primaryPhoto,
    needsAttentionPhotos,
    repairPhotos,
    loading,
    addPhoto,
    addPhotosFromUrls,
    setPrimaryPhoto,
    toggleNeedsAttention,
    toggleRepair,
    deletePhoto,
  } = useItemPhotos(itemId);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<ItemPhoto | null>(null);
  const [photoType, setPhotoType] = useState<ItemPhoto['photo_type']>('general');
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleDownload = async (photo: ItemPhoto) => {
    try {
      const response = await fetch(photo.storage_url || '');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.file_name || `photo-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download failed',
        description: 'Could not download the photo.',
        variant: 'destructive',
      });
    }
  };

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
  };

  // Handle photos from PhotoScanner - save URLs to item_photos table
  const handleScannerPhotosSaved = async (urls: string[]) => {
    // Filter to only new URLs (not already in existing photos)
    const existingUrls = photos.map(p => p.storage_url);
    const newUrls = urls.filter(url => !existingUrls.includes(url));

    if (newUrls.length === 0) {
      return;
    }

    const success = await addPhotosFromUrls(newUrls, photoType);
    if (success) {
      toast({
        title: 'Photos saved',
        description: `${newUrls.length} photo(s) added to item.`,
      });
    }
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

  const handleToggleRepair = async (photoId: string, current: boolean) => {
    await toggleRepair(photoId, !current);
  };

  const handleDelete = async (photoId: string) => {
    await deletePhoto(photoId);
  };

  // Filter photos by type and attention flag (using allPhotos which includes task photos)
  const getFilteredPhotos = (type?: ItemPhoto['photo_type']) => {
    let filtered = type ? allPhotos.filter(p => p.photo_type === type) : allPhotos;
    if (filterNeedsAttention) {
      filtered = filtered.filter(p => p.needs_attention);
    }
    return filtered;
  };

  // Helper to check if a photo is from a task (read-only)
  const isTaskPhoto = (photo: ItemPhoto) => photo.is_from_task === true;

  const renderPhotoGrid = (photosToRender: ItemPhoto[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
      {photosToRender.map((photo) => {
        // Determine border color: red for attention, green for repair, transparent otherwise
        const borderClass = photo.needs_attention
          ? 'border-red-500'
          : photo.is_repair
          ? 'border-green-500'
          : 'border-transparent';

        return (
          <div
            key={photo.id}
            className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-muted cursor-pointer group ${borderClass} ${photo.is_primary ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setLightboxPhoto(photo)}
          >
          <img
            src={photo.storage_url || ''}
            alt={photo.file_name}
            className="w-full h-full object-cover"
          />

          {/* Overlay badges - High contrast styling */}
          <div className="absolute top-1 left-1 flex gap-1 flex-wrap max-w-[calc(100%-2rem)]">
            {isTaskPhoto(photo) && (
              <Badge className="h-6 text-xs bg-blue-600 text-white px-2 shadow-md border border-blue-700">
                <MaterialIcon name="assignment" className="text-[12px] mr-1" />
                {photo.source_task_type || 'Task'}
              </Badge>
            )}
            {photo.is_primary && !isTaskPhoto(photo) && (
              <Badge className="h-6 text-xs bg-amber-500 text-white px-2 shadow-md border border-amber-600">
                <MaterialIcon name="star" className="text-[12px] mr-1" />
                Primary
              </Badge>
            )}
            {photo.needs_attention && (
              <Badge className="h-6 text-xs bg-red-600 text-white px-2 shadow-md border border-red-700">
                <MaterialIcon name="warning" className="text-[12px] mr-1" />
                attention
              </Badge>
            )}
            {photo.is_repair && (
              <Badge className="h-6 text-xs bg-green-600 text-white px-2 shadow-md border border-green-700">
                <MaterialIcon name="build" className="text-[12px] mr-1" />
                repair
              </Badge>
            )}
          </div>

          {/* Selection checkbox (for staff) - only for non-task photos */}
          {!isClientUser && !isTaskPhoto(photo) && (
            <div
              className="absolute top-1 right-1"
              onClick={(e) => {
                e.stopPropagation();
                togglePhotoSelection(photo.id);
              }}
            >
              <Checkbox
                checked={selectedPhotos.includes(photo.id)}
                className="h-5 w-5 bg-background border-2"
              />
            </div>
          )}

          {/* Hover actions - always visible on mobile */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <div className="flex gap-2 justify-end">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:text-blue-400 hover:bg-blue-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(photo);
                }}
              >
                <MaterialIcon name="download" size="md" />
              </Button>
              {/* Only show editing actions for non-task photos (task photos are read-only from item view) */}
              {!isClientUser && !isTaskPhoto(photo) && (
                <>
                  {!photo.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetPrimary(photo.id);
                      }}
                    >
                      <MaterialIcon name="star" size="md" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 ${photo.needs_attention ? 'text-red-400 bg-red-500/20' : 'text-white'} hover:text-red-400 hover:bg-red-500/20`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleAttention(photo.id, photo.needs_attention);
                    }}
                  >
                    <MaterialIcon name="warning" size="md" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 ${photo.is_repair ? 'text-green-400 bg-green-500/20' : 'text-white'} hover:text-green-400 hover:bg-green-500/20`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRepair(photo.id, photo.is_repair);
                    }}
                  >
                    <MaterialIcon name="build" size="md" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:text-destructive hover:bg-destructive/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo.id);
                    }}
                  >
                    <MaterialIcon name="close" size="md" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Zoom icon - hidden on mobile for cleaner UI */}
          <div className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <MaterialIcon name="zoom_in" className="text-[32px] text-white drop-shadow-lg" />
          </div>
        </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
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
              <MaterialIcon name="photo_camera" size="md" />
              Photos ({allPhotos.length})
              {taskPhotos.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {taskPhotos.length} from tasks
                </Badge>
              )}
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
                  <MaterialIcon name="filter_list" size="sm" className="sm:mr-1" />
                  <span className="hidden sm:inline">Needs Attention</span>
                </Button>

                {/* Camera button - opens PhotoScanner */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setScannerOpen(true)}
                  disabled={uploading}
                  className="text-xs sm:text-sm"
                >
                  <MaterialIcon name="photo_camera" size="sm" className="sm:mr-1" />
                  <span className="hidden sm:inline">Camera</span>
                </Button>

                {/* Upload button */}
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
                    <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                  ) : (
                    <MaterialIcon name="upload" size="sm" className="sm:mr-1" />
                  )}
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {allPhotos.length === 0 ? (
            <div className="text-center py-8">
              <MaterialIcon name="photo_camera" className="mx-auto text-[48px] text-muted-foreground" />
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
                    All ({allPhotos.length})
                  </TabsTrigger>
                  <TabsTrigger value="general" className="text-xs sm:text-sm px-2 sm:px-3">
                    General ({allPhotos.filter(p => p.photo_type === 'general').length})
                  </TabsTrigger>
                  <TabsTrigger value="inspection" className="text-xs sm:text-sm px-2 sm:px-3">
                    Inspect ({allPhotos.filter(p => p.photo_type === 'inspection').length})
                  </TabsTrigger>
                  <TabsTrigger value="repair" className="text-xs sm:text-sm px-2 sm:px-3">
                    Repair ({allPhotos.filter(p => p.photo_type === 'repair').length})
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
          <DialogTitle className="flex items-center gap-2 flex-wrap">
              Photo
              {lightboxPhoto && isTaskPhoto(lightboxPhoto) && (
                <Badge className="bg-blue-600 text-white">
                  <MaterialIcon name="assignment" className="text-[12px] mr-1" />
                  From {lightboxPhoto.source_task_type || 'Task'}
                </Badge>
              )}
              {lightboxPhoto?.is_primary && !lightboxPhoto?.is_from_task && (
                <Badge className="bg-amber-500 text-white"><MaterialIcon name="star" className="text-[12px] mr-1" />Primary</Badge>
              )}
              {/* Tappable attention badge - click to toggle */}
              {lightboxPhoto?.needs_attention && !isClientUser && !isTaskPhoto(lightboxPhoto) && (
                <Badge 
                  className="bg-red-600 text-white cursor-pointer hover:bg-red-700"
                  onClick={() => {
                    handleToggleAttention(lightboxPhoto.id, lightboxPhoto.needs_attention);
                    setLightboxPhoto(null);
                  }}
                >
                  <MaterialIcon name="warning" className="text-[12px] mr-1" />attention
                </Badge>
              )}
              {lightboxPhoto?.needs_attention && (isClientUser || isTaskPhoto(lightboxPhoto)) && (
                <Badge className="bg-red-600 text-white">
                  <MaterialIcon name="warning" className="text-[12px] mr-1" />attention
                </Badge>
              )}
              {/* Tappable repair badge - click to toggle */}
              {lightboxPhoto?.is_repair && !isClientUser && !isTaskPhoto(lightboxPhoto) && (
                <Badge 
                  className="bg-green-600 text-white cursor-pointer hover:bg-green-700"
                  onClick={() => {
                    handleToggleRepair(lightboxPhoto.id, lightboxPhoto.is_repair);
                    setLightboxPhoto(null);
                  }}
                >
                  <MaterialIcon name="build" className="text-[12px] mr-1" />repair
                </Badge>
              )}
              {lightboxPhoto?.is_repair && (isClientUser || isTaskPhoto(lightboxPhoto)) && (
                <Badge className="bg-green-600 text-white">
                  <MaterialIcon name="build" className="text-[12px] mr-1" />repair
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {lightboxPhoto && (
            <div className="relative">
              {/* Task info banner for task photos */}
              {isTaskPhoto(lightboxPhoto) && lightboxPhoto.source_task_title && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm flex items-center gap-2">
                  <MaterialIcon name="assignment" size="sm" className="text-blue-600" />
                  <span className="text-muted-foreground">From task:</span>
                  <a
                    href={`/tasks/${lightboxPhoto.source_task_id}`}
                    className="text-blue-600 hover:underline font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lightboxPhoto.source_task_title}
                  </a>
                </div>
              )}
              <img
                src={lightboxPhoto.storage_url || ''}
                alt={lightboxPhoto.file_name}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
              <div className="flex gap-2 mt-4 justify-end flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(lightboxPhoto)}
                >
                  <MaterialIcon name="download" size="sm" className="mr-2" />
                  Download
                </Button>
                {/* Only show editing actions for non-task photos */}
                {!isClientUser && !isTaskPhoto(lightboxPhoto) && (
                  <>
                    {!lightboxPhoto.is_primary && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleSetPrimary(lightboxPhoto.id);
                          setLightboxPhoto(null);
                        }}
                      >
                        <MaterialIcon name="star" size="sm" className="mr-2" />
                        Set as Primary
                      </Button>
                    )}
                    {/* Add flag buttons only shown when flags are NOT set */}
                    {!lightboxPhoto.needs_attention && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleToggleAttention(lightboxPhoto.id, false);
                          setLightboxPhoto(null);
                        }}
                      >
                        <MaterialIcon name="warning" size="sm" className="mr-2" />
                        attention
                      </Button>
                    )}
                    {!lightboxPhoto.is_repair && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleToggleRepair(lightboxPhoto.id, false);
                          setLightboxPhoto(null);
                        }}
                      >
                        <MaterialIcon name="build" size="sm" className="mr-2" />
                        repair
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleDelete(lightboxPhoto.id);
                        setLightboxPhoto(null);
                      }}
                    >
                      <MaterialIcon name="close" size="sm" className="mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PhotoScanner Dialog */}
      <PhotoScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        entityType="item"
        entityId={itemId}
        tenantId={profile?.tenant_id}
        existingPhotos={photos.map(p => p.storage_url || '')}
        maxPhotos={50}
        onPhotosSaved={handleScannerPhotosSaved}
      />
    </>
  );
}

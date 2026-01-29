import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queueItemDamagedAlert } from '@/lib/alertQueue';

export interface ItemPhoto {
  id: string;
  item_id: string;
  tenant_id: string;
  storage_key: string;
  storage_url: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  is_primary: boolean;
  needs_attention: boolean;
  photo_type: 'general' | 'inspection' | 'repair' | 'receiving';
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useItemPhotos(itemId: string | undefined) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = useCallback(async () => {
    if (!itemId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('item_photos') as any)
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error fetching item photos:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const addPhoto = async (
    file: File,
    photoType: ItemPhoto['photo_type'] = 'general'
  ): Promise<ItemPhoto | null> => {
    if (!profile?.tenant_id || !itemId) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const storageKey = `items/${itemId}/${photoType}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(storageKey, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(storageKey);

      const { data, error } = await (supabase
        .from('item_photos') as any)
        .insert({
          item_id: itemId,
          tenant_id: profile.tenant_id,
          storage_key: storageKey,
          storage_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          photo_type: photoType,
          is_primary: false,
          needs_attention: false,
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      fetchPhotos();
      return data;
    } catch (error) {
      console.error('Error adding photo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to upload photo',
      });
      return null;
    }
  };

  const setPrimaryPhoto = async (photoId: string) => {
    if (!itemId) return false;

    try {
      // Remove primary from all photos for this item
      await (supabase
        .from('item_photos') as any)
        .update({ is_primary: false })
        .eq('item_id', itemId);

      // Set new primary
      const { error } = await (supabase
        .from('item_photos') as any)
        .update({ is_primary: true })
        .eq('id', photoId);

      if (error) throw error;

      // Update item's primary_photo_url
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        await (supabase
          .from('items') as any)
          .update({ primary_photo_url: photo.storage_url })
          .eq('id', itemId);
      }

      toast({
        title: 'Primary Photo Set',
        description: 'This photo is now the primary photo for this item.',
      });

      fetchPhotos();
      return true;
    } catch (error) {
      console.error('Error setting primary photo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to set primary photo',
      });
      return false;
    }
  };

  const toggleNeedsAttention = async (photoId: string, needsAttention: boolean) => {
    if (!profile?.tenant_id || !itemId) return false;

    try {
      const { error } = await (supabase
        .from('item_photos') as any)
        .update({ needs_attention: needsAttention })
        .eq('id', photoId);

      if (error) throw error;

      // If marking as needs attention, update item's has_damage flag and create alert
      if (needsAttention) {
        // Get item code for the alert
        const { data: itemData } = await (supabase
          .from('items') as any)
          .select('item_code')
          .eq('id', itemId)
          .single();

        await (supabase
          .from('items') as any)
          .update({ has_damage: true })
          .eq('id', itemId);

        // Queue damage alert using the centralized alert queue
        await queueItemDamagedAlert(
          profile.tenant_id,
          itemId,
          itemData?.item_code || 'Unknown'
        );

        toast({
          title: 'Photo Flagged',
          description: 'Photo has been flagged as needing attention. Alert sent to managers.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Flag Removed',
          description: 'Needs attention flag has been removed.',
        });
      }

      fetchPhotos();
      return true;
    } catch (error) {
      console.error('Error toggling needs attention:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update photo flag',
      });
      return false;
    }
  };

  const deletePhoto = async (photoId: string) => {
    try {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        // Delete from storage
        await supabase.storage.from('photos').remove([photo.storage_key]);
      }

      // Delete from database
      const { error } = await (supabase
        .from('item_photos') as any)
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      toast({
        title: 'Photo Deleted',
        description: 'Photo has been removed.',
      });

      fetchPhotos();
      return true;
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete photo',
      });
      return false;
    }
  };

  // Add photo from an already-uploaded URL (used by PhotoScanner)
  const addPhotoFromUrl = async (
    storageUrl: string,
    photoType: ItemPhoto['photo_type'] = 'general'
  ): Promise<ItemPhoto | null> => {
    if (!profile?.tenant_id || !itemId) return null;

    try {
      // Extract storage key from URL
      const urlParts = storageUrl.split('/photos/');
      const storageKey = urlParts[1] || `items/${itemId}/${Date.now()}.jpg`;

      const { data, error } = await (supabase
        .from('item_photos') as any)
        .insert({
          item_id: itemId,
          tenant_id: profile.tenant_id,
          storage_key: storageKey,
          storage_url: storageUrl,
          file_name: storageKey.split('/').pop() || 'photo.jpg',
          file_size: null,
          mime_type: 'image/jpeg',
          photo_type: photoType,
          is_primary: false,
          needs_attention: false,
          uploaded_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding photo from URL:', error);
      return null;
    }
  };

  // Add multiple photos from URLs (batch operation for PhotoScanner)
  const addPhotosFromUrls = async (
    urls: string[],
    photoType: ItemPhoto['photo_type'] = 'general'
  ): Promise<boolean> => {
    if (!profile?.tenant_id || !itemId || urls.length === 0) return false;

    try {
      const records = urls.map(url => {
        const urlParts = url.split('/photos/');
        const storageKey = urlParts[1] || `items/${itemId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        return {
          item_id: itemId,
          tenant_id: profile.tenant_id,
          storage_key: storageKey,
          storage_url: url,
          file_name: storageKey.split('/').pop() || 'photo.jpg',
          file_size: null,
          mime_type: 'image/jpeg',
          photo_type: photoType,
          is_primary: false,
          needs_attention: false,
          uploaded_by: profile.id,
        };
      });

      const { error } = await (supabase
        .from('item_photos') as any)
        .insert(records);

      if (error) throw error;

      fetchPhotos();
      return true;
    } catch (error) {
      console.error('Error adding photos from URLs:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save photos',
      });
      return false;
    }
  };

  const primaryPhoto = photos.find(p => p.is_primary) || photos[0] || null;
  const needsAttentionPhotos = photos.filter(p => p.needs_attention);

  return {
    photos,
    primaryPhoto,
    needsAttentionPhotos,
    loading,
    refetch: fetchPhotos,
    addPhoto,
    addPhotoFromUrl,
    addPhotosFromUrls,
    setPrimaryPhoto,
    toggleNeedsAttention,
    deletePhoto,
  };
}

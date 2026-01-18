import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ItemNote {
  id: string;
  item_id: string;
  note: string;
  note_type: 'internal' | 'public';
  visibility: string | null;
  parent_note_id: string | null;
  version: number;
  is_current: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  replies?: ItemNote[];
}

export function useItemNotes(itemId: string | undefined) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<ItemNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!itemId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('item_notes') as any)
        .select(`
          *,
          author:created_by(id, first_name, last_name)
        `)
        .eq('item_id', itemId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Organize notes into threads (parent notes with replies)
      const parentNotes = (data || []).filter((n: ItemNote) => !n.parent_note_id);
      const replies = (data || []).filter((n: ItemNote) => n.parent_note_id);

      const threaded = parentNotes.map((parent: ItemNote) => ({
        ...parent,
        replies: replies.filter((r: ItemNote) => r.parent_note_id === parent.id),
      }));

      setNotes(threaded);
    } catch (error) {
      console.error('Error fetching item notes:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (
    note: string,
    noteType: 'internal' | 'public',
    parentNoteId?: string
  ) => {
    if (!profile?.tenant_id || !itemId) return null;

    try {
      const { data, error } = await (supabase
        .from('item_notes') as any)
        .insert({
          item_id: itemId,
          tenant_id: profile.tenant_id,
          note,
          note_type: noteType,
          visibility: noteType === 'public' ? 'client' : 'internal',
          parent_note_id: parentNoteId || null,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Note Added',
        description: `${noteType === 'public' ? 'Public' : 'Internal'} note has been added.`,
      });

      fetchNotes();
      return data;
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add note',
      });
      return null;
    }
  };

  const updateNote = async (noteId: string, newContent: string) => {
    if (!profile?.id) return false;

    try {
      // For public notes, create a new version instead of updating
      const existingNote = notes.find(n => n.id === noteId);
      
      if (existingNote?.note_type === 'public') {
        // Mark current as not current
        await (supabase
          .from('item_notes') as any)
          .update({ is_current: false })
          .eq('id', noteId);

        // Create new version
        await (supabase
          .from('item_notes') as any)
          .insert({
            item_id: existingNote.item_id,
            tenant_id: profile.tenant_id,
            note: newContent,
            note_type: 'public',
            visibility: 'client',
            parent_note_id: existingNote.parent_note_id,
            version: (existingNote.version || 1) + 1,
            is_current: true,
            created_by: profile.id,
          });
      } else {
        // For internal notes, just update
        const { error } = await (supabase
          .from('item_notes') as any)
          .update({ note: newContent })
          .eq('id', noteId);

        if (error) throw error;
      }

      toast({
        title: 'Note Updated',
        description: 'Note has been updated.',
      });

      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update note',
      });
      return false;
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await (supabase
        .from('item_notes') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', noteId);

      if (error) throw error;

      toast({
        title: 'Note Deleted',
        description: 'Note has been removed.',
      });

      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete note',
      });
      return false;
    }
  };

  return {
    notes,
    loading,
    refetch: fetchNotes,
    addNote,
    updateNote,
    deleteNote,
  };
}

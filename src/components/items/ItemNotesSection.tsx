import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useItemNotes, ItemNote } from '@/hooks/useItemNotes';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface ItemNotesSectionProps {
  itemId: string;
  isClientUser?: boolean;
}

export function ItemNotesSection({ itemId, isClientUser = false }: ItemNotesSectionProps) {
  const { notes, loading, addNote } = useItemNotes(itemId);
  const { profile } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'internal' | 'public'>('internal');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newNote.trim()) return;

    setSubmitting(true);
    await addNote(newNote, noteType);
    setNewNote('');
    setSubmitting(false);
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim()) return;

    setSubmitting(true);
    // Replies inherit the note type from parent
    const parentNote = notes.find(n => n.id === parentId);
    await addNote(replyText, parentNote?.note_type || 'internal', parentId);
    setReplyText('');
    setReplyingTo(null);
    setSubmitting(false);
  };

  // Filter notes based on user type
  const visibleNotes = isClientUser
    ? notes.filter(n => n.note_type === 'public')
    : notes;

  const internalNotes = notes.filter(n => n.note_type === 'internal');
  const publicNotes = notes.filter(n => n.note_type === 'public');

  const renderNote = (note: ItemNote, isReply = false) => {
    const authorName = note.author
      ? `${note.author.first_name || ''} ${note.author.last_name || ''}`.trim() || 'Unknown'
      : 'System';
    const initials = authorName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        key={note.id}
        className={`flex gap-3 ${isReply ? 'ml-8 mt-2' : 'border-b pb-4 last:border-b-0'}`}
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{authorName}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
            </span>
            {note.note_type === 'public' ? (
              <Badge variant="outline" className="text-xs">
                <MaterialIcon name="public" className="text-[12px] mr-1" />
                Public
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <MaterialIcon name="lock" className="text-[12px] mr-1" />
                Internal
              </Badge>
            )}
            {note.version && note.version > 1 && (
              <Badge variant="outline" className="text-xs">
                <MaterialIcon name="history" className="text-[12px] mr-1" />
                v{note.version}
              </Badge>
            )}
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{note.note}</p>
          
          {!isReply && !isClientUser && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-6 px-2 text-xs"
              onClick={() => setReplyingTo(replyingTo === note.id ? null : note.id)}
            >
              <MaterialIcon name="reply" className="text-[12px] mr-1" />
              Reply
            </Button>
          )}

          {/* Reply input */}
          {replyingTo === note.id && (
            <div className="flex gap-2 mt-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="min-h-[60px] text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleReply(note.id)}
                disabled={submitting || !replyText.trim()}
              >
                {submitting ? (
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                ) : (
                  <MaterialIcon name="send" size="sm" />
                )}
              </Button>
            </div>
          )}

          {/* Render replies */}
          {note.replies?.map(reply => renderNote(reply, true))}
        </div>
      </div>
    );
  };

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MaterialIcon name="chat" size="md" />
          {isClientUser ? 'Notes' : noteType === 'internal' ? 'Internal Note' : 'Public Note'} ({visibleNotes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New note input */}
        {!isClientUser && (
          <div className="space-y-3">
            {/* Note Type Toggle - More prominent */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">Note Type:</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={noteType === 'internal' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 ${noteType === 'internal' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                  onClick={() => setNoteType('internal')}
                >
                  <MaterialIcon name="lock" className="text-[14px] mr-2" />
                  Internal
                </Button>
                <Button
                  type="button"
                  variant={noteType === 'public' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 ${noteType === 'public' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                  onClick={() => setNoteType('public')}
                >
                  <MaterialIcon name="public" className="text-[14px] mr-2" />
                  Public
                </Button>
              </div>
              {/* Description text based on note type */}
              <p className={`text-xs ${noteType === 'internal' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {noteType === 'internal'
                  ? 'Internal Note is only viewable by company'
                  : 'Public notes for client viewing'}
              </p>
            </div>

            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={noteType === 'internal' ? 'Add an internal note...' : 'Add a public note for client...'}
              className={`min-h-[80px] ${noteType === 'internal' ? 'border-amber-300 focus:border-amber-500' : 'border-blue-300 focus:border-blue-500'}`}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !newNote.trim()}
                className={noteType === 'internal' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}
              >
                {submitting ? (
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                ) : (
                  <MaterialIcon name="send" size="sm" className="mr-2" />
                )}
                Add {noteType === 'internal' ? 'Internal' : 'Public'} Note
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {isClientUser ? (
          <div className="space-y-4">
            {publicNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notes available.
              </p>
            ) : (
              publicNotes.map(note => renderNote(note))
            )}
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="all">All ({notes.length})</TabsTrigger>
              <TabsTrigger value="internal">Internal ({internalNotes.length})</TabsTrigger>
              <TabsTrigger value="public">Public ({publicNotes.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4 space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notes yet. Add the first one above.
                </p>
              ) : (
                notes.map(note => renderNote(note))
              )}
            </TabsContent>
            <TabsContent value="internal" className="mt-4 space-y-4">
              {internalNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No internal notes.
                </p>
              ) : (
                internalNotes.map(note => renderNote(note))
              )}
            </TabsContent>
            <TabsContent value="public" className="mt-4 space-y-4">
              {publicNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No public notes.
                </p>
              ) : (
                publicNotes.map(note => renderNote(note))
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useItemNotes, ItemNote } from '@/hooks/useItemNotes';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import {
  MessageSquare,
  Send,
  Lock,
  Globe,
  Reply,
  Loader2,
  History,
} from 'lucide-react';

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
                <Globe className="h-3 w-3 mr-1" />
                Public
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Internal
              </Badge>
            )}
            {note.version && note.version > 1 && (
              <Badge variant="outline" className="text-xs">
                <History className="h-3 w-3 mr-1" />
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
              <Reply className="h-3 w-3 mr-1" />
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Notes ({visibleNotes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New note input */}
        {!isClientUser && (
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="min-h-[80px]"
            />
            <div className="flex items-center justify-between">
              <Tabs value={noteType} onValueChange={(v) => setNoteType(v as 'internal' | 'public')}>
                <TabsList className="h-8">
                  <TabsTrigger value="internal" className="text-xs h-6">
                    <Lock className="h-3 w-3 mr-1" />
                    Internal
                  </TabsTrigger>
                  <TabsTrigger value="public" className="text-xs h-6">
                    <Globe className="h-3 w-3 mr-1" />
                    Public
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !newNote.trim()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Add Note
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

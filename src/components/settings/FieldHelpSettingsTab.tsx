import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import {
  type FieldHelpEntry,
  useFieldHelpEntries,
  useFieldHelpPageKeys,
  useUpsertFieldHelpEntry,
  useUpdateFieldHelpEntry,
} from '@/hooks/useFieldHelpContent';

type EditorState = {
  open: boolean;
  mode: 'create' | 'edit';
  entryId: string | null;
  pageKey: string;
  fieldKey: string;
  helpText: string;
  isActive: boolean;
};

const DEFAULT_EDITOR: EditorState = {
  open: false,
  mode: 'create',
  entryId: null,
  pageKey: '',
  fieldKey: '',
  helpText: '',
  isActive: true,
};

export function FieldHelpSettingsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [pageFilter, setPageFilter] = useState('all');
  const [editor, setEditor] = useState<EditorState>(DEFAULT_EDITOR);

  const { data: entries = [], isLoading } = useFieldHelpEntries({ includeInactive: true });
  const upsertEntry = useUpsertFieldHelpEntry();
  const updateEntry = useUpdateFieldHelpEntry();
  const pageKeys = useFieldHelpPageKeys(entries);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (pageFilter !== 'all' && entry.page_key !== pageFilter) return false;
      if (!q) return true;
      return (
        entry.page_key.toLowerCase().includes(q) ||
        entry.field_key.toLowerCase().includes(q) ||
        entry.help_text.toLowerCase().includes(q)
      );
    });
  }, [entries, pageFilter, search]);

  const openCreateDialog = () => {
    setEditor(DEFAULT_EDITOR);
    setEditor((prev) => ({ ...prev, open: true, mode: 'create' }));
  };

  const openEditDialog = (entry: FieldHelpEntry) => {
    setEditor({
      open: true,
      mode: 'edit',
      entryId: entry.id,
      pageKey: entry.page_key,
      fieldKey: entry.field_key,
      helpText: entry.help_text,
      isActive: entry.is_active,
    });
  };

  const closeEditor = () => setEditor(DEFAULT_EDITOR);

  const saveEditor = async () => {
    if (!editor.pageKey.trim() || !editor.fieldKey.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing keys',
        description: 'Page key and field key are required.',
      });
      return;
    }

    if (!editor.helpText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing content',
        description: 'Help text is required.',
      });
      return;
    }

    try {
      if (editor.mode === 'create') {
        await upsertEntry.mutateAsync({
          page_key: editor.pageKey,
          field_key: editor.fieldKey,
          help_text: editor.helpText,
          is_active: editor.isActive,
        });
      } else if (editor.entryId) {
        await updateEntry.mutateAsync({
          id: editor.entryId,
          patch: {
            help_text: editor.helpText,
            is_active: editor.isActive,
          },
        });
      }

      toast({ title: 'Saved', description: 'Field help content updated.' });
      closeEditor();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save help content.',
      });
    }
  };

  const toggleActive = async (entry: FieldHelpEntry, nextActive: boolean) => {
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        patch: { is_active: nextActive },
      });
      toast({
        title: nextActive ? 'Entry enabled' : 'Entry disabled',
        description: `${entry.page_key}.${entry.field_key} updated.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Could not update status.',
      });
    }
  };

  const savePending = upsertEntry.isPending || updateEntry.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="help" size="md" />
            Field Help Content
          </CardTitle>
          <CardDescription>
            Centralized contextual help text by <code>page_key</code> and <code>field_key</code>.
            Entries override inline HelpTip copy where keys are wired in the UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <MaterialIcon
                name="search"
                size="sm"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search page key, field key, or help text..."
                className="pl-8"
              />
            </div>
            <Select value={pageFilter} onValueChange={setPageFilter}>
              <SelectTrigger className="w-full lg:w-[260px]">
                <SelectValue placeholder="Filter by page key" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pages</SelectItem>
                {pageKeys.map((pageKey) => (
                  <SelectItem key={pageKey} value={pageKey}>
                    {pageKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog}>
              <MaterialIcon name="add" size="sm" className="mr-1" />
              Add Entry
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading help content…</div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No matching entries.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-52">Page Key</TableHead>
                    <TableHead className="w-44">Field Key</TableHead>
                    <TableHead>Help Text</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-36 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">{entry.page_key}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.field_key}</TableCell>
                      <TableCell className="text-sm">{entry.help_text}</TableCell>
                      <TableCell>
                        <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                          {entry.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Edit"
                            onClick={() => openEditDialog(entry)}
                          >
                            <MaterialIcon name="edit" size="sm" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title={entry.is_active ? 'Disable' : 'Enable'}
                            onClick={() => toggleActive(entry, !entry.is_active)}
                          >
                            <MaterialIcon
                              name={entry.is_active ? 'visibility_off' : 'visibility'}
                              size="sm"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editor.open}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editor.mode === 'create' ? 'Add Help Entry' : 'Edit Help Entry'}</DialogTitle>
            <DialogDescription>
              Configure contextual help text for a page field.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Page Key</Label>
                <Input
                  value={editor.pageKey}
                  onChange={(e) => setEditor((prev) => ({ ...prev, pageKey: e.target.value }))}
                  placeholder="receiving.stage1"
                  disabled={editor.mode === 'edit'}
                />
              </div>
              <div className="space-y-2">
                <Label>Field Key</Label>
                <Input
                  value={editor.fieldKey}
                  onChange={(e) => setEditor((prev) => ({ ...prev, fieldKey: e.target.value }))}
                  placeholder="signed_pieces"
                  disabled={editor.mode === 'edit'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Help Text</Label>
              <Textarea
                value={editor.helpText}
                onChange={(e) => setEditor((prev) => ({ ...prev, helpText: e.target.value }))}
                placeholder="Write contextual guidance shown in HelpTip..."
                rows={6}
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={editor.isActive}
                onCheckedChange={(checked) =>
                  setEditor((prev) => ({ ...prev, isActive: !!checked }))
                }
              />
              Active
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={savePending}>
              Cancel
            </Button>
            <Button onClick={saveEditor} disabled={savePending}>
              {savePending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

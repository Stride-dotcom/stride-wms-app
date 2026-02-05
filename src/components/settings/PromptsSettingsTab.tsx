import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { usePromptAdmin } from '@/hooks/usePromptAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PromptLevel, PromptWorkflow } from '@/types/guidedPrompts';
import { Skeleton } from '@/components/ui/skeleton';

const LEVEL_LABELS: Record<PromptLevel, string> = {
  training: 'Training (All Prompts)',
  standard: 'Standard (Critical Only)',
  advanced: 'Advanced (Help Only)',
};

const WORKFLOW_LABELS: Record<PromptWorkflow, string> = {
  receiving: 'Receiving',
  inspection: 'Inspection',
  assembly: 'Assembly',
  repair: 'Repair',
  movement: 'Movement',
  stocktake: 'Stocktake',
  scan_hub: 'Scan Hub',
  outbound: 'Outbound',
  claims: 'Claims',
  will_call: 'Will Call',
};

export function PromptsSettingsTab() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const {
    isLoading,
    allUserSettings,
    tenantDefaults,
    pendingSuggestions,
    allPrompts,
    updateUserSettings,
    updateTenantDefaults,
    approveSuggestion,
    dismissSuggestion,
    togglePromptActive,
    refetch,
  } = usePromptAdmin();

  const [activeSubTab, setActiveSubTab] = useState('users');

  // Fix 1.1 - Optimistic local state for user settings
  const [localUserSettings, setLocalUserSettings] = useState(allUserSettings);
  useEffect(() => {
    setLocalUserSettings(allUserSettings);
  }, [allUserSettings]);

  // Fix 1.2 - Local state for organization defaults
  const [localDefaults, setLocalDefaults] = useState(tenantDefaults);
  useEffect(() => {
    setLocalDefaults(tenantDefaults);
  }, [tenantDefaults]);

  // Fix 1.3 - Prompt edit dialog state
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openEditDialog = (prompt: any) => {
    setEditingPrompt(prompt);
    setEditForm({
      id: prompt.id,
      title: prompt.title || '',
      message: prompt.message || '',
      tip_text: prompt.tip_text || '',
      checklist_items: Array.isArray(prompt.checklist_items)
        ? prompt.checklist_items.map((item: any) => ({ ...item }))
        : [],
      prompt_type: prompt.prompt_type || 'modal',
      trigger_point: prompt.trigger_point || 'before',
      min_level: prompt.min_level || 'training',
      is_active: prompt.is_active ?? true,
    });
  };

  const closeEditDialog = () => {
    setEditingPrompt(null);
    setEditForm({});
  };

  const handleSavePrompt = async () => {
    if (!editForm.id) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase.from('guided_prompts') as any).update({
        title: editForm.title,
        message: editForm.message,
        tip_text: editForm.tip_text,
        checklist_items: editForm.checklist_items,
        prompt_type: editForm.prompt_type,
        trigger_point: editForm.trigger_point,
        min_level: editForm.min_level,
        is_active: editForm.is_active,
        updated_at: new Date().toISOString(),
      }).eq('id', editForm.id);

      if (error) throw error;

      toast({
        title: 'Prompt Updated',
        description: 'The prompt has been saved successfully.',
      });
      closeEditDialog();
      await refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save prompt changes.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePrompt = async () => {
    if (!editForm.id) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase.from('guided_prompts') as any)
        .delete()
        .eq('id', editForm.id);

      if (error) throw error;

      toast({
        title: 'Prompt Deleted',
        description: 'The prompt has been permanently deleted.',
      });
      setShowDeleteConfirm(false);
      closeEditDialog();
      await refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete prompt.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addChecklistItem = () => {
    setEditForm((prev: any) => ({
      ...prev,
      checklist_items: [
        ...(prev.checklist_items || []),
        { label: '', required: false },
      ],
    }));
  };

  const updateChecklistItem = (index: number, field: string, value: any) => {
    setEditForm((prev: any) => {
      const items = [...(prev.checklist_items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, checklist_items: items };
    });
  };

  const removeChecklistItem = (index: number) => {
    setEditForm((prev: any) => {
      const items = [...(prev.checklist_items || [])];
      items.splice(index, 1);
      return { ...prev, checklist_items: items };
    });
  };

  // Fix 1.2 - Save defaults on blur for text/number inputs
  const handleDefaultsBlur = (field: string, value: any) => {
    updateTenantDefaults({ [field]: value });
    toast({ title: 'Setting saved', duration: 2000 });
  };

  const handleDefaultsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User Settings</TabsTrigger>
          <TabsTrigger value="organization">Organization Defaults</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Management</TabsTrigger>
        </TabsList>

        {/* User Settings Tab */}
        <TabsContent value="users" className="space-y-4">
          {/* Pending Upgrade Suggestions */}
          {pendingSuggestions.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MaterialIcon name="trending_up" className="text-blue-600" />
                  Pending Upgrade Suggestions
                </CardTitle>
                <CardDescription>
                  Review employees who may be ready for reduced prompts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingSuggestions.map(suggestion => (
                    <div
                      key={suggestion.id}
                      className="flex items-center justify-between bg-white rounded-lg p-3 border"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {suggestion.users?.first_name} {suggestion.users?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {LEVEL_LABELS[suggestion.current_level]} → {LEVEL_LABELS[suggestion.suggested_level]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {suggestion.reason}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dismissSuggestion(suggestion.id)}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveSuggestion(suggestion.id)}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Settings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee Prompt Levels</CardTitle>
              <CardDescription>
                Manage prompt settings for individual employees.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Prompt Level</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localUserSettings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No user settings found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    localUserSettings.map(setting => (
                      <TableRow key={setting.id}>
                        <TableCell className="font-medium">
                          {setting.users?.first_name} {setting.users?.last_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {setting.users?.email}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={setting.prompt_level}
                            onValueChange={(value: PromptLevel) => {
                              // Optimistic update: update local state immediately
                              setLocalUserSettings(prev =>
                                prev.map(s =>
                                  s.id === setting.id
                                    ? { ...s, prompt_level: value }
                                    : s
                                )
                              );
                              // Then persist to server
                              updateUserSettings(setting.user_id, { prompt_level: value });
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="training">Training</SelectItem>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="advanced">Advanced</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              setting.prompt_level === 'training' ? 'default' :
                              setting.prompt_level === 'standard' ? 'secondary' : 'outline'
                            }
                          >
                            {setting.prompt_level}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Defaults Tab */}
        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default Settings</CardTitle>
              <CardDescription>
                Configure default prompt settings for new employees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Prompt Level</Label>
                  <Select
                    value={localDefaults?.default_prompt_level || 'training'}
                    onValueChange={(value: PromptLevel) => {
                      setLocalDefaults(prev => prev ? { ...prev, default_prompt_level: value } : prev);
                      updateTenantDefaults({ default_prompt_level: value });
                      toast({ title: 'Setting saved', duration: 2000 });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    New employees will start at this level.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Reminder Interval (Days)</Label>
                  <Input
                    type="number"
                    value={localDefaults?.default_reminder_days || 30}
                    onChange={(e) =>
                      setLocalDefaults(prev =>
                        prev ? { ...prev, default_reminder_days: parseInt(e.target.value) || 30 } : prev
                      )
                    }
                    onBlur={(e) =>
                      handleDefaultsBlur('default_reminder_days', parseInt(e.target.value) || 30)
                    }
                    onKeyDown={handleDefaultsKeyDown}
                    min={1}
                    max={365}
                  />
                  <p className="text-xs text-muted-foreground">
                    Days before sending a reminder to review prompt levels.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Competency Thresholds</CardTitle>
              <CardDescription>
                Configure when employees qualify for prompt level upgrades.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tasks Required</Label>
                  <Input
                    type="number"
                    value={localDefaults?.competency_tasks_required || 10}
                    onChange={(e) =>
                      setLocalDefaults(prev =>
                        prev ? { ...prev, competency_tasks_required: parseInt(e.target.value) || 10 } : prev
                      )
                    }
                    onBlur={(e) =>
                      handleDefaultsBlur('competency_tasks_required', parseInt(e.target.value) || 10)
                    }
                    onKeyDown={handleDefaultsKeyDown}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tasks completed before qualifying for upgrade.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Errors Allowed</Label>
                  <Input
                    type="number"
                    value={localDefaults?.competency_max_errors || 0}
                    onChange={(e) =>
                      setLocalDefaults(prev =>
                        prev ? { ...prev, competency_max_errors: parseInt(e.target.value) || 0 } : prev
                      )
                    }
                    onBlur={(e) =>
                      handleDefaultsBlur('competency_max_errors', parseInt(e.target.value) || 0)
                    }
                    onKeyDown={handleDefaultsKeyDown}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum errors allowed while still qualifying.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Missing Photos</Label>
                  <Input
                    type="number"
                    value={localDefaults?.competency_max_missing_photos || 0}
                    onChange={(e) =>
                      setLocalDefaults(prev =>
                        prev ? { ...prev, competency_max_missing_photos: parseInt(e.target.value) || 0 } : prev
                      )
                    }
                    onBlur={(e) =>
                      handleDefaultsBlur('competency_max_missing_photos', parseInt(e.target.value) || 0)
                    }
                    onKeyDown={handleDefaultsKeyDown}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum missing photos allowed.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Location Errors</Label>
                  <Input
                    type="number"
                    value={localDefaults?.competency_max_location_errors || 0}
                    onChange={(e) =>
                      setLocalDefaults(prev =>
                        prev ? { ...prev, competency_max_location_errors: parseInt(e.target.value) || 0 } : prev
                      )
                    }
                    onBlur={(e) =>
                      handleDefaultsBlur('competency_max_location_errors', parseInt(e.target.value) || 0)
                    }
                    onKeyDown={handleDefaultsKeyDown}
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum location errors allowed.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label className="text-base">Auto-Suggestions</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically suggest upgrades when employees qualify.
                  </p>
                </div>
                <Switch
                  checked={localDefaults?.auto_suggestion_enabled ?? true}
                  onCheckedChange={(checked) => {
                    setLocalDefaults(prev => prev ? { ...prev, auto_suggestion_enabled: checked } : prev);
                    updateTenantDefaults({ auto_suggestion_enabled: checked });
                    toast({ title: 'Setting saved', duration: 2000 });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompt Management Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt Library</CardTitle>
              <CardDescription>
                Enable or disable individual prompts across workflows. Click a prompt to edit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {(Object.keys(WORKFLOW_LABELS) as PromptWorkflow[]).map(workflow => {
                  const workflowPrompts = allPrompts.filter(p => p.workflow === workflow);
                  if (workflowPrompts.length === 0) return null;

                  return (
                    <div key={workflow} className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <MaterialIcon name="folder" size="sm" className="text-muted-foreground" />
                        {WORKFLOW_LABELS[workflow]}
                        <Badge variant="outline" className="ml-2">
                          {workflowPrompts.filter(p => p.is_active).length}/{workflowPrompts.length}
                        </Badge>
                      </h4>
                      <div className="grid gap-2">
                        {workflowPrompts
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(prompt => (
                            <div
                              key={prompt.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => openEditDialog(prompt)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{prompt.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {prompt.trigger_point}
                                  </Badge>
                                  <Badge
                                    variant={
                                      prompt.min_level === 'training' ? 'default' :
                                      prompt.min_level === 'standard' ? 'secondary' : 'outline'
                                    }
                                    className="text-xs"
                                  >
                                    {prompt.min_level}+
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {prompt.message.substring(0, 80)}
                                  {prompt.message.length > 80 ? '...' : ''}
                                </p>
                              </div>
                              <Switch
                                checked={prompt.is_active}
                                onCheckedChange={(checked) => togglePromptActive(prompt.id, checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Prompt Edit Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
            <DialogDescription>
              Modify the prompt settings, message content, and checklist items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editForm.title || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, title: e.target.value }))}
                placeholder="Prompt title"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={editForm.message || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, message: e.target.value }))}
                placeholder="Prompt message shown to the user"
                rows={3}
              />
            </div>

            {/* Tip Text */}
            <div className="space-y-2">
              <Label>Tip Text (optional)</Label>
              <Textarea
                value={editForm.tip_text || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, tip_text: e.target.value }))}
                placeholder="Optional tip or hint text"
                rows={2}
              />
            </div>

            {/* Checklist Items */}
            <div className="space-y-2">
              <Label>Checklist Items</Label>
              <div className="space-y-2">
                {(editForm.checklist_items || []).map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item.label || ''}
                      onChange={(e) => updateChecklistItem(index, 'label', e.target.value)}
                      placeholder="Checklist item label"
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Checkbox
                        checked={item.required || false}
                        onCheckedChange={(checked) => updateChecklistItem(index, 'required', !!checked)}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Required</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChecklistItem(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <MaterialIcon name="close" size="sm" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChecklistItem}
                  className="mt-1"
                >
                  <MaterialIcon name="add" size="sm" className="mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Row of selects */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Prompt Type */}
              <div className="space-y-2">
                <Label>Prompt Type</Label>
                <Select
                  value={editForm.prompt_type || 'modal'}
                  onValueChange={(value) => setEditForm((prev: any) => ({ ...prev, prompt_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modal">Modal</SelectItem>
                    <SelectItem value="slide_panel">Slide Panel</SelectItem>
                    <SelectItem value="tooltip">Tooltip</SelectItem>
                    <SelectItem value="toast">Toast</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Trigger Point */}
              <div className="space-y-2">
                <Label>Trigger Point</Label>
                <Select
                  value={editForm.trigger_point || 'before'}
                  onValueChange={(value) => setEditForm((prev: any) => ({ ...prev, trigger_point: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before</SelectItem>
                    <SelectItem value="during">During</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Level */}
              <div className="space-y-2">
                <Label>Minimum Level</Label>
                <Select
                  value={editForm.min_level || 'training'}
                  onValueChange={(value) => setEditForm((prev: any) => ({ ...prev, min_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Whether this prompt is currently shown to users.
                </p>
              </div>
              <Switch
                checked={editForm.is_active ?? true}
                onCheckedChange={(checked) => setEditForm((prev: any) => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
            >
              Delete Prompt
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditDialog}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSavePrompt}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this prompt? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePrompt}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

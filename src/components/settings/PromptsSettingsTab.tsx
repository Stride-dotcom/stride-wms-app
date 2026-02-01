import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { usePromptAdmin } from '@/hooks/usePromptAdmin';
import { useAuth } from '@/contexts/AuthContext';
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
  } = usePromptAdmin();

  const [activeSubTab, setActiveSubTab] = useState('users');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
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
                {allUserSettings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No user settings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  allUserSettings.map(setting => (
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
                          onValueChange={(value: PromptLevel) =>
                            updateUserSettings(setting.user_id, { prompt_level: value })
                          }
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
                  value={tenantDefaults?.default_prompt_level || 'training'}
                  onValueChange={(value: PromptLevel) =>
                    updateTenantDefaults({ default_prompt_level: value })
                  }
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
                  value={tenantDefaults?.default_reminder_days || 30}
                  onChange={(e) =>
                    updateTenantDefaults({ default_reminder_days: parseInt(e.target.value) || 30 })
                  }
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
                  value={tenantDefaults?.competency_tasks_required || 10}
                  onChange={(e) =>
                    updateTenantDefaults({ competency_tasks_required: parseInt(e.target.value) || 10 })
                  }
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
                  value={tenantDefaults?.competency_max_errors || 0}
                  onChange={(e) =>
                    updateTenantDefaults({ competency_max_errors: parseInt(e.target.value) || 0 })
                  }
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
                  value={tenantDefaults?.competency_max_missing_photos || 0}
                  onChange={(e) =>
                    updateTenantDefaults({ competency_max_missing_photos: parseInt(e.target.value) || 0 })
                  }
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
                  value={tenantDefaults?.competency_max_location_errors || 0}
                  onChange={(e) =>
                    updateTenantDefaults({ competency_max_location_errors: parseInt(e.target.value) || 0 })
                  }
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
                checked={tenantDefaults?.auto_suggestion_enabled ?? true}
                onCheckedChange={(checked) =>
                  updateTenantDefaults({ auto_suggestion_enabled: checked })
                }
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
              Enable or disable individual prompts across workflows.
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
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
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
  );
}

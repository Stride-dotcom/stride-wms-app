import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useToast } from "@/hooks/use-toast";
import {
  QueueWorkerRunResult,
  QueueWorkerStep,
  SmsSenderOpsLogEntry,
  SmsSenderOpsProfile,
  SmsSenderProvisioningStatus,
  useSmsSenderOpsAdmin,
} from "@/hooks/useSmsSenderOpsAdmin";

const STATUS_OPTIONS: Array<{ value: SmsSenderProvisioningStatus; label: string }> = [
  { value: "not_requested", label: "Not Requested" },
  { value: "requested", label: "Requested" },
  { value: "provisioning", label: "Provisioning" },
  { value: "pending_verification", label: "Pending Verification" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
];

const MUTABLE_STATUS_OPTIONS: Array<{ value: Exclude<SmsSenderProvisioningStatus, "not_requested">; label: string }> = [
  { value: "requested", label: "Requested" },
  { value: "provisioning", label: "Provisioning" },
  { value: "pending_verification", label: "Pending Verification" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
];

const WORKER_STEP_OPTIONS: Array<{ value: QueueWorkerStep; label: string; from: string; to: string }> = [
  {
    value: "requested_to_provisioning",
    label: "Requested → Provisioning",
    from: "requested",
    to: "provisioning",
  },
  {
    value: "provisioning_to_pending_verification",
    label: "Provisioning → Pending Verification",
    from: "provisioning",
    to: "pending_verification",
  },
];

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
    case "active":
      return "default";
    case "rejected":
    case "disabled":
      return "destructive";
    case "requested":
    case "provisioning":
    case "pending_verification":
    case "past_due":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "PPP p");
}

export default function SmsSenderOps() {
  const { toast } = useToast();
  const {
    profiles,
    loading,
    updating,
    runningWorker,
    refetch,
    setSenderStatus,
    bulkSetSenderStatus,
    runQueueWorker,
    fetchTenantLog,
  } = useSmsSenderOpsAdmin();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingProfile, setEditingProfile] = useState<SmsSenderOpsProfile | null>(null);
  const [historyProfile, setHistoryProfile] = useState<SmsSenderOpsProfile | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<SmsSenderOpsLogEntry[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());

  const [nextStatus, setNextStatus] = useState<Exclude<SmsSenderProvisioningStatus, "not_requested">>(
    "requested"
  );
  const [twilioPhoneSid, setTwilioPhoneSid] = useState("");
  const [twilioPhoneE164, setTwilioPhoneE164] = useState("");
  const [errorText, setErrorText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [bulkStatus, setBulkStatus] = useState<Exclude<SmsSenderProvisioningStatus, "not_requested">>(
    "provisioning"
  );
  const [bulkNote, setBulkNote] = useState("");
  const [workerStep, setWorkerStep] = useState<QueueWorkerStep>("requested_to_provisioning");
  const [workerLimit, setWorkerLimit] = useState("20");
  const [workerNote, setWorkerNote] = useState("");
  const [lastWorkerResult, setLastWorkerResult] = useState<QueueWorkerRunResult | null>(null);

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aTime = a.requested_at ? new Date(a.requested_at).getTime() : 0;
      const bTime = b.requested_at ? new Date(b.requested_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [profiles]);

  const visibleTenantIds = useMemo(
    () => sortedProfiles.map((profile) => profile.tenant_id),
    [sortedProfiles]
  );
  const selectedVisibleCount = visibleTenantIds.filter((tenantId) =>
    selectedTenantIds.has(tenantId)
  ).length;
  const allVisibleSelected =
    visibleTenantIds.length > 0 &&
    visibleTenantIds.every((tenantId) => selectedTenantIds.has(tenantId));
  const selectAllState: boolean | "indeterminate" =
    selectedVisibleCount === 0
      ? false
      : allVisibleSelected
      ? true
      : "indeterminate";

  useEffect(() => {
    setSelectedTenantIds((prev) => {
      const next = new Set<string>();
      for (const tenantId of prev) {
        if (visibleTenantIds.includes(tenantId)) {
          next.add(tenantId);
        }
      }
      return next;
    });
  }, [visibleTenantIds]);

  const openEditDialog = (profile: SmsSenderOpsProfile) => {
    setEditingProfile(profile);
    setNextStatus(
      profile.provisioning_status === "not_requested"
        ? "requested"
        : (profile.provisioning_status as Exclude<SmsSenderProvisioningStatus, "not_requested">)
    );
    setTwilioPhoneSid(profile.twilio_phone_number_sid || "");
    setTwilioPhoneE164(profile.twilio_phone_number_e164 || "");
    setErrorText(profile.last_error || "");
    setNoteText("");
  };

  const closeEditDialog = () => {
    setEditingProfile(null);
    setTwilioPhoneSid("");
    setTwilioPhoneE164("");
    setErrorText("");
    setNoteText("");
  };

  const handleApplyStatus = async () => {
    if (!editingProfile) return;
    try {
      await setSenderStatus({
        tenantId: editingProfile.tenant_id,
        status: nextStatus,
        twilioPhoneNumberSid: twilioPhoneSid.trim() || null,
        twilioPhoneNumberE164: twilioPhoneE164.trim() || null,
        error: nextStatus === "rejected" ? errorText.trim() || null : null,
        note: noteText.trim() || null,
      });

      toast({
        title: "Sender status updated",
        description: `${editingProfile.tenant_name} is now ${nextStatus}.`,
      });

      closeEditDialog();
      await refetch(statusFilter);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update sender status.";
      toast({
        variant: "destructive",
        title: "Update failed",
        description: message,
      });
    }
  };

  const handleOpenHistory = async (profile: SmsSenderOpsProfile) => {
    setHistoryProfile(profile);
    setHistoryLoading(true);
    try {
      const entries = await fetchTenantLog(profile.tenant_id, 100);
      setHistoryEntries(entries);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load history.";
      toast({
        variant: "destructive",
        title: "History load failed",
        description: message,
      });
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFilterChange = async (value: string) => {
    setStatusFilter(value);
    setSelectedTenantIds(new Set());
    await refetch(value);
  };

  const toggleSelectTenant = (tenantId: string, checked: boolean) => {
    setSelectedTenantIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(tenantId);
      } else {
        next.delete(tenantId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedTenantIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const tenantId of visibleTenantIds) {
          next.add(tenantId);
        }
      } else {
        for (const tenantId of visibleTenantIds) {
          next.delete(tenantId);
        }
      }
      return next;
    });
  };

  const handleBulkUpdate = async () => {
    const tenantIds = Array.from(selectedTenantIds);
    if (tenantIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No tenants selected",
        description: "Select at least one tenant row to run a bulk update.",
      });
      return;
    }

    try {
      const result = await bulkSetSenderStatus({
        tenantIds,
        status: bulkStatus,
        note: bulkNote.trim() || null,
      });

      toast({
        title: "Bulk status update complete",
        description: `Updated ${result.updated}/${result.attempted} tenant sender profiles.`,
      });

      if (result.failed > 0) {
        toast({
          variant: "destructive",
          title: `${result.failed} updates failed`,
          description: result.failures[0]?.error || "Some updates failed. Check history for details.",
        });
      }

      setSelectedTenantIds(new Set());
      await refetch(statusFilter);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bulk update failed.";
      toast({
        variant: "destructive",
        title: "Bulk update failed",
        description: message,
      });
    }
  };

  const handleRunQueueWorker = async () => {
    const parsedLimit = Number.parseInt(workerLimit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 20;

    try {
      const result = await runQueueWorker(workerStep, limit, workerNote.trim() || undefined);
      setLastWorkerResult(result);

      toast({
        title: "Queue worker run complete",
        description: `Transitioned ${result.transitioned}/${result.attempted} profiles (${result.from_status} → ${result.to_status}).`,
      });

      if (result.failed > 0) {
        toast({
          variant: "destructive",
          title: `${result.failed} transitions failed`,
          description: result.failures[0]?.error || "Some transitions failed.",
        });
      }

      await refetch(statusFilter);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Queue worker run failed.";
      toast({
        variant: "destructive",
        title: "Queue worker failed",
        description: message,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          primaryText="SMS Sender"
          accentText="Ops"
          description="Admin-dev controls for platform-managed toll-free sender provisioning and verification."
        />

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/billing-overrides-ops">
              <MaterialIcon name="money_off" size="sm" className="mr-2" />
              Open Billing Overrides Ops
            </Link>
          </Button>
        </div>

        <Alert>
          <MaterialIcon name="info" size="sm" />
          <AlertDescription className="text-sm">
            Approving sender status here enables SMS only when both sender approval and SMS add-on activation are satisfied.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Actions & Queue Worker</CardTitle>
            <CardDescription>
              Apply bulk status updates to selected tenants or run queue transitions for pending profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Bulk Status Update</h4>
                <Badge variant="outline">{selectedTenantIds.size} selected</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Target Status</Label>
                  <Select
                    value={bulkStatus}
                    onValueChange={(value) =>
                      setBulkStatus(value as Exclude<SmsSenderProvisioningStatus, "not_requested">)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUTABLE_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Internal Note (optional)</Label>
                  <Input
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    placeholder="Bulk transition note for audit log..."
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleBulkUpdate()}
                  disabled={updating || selectedTenantIds.size === 0}
                >
                  <MaterialIcon name="playlist_add_check" size="sm" className="mr-2" />
                  Apply Bulk Update
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium">Queue Worker (Scaffold)</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Worker Step</Label>
                  <Select value={workerStep} onValueChange={(value) => setWorkerStep(value as QueueWorkerStep)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKER_STEP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max Records</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={workerLimit}
                    onChange={(e) => setWorkerLimit(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input
                    value={workerNote}
                    onChange={(e) => setWorkerNote(e.target.value)}
                    placeholder="Queue run note..."
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => void handleRunQueueWorker()} disabled={runningWorker}>
                  {runningWorker ? (
                    <>
                      <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
                      Run Queue Worker
                    </>
                  )}
                </Button>
              </div>

              {lastWorkerResult && (
                <Alert>
                  <MaterialIcon name="sync" size="sm" />
                  <AlertDescription className="text-sm">
                    Last run: transitioned {lastWorkerResult.transitioned}/{lastWorkerResult.attempted} (
                    {lastWorkerResult.from_status} → {lastWorkerResult.to_status})
                    {lastWorkerResult.failed > 0 ? `, ${lastWorkerResult.failed} failed` : ""}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Sender Provisioning Queue</CardTitle>
              <CardDescription>Review tenant requests and update lifecycle status.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter" className="text-xs text-muted-foreground">
                Filter
              </Label>
              <Select value={statusFilter} onValueChange={(value) => void handleFilterChange(value)}>
                <SelectTrigger id="status-filter" className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <MaterialIcon name="progress_activity" size="md" className="animate-spin text-muted-foreground" />
              </div>
            ) : sortedProfiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sender profiles found for this filter.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[44px]">
                        <Checkbox
                          checked={selectAllState}
                          onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                          aria-label="Select all visible tenants"
                        />
                      </TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Number</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>SMS Add-On</TableHead>
                      <TableHead>SMS Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProfiles.map((profile) => (
                      <TableRow key={profile.tenant_id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedTenantIds.has(profile.tenant_id)}
                            onCheckedChange={(checked) =>
                              toggleSelectTenant(profile.tenant_id, checked === true)
                            }
                            aria-label={`Select ${profile.company_name || profile.tenant_name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{profile.company_name || profile.tenant_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {profile.app_subdomain
                                ? `${profile.app_subdomain} • `
                                : ""}
                              {profile.company_email || "No company_email"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(profile.provisioning_status)}>
                            {profile.provisioning_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {profile.twilio_phone_number_e164 || "—"}
                        </TableCell>
                        <TableCell>{formatDate(profile.requested_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(profile.sms_addon_status)}>
                            {profile.sms_addon_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={profile.sms_enabled ? "default" : "outline"}>
                            {profile.sms_enabled ? "enabled" : "disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(profile)}>
                              Update
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleOpenHistory(profile)}
                            >
                              History
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
      </div>

      <Dialog open={Boolean(editingProfile)} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Update Sender Status</DialogTitle>
            <DialogDescription>
              {editingProfile?.company_name || editingProfile?.tenant_name} ({editingProfile?.tenant_id})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as Exclude<SmsSenderProvisioningStatus, "not_requested">)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUTABLE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Twilio Phone Number SID</Label>
                <Input
                  value={twilioPhoneSid}
                  onChange={(e) => setTwilioPhoneSid(e.target.value)}
                  placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Twilio Number (E.164)</Label>
                <Input
                  value={twilioPhoneE164}
                  onChange={(e) => setTwilioPhoneE164(e.target.value)}
                  placeholder="+12065551234"
                />
              </div>
            </div>

            {nextStatus === "rejected" && (
              <div className="space-y-1.5">
                <Label>Rejection/Error Message</Label>
                <Textarea
                  value={errorText}
                  onChange={(e) => setErrorText(e.target.value)}
                  placeholder="Explain why provisioning/verification was rejected..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Internal Note</Label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Optional note for audit trail..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleApplyStatus()} disabled={updating}>
              {updating ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Apply Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyProfile)} onOpenChange={(open) => !open && setHistoryProfile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sender History</DialogTitle>
            <DialogDescription>
              {historyProfile?.company_name || historyProfile?.tenant_name} ({historyProfile?.tenant_id})
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <MaterialIcon name="progress_activity" size="md" className="animate-spin text-muted-foreground" />
            </div>
          ) : historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sender lifecycle events recorded yet.</p>
          ) : (
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-3">
                {historyEntries.map((entry) => (
                  <div key={entry.id} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">{entry.event_type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {entry.status_from || "—"} → {entry.status_to || "—"}
                    </p>
                    {entry.notes && <p className="mt-2">{entry.notes}</p>}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}


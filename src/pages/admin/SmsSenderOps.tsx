import { useMemo, useState } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const { profiles, loading, updating, refetch, setSenderStatus, fetchTenantLog } =
    useSmsSenderOpsAdmin();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingProfile, setEditingProfile] = useState<SmsSenderOpsProfile | null>(null);
  const [historyProfile, setHistoryProfile] = useState<SmsSenderOpsProfile | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<SmsSenderOpsLogEntry[]>([]);

  const [nextStatus, setNextStatus] = useState<Exclude<SmsSenderProvisioningStatus, "not_requested">>(
    "requested"
  );
  const [twilioPhoneSid, setTwilioPhoneSid] = useState("");
  const [twilioPhoneE164, setTwilioPhoneE164] = useState("");
  const [errorText, setErrorText] = useState("");
  const [noteText, setNoteText] = useState("");

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aTime = a.requested_at ? new Date(a.requested_at).getTime() : 0;
      const bTime = b.requested_at ? new Date(b.requested_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [profiles]);

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
    await refetch(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          primaryText="SMS Sender"
          accentText="Ops"
          description="Admin-dev controls for platform-managed toll-free sender provisioning and verification."
        />

        <Alert>
          <MaterialIcon name="info" size="sm" />
          <AlertDescription className="text-sm">
            Approving sender status here enables SMS only when both sender approval and SMS add-on activation are satisfied.
          </AlertDescription>
        </Alert>

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


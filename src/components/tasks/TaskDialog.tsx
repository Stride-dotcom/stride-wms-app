import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { SelectSearch } from "@/components/shared/SelectSearch";
import type { SelectOption } from "@/components/shared/SelectSearch";

import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import { useEmployees } from "@/hooks/useEmployees";
import { useTaskTypes } from "@/hooks/useTaskTypes";

// NOTE: DB constraint allows ONLY these:
type DbTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

// UI label mapping (so you can say “In Queue” but store “pending”)
const STATUS_UI_OPTIONS: { value: DbTaskStatus; label: string }[] = [
{ value: "pending", label: "In Queue" },
{ value: "in_progress", label: "In Progress" },
{ value: "completed", label: "Completed" },
{ value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
{ value: "low", label: "Low" },
{ value: "normal", label: "Normal" },
{ value: "urgent", label: "Urgent" },
];

// Keep task types in the UI as-is
type TaskDialogProps = {
open: boolean;
onOpenChange: (open: boolean) => void;
onCreated?: () => void;
};

export default function TaskDialog({ open, onOpenChange, onCreated }: TaskDialogProps) {
const { profile } = useAuth();
const tenantId = profile?.tenant_id ?? null;

const { accounts } = useAccounts();
const { employees } = useEmployees();
const { taskTypes } = useTaskTypes();

const accountOptions: SelectOption[] = useMemo(
() => (accounts ?? []).map((a: any) => ({ value: a.id, label: a.account_name })),
[accounts]
);

const employeeOptions: SelectOption[] = useMemo(
() => (employees ?? []).map((e: any) => ({
value: e.id,
label: e.full_name || e.email || "Employee",
subtitle: e.role || undefined,
})),
[employees]
);

const taskTypeOptions: SelectOption[] = useMemo(
() => (taskTypes ?? []).map((t: any) => ({ value: t.code ?? t.name, label: t.name })),
[taskTypes]
);

// Form state
const [taskType, setTaskType] = useState<string>("");
const [accountId, setAccountId] = useState<string>("");
const [description, setDescription] = useState<string>("");
const [billTo, setBillTo] = useState<"account">("account");
const [priority, setPriority] = useState<string>("normal");
const [dueDate, setDueDate] = useState<string>("");
const [assignedTo, setAssignedTo] = useState<string>("");

const [saving, setSaving] = useState(false);

// Reset when opened
useEffect(() => {
if (!open) return;
setTaskType("");
setAccountId("");
setDescription("");
setBillTo("account");
setPriority("normal");
setDueDate("");
setAssignedTo("");
}, [open]);

const handleCreate = async () => {
if (!tenantId) {
toast.error("Missing tenant context. Please re-login.");
return;
}
if (!taskType) {
toast.error("Please select a task type.");
return;
}

setSaving(true);
try {
// IMPORTANT: Store DB-safe status
const status: DbTaskStatus = "pending";

const payload: any = {
tenant_id: tenantId,
task_type: taskType,
status, // ✅ pending fixes your constraint error
priority,
description: description?.trim() || null,
account_id: accountId || null,
bill_to: billTo,
due_date: dueDate || null,
assigned_to: assignedTo || null,
};

const { error } = await supabase.from("tasks").insert(payload);

if (error) {
console.error("[TaskDialog] insert error:", error);
toast.error(`Error saving task: ${error.message}`);
return;
}

toast.success("Task created (In Queue).");
onOpenChange(false);
onCreated?.();
} finally {
setSaving(false);
}
};

return (
<Dialog open={open} onOpenChange={onOpenChange}>
<DialogContent className="sm:max-w-[560px]">
<DialogHeader>
<DialogTitle>Create Task</DialogTitle>
</DialogHeader>

<div className="space-y-4">
<div>
<Label>Task Type</Label>
<SelectSearch
value={taskType}
onValueChange={(v) => setTaskType(v)}
placeholder="Select task type..."
searchPlaceholder="Search task types..."
emptyText="No task types found"
options={taskTypeOptions}
/>
</div>

<div>
<Label>Account</Label>
<SelectSearch
value={accountId}
onValueChange={(v) => setAccountId(v)}
placeholder="No account"
searchPlaceholder="Search accounts..."
emptyText="No accounts found"
options={accountOptions}
clearable
/>
</div>

<div>
<Label>Description</Label>
<Textarea
value={description}
onChange={(e) => setDescription(e.target.value)}
placeholder="Task description"
/>
</div>

<div>
<Label>Bill To</Label>
<SelectSearch
value={billTo}
onValueChange={() => setBillTo("account")}
options={[{ value: "account", label: "Account" }]}
/>
</div>

<div className="grid grid-cols-2 gap-4">
<div>
<Label>Priority</Label>
<SelectSearch
value={priority}
onValueChange={(v) => setPriority(v)}
options={PRIORITY_OPTIONS}
/>
</div>

<div>
<Label>Due Date</Label>
<input
type="date"
className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
value={dueDate}
onChange={(e) => setDueDate(e.target.value)}
/>
</div>
</div>

<div>
<Label>Assign To</Label>
<SelectSearch
value={assignedTo}
onValueChange={(v) => setAssignedTo(v)}
placeholder="Unassigned"
searchPlaceholder="Search employees..."
emptyText="No employees found"
options={employeeOptions}
clearable
/>
</div>

{/* Status (UI only). We create tasks as pending; if you later add edit mode, use STATUS_UI_OPTIONS */}
<div className="pt-2 flex justify-end gap-2">
<Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
Cancel
</Button>
<Button onClick={handleCreate} disabled={saving}>
{saving ? "Creating..." : "Create Task"}
</Button>
</div>
</div>
</DialogContent>
</Dialog>
);
}

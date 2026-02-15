import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SmsSenderProvisioningStatus =
  | "not_requested"
  | "requested"
  | "provisioning"
  | "pending_verification"
  | "approved"
  | "rejected"
  | "disabled";

export interface SmsSenderOpsProfile {
  tenant_id: string;
  tenant_name: string;
  company_name: string | null;
  company_email: string | null;
  app_subdomain: string | null;
  sender_type: string;
  provisioning_status: SmsSenderProvisioningStatus;
  twilio_phone_number_sid: string | null;
  twilio_phone_number_e164: string | null;
  requested_at: string | null;
  verification_submitted_at: string | null;
  verification_approved_at: string | null;
  verification_rejected_at: string | null;
  billing_start_at: string | null;
  last_error: string | null;
  sms_addon_active: boolean;
  sms_addon_status: string;
  sms_enabled: boolean;
  profile_updated_at: string | null;
}

export interface SmsSenderOpsLogEntry {
  id: string;
  tenant_id: string;
  event_type: string;
  actor_user_id: string | null;
  status_from: string | null;
  status_to: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SetStatusInput {
  tenantId: string;
  status: Exclude<SmsSenderProvisioningStatus, "not_requested">;
  twilioPhoneNumberSid?: string | null;
  twilioPhoneNumberE164?: string | null;
  error?: string | null;
  note?: string | null;
}

interface BulkSetStatusInput {
  tenantIds: string[];
  status: Exclude<SmsSenderProvisioningStatus, "not_requested">;
  note?: string | null;
  error?: string | null;
}

export interface BulkStatusResult {
  attempted: number;
  updated: number;
  failed: number;
  failures: Array<{ tenant_id: string; error: string }>;
}

export type QueueWorkerStep = "requested_to_provisioning" | "provisioning_to_pending_verification";

export interface QueueWorkerRunResult {
  ok: boolean;
  step: QueueWorkerStep;
  from_status: string;
  to_status: string;
  attempted: number;
  transitioned: number;
  failed: number;
  failures: Array<{ tenant_id: string; error: string }>;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeProfileRow(row: Record<string, unknown>): SmsSenderOpsProfile {
  return {
    tenant_id: String(row.tenant_id),
    tenant_name: String(row.tenant_name ?? ""),
    company_name: toNullableString(row.company_name),
    company_email: toNullableString(row.company_email),
    app_subdomain: toNullableString(row.app_subdomain),
    sender_type: String(row.sender_type ?? "toll_free"),
    provisioning_status:
      typeof row.provisioning_status === "string"
        ? (row.provisioning_status as SmsSenderProvisioningStatus)
        : "not_requested",
    twilio_phone_number_sid: toNullableString(row.twilio_phone_number_sid),
    twilio_phone_number_e164: toNullableString(row.twilio_phone_number_e164),
    requested_at: toNullableString(row.requested_at),
    verification_submitted_at: toNullableString(row.verification_submitted_at),
    verification_approved_at: toNullableString(row.verification_approved_at),
    verification_rejected_at: toNullableString(row.verification_rejected_at),
    billing_start_at: toNullableString(row.billing_start_at),
    last_error: toNullableString(row.last_error),
    sms_addon_active: toBoolean(row.sms_addon_active),
    sms_addon_status: String(row.sms_addon_status ?? "not_activated"),
    sms_enabled: toBoolean(row.sms_enabled),
    profile_updated_at: toNullableString(row.profile_updated_at),
  };
}

function normalizeLogRow(row: Record<string, unknown>): SmsSenderOpsLogEntry {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    event_type: String(row.event_type ?? ""),
    actor_user_id: toNullableString(row.actor_user_id),
    status_from: toNullableString(row.status_from),
    status_to: toNullableString(row.status_to),
    notes: toNullableString(row.notes),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? ""),
  };
}

export function useSmsSenderOpsAdmin() {
  const [profiles, setProfiles] = useState<SmsSenderOpsProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [runningWorker, setRunningWorker] = useState(false);

  const fetchProfiles = useCallback(async (statusFilter?: string) => {
    const { data, error } = await (supabase as any).rpc("rpc_admin_list_sms_sender_profiles", {
      p_status: statusFilter && statusFilter !== "all" ? statusFilter : null,
    });
    if (error) throw new Error(error.message || "Failed to load sender profiles");
    const rows = Array.isArray(data) ? data : [];
    setProfiles(rows.map((row) => normalizeProfileRow(row as Record<string, unknown>)));
  }, []);

  const refetch = useCallback(async (statusFilter?: string) => {
    setLoading(true);
    try {
      await fetchProfiles(statusFilter);
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const callSetSenderStatusRpc = useCallback(
    async (input: SetStatusInput) => {
      const { data, error } = await (supabase as any).rpc("rpc_admin_set_sms_sender_status", {
        p_tenant_id: input.tenantId,
        p_status: input.status,
        p_twilio_phone_number_sid: input.twilioPhoneNumberSid ?? null,
        p_twilio_phone_number_e164: input.twilioPhoneNumberE164 ?? null,
        p_error: input.error ?? null,
        p_note: input.note ?? null,
      });

      if (error) throw new Error(error.message || "Failed to update sender status");
      return data as Record<string, unknown>;
    },
    []
  );

  const setSenderStatus = useCallback(
    async (input: SetStatusInput) => {
      setUpdating(true);
      try {
        return await callSetSenderStatusRpc(input);
      } finally {
        setUpdating(false);
      }
    },
    [callSetSenderStatusRpc]
  );

  const fetchTenantLog = useCallback(async (tenantId: string, limit = 50) => {
    const { data, error } = await (supabase as any).rpc("rpc_admin_get_sms_sender_profile_log", {
      p_tenant_id: tenantId,
      p_limit: limit,
    });
    if (error) throw new Error(error.message || "Failed to load sender log");
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row) => normalizeLogRow(row as Record<string, unknown>));
  }, []);

  const bulkSetSenderStatus = useCallback(
    async (input: BulkSetStatusInput): Promise<BulkStatusResult> => {
      const failures: Array<{ tenant_id: string; error: string }> = [];
      let updated = 0;
      const uniqueTenantIds = Array.from(new Set(input.tenantIds.filter(Boolean)));

      if (uniqueTenantIds.length === 0) {
        return {
          attempted: 0,
          updated: 0,
          failed: 0,
          failures: [],
        };
      }

      setUpdating(true);
      try {
        for (const tenantId of uniqueTenantIds) {
          try {
            await callSetSenderStatusRpc({
              tenantId,
              status: input.status,
              note: input.note ?? null,
              error: input.error ?? null,
            });
            updated += 1;
          } catch (error: unknown) {
            failures.push({
              tenant_id: tenantId,
              error: error instanceof Error ? error.message : "Unknown update error",
            });
          }
        }

        return {
          attempted: uniqueTenantIds.length,
          updated,
          failed: failures.length,
          failures,
        };
      } finally {
        setUpdating(false);
      }
    },
    [callSetSenderStatusRpc]
  );

  const runQueueWorker = useCallback(
    async (step: QueueWorkerStep, limit = 20, note?: string): Promise<QueueWorkerRunResult> => {
      setRunningWorker(true);
      try {
        const { data, error } = await supabase.functions.invoke("process-sms-sender-queue", {
          body: {
            step,
            limit,
            note: note ?? null,
          },
        });
        if (error) throw new Error(error.message || "Failed to run queue worker");
        if (!data || (data as Record<string, unknown>).ok !== true) {
          const message =
            data && typeof (data as Record<string, unknown>).error === "string"
              ? ((data as Record<string, unknown>).error as string)
              : "Queue worker returned an unexpected response";
          throw new Error(message);
        }
        return data as QueueWorkerRunResult;
      } finally {
        setRunningWorker(false);
      }
    },
    []
  );

  return {
    profiles,
    loading,
    updating,
    runningWorker,
    refetch,
    setSenderStatus,
    bulkSetSenderStatus,
    runQueueWorker,
    fetchTenantLog,
  };
}


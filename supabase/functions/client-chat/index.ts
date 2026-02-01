import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// TYPES
// ============================================================

interface ChatScope {
  tenant_id: string;
  account_id: string;
  subaccount_id?: string;
  user_id: string;
}

interface UIContext {
  route?: string;
  selected_item_ids?: string[];
}

interface DisambiguationState {
  type: 'items' | 'subaccounts';
  candidates: Array<{ id: string; label: string; index: number }>;
  original_query: string;
  action_context?: any;
}

interface SessionState {
  pending_disambiguation?: DisambiguationState;
  pending_draft?: {
    type: 'will_call' | 'repair_quote' | 'reallocation';
    draft_id: string;
    summary: string;
  };
}

// ============================================================
// CLIENT-SAFE SYSTEM PROMPT
// ============================================================

const CLIENT_SYSTEM_PROMPT = `You are Stride Helper, a friendly AI assistant for warehouse clients. You help customers manage their stored items with warmth and clarity.

## Your Personality
- Warm, friendly, and approachable - like a helpful concierge
- Use plain English, avoid warehouse jargon
- Light emoji use is okay (but don't overdo it)
- Always explain what's happening in simple terms
- Be reassuring when things might seem complex

## What You Can Help With
- Creating will call / pickup requests for items
- Checking if items have arrived ("Did I get a Jones sofa yet?")
- Requesting repair quotes for damaged items
- Moving items between jobs/projects (subaccounts)
- Finding items and checking their status
- Viewing inspection reports

## Important Rules

### AMBIGUITY - Always Ask for Clarification
When a search returns multiple possible matches, you MUST:
1. Present a numbered list of options
2. Ask the user to choose: "Which one did you mean?"
3. Allow multi-select responses like "1 and 3" or "all"
4. Never guess - always confirm

Example response for multiple matches:
"I found a few items that could be what you're looking for:

1. **Blue Leather Sofa** - Job: Johnson Residence - Received Jan 15
2. **Blue Velvet Sofa** - Job: Smith Office - Received Jan 20
3. **Navy Sofa Set** - Job: Johnson Residence - Received Jan 22

Which one did you mean? You can say a number, multiple numbers (like "1 and 3"), or "all" if you need all of them."

### CONFIRMATION - Always Confirm Before Actions
Any action that changes data MUST follow this flow:
1. Create a draft and summarize what will happen
2. Ask for explicit confirmation: "Should I go ahead with this?"
3. Only execute if user confirms
4. If user says no, cancel and offer alternatives

### LINKS - Only When Asked
- Show item numbers, shipment numbers, etc. as plain text by default
- Only include clickable links when the user asks to "open", "view", or "show me" something
- Or when showing a draft that needs review

## Available Tools
You have access to tools for:
- Searching items (scoped to the client's account)
- Getting the most recent shipment
- Checking item status and location
- Viewing inspection reports
- Creating will call drafts
- Submitting will calls (after confirmation)
- Creating repair quote request drafts
- Submitting repair quote requests (after confirmation)
- Moving items between jobs (with preview and confirmation)

## Session Context
The user is a client portal user. All data you access is automatically scoped to their account - you cannot see other customers' data, internal notes, costs, rates, or employee information.

## Response Style Examples

Good: "Great news! Your Jones sofa arrived on January 15th. It's currently stored in our climate-controlled area. Would you like me to set up a pickup for it?"

Avoid: "Item ITM-00142 status=active, location_id=LOC-089, received_at=2024-01-15T14:30:00Z"

Good: "I'd be happy to help you schedule a pickup! I'll need to know: who will be picking up the items, and would you like them ready for a specific date?"

Avoid: "Initiating will_call_draft creation sequence. Please provide released_to_name parameter."`;

// ============================================================
// TOOL DEFINITIONS
// ============================================================

const TOOLS = [
  {
    name: "tool_search_items",
    description: "Search for items in the client's inventory by name, description, or job name",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (item name, description, or job name)" },
      },
      required: ["query"],
    },
  },
  {
    name: "tool_get_last_inbound_shipment",
    description: "Get the most recent inbound shipment for this client",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "tool_get_shipment_items",
    description: "Get all items from a specific shipment",
    parameters: {
      type: "object",
      properties: {
        shipment_id: { type: "string", description: "The shipment ID" },
      },
      required: ["shipment_id"],
    },
  },
  {
    name: "tool_get_item_status",
    description: "Get detailed status of a specific item",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "The item ID" },
      },
      required: ["item_id"],
    },
  },
  {
    name: "tool_get_inspection_reports",
    description: "Get inspection reports for a shipment, item, or job",
    parameters: {
      type: "object",
      properties: {
        shipment_id: { type: "string", description: "Filter by shipment ID" },
        item_id: { type: "string", description: "Filter by item ID" },
        subaccount_id: { type: "string", description: "Filter by job/subaccount ID" },
      },
    },
  },
  {
    name: "tool_create_will_call_draft",
    description: "Create a draft will call (pickup) request - requires confirmation before submitting",
    parameters: {
      type: "object",
      properties: {
        subaccount_id: { type: "string", description: "The job/subaccount ID" },
        item_ids: { type: "array", items: { type: "string" }, description: "Array of item IDs to pick up" },
        release_type: {
          type: "string",
          enum: ["customer", "third_party_carrier", "stride_delivery"],
          description: "How items will be picked up"
        },
        released_to_name: { type: "string", description: "Name of person/company picking up" },
        notes: { type: "string", description: "Optional notes for the pickup" },
      },
      required: ["item_ids", "release_type", "released_to_name"],
    },
  },
  {
    name: "tool_submit_will_call",
    description: "Submit a confirmed will call draft - only call after user confirms",
    parameters: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The draft ID to submit" },
      },
      required: ["draft_id"],
    },
  },
  {
    name: "tool_create_repair_quote_request_draft",
    description: "Create a draft repair quote request - requires confirmation before submitting",
    parameters: {
      type: "object",
      properties: {
        subaccount_id: { type: "string", description: "The job/subaccount ID" },
        item_ids: { type: "array", items: { type: "string" }, description: "Array of item IDs needing repair" },
        notes: { type: "string", description: "Description of repair needed" },
      },
      required: ["item_ids"],
    },
  },
  {
    name: "tool_submit_repair_quote_request",
    description: "Submit a confirmed repair quote request draft - only call after user confirms",
    parameters: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "The draft ID to submit" },
      },
      required: ["draft_id"],
    },
  },
  {
    name: "tool_reallocate_items_preview",
    description: "Preview moving items from one job to another - shows what will change",
    parameters: {
      type: "object",
      properties: {
        item_ids: { type: "array", items: { type: "string" }, description: "Array of item IDs to move" },
        from_subaccount_id: { type: "string", description: "Source job/subaccount ID" },
        to_subaccount_id: { type: "string", description: "Destination job/subaccount ID" },
      },
      required: ["item_ids", "from_subaccount_id", "to_subaccount_id"],
    },
  },
  {
    name: "tool_reallocate_items_execute",
    description: "Execute the item move after user confirms - only call after confirmation",
    parameters: {
      type: "object",
      properties: {
        item_ids: { type: "array", items: { type: "string" }, description: "Array of item IDs to move" },
        from_subaccount_id: { type: "string", description: "Source job/subaccount ID" },
        to_subaccount_id: { type: "string", description: "Destination job/subaccount ID" },
      },
      required: ["item_ids", "from_subaccount_id", "to_subaccount_id"],
    },
  },
  {
    name: "tool_resolve_disambiguation",
    description: "Resolve a pending disambiguation by selecting from previous options",
    parameters: {
      type: "object",
      properties: {
        selections: {
          type: "array",
          items: { type: "number" },
          description: "Array of selected option numbers (1-indexed)"
        },
        select_all: { type: "boolean", description: "Set to true if user said 'all'" },
      },
      required: [],
    },
  },
  {
    name: "tool_get_subaccounts",
    description: "Get available jobs/subaccounts for the client",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// ============================================================
// TOOL HANDLERS
// ============================================================

async function handleTool(
  supabase: any,
  toolName: string,
  params: any,
  scope: ChatScope,
  sessionState: SessionState
): Promise<{ result: any; newSessionState?: Partial<SessionState> }> {
  switch (toolName) {
    case "tool_search_items":
      return await toolSearchItems(supabase, params, scope);

    case "tool_get_last_inbound_shipment":
      return await toolGetLastInboundShipment(supabase, scope);

    case "tool_get_shipment_items":
      return await toolGetShipmentItems(supabase, params, scope);

    case "tool_get_item_status":
      return await toolGetItemStatus(supabase, params, scope);

    case "tool_get_inspection_reports":
      return await toolGetInspectionReports(supabase, params, scope);

    case "tool_create_will_call_draft":
      return await toolCreateWillCallDraft(supabase, params, scope);

    case "tool_submit_will_call":
      return await toolSubmitWillCall(supabase, params, scope);

    case "tool_create_repair_quote_request_draft":
      return await toolCreateRepairQuoteDraft(supabase, params, scope);

    case "tool_submit_repair_quote_request":
      return await toolSubmitRepairQuoteRequest(supabase, params, scope);

    case "tool_reallocate_items_preview":
      return await toolReallocateItemsPreview(supabase, params, scope);

    case "tool_reallocate_items_execute":
      return await toolReallocateItemsExecute(supabase, params, scope);

    case "tool_resolve_disambiguation":
      return await toolResolveDisambiguation(params, sessionState);

    case "tool_get_subaccounts":
      return await toolGetSubaccounts(supabase, scope);

    default:
      return { result: { error: `Unknown tool: ${toolName}` } };
  }
}

// Tool: Search Items
async function toolSearchItems(supabase: any, params: { query: string }, scope: ChatScope) {
  const { query } = params;

  const { data: items, error } = await supabase
    .from("items")
    .select(`
      id,
      item_code,
      description,
      status,
      received_at,
      sidemark:sidemarks(id, sidemark_name),
      location:locations(id, code, name),
      shipment:shipments!items_shipment_id_fkey(id, shipment_number)
    `)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .is("deleted_at", null)
    .or(`description.ilike.%${query}%,item_code.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error("Search items error:", error);
    return { result: { error: "Failed to search items", candidates: [] } };
  }

  // Also search by sidemark/job name
  const { data: sidemarkItems } = await supabase
    .from("items")
    .select(`
      id,
      item_code,
      description,
      status,
      received_at,
      sidemark:sidemarks!inner(id, sidemark_name),
      location:locations(id, code, name),
      shipment:shipments!items_shipment_id_fkey(id, shipment_number)
    `)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .is("deleted_at", null)
    .ilike("sidemarks.sidemark_name", `%${query}%`)
    .limit(20);

  // Combine and dedupe
  const allItems = [...(items || []), ...(sidemarkItems || [])];
  const uniqueItems = Array.from(new Map(allItems.map(i => [i.id, i])).values());

  const candidates = uniqueItems.map((item: any) => ({
    id: item.id,
    label: item.description || item.item_code,
    item_number: item.item_code,
    job_name: item.sidemark?.sidemark_name || null,
    location_label: item.location?.name || item.location?.code || null,
    received_at: item.received_at,
    shipment_number: item.shipment?.shipment_number || null,
    status: item.status,
  }));

  // If multiple matches, set up disambiguation
  if (candidates.length > 1) {
    return {
      result: {
        multiple_matches: true,
        count: candidates.length,
        candidates: candidates.slice(0, 10).map((c: any, i: number) => ({ ...c, index: i + 1 })),
        message: "Multiple items found. Please specify which one(s) you mean.",
      },
      newSessionState: {
        pending_disambiguation: {
          type: "items",
          candidates: candidates.slice(0, 10).map((c: any, i: number) => ({
            id: c.id,
            label: c.label,
            index: i + 1,
          })),
          original_query: query,
        },
      },
    };
  }

  return { result: { candidates } };
}

// Tool: Get Last Inbound Shipment
async function toolGetLastInboundShipment(supabase: any, scope: ChatScope) {
  const { data: shipment, error } = await supabase
    .from("shipments")
    .select("id, shipment_number, received_at, created_at, status")
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .eq("shipment_type", "inbound")
    .is("deleted_at", null)
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (error) {
    return { result: { found: false, message: "No recent shipments found" } };
  }

  return {
    result: {
      found: true,
      shipment_id: shipment.id,
      shipment_number: shipment.shipment_number,
      received_at: shipment.received_at || shipment.created_at,
      status: shipment.status,
    },
  };
}

// Tool: Get Shipment Items
async function toolGetShipmentItems(supabase: any, params: { shipment_id: string }, scope: ChatScope) {
  // Verify shipment belongs to this account
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id")
    .eq("id", params.shipment_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .single();

  if (!shipment) {
    return { result: { error: "Shipment not found", items: [] } };
  }

  const { data: items, error } = await supabase
    .from("items")
    .select(`
      id,
      item_code,
      description,
      status,
      sidemark:sidemarks(id, sidemark_name)
    `)
    .eq("shipment_id", params.shipment_id)
    .eq("tenant_id", scope.tenant_id)
    .is("deleted_at", null);

  if (error) {
    return { result: { error: "Failed to get shipment items", items: [] } };
  }

  return {
    result: {
      items: (items || []).map((item: any) => ({
        item_id: item.id,
        label: item.description || item.item_code,
        item_number: item.item_code,
        job_name: item.sidemark?.sidemark_name,
        status: item.status,
      })),
    },
  };
}

// Tool: Get Item Status
async function toolGetItemStatus(supabase: any, params: { item_id: string }, scope: ChatScope) {
  const { data: item, error } = await supabase
    .from("items")
    .select(`
      id,
      item_code,
      description,
      status,
      received_at,
      sidemark:sidemarks(id, sidemark_name),
      location:locations(id, code, name),
      warehouse:warehouses(id, name),
      shipment:shipments!items_shipment_id_fkey(id, shipment_number, received_at)
    `)
    .eq("id", params.item_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .single();

  if (error || !item) {
    return { result: { found: false, message: "Item not found" } };
  }

  // Get any inspection tasks for this item
  const { data: inspectionTasks } = await supabase
    .from("tasks")
    .select("id, task_number, title, status, completed_at")
    .eq("tenant_id", scope.tenant_id)
    .contains("item_ids", [params.item_id])
    .eq("task_type", "inspection")
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    result: {
      found: true,
      status: item.status,
      description: item.description,
      item_number: item.item_code,
      location_label: item.location?.name || item.location?.code || "Not assigned",
      warehouse: item.warehouse?.name,
      received_at: item.received_at,
      shipment_number: item.shipment?.shipment_number,
      job_name: item.sidemark?.sidemark_name,
      inspection_reports: inspectionTasks?.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        completed_at: t.completed_at,
      })) || [],
    },
  };
}

// Tool: Get Inspection Reports
async function toolGetInspectionReports(
  supabase: any,
  params: { shipment_id?: string; item_id?: string; subaccount_id?: string },
  scope: ChatScope
) {
  let query = supabase
    .from("tasks")
    .select("id, task_number, title, status, completed_at, created_at, item_ids")
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .eq("task_type", "inspection")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (params.subaccount_id) {
    query = query.eq("sidemark_id", params.subaccount_id);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return { result: { error: "Failed to get inspection reports", reports: [] } };
  }

  let filteredTasks = tasks || [];

  // Filter by item_id if provided
  if (params.item_id) {
    filteredTasks = filteredTasks.filter((t: any) =>
      t.item_ids && t.item_ids.includes(params.item_id)
    );
  }

  // Filter by shipment_id if provided - need to get items from that shipment
  if (params.shipment_id) {
    const { data: shipmentItems } = await supabase
      .from("items")
      .select("id")
      .eq("shipment_id", params.shipment_id)
      .eq("tenant_id", scope.tenant_id);

    const shipmentItemIds = (shipmentItems || []).map((i: any) => i.id);

    filteredTasks = filteredTasks.filter((t: any) =>
      t.item_ids && t.item_ids.some((id: string) => shipmentItemIds.includes(id))
    );
  }

  return {
    result: {
      reports: filteredTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        task_number: t.task_number,
        status: t.status,
        created_at: t.created_at,
        completed_at: t.completed_at,
      })),
    },
  };
}

// Tool: Create Will Call Draft
async function toolCreateWillCallDraft(
  supabase: any,
  params: {
    subaccount_id?: string;
    item_ids: string[];
    release_type: string;
    released_to_name: string;
    notes?: string;
  },
  scope: ChatScope
) {
  // Validate items belong to this account
  const { data: validItems, error: itemsError } = await supabase
    .from("items")
    .select("id, item_code, description, status, sidemark:sidemarks(id, sidemark_name)")
    .in("id", params.item_ids)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .is("deleted_at", null);

  if (itemsError || !validItems || validItems.length === 0) {
    return { result: { error: "No valid items found for pickup", ok: false } };
  }

  // Check items are available for pickup
  const unavailableItems = validItems.filter((i: any) =>
    !["active", "in_storage", "available"].includes(i.status)
  );

  if (unavailableItems.length > 0) {
    return {
      result: {
        ok: false,
        error: "Some items are not available for pickup",
        unavailable_items: unavailableItems.map((i: any) => ({
          item_number: i.item_code,
          status: i.status,
        })),
      },
    };
  }

  // Create draft
  const { data: draft, error: draftError } = await supabase
    .from("client_chat_will_call_drafts")
    .insert({
      tenant_id: scope.tenant_id,
      account_id: scope.account_id,
      subaccount_id: params.subaccount_id || null,
      created_by: scope.user_id,
      item_ids: params.item_ids,
      release_type: params.release_type,
      released_to_name: params.released_to_name,
      notes: params.notes || null,
    })
    .select("id")
    .single();

  if (draftError) {
    console.error("Create draft error:", draftError);
    return { result: { error: "Failed to create pickup request draft", ok: false } };
  }

  const releaseTypeLabels: Record<string, string> = {
    customer: "Customer pickup",
    third_party_carrier: "Third-party carrier",
    stride_delivery: "Stride delivery",
  };

  const summary = `
**Pickup Request Draft Created**

Items to be picked up (${validItems.length}):
${validItems.map((i: any) => `- ${i.description || i.item_code}`).join("\n")}

Pickup method: ${releaseTypeLabels[params.release_type] || params.release_type}
Picked up by: ${params.released_to_name}
${params.notes ? `Notes: ${params.notes}` : ""}

Would you like me to submit this pickup request?
  `.trim();

  return {
    result: {
      ok: true,
      draft_id: draft.id,
      summary,
      item_count: validItems.length,
      needs_confirmation: true,
    },
    newSessionState: {
      pending_draft: {
        type: "will_call",
        draft_id: draft.id,
        summary,
      },
    },
  };
}

// Tool: Submit Will Call
async function toolSubmitWillCall(
  supabase: any,
  params: { draft_id: string },
  scope: ChatScope
) {
  // Get draft
  const { data: draft, error: draftError } = await supabase
    .from("client_chat_will_call_drafts")
    .select("*")
    .eq("id", params.draft_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .eq("status", "draft")
    .single();

  if (draftError || !draft) {
    return { result: { ok: false, error: "Draft not found or already submitted" } };
  }

  // Create the actual outbound shipment
  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments")
    .insert({
      tenant_id: scope.tenant_id,
      account_id: scope.account_id,
      shipment_type: "outbound",
      status: "pending",
      sidemark_id: draft.subaccount_id,
      notes: `${draft.release_type}: ${draft.released_to_name}${draft.notes ? ` - ${draft.notes}` : ""}`,
      created_by: scope.user_id,
    })
    .select("id, shipment_number")
    .single();

  if (shipmentError) {
    console.error("Create shipment error:", shipmentError);
    return { result: { ok: false, error: "Failed to create pickup request" } };
  }

  // Create shipment items
  const shipmentItems = draft.item_ids.map((item_id: string) => ({
    shipment_id: shipment.id,
    item_id,
    expected_quantity: 1,
    status: "pending",
  }));

  await supabase.from("shipment_items").insert(shipmentItems);

  // Update items to allocated status
  await supabase
    .from("items")
    .update({ status: "allocated" })
    .in("id", draft.item_ids);

  // Mark draft as confirmed
  await supabase
    .from("client_chat_will_call_drafts")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", params.draft_id);

  return {
    result: {
      ok: true,
      request_id: shipment.id,
      request_number: shipment.shipment_number,
      status: "pending",
      message: `Your pickup request ${shipment.shipment_number} has been submitted! The warehouse team will prepare your items.`,
    },
  };
}

// Tool: Create Repair Quote Draft
async function toolCreateRepairQuoteDraft(
  supabase: any,
  params: {
    subaccount_id?: string;
    item_ids: string[];
    notes?: string;
  },
  scope: ChatScope
) {
  // Validate items belong to this account
  const { data: validItems, error: itemsError } = await supabase
    .from("items")
    .select("id, item_code, description, sidemark:sidemarks(id, sidemark_name)")
    .in("id", params.item_ids)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .is("deleted_at", null);

  if (itemsError || !validItems || validItems.length === 0) {
    return { result: { error: "No valid items found", ok: false } };
  }

  // Create draft
  const { data: draft, error: draftError } = await supabase
    .from("client_chat_repair_quote_drafts")
    .insert({
      tenant_id: scope.tenant_id,
      account_id: scope.account_id,
      subaccount_id: params.subaccount_id || null,
      created_by: scope.user_id,
      item_ids: params.item_ids,
      notes: params.notes || null,
    })
    .select("id")
    .single();

  if (draftError) {
    console.error("Create repair draft error:", draftError);
    return { result: { error: "Failed to create repair quote request draft", ok: false } };
  }

  const summary = `
**Repair Quote Request Draft Created**

Items needing repair (${validItems.length}):
${validItems.map((i: any) => `- ${i.description || i.item_code}`).join("\n")}

${params.notes ? `Description: ${params.notes}` : ""}

Would you like me to submit this repair quote request?
  `.trim();

  return {
    result: {
      ok: true,
      draft_id: draft.id,
      summary,
      item_count: validItems.length,
      needs_confirmation: true,
    },
    newSessionState: {
      pending_draft: {
        type: "repair_quote",
        draft_id: draft.id,
        summary,
      },
    },
  };
}

// Tool: Submit Repair Quote Request
async function toolSubmitRepairQuoteRequest(
  supabase: any,
  params: { draft_id: string },
  scope: ChatScope
) {
  // Get draft
  const { data: draft, error: draftError } = await supabase
    .from("client_chat_repair_quote_drafts")
    .select("*")
    .eq("id", params.draft_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .eq("status", "draft")
    .single();

  if (draftError || !draft) {
    return { result: { ok: false, error: "Draft not found or already submitted" } };
  }

  // Create a repair quote task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      tenant_id: scope.tenant_id,
      account_id: scope.account_id,
      sidemark_id: draft.subaccount_id,
      task_type: "repair_quote",
      title: `Repair Quote Request - ${draft.item_ids.length} item(s)`,
      description: draft.notes || "Customer requested repair quote via chat",
      status: "open",
      priority: "medium",
      item_ids: draft.item_ids,
      created_by: scope.user_id,
    })
    .select("id, task_number")
    .single();

  if (taskError) {
    console.error("Create task error:", taskError);
    return { result: { ok: false, error: "Failed to create repair quote request" } };
  }

  // Mark draft as confirmed
  await supabase
    .from("client_chat_repair_quote_drafts")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", params.draft_id);

  return {
    result: {
      ok: true,
      request_id: task.id,
      request_number: task.task_number,
      status: "open",
      message: `Your repair quote request ${task.task_number} has been submitted! Our team will assess the items and provide a quote.`,
    },
  };
}

// Tool: Reallocate Items Preview
async function toolReallocateItemsPreview(
  supabase: any,
  params: {
    item_ids: string[];
    from_subaccount_id: string;
    to_subaccount_id: string;
  },
  scope: ChatScope
) {
  // Validate items
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("id, item_code, description, sidemark_id")
    .in("id", params.item_ids)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .is("deleted_at", null);

  if (itemsError || !items || items.length === 0) {
    return { result: { ok: false, blockers: ["No valid items found"] } };
  }

  // Validate subaccounts
  const { data: fromSubaccount } = await supabase
    .from("sidemarks")
    .select("id, sidemark_name")
    .eq("id", params.from_subaccount_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .single();

  const { data: toSubaccount } = await supabase
    .from("sidemarks")
    .select("id, sidemark_name")
    .eq("id", params.to_subaccount_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .single();

  if (!fromSubaccount || !toSubaccount) {
    return { result: { ok: false, blockers: ["Invalid job/subaccount specified"] } };
  }

  // Check items are from the source subaccount
  const wrongSourceItems = items.filter((i: any) => i.sidemark_id !== params.from_subaccount_id);
  if (wrongSourceItems.length > 0) {
    return {
      result: {
        ok: false,
        blockers: [`Some items are not in the "${fromSubaccount.sidemark_name}" job`],
      },
    };
  }

  const summary = `
**Move Items Preview**

Moving ${items.length} item(s):
${items.map((i: any) => `- ${i.description || i.item_code}`).join("\n")}

From: ${fromSubaccount.sidemark_name}
To: ${toSubaccount.sidemark_name}

Would you like me to move these items?
  `.trim();

  return {
    result: {
      ok: true,
      blockers: [],
      summary,
      item_count: items.length,
      from_job: fromSubaccount.sidemark_name,
      to_job: toSubaccount.sidemark_name,
      needs_confirmation: true,
    },
  };
}

// Tool: Reallocate Items Execute
async function toolReallocateItemsExecute(
  supabase: any,
  params: {
    item_ids: string[];
    from_subaccount_id: string;
    to_subaccount_id: string;
  },
  scope: ChatScope
) {
  // Validate items again
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("id, sidemark_id")
    .in("id", params.item_ids)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .eq("sidemark_id", params.from_subaccount_id)
    .is("deleted_at", null);

  if (itemsError || !items || items.length === 0) {
    return { result: { ok: false, error: "Items validation failed" } };
  }

  // Validate destination subaccount
  const { data: toSubaccount } = await supabase
    .from("sidemarks")
    .select("id, sidemark_name")
    .eq("id", params.to_subaccount_id)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .single();

  if (!toSubaccount) {
    return { result: { ok: false, error: "Destination job not found" } };
  }

  // Perform the move
  const { error: updateError } = await supabase
    .from("items")
    .update({ sidemark_id: params.to_subaccount_id })
    .in("id", params.item_ids)
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id);

  if (updateError) {
    console.error("Move items error:", updateError);
    return { result: { ok: false, error: "Failed to move items" } };
  }

  return {
    result: {
      ok: true,
      moved_count: items.length,
      message: `Successfully moved ${items.length} item(s) to "${toSubaccount.sidemark_name}"!`,
    },
  };
}

// Tool: Resolve Disambiguation
async function toolResolveDisambiguation(
  params: { selections?: number[]; select_all?: boolean },
  sessionState: SessionState
): Promise<{ result: any; newSessionState?: Partial<SessionState> }> {
  const disambiguation = sessionState.pending_disambiguation;

  if (!disambiguation) {
    return {
      result: { error: "No pending selection to resolve" },
    };
  }

  let selectedIds: string[];

  if (params.select_all) {
    selectedIds = disambiguation.candidates.map((c) => c.id);
  } else if (params.selections && params.selections.length > 0) {
    selectedIds = params.selections
      .map((idx) => disambiguation.candidates.find((c) => c.index === idx))
      .filter(Boolean)
      .map((c) => c!.id);
  } else {
    return { result: { error: "No selections provided" } };
  }

  return {
    result: {
      resolved: true,
      selected_ids: selectedIds,
      selected_count: selectedIds.length,
      original_query: disambiguation.original_query,
    },
    newSessionState: {
      pending_disambiguation: undefined,
    },
  };
}

// Tool: Get Subaccounts
async function toolGetSubaccounts(supabase: any, scope: ChatScope) {
  const { data: subaccounts, error } = await supabase
    .from("sidemarks")
    .select("id, sidemark_name")
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .is("deleted_at", null)
    .order("sidemark_name");

  if (error) {
    return { result: { error: "Failed to get jobs", subaccounts: [] } };
  }

  return {
    result: {
      subaccounts: (subaccounts || []).map((s: any) => ({
        id: s.id,
        name: s.sidemark_name,
      })),
    },
  };
}

// ============================================================
// SESSION STATE MANAGEMENT
// ============================================================

async function getOrCreateSession(
  supabase: any,
  scope: ChatScope,
  uiContext: UIContext
): Promise<{ id: string; state: SessionState }> {
  // Try to get existing session
  const { data: existing } = await supabase
    .from("client_chat_sessions")
    .select("id, pending_disambiguation, pending_draft")
    .eq("tenant_id", scope.tenant_id)
    .eq("account_id", scope.account_id)
    .eq("user_id", scope.user_id)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (existing) {
    // Update with latest context
    await supabase
      .from("client_chat_sessions")
      .update({
        last_route: uiContext.route || null,
        last_selected_items: uiContext.selected_item_ids || null,
      })
      .eq("id", existing.id);

    return {
      id: existing.id,
      state: {
        pending_disambiguation: existing.pending_disambiguation,
        pending_draft: existing.pending_draft,
      },
    };
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from("client_chat_sessions")
    .insert({
      tenant_id: scope.tenant_id,
      account_id: scope.account_id,
      user_id: scope.user_id,
      last_route: uiContext.route || null,
      last_selected_items: uiContext.selected_item_ids || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Create session error:", error);
    // Return a temporary ID if creation fails
    return { id: "temp", state: {} };
  }

  return { id: newSession.id, state: {} };
}

async function updateSessionState(
  supabase: any,
  sessionId: string,
  updates: Partial<SessionState>
) {
  if (sessionId === "temp") return;

  const updateData: any = {};
  if ("pending_disambiguation" in updates) {
    updateData.pending_disambiguation = updates.pending_disambiguation || null;
  }
  if ("pending_draft" in updates) {
    updateData.pending_draft = updates.pending_draft || null;
  }

  if (Object.keys(updateData).length > 0) {
    await supabase
      .from("client_chat_sessions")
      .update(updateData)
      .eq("id", sessionId);
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message,
      tenantId,
      accountId,
      subaccountId,
      uiContext,
      conversationHistory,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract user ID from auth token if available
    const authHeader = req.headers.get("authorization");
    let userId = "anonymous";
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      } catch (e) {
        console.error("Auth error:", e);
      }
    }

    const scope: ChatScope = {
      tenant_id: tenantId,
      account_id: accountId,
      subaccount_id: subaccountId,
      user_id: userId,
    };

    const parsedUiContext: UIContext = uiContext || {};

    // Get or create session state
    const session = await getOrCreateSession(supabase, scope, parsedUiContext);

    // Build messages for AI
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Add session context to system prompt
    let contextAddition = "";
    if (session.state.pending_disambiguation) {
      contextAddition += `\n\n## Pending Selection\nThe user needs to choose from:\n${session.state.pending_disambiguation.candidates
        .map((c) => `${c.index}. ${c.label}`)
        .join("\n")}\nIf their message contains a selection (number, "all", etc.), use tool_resolve_disambiguation.`;
    }
    if (session.state.pending_draft) {
      contextAddition += `\n\n## Pending Confirmation\nThere is a ${session.state.pending_draft.type} draft awaiting confirmation (draft_id: ${session.state.pending_draft.draft_id}). If the user confirms (yes, sure, go ahead, etc.), submit it. If they decline, acknowledge and offer alternatives.`;
    }

    // First API call - potentially with tool use
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { role: "system", content: CLIENT_SYSTEM_PROMPT + contextAddition },
          ...messages,
        ],
        tools: TOOLS.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const choice = aiResponse.choices?.[0];

    if (!choice) {
      throw new Error("No response from AI");
    }

    // Check for tool calls
    const toolCalls = choice.message?.tool_calls;
    let finalContent = choice.message?.content || "";
    let sessionUpdates: Partial<SessionState> = {};

    if (toolCalls && toolCalls.length > 0) {
      const toolResults: Array<{ tool_call_id: string; content: string }> = [];

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let toolParams = {};
        try {
          toolParams = JSON.parse(toolCall.function.arguments || "{}");
        } catch (e) {
          console.error("Parse tool args error:", e);
        }

        const { result, newSessionState } = await handleTool(
          supabase,
          toolName,
          toolParams,
          scope,
          session.state
        );

        if (newSessionState) {
          sessionUpdates = { ...sessionUpdates, ...newSessionState };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Update session state
      if (Object.keys(sessionUpdates).length > 0) {
        await updateSessionState(supabase, session.id, sessionUpdates);
      }

      // Follow-up call with tool results
      const followUpMessages = [
        { role: "system", content: CLIENT_SYSTEM_PROMPT + contextAddition },
        ...messages,
        {
          role: "assistant",
          content: choice.message.content || "",
          tool_calls: toolCalls,
        },
        ...toolResults.map((tr) => ({
          role: "tool",
          tool_call_id: tr.tool_call_id,
          content: tr.content,
        })),
      ];

      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!followUpResponse.ok) {
        // Fallback to non-streamed response
        finalContent = "I found some information but had trouble formatting it. Please try again.";
      } else {
        // Stream the follow-up response
        return new Response(followUpResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // No tool calls - stream the initial response or return content
    if (choice.finish_reason === "stop" && finalContent) {
      // Convert to SSE format for consistency
      const sseData = `data: ${JSON.stringify({
        choices: [{ delta: { content: finalContent } }],
      })}\n\ndata: [DONE]\n\n`;

      return new Response(sseData, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Fallback
    return new Response(
      JSON.stringify({ content: finalContent || "I'm not sure how to help with that. Could you try rephrasing?" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("client-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

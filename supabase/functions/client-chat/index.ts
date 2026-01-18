import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, tenantId, accountId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch relevant data based on user query
    const lowerMessage = message.toLowerCase();
    let contextData = "";

    // Search items
    if (lowerMessage.includes("item") || lowerMessage.includes("inventory") || lowerMessage.includes("where")) {
      const { data: items } = await supabase
        .from("items")
        .select(`
          item_code, 
          description, 
          status, 
          quantity, 
          client_account, 
          sidemark,
          locations(code, name),
          warehouses(name)
        `)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .limit(20);
      
      if (items && items.length > 0) {
        contextData += `\n\nInventory Items:\n${JSON.stringify(items, null, 2)}`;
      }
    }

    // Search shipments
    if (lowerMessage.includes("shipment") || lowerMessage.includes("delivery") || lowerMessage.includes("arriving") || lowerMessage.includes("coming")) {
      const { data: shipments } = await supabase
        .from("shipments")
        .select(`
          shipment_number,
          shipment_type,
          status,
          carrier,
          tracking_number,
          expected_arrival_date,
          accounts(account_name),
          warehouses(name)
        `)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (shipments && shipments.length > 0) {
        contextData += `\n\nShipments:\n${JSON.stringify(shipments, null, 2)}`;
      }
    }

    // Search orders (will call orders)
    if (lowerMessage.includes("order") || lowerMessage.includes("will call") || lowerMessage.includes("pickup")) {
      const { data: orders } = await supabase
        .from("will_call_orders")
        .select(`
          order_number,
          client_name,
          status,
          scheduled_pickup_at,
          notes
        `)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (orders && orders.length > 0) {
        contextData += `\n\nWill Call Orders:\n${JSON.stringify(orders, null, 2)}`;
      }
    }

    // Search tasks
    if (lowerMessage.includes("task") || lowerMessage.includes("inspection") || lowerMessage.includes("assembly") || lowerMessage.includes("repair")) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          title,
          task_type,
          status,
          priority,
          due_date,
          accounts(account_name)
        `)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);
      
      if (tasks && tasks.length > 0) {
        contextData += `\n\nActive Tasks:\n${JSON.stringify(tasks, null, 2)}`;
      }
    }

    // If no specific context, get a summary
    if (!contextData) {
      const [itemsRes, shipmentsRes, tasksRes] = await Promise.all([
        supabase
          .from("items")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null),
        supabase
          .from("shipments")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "expected")
          .is("deleted_at", null),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .neq("status", "completed")
          .is("deleted_at", null),
      ]);

      contextData = `\n\nSummary:
- Total items in inventory: ${itemsRes.count || 0}
- Expected shipments: ${shipmentsRes.count || 0}
- Active tasks: ${tasksRes.count || 0}`;
    }

    const systemPrompt = `You are a helpful warehouse management assistant for a client portal. You help clients find information about their inventory, shipments, orders, and tasks.

You have access to the following data from the warehouse management system:
${contextData}

Guidelines:
- Be concise and helpful
- If asked about items, provide item codes, descriptions, locations, and statuses
- If asked about shipments, provide tracking info, carriers, and expected dates
- If asked about orders, provide order numbers and pickup schedules
- If the information isn't in the data provided, say so politely
- Format responses in a clear, easy-to-read way
- Use bullet points for lists
- If a specific item or shipment is mentioned by code/number, search for it in the data`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("client-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

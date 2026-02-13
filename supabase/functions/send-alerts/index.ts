import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertPayload {
  alert_id: string;
  tenant_id: string;
  alert_type: string;
  entity_type: string;
  entity_id: string;
  recipient_emails: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
}

// =============================================================================
// EMAIL VALIDATION & UTILS
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmails(emails: string[]): string[] {
  const cleaned = emails
    .map(e => (e || '').trim().toLowerCase())
    .filter(e => EMAIL_REGEX.test(e));
  return [...new Set(cleaned)];
}

function parseCommaEmails(str: string | null | undefined): string[] {
  if (!str) return [];
  return str.split(',').map(e => e.trim().toLowerCase()).filter(e => EMAIL_REGEX.test(e));
}

// =============================================================================
// RECIPIENT RESOLUTION (Hardened)
// =============================================================================

/**
 * Get manager/admin emails via direct join: user_roles → roles + users
 * This avoids the fragile nested embed that was causing empty results.
 */
async function getManagerEmails(supabase: any, tenantId: string): Promise<string[]> {
  try {
    // Step 1: Get role IDs for admin/manager/tenant_admin
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .in('name', ['admin', 'manager', 'tenant_admin'])
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (rolesError || !roles || roles.length === 0) {
      console.warn('[getManagerEmails] No admin/manager roles found for tenant:', tenantId, rolesError);
      return [];
    }

    const roleIds = roles.map((r: any) => r.id);

    // Step 2: Get user IDs with those roles
    const { data: userRoles, error: urError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role_id', roleIds)
      .is('deleted_at', null);

    if (urError || !userRoles || userRoles.length === 0) {
      console.warn('[getManagerEmails] No user_roles found for roles:', roleIds, urError);
      return [];
    }

    const userIds = [...new Set(userRoles.map((ur: any) => ur.user_id))];

    // Step 3: Get emails for those users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email')
      .in('id', userIds)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (usersError || !users) {
      console.warn('[getManagerEmails] Failed to fetch user emails:', usersError);
      return [];
    }

    const emails = users.map((u: any) => u.email).filter(Boolean);
    console.log(`[getManagerEmails] Found ${emails.length} manager/admin emails for tenant ${tenantId}`);
    return cleanEmails(emails);
  } catch (err) {
    console.error('[getManagerEmails] Unexpected error:', err);
    return [];
  }
}

/**
 * Get office_alert_emails from tenant_company_settings (comma-separated field)
 */
async function getOfficeAlertEmails(supabase: any, tenantId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('tenant_company_settings')
      .select('office_alert_emails')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) return [];
    return parseCommaEmails(data.office_alert_emails);
  } catch {
    return [];
  }
}

/**
 * Get per-alert send_to override from communication_alerts (if configured)
 */
async function getAlertSendToEmails(supabase: any, tenantId: string, alertType: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('communication_alerts')
      .select('channels')
      .eq('tenant_id', tenantId)
      .eq('trigger_event', alertType)
      .eq('is_enabled', true)
      .maybeSingle();

    if (error || !data) return [];

    // Check for send_to_emails inside channels JSON
    const channels = data.channels;
    if (channels && channels.send_to_emails) {
      if (typeof channels.send_to_emails === 'string') {
        return parseCommaEmails(channels.send_to_emails);
      }
      if (Array.isArray(channels.send_to_emails)) {
        return cleanEmails(channels.send_to_emails);
      }
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Resolve recipients with deterministic precedence:
 * 1) alert_queue.recipient_emails (explicit per-alert)
 * 2) communication_alerts.channels.send_to_emails (per-trigger override)
 * 3) tenant_company_settings.office_alert_emails (tenant-wide fallback)
 * 4) getManagerEmails() (role-based fallback)
 */
async function resolveRecipients(
  supabase: any,
  tenantId: string,
  alertType: string,
  queueRecipients: string[] | null
): Promise<{ emails: string[]; source: string }> {
  // 1) Explicit recipients from alert_queue
  if (queueRecipients && queueRecipients.length > 0) {
    const cleaned = cleanEmails(queueRecipients);
    if (cleaned.length > 0) {
      return { emails: cleaned, source: 'alert_queue.recipient_emails' };
    }
  }

  // 2) Per-alert send_to override from communication_alerts
  const alertSendTo = await getAlertSendToEmails(supabase, tenantId, alertType);
  if (alertSendTo.length > 0) {
    return { emails: alertSendTo, source: 'communication_alerts.send_to_emails' };
  }

  // 3) Tenant office_alert_emails setting
  const officeEmails = await getOfficeAlertEmails(supabase, tenantId);
  if (officeEmails.length > 0) {
    return { emails: officeEmails, source: 'tenant_company_settings.office_alert_emails' };
  }

  // 4) Manager/admin role-based fallback
  const managerEmails = await getManagerEmails(supabase, tenantId);
  if (managerEmails.length > 0) {
    return { emails: managerEmails, source: 'getManagerEmails (role-based)' };
  }

  return { emails: [], source: 'none' };
}

// =============================================================================
// CATALOG AUDIENCE LOOKUP
// =============================================================================

type Audience = 'internal' | 'client' | 'both';

async function getCatalogAudience(
  supabase: any,
  triggerEvent: string
): Promise<Audience> {
  try {
    const { data, error } = await supabase
      .from('communication_trigger_catalog')
      .select('audience')
      .eq('key', triggerEvent)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      // If trigger not in catalog, default to internal (safe default)
      return 'internal';
    }

    const audience = data.audience as string;
    if (audience === 'client' || audience === 'both') {
      return audience;
    }
    return 'internal';
  } catch {
    return 'internal';
  }
}

// =============================================================================
// ENTITY → ACCOUNT CONTEXT RESOLUTION
// =============================================================================

interface AccountContext {
  accountId: string;
  accountName: string;
}

async function getAccountContext(
  supabase: any,
  entityType: string,
  entityId: string,
  tenantId: string
): Promise<AccountContext | null> {
  try {
    // Map entity_type to table + join path
    const entityTableMap: Record<string, { table: string; accountJoin?: boolean }> = {
      shipment: { table: 'shipments', accountJoin: true },
      item: { table: 'items', accountJoin: true },
      task: { table: 'tasks', accountJoin: true },
      invoice: { table: 'invoices', accountJoin: true },
      release: { table: 'releases', accountJoin: true },
      claim: { table: 'claims', accountJoin: true },
      repair_quote: { table: 'repair_quotes', accountJoin: true },
      billing_event: { table: 'billing_events', accountJoin: true },
    };

    const mapping = entityTableMap[entityType];
    if (!mapping) {
      console.log(`[getAccountContext] NO_ACCOUNT_CONTEXT: unknown entity_type "${entityType}"`);
      return null;
    }

    const { data, error } = await supabase
      .from(mapping.table)
      .select('account_id, account:accounts(id, account_name)')
      .eq('id', entityId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !data) {
      console.log(`[getAccountContext] NO_ACCOUNT_CONTEXT: entity ${entityType}/${entityId} not found or no tenant match`);
      return null;
    }

    if (!data.account_id) {
      console.log(`[getAccountContext] NO_ACCOUNT_CONTEXT: entity ${entityType}/${entityId} has no account_id`);
      return null;
    }

    const accountName = data.account?.account_name || '';
    return {
      accountId: data.account_id,
      accountName,
    };
  } catch (err) {
    console.error(`[getAccountContext] NO_ACCOUNT_CONTEXT: unexpected error for ${entityType}/${entityId}:`, err);
    return null;
  }
}

// =============================================================================
// CLIENT RECIPIENT RESOLUTION
// =============================================================================

async function resolveClientRecipients(
  supabase: any,
  tenantId: string,
  triggerEvent: string,
  accountId: string,
  accountName: string
): Promise<{ emails: string[]; source: string }> {
  // Priority 1: alert_recipients → alert_types → client_contacts
  try {
    // Find alert_type by key matching triggerEvent
    const { data: alertType } = await supabase
      .from('alert_types')
      .select('id')
      .eq('key', triggerEvent)
      .maybeSingle();

    if (alertType) {
      // Find alert_recipients for this alert_type and tenant
      const { data: recipients } = await supabase
        .from('alert_recipients')
        .select('client_contact_id, email, recipient_type')
        .eq('alert_type_id', alertType.id)
        .eq('tenant_id', tenantId);

      if (recipients && recipients.length > 0) {
        const directEmails: string[] = [];
        const contactIds: string[] = [];

        for (const r of recipients) {
          if (r.email) {
            directEmails.push(r.email);
          }
          if (r.client_contact_id) {
            contactIds.push(r.client_contact_id);
          }
        }

        // Fetch client_contacts filtered by account_name
        if (contactIds.length > 0) {
          const { data: contacts } = await supabase
            .from('client_contacts')
            .select('email')
            .in('id', contactIds)
            .eq('tenant_id', tenantId)
            .eq('account_name', accountName)
            .eq('is_active', true);

          if (contacts) {
            for (const c of contacts) {
              if (c.email) directEmails.push(c.email);
            }
          }
        }

        const cleaned = cleanEmails(directEmails);
        if (cleaned.length > 0) {
          return { emails: cleaned, source: 'alert_recipients + client_contacts' };
        }
      }
    }
  } catch (err) {
    // alert_types or alert_recipients table may not exist; fall through gracefully
    console.warn('[resolveClientRecipients] alert_recipients lookup failed (table may not exist):', err);
  }

  // Priority 2: accounts.alerts_contact_email fallback
  try {
    const { data: account } = await supabase
      .from('accounts')
      .select('alerts_contact_email, account_alert_recipients')
      .eq('id', accountId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (account) {
      const emails: string[] = [];

      // alerts_contact_email (single email or comma-separated)
      if (account.alerts_contact_email) {
        emails.push(...parseCommaEmails(account.alerts_contact_email));
      }

      // account_alert_recipients (comma-separated additional recipients)
      if (account.account_alert_recipients) {
        emails.push(...parseCommaEmails(account.account_alert_recipients));
      }

      const cleaned = cleanEmails(emails);
      if (cleaned.length > 0) {
        return { emails: cleaned, source: 'accounts.alerts_contact_email' };
      }
    }
  } catch (err) {
    console.warn('[resolveClientRecipients] accounts fallback failed:', err);
  }

  console.log(`[resolveClientRecipients] NO_CLIENT_RECIPIENTS: no client recipients found for trigger="${triggerEvent}" account="${accountName}" (${accountId})`);
  return { emails: [], source: 'none' };
}

// =============================================================================
// ENTITY DATA & TEMPLATES (unchanged logic, extracted for clarity)
// =============================================================================

async function getAccountContactEmail(supabase: any, accountId: string): Promise<string | null> {
  const { data } = await supabase
    .from('accounts')
    .select('primary_contact_email, alerts_contact_email')
    .eq('id', accountId)
    .single();
  
  return data?.alerts_contact_email || data?.primary_contact_email || null;
}

async function getTenantBranding(supabase: any, tenantId: string): Promise<{
  logoUrl: string | null;
  companyName: string | null;
  supportEmail: string | null;
  portalBaseUrl: string | null;
  primaryColor: string;
  termsUrl: string | null;
  privacyUrl: string | null;
  companyAddress: string | null;
}> {
  try {
    const { data: brandSettings } = await supabase
      .from('communication_brand_settings')
      .select('brand_logo_url, brand_primary_color, brand_support_email, portal_base_url')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from('tenant_company_settings')
      .select('logo_url, company_name, company_address, terms_url, privacy_url')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    return {
      logoUrl: brandSettings?.brand_logo_url || settings?.logo_url || null,
      companyName: settings?.company_name || tenant?.name || 'Warehouse System',
      supportEmail: brandSettings?.brand_support_email || null,
      portalBaseUrl: brandSettings?.portal_base_url || null,
      primaryColor: brandSettings?.brand_primary_color || '#FD5A2A',
      termsUrl: settings?.terms_url || null,
      privacyUrl: settings?.privacy_url || null,
      companyAddress: settings?.company_address || null,
    };
  } catch {
    return { logoUrl: null, companyName: 'Warehouse System', supportEmail: null, portalBaseUrl: null, primaryColor: '#FD5A2A', termsUrl: null, privacyUrl: null, companyAddress: null };
  }
}

// Replace {{variable}}, [[variable]], and {variable} syntax
// Single-brace {variable} is matched ONLY when not preceded by another { (avoids clobbering {{)
function replaceTemplateVariables(html: string, variables: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = value || '';
    // Double braces first
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue);
    // Square brackets
    result = result.replace(new RegExp(`\\[\\[${key}\\]\\]`, 'g'), safeValue);
    // Single braces (negative lookbehind for { and lookahead for })
    result = result.replace(new RegExp(`(?<!\\{)\\{${key}\\}(?!\\})`, 'g'), safeValue);
  }
  return result;
}

async function generateItemsTableHtml(supabase: any, itemIds: string[]): Promise<string> {
  if (!itemIds || itemIds.length === 0) return '<p style="color:#6b7280;font-size:14px;text-align:center;">No items</p>';
  
  const { data: items } = await supabase
    .from('items')
    .select('item_code, description, vendor, current_location')
    .in('id', itemIds);
  
  if (!items || items.length === 0) return '<p style="color:#6b7280;font-size:14px;text-align:center;">No items found</p>';
  
  const rows = items.map((item: any, index: number) => `
    <tr style="background-color:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111111;">${item.item_code || 'N/A'}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#374151;">${item.description || 'N/A'}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.vendor || 'N/A'}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.current_location || 'N/A'}</td>
    </tr>
  `).join('');
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background-color:#111111;">
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Item ID</th>
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Description</th>
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Vendor</th>
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Location</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

async function generateItemsListText(supabase: any, itemIds: string[]): Promise<string> {
  if (!itemIds || itemIds.length === 0) return 'No items';
  
  const { data: items } = await supabase
    .from('items')
    .select('item_code, description')
    .in('id', itemIds);
  
  if (!items || items.length === 0) return 'No items found';
  
  return items.map((item: any) => `• ${item.item_code}: ${item.description || 'N/A'}`).join('\n');
}

// ── INSPECTION FINDINGS TABLE ──
async function generateInspectionFindingsTableHtml(supabase: any, itemIds: string[]): Promise<string> {
  if (!itemIds || itemIds.length === 0) return '<p style="color:#6b7280;font-size:14px;">No inspection details available.</p>';

  const { data: items } = await supabase
    .from('items')
    .select('item_code, description, inspection_status, inspection_photos')
    .in('id', itemIds);

  if (!items || items.length === 0) return '<p style="color:#6b7280;font-size:14px;">No inspection details available.</p>';

  const rows = items.map((item: any, index: number) => {
    const photosCount = Array.isArray(item.inspection_photos) ? item.inspection_photos.length : 0;
    return `
    <tr style="background-color:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111827;">${item.item_code || 'N/A'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">${item.description || 'N/A'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.inspection_status || 'Pending'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;text-align:center;">${photosCount}</td>
    </tr>`;
  }).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background-color:#111827;">
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Item</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Description</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Condition</th>
          <th style="padding:10px 14px;text-align:center;font-weight:600;color:#ffffff;font-size:13px;">Photos</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── TASK SERVICES TABLE ──
async function generateTaskServicesTableHtml(supabase: any, taskId: string): Promise<string> {
  if (!taskId) return '<p style="color:#6b7280;font-size:14px;">No services details available.</p>';

  const { data: lines } = await supabase
    .from('task_addon_lines')
    .select('description, quantity, unit_rate, total_amount')
    .eq('task_id', taskId);

  if (!lines || lines.length === 0) return '<p style="color:#6b7280;font-size:14px;">No services details available.</p>';

  const rows = lines.map((line: any, index: number) => `
    <tr style="background-color:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;">${line.description || 'Service'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:center;">${line.quantity ?? 1}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">$${Number(line.unit_rate || 0).toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;text-align:right;">$${Number(line.total_amount || 0).toFixed(2)}</td>
    </tr>`).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background-color:#111827;">
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Service</th>
          <th style="padding:10px 14px;text-align:center;font-weight:600;color:#ffffff;font-size:13px;">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-weight:600;color:#ffffff;font-size:13px;">Rate</th>
          <th style="padding:10px 14px;text-align:right;font-weight:600;color:#ffffff;font-size:13px;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── REPAIR ACTIONS TABLE ──
async function generateRepairActionsTableHtml(supabase: any, entityId: string, entityType: string): Promise<string> {
  // entityId could be a repair_quote id or an item id
  let quoteId = entityId;

  if (entityType === 'item') {
    // Find the most recent repair quote for this item
    const { data: quote } = await supabase
      .from('repair_quotes')
      .select('id')
      .eq('item_id', entityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (quote) quoteId = quote.id;
    else return '<p style="color:#6b7280;font-size:14px;">No repair details available.</p>';
  }

  const { data: items } = await supabase
    .from('repair_quote_items')
    .select('item_code, item_description, damage_description, allocated_customer_amount, notes_public')
    .eq('repair_quote_id', quoteId);

  if (!items || items.length === 0) {
    // Fallback: show quote-level data
    const { data: quote } = await supabase
      .from('repair_quotes')
      .select('tech_notes, customer_total, tech_labor_hours, tech_materials_cost')
      .eq('id', quoteId)
      .maybeSingle();

    if (!quote) return '<p style="color:#6b7280;font-size:14px;">No repair details available.</p>';

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background-color:#111827;">
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Description</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#ffffff;font-size:13px;">Labor Hrs</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#ffffff;font-size:13px;">Materials</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#ffffff;font-size:13px;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;">${quote.tech_notes || 'Repair work'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">${quote.tech_labor_hours ?? '—'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">${quote.tech_materials_cost != null ? '$' + Number(quote.tech_materials_cost).toFixed(2) : '—'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;text-align:right;">${quote.customer_total != null ? '$' + Number(quote.customer_total).toFixed(2) : '—'}</td>
          </tr>
        </tbody>
      </table>`;
  }

  const rows = items.map((item: any, index: number) => `
    <tr style="background-color:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;">${item.damage_description || item.item_description || 'Repair'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">${item.item_code || 'N/A'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">${item.notes_public || '—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;text-align:right;">${item.allocated_customer_amount != null ? '$' + Number(item.allocated_customer_amount).toFixed(2) : '—'}</td>
    </tr>`).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background-color:#111827;">
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Action</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Item</th>
          <th style="padding:10px 14px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;">Notes</th>
          <th style="padding:10px 14px;text-align:right;font-weight:600;color:#ffffff;font-size:13px;">Estimate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function buildTemplateVariables(
  supabase: any,
  alertType: string,
  entityType: string,
  entityId: string,
  tenantId: string
): Promise<{ variables: Record<string, string>; itemIds: string[] }> {
  const branding = await getTenantBranding(supabase, tenantId);

  // Fetch office_alert_emails for template tokens
  const officeAlertEmailsList = await getOfficeAlertEmails(supabase, tenantId);
  const officeAlertEmailsStr = officeAlertEmailsList.join(', ');
  const officeAlertEmailPrimary = officeAlertEmailsList.length > 0 ? officeAlertEmailsList[0] : '';

  const portalBase = branding.portalBaseUrl || '';

  const variables: Record<string, string> = {
    // ── Branding tokens ──
    tenant_name: branding.companyName || 'Warehouse System',
    brand_logo_url: branding.logoUrl || '',
    brand_primary_color: branding.primaryColor || '#FD5A2A',
    brand_support_email: branding.supportEmail || 'support@example.com',
    brand_terms_url: branding.termsUrl || '',
    brand_privacy_url: branding.privacyUrl || '',
    tenant_company_address: branding.companyAddress || '',
    portal_base_url: portalBase,
    // Aliases used by some v4 templates
    tenant_terms_url: branding.termsUrl || '',
    tenant_privacy_url: branding.privacyUrl || '',
    // ── Office tokens ──
    office_alert_emails: officeAlertEmailsStr,
    office_alert_email_primary: officeAlertEmailPrimary,
    // ── Portal deep-link tokens (defaults; overridden per entity below) ──
    shipment_link: '',
    portal_invoice_url: '',
    portal_claim_url: '',
    portal_release_url: '',
    portal_quote_url: '',
    portal_account_url: '',
    portal_settings_url: portalBase ? `${portalBase}/settings/organization/contact` : '',
    portal_inspection_url: '',
    portal_repair_url: '',
    // ── General ──
    created_at: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
  };

  let itemIds: string[] = [];

  try {
    if (entityType === 'shipment') {
      const { data: shipment } = await supabase
        .from('shipments')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (shipment) {
        variables.shipment_number = shipment.shipment_number || entityId;
        variables.shipment_status = shipment.status || 'Unknown';
        variables.shipment_vendor = shipment.vendor || 'N/A';
        variables.scheduled_date = shipment.scheduled_date
          ? new Date(shipment.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        variables.delivery_window = shipment.delivery_window || '';
        variables.delay_reason = shipment.delay_reason || '';
        variables.delivered_at = shipment.delivered_at
          ? new Date(shipment.delivered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '';
        variables.account_name = shipment.account?.account_name || 'N/A';
        variables.account_contact_name = shipment.account?.primary_contact_name || 'Customer';
        variables.account_contact_email = shipment.account?.primary_contact_email || '';
        variables.shipment_link = portalBase ? `${portalBase}/shipments/${entityId}` : '';
        if (shipment.account_id) {
          variables.portal_account_url = portalBase ? `${portalBase}/accounts/${shipment.account_id}` : '';
        }

        const { data: shipmentItems } = await supabase
          .from('items')
          .select('id')
          .eq('receiving_shipment_id', entityId);

        if (shipmentItems) {
          itemIds = shipmentItems.map((i: any) => i.id);
          variables.items_count = String(itemIds.length);
        } else {
          variables.items_count = '0';
        }
      }
    } else if (entityType === 'item') {
      const { data: item } = await supabase
        .from('items')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (item) {
        variables.item_code = item.item_code || entityId;
        variables.item_id = item.item_code || entityId;
        variables.item_description = item.description || 'N/A';
        variables.item_location = item.current_location || 'Unknown';
        variables.item_sidemark = item.sidemark || '';
        variables.item_vendor = item.vendor || '';
        variables.account_name = item.account?.account_name || item.client_account || 'N/A';
        variables.account_contact_name = item.account?.primary_contact_name || 'Customer';
        variables.item_photos_link = portalBase ? `${portalBase}/inventory/${entityId}` : '';
        variables.items_count = '1';
        itemIds = [entityId];

        // Repair-specific tokens (for repair_started, repair_completed, repair_requires_approval)
        if (alertType.startsWith('repair')) {
          variables.repair_type = item.repair_type || '';
          variables.repair_completed_at = item.repair_completed_at
            ? new Date(item.repair_completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
            : '';
          // Fetch repair quote for estimate amount
          const { data: repairQuote } = await supabase
            .from('repair_quotes')
            .select('id, customer_total, status')
            .eq('item_id', entityId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (repairQuote) {
            variables.repair_estimate_amount = repairQuote.customer_total != null
              ? `$${Number(repairQuote.customer_total).toFixed(2)}`
              : '';
            variables.portal_repair_url = portalBase ? `${portalBase}/repairs/${repairQuote.id}` : '';
          }
        }
      }
    } else if (entityType === 'task') {
      const { data: task } = await supabase
        .from('tasks')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email),
          assigned_user:users!tasks_assigned_to_fkey(first_name, last_name, email),
          completed_by_user:users!tasks_completed_by_fkey(first_name, last_name)
        `)
        .eq('id', entityId)
        .single();

      if (task) {
        variables.task_type = task.task_type || 'Task';
        variables.task_title = task.title || 'Untitled Task';
        variables.task_number = task.task_number || entityId;
        variables.task_status = task.status || 'Unknown';
        variables.task_due_date = task.due_date
          ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'No due date';
        variables.account_name = task.account?.account_name || 'N/A';
        variables.account_contact_name = task.account?.primary_contact_name || 'Customer';
        variables.task_link = portalBase ? `${portalBase}/tasks` : '';

        if (task.assigned_user) {
          variables.assigned_to_name = `${task.assigned_user.first_name || ''} ${task.assigned_user.last_name || ''}`.trim() || 'Unassigned';
        }

        if (task.completed_by_user) {
          variables.completed_by_name = `${task.completed_by_user.first_name || ''} ${task.completed_by_user.last_name || ''}`.trim() || 'Someone';
          variables.created_by_name = variables.completed_by_name;
        } else {
          variables.completed_by_name = 'Someone';
          variables.created_by_name = 'Someone';
        }

        // task_days_overdue: works for both legacy task.overdue and v4 task_overdue
        if ((alertType === 'task.overdue' || alertType === 'task_overdue') && task.due_date) {
          const dueDate = new Date(task.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - dueDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          variables.task_days_overdue = String(Math.max(0, diffDays));
        }

        // Inspection tokens (inspection is a task type)
        if (alertType.startsWith('inspection')) {
          variables.inspection_number = task.task_number || task.title || entityId;
          variables.portal_inspection_url = portalBase ? `${portalBase}/tasks` : '';
          // Count items with issues
          const { data: taskItemsInsp } = await supabase
            .from('task_items')
            .select('item_id')
            .eq('task_id', entityId);
          if (taskItemsInsp) {
            const inspItemIds = taskItemsInsp.map((ti: any) => ti.item_id);
            const { data: issueItems } = await supabase
              .from('items')
              .select('id, inspection_status')
              .in('id', inspItemIds)
              .neq('inspection_status', 'good');
            variables.inspection_issues_count = String(issueItems?.length || 0);
            variables.inspection_result = (issueItems?.length || 0) > 0 ? 'Issues found' : 'All clear';
          }
          // Shipment number for inspection context
          if (task.shipment_id) {
            const { data: shipment } = await supabase
              .from('shipments')
              .select('shipment_number')
              .eq('id', task.shipment_id)
              .maybeSingle();
            if (shipment) variables.shipment_number = shipment.shipment_number;
          }
        }

        if (task.account_id) {
          variables.portal_account_url = portalBase ? `${portalBase}/accounts/${task.account_id}` : '';
        }

        const { data: taskItems } = await supabase
          .from('task_items')
          .select('item_id')
          .eq('task_id', entityId);

        if (taskItems) {
          itemIds = taskItems.map((ti: any) => ti.item_id);
          variables.items_count = String(itemIds.length);
        } else {
          variables.items_count = '0';
        }
      }
    } else if (entityType === 'invoice') {
      const { data: invoice } = await supabase
        .from('invoices')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (invoice) {
        variables.invoice_number = invoice.invoice_number || entityId;
        variables.amount_due = invoice.total_amount
          ? `$${Number(invoice.total_amount).toFixed(2)}`
          : '$0.00';
        variables.account_name = invoice.account?.account_name || 'N/A';
        variables.account_contact_name = invoice.account?.primary_contact_name || 'Customer';
        variables.account_contact_email = invoice.account?.primary_contact_email || '';
        variables.items_count = '0';
      }
    } else if (entityType === 'billing_event') {
      const { data: billingEvent } = await supabase
        .from('billing_events')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name),
          item:items(item_code, description),
          created_by_user:users!billing_events_created_by_fkey(first_name, last_name)
        `)
        .eq('id', entityId)
        .single();

      if (billingEvent) {
        variables.service_name = billingEvent.charge_type || 'Service';
        variables.service_code = billingEvent.charge_type || '';
        variables.service_amount = billingEvent.total_amount
          ? `$${Number(billingEvent.total_amount).toFixed(2)}`
          : '$0.00';
        variables.billing_description = billingEvent.description || '';
        variables.account_name = billingEvent.account?.account_name || 'N/A';
        variables.account_contact_name = billingEvent.account?.primary_contact_name || 'Customer';
        variables.item_code = billingEvent.item?.item_code || 'N/A';
        variables.item_id = billingEvent.item?.item_code || 'N/A';
        variables.item_description = billingEvent.item?.description || 'N/A';
        variables.items_count = '1';

        if (billingEvent.created_by_user) {
          const firstName = billingEvent.created_by_user.first_name || '';
          const lastName = billingEvent.created_by_user.last_name || '';
          variables.user_name = `${firstName} ${lastName}`.trim() || 'System';
          variables.created_by_name = variables.user_name;
        } else {
          variables.user_name = 'System';
          variables.created_by_name = 'System';
        }

        if (billingEvent.item_id) {
          itemIds = [billingEvent.item_id];
        }
      }
    } else if (entityType === 'release') {
      const { data: release } = await supabase
        .from('releases')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (release) {
        variables.release_number = release.release_number || entityId;
        variables.release_type = release.release_type || 'Will Call';
        variables.release_completed_at = release.completed_at
          ? new Date(release.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '';
        variables.released_at = variables.release_completed_at;
        variables.pickup_hours = release.pickup_hours || '';
        variables.account_name = release.account?.account_name || 'N/A';
        variables.account_contact_name = release.account?.primary_contact_name || 'Customer';
        variables.portal_release_url = portalBase ? `${portalBase}/releases/${entityId}` : '';

        const { data: releaseItems } = await supabase
          .from('release_items')
          .select('item_id')
          .eq('release_id', entityId);

        if (releaseItems) {
          itemIds = releaseItems.map((ri: any) => ri.item_id);
          variables.items_count = String(itemIds.length);
        } else {
          variables.items_count = '0';
        }
      }
    } else if (entityType === 'repair_quote') {
      const { data: quote } = await supabase
        .from('repair_quotes')
        .select(`
          *,
          item:items(item_code, description, client_account),
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (quote) {
        variables.item_code = quote.item?.item_code || '';
        variables.item_description = quote.item?.description || '';
        variables.account_name = quote.account?.account_name || quote.item?.client_account || 'N/A';
        variables.repair_estimate_amount = quote.customer_total != null
          ? `$${Number(quote.customer_total).toFixed(2)}`
          : '';
        variables.repair_type = quote.repair_type || '';
        variables.repair_completed_at = quote.completed_at
          ? new Date(quote.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '';
        variables.portal_repair_url = portalBase ? `${portalBase}/repairs/${entityId}` : '';
        variables.item_photos_link = portalBase && quote.item_id ? `${portalBase}/inventory/${quote.item_id}` : '';
        if (quote.item_id) itemIds = [quote.item_id];
        variables.items_count = itemIds.length > 0 ? '1' : '0';
      }
    }
  } catch (error) {
    console.error('Error building template variables:', error);
  }

  return { variables, itemIds };
}

async function getTemplateForAlert(
  supabase: any,
  alertType: string,
  tenantId: string,
  channel: 'email' | 'sms' = 'email'
): Promise<{ subjectTemplate: string; bodyTemplate: string } | null> {
  try {
    const { data: alert } = await supabase
      .from('communication_alerts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('trigger_event', alertType)
      .eq('is_enabled', true)
      .maybeSingle();

    if (alert) {
      const { data: template } = await supabase
        .from('communication_templates')
        .select('subject_template, body_template')
        .eq('alert_id', alert.id)
        .eq('channel', channel)
        .maybeSingle();

      if (template) {
        return {
          subjectTemplate: template.subject_template || '',
          bodyTemplate: template.body_template || '',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching template:', error);
    return null;
  }
}

// Legacy email content generation
async function generateEmailContent(
  alertType: string, 
  entityType: string,
  entityId: string,
  supabase: any
): Promise<{ subject: string; html: string; text: string }> {
  let subject = '';
  let html = '';
  let text = '';

  switch (alertType) {
    case 'damage_photo': {
      const { data: item } = await supabase
        .from('items')
        .select('item_code, description, client_account')
        .eq('id', entityId)
        .single();

      subject = `⚠️ Damage Photo Flagged - ${item?.item_code || 'Item'}`;
      text = `A photo has been flagged as needing attention for item ${item?.item_code || entityId}.`;
      html = `
        <h2 style="color: #dc2626;">⚠️ Damage Photo Flagged</h2>
        <p>A photo has been flagged as needing attention.</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Item Code:</td><td style="padding: 8px;">${item?.item_code || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${item?.description || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${item?.client_account || 'N/A'}</td></tr>
        </table>
        <p>Please review this item in the system.</p>
      `;
      break;
    }

    case 'unable_to_complete': {
      const { data: task } = await supabase
        .from('tasks')
        .select('title, task_type, unable_to_complete_note, assigned_user:users!tasks_assigned_to_fkey(first_name, last_name)')
        .eq('id', entityId)
        .single();

      subject = `❌ Task Unable to Complete - ${task?.title || 'Task'}`;
      const assignedTo = task?.assigned_user 
        ? `${task.assigned_user.first_name} ${task.assigned_user.last_name}`
        : 'Unassigned';
      text = `A task has been marked as unable to complete.\n\nTask: ${task?.title}\nType: ${task?.task_type}\nAssigned To: ${assignedTo}\n\nReason: ${task?.unable_to_complete_note || 'No reason provided'}`;
      html = `
        <h2 style="color: #dc2626;">❌ Task Unable to Complete</h2>
        <p>A task has been marked as unable to complete and requires review.</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Task:</td><td style="padding: 8px;">${task?.title || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Type:</td><td style="padding: 8px;">${task?.task_type || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Assigned To:</td><td style="padding: 8px;">${assignedTo}</td></tr>
        </table>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0;">
          <strong>Reason:</strong><br/>
          ${task?.unable_to_complete_note || 'No reason provided'}
        </div>
        <p>Please review and take appropriate action.</p>
      `;
      break;
    }

    case 'repair_quote_approved': {
      const { data: item } = await supabase
        .from('items')
        .select('item_code, description, client_account')
        .eq('id', entityId)
        .single();

      subject = `✅ Repair Quote Approved - ${item?.item_code || 'Item'}`;
      text = `A repair quote has been approved for item ${item?.item_code}.`;
      html = `
        <h2 style="color: #16a34a;">✅ Repair Quote Approved</h2>
        <p>A repair quote has been approved for the following item:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Item Code:</td><td style="padding: 8px;">${item?.item_code || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${item?.description || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${item?.client_account || 'N/A'}</td></tr>
        </table>
        <p>A repair task has been automatically created and added to the queue.</p>
      `;
      break;
    }

    case 'repair_quote_pending': {
      const { data: item } = await supabase
        .from('items')
        .select('item_code, description, client_account')
        .eq('id', entityId)
        .single();

      const { data: quote } = await supabase
        .from('repair_quotes')
        .select('flat_rate, notes')
        .eq('item_id', entityId)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      subject = `🔧 New Repair Quote Pending - ${item?.item_code || 'Item'}`;
      text = `A new repair quote is pending approval.\n\nItem: ${item?.item_code}\nAmount: $${quote?.flat_rate?.toFixed(2) || '0.00'}`;
      html = `
        <h2 style="color: #f59e0b;">🔧 Repair Quote Pending Approval</h2>
        <p>A new repair quote requires your approval:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Item Code:</td><td style="padding: 8px;">${item?.item_code || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${item?.description || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${item?.client_account || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Quote Amount:</td><td style="padding: 8px; font-size: 1.2em; color: #16a34a;"><strong>$${quote?.flat_rate?.toFixed(2) || '0.00'}</strong></td></tr>
        </table>
        ${quote?.notes ? `<p><strong>Notes:</strong> ${quote.notes}</p>` : ''}
        <p>Please log in to review and approve or decline this quote.</p>
      `;
      break;
    }

    default:
      subject = `Alert: ${alertType}`;
      text = `An alert of type ${alertType} was triggered for ${entityType} ${entityId}.`;
      html = `<p>An alert of type <strong>${alertType}</strong> was triggered for ${entityType} ${entityId}.</p>`;
  }

  return { subject, html, text };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional JSON body
    let bodyFilter: { 
      tenant_id?: string; 
      alert_queue_id?: string; 
      limit?: number;
      test_send?: boolean;
      test_email?: string;
    } = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        bodyFilter = JSON.parse(bodyText);
      }
    } catch {
      // No body or invalid JSON
    }

    // =========================================================================
    // TEST SEND PATH
    // =========================================================================
    if (bodyFilter.test_send === true) {
      const testEmail = bodyFilter.test_email;
      if (!testEmail || !EMAIL_REGEX.test(testEmail)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Valid test_email is required for test_send' 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'RESEND_API_KEY not configured' 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { Resend } = await import("https://esm.sh/resend@2.0.0");
        const resend = new Resend(resendApiKey);

        // Determine from address
        let fromEmail = 'alerts@resend.dev';
        let fromName = 'Stride WMS Test';

        if (bodyFilter.tenant_id) {
          const { data: brandSettings } = await supabase
            .from('communication_brand_settings')
            .select('from_email, from_name, email_domain_verified')
            .eq('tenant_id', bodyFilter.tenant_id)
            .maybeSingle();

          if (brandSettings?.email_domain_verified && brandSettings?.from_email) {
            fromEmail = brandSettings.from_email;
            fromName = brandSettings.from_name || 'Stride WMS';
          }

          // Also test recipient resolution
          const recipientResult = await resolveRecipients(
            supabase, bodyFilter.tenant_id, 'test', null
          );
          console.log(`[test_send] Recipient resolution for tenant ${bodyFilter.tenant_id}:`, recipientResult);
        }

        const { data: sendResult, error: sendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [testEmail],
          subject: '✅ Stride WMS - Email Test Successful',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #16a34a;">✅ Email Test Successful</h1>
              <p>This is a test email from Stride WMS to verify your email configuration is working correctly.</p>
              <table style="border-collapse: collapse; margin: 20px 0; width: 100%;">
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">From:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fromName} &lt;${fromEmail}&gt;</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">To:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${testEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Sent At:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date().toISOString()}</td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 14px;">If you received this email, your email alert system is configured correctly.</p>
            </div>
          `,
          text: `Email Test Successful\n\nThis is a test email from Stride WMS.\nFrom: ${fromName} <${fromEmail}>\nTo: ${testEmail}\nSent: ${new Date().toISOString()}`,
        });

        if (sendError) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: sendError.message || 'Send failed',
            details: sendError,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Test email sent to ${testEmail}`,
          from: `${fromName} <${fromEmail}>`,
          resend_id: sendResult?.id,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (testErr: any) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: testErr.message || 'Unknown test error',
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // =========================================================================
    // NORMAL ALERT PROCESSING
    // =========================================================================

    const queryLimit = bodyFilter.limit || 50;

    let query = supabase
      .from('alert_queue')
      .select('*')
      .eq('status', 'pending');

    if (bodyFilter.tenant_id) {
      query = query.eq('tenant_id', bodyFilter.tenant_id);
    }
    if (bodyFilter.alert_queue_id) {
      query = query.eq('id', bodyFilter.alert_queue_id);
    }

    const { data: pendingAlerts, error: fetchError } = await query.limit(queryLimit);

    if (fetchError) throw fetchError;

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return new Response(JSON.stringify({ message: "No pending alerts", processed: 0, sent: 0, failed: 0, skipped: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured. Add RESEND_API_KEY secret." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const alert of pendingAlerts) {
      try {
        // Check communication_alerts enable/disable for this alert type
        const { data: commAlert } = await supabase
          .from('communication_alerts')
          .select('is_enabled, channels')
          .eq('tenant_id', alert.tenant_id)
          .eq('trigger_event', alert.alert_type)
          .maybeSingle();

        // If disabled or email channel is off, skip
        if (commAlert) {
          const emailEnabled = commAlert.channels?.email === true;
          if (!commAlert.is_enabled || !emailEnabled) {
            console.log(`Alert ${alert.id} skipped: "${alert.alert_type}" disabled for tenant ${alert.tenant_id}`);
            await supabase
              .from('alert_queue')
              .update({ status: 'skipped', error_message: 'Alert disabled' })
              .eq('id', alert.id);
            skipped++;
            continue;
          }
        }

        // Build template variables from entity data
        const { variables, itemIds } = await buildTemplateVariables(
          supabase,
          alert.alert_type,
          alert.entity_type,
          alert.entity_id,
          alert.tenant_id
        );

        // Generate items table HTML
        const itemsTableHtml = await generateItemsTableHtml(supabase, itemIds);
        const itemsListText = await generateItemsListText(supabase, itemIds);
        variables.items_table_html = itemsTableHtml;
        variables.items_list_text = itemsListText;

        // Generate inspection findings table (for inspection triggers)
        if (alert.alert_type.startsWith('inspection') || alert.alert_type.includes('inspection')) {
          variables.inspection_findings_table_html = await generateInspectionFindingsTableHtml(supabase, itemIds);
        }

        // Generate task services table (for task triggers)
        if (alert.alert_type.startsWith('task') || alert.alert_type.includes('task') || alert.entity_type === 'task') {
          variables.task_services_table_html = await generateTaskServicesTableHtml(supabase, alert.entity_id);
        }

        // Generate repair actions table (for repair triggers)
        if (alert.alert_type.startsWith('repair') || alert.alert_type.includes('repair')) {
          variables.repair_actions_table_html = await generateRepairActionsTableHtml(supabase, alert.entity_id, alert.entity_type);
        }

        // =====================================================================
        // AUDIENCE-BASED ROUTING SWITCH (Phase 4)
        // =====================================================================
        const audience = await getCatalogAudience(supabase, alert.alert_type);

        // Resolve internal recipients (existing 4-tier precedence)
        let internalRecipients: string[] = [];
        let internalSource = 'none';
        if (audience === 'internal' || audience === 'both') {
          const internalResult = await resolveRecipients(
            supabase,
            alert.tenant_id,
            alert.alert_type,
            alert.recipient_emails
          );
          internalRecipients = internalResult.emails;
          internalSource = internalResult.source;
        }

        // Resolve client recipients (only for client/both audience)
        let clientRecipients: string[] = [];
        let clientSource = 'none';
        if (audience === 'client' || audience === 'both') {
          const accountCtx = await getAccountContext(
            supabase,
            alert.entity_type,
            alert.entity_id,
            alert.tenant_id
          );

          if (accountCtx) {
            const clientResult = await resolveClientRecipients(
              supabase,
              alert.tenant_id,
              alert.alert_type,
              accountCtx.accountId,
              accountCtx.accountName
            );
            clientRecipients = clientResult.emails;
            clientSource = clientResult.source;
          } else {
            // NO_ACCOUNT_CONTEXT already logged by getAccountContext
            if (audience === 'client') {
              // Client-only trigger with no account context → skip
              console.log(`[send-alerts] Alert ${alert.id}: audience=client but NO_ACCOUNT_CONTEXT, skipping client routing`);
            }
          }
        }

        // Merge and deduplicate all recipients
        const allRecipientEmails = cleanEmails([...internalRecipients, ...clientRecipients]);

        if (allRecipientEmails.length === 0) {
          const noRecipMsg = audience === 'client'
            ? 'No client recipients found. Configure alerts_contact_email on the account or set up alert_recipients.'
            : 'No recipients found. Configure office_alert_emails in Organization Settings or assign admin/manager roles.';
          console.error(`[send-alerts] No recipients for alert ${alert.id} (type: ${alert.alert_type}, audience: ${audience}, tenant: ${alert.tenant_id})`);
          await supabase
            .from('alert_queue')
            .update({ status: 'failed', error_message: noRecipMsg })
            .eq('id', alert.id);
          failed++;
          continue;
        }

        // Log routing details
        const routingDetails = [];
        if (internalRecipients.length > 0) routingDetails.push(`internal=${internalRecipients.length} via ${internalSource}`);
        if (clientRecipients.length > 0) routingDetails.push(`client=${clientRecipients.length} via ${clientSource}`);
        console.log(`[send-alerts] Alert ${alert.id} (audience=${audience}): ${allRecipientEmails.length} total recipients [${routingDetails.join(', ')}]`);

        // Try to get custom template first
        const customTemplate = await getTemplateForAlert(supabase, alert.alert_type, alert.tenant_id, 'email');

        let subject = alert.subject;
        let html = alert.body_html;
        let text = alert.body_text;

        if (customTemplate && customTemplate.bodyTemplate) {
          subject = replaceTemplateVariables(customTemplate.subjectTemplate || subject, variables);
          html = replaceTemplateVariables(customTemplate.bodyTemplate, variables);
          text = html.replace(/<[^>]+>/g, '');
        } else if (!html || !text) {
          const content = await generateEmailContent(
            alert.alert_type,
            alert.entity_type,
            alert.entity_id,
            supabase
          );
          subject = subject || content.subject;
          html = html || content.html;
          text = text || content.text;
        }

        // Apply variable substitution to all content
        subject = replaceTemplateVariables(subject, variables);
        html = replaceTemplateVariables(html!, variables);
        text = replaceTemplateVariables(text!, variables);

        // Get custom email domain settings
        const { data: brandSettings } = await supabase
          .from('communication_brand_settings')
          .select('custom_email_domain, from_name, from_email, email_domain_verified')
          .eq('tenant_id', alert.tenant_id)
          .maybeSingle();

        let fromEmail = 'alerts@resend.dev';
        let fromName = variables.tenant_name || 'Warehouse System';

        if (brandSettings?.email_domain_verified && brandSettings?.from_email) {
          fromEmail = brandSettings.from_email;
          if (brandSettings?.from_name) {
            fromName = brandSettings.from_name;
          }
        }

        // Send email to merged recipient list
        const { error: sendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: allRecipientEmails,
          subject: subject,
          html: html,
          text: text,
        });

        if (sendError) throw sendError;

        // =====================================================================
        // IN-APP NOTIFICATION DISPATCH (internal only — client in-app NOT supported)
        // =====================================================================
        if (audience === 'client') {
          console.log(`[send-alerts] CLIENT_INAPP_NOT_SUPPORTED: skipping in-app for client-only alert ${alert.id}`);
        }

        // Run in-app dispatch for internal and both audiences
        if (audience === 'internal' || audience === 'both') {
          try {
            // Check if in_app channel is enabled for this alert type
            const { data: alertConfig } = await supabase
              .from('communication_alerts')
              .select('id, channels')
              .eq('tenant_id', alert.tenant_id)
              .eq('trigger_event', alert.alert_type)
              .eq('is_enabled', true)
              .maybeSingle();

            const inAppEnabled = alertConfig?.channels?.in_app === true;

            if (inAppEnabled) {
              // Get the in-app template for recipients and body
              const { data: inAppTemplate } = await supabase
                .from('communication_templates')
                .select('subject_template, body_template, in_app_recipients')
                .eq('alert_id', alertConfig.id)
                .eq('channel', 'in_app')
                .maybeSingle();

              if (inAppTemplate?.in_app_recipients) {
                // Parse role tokens from recipients string: "[[manager_role]], [[client_user_role]]"
                const roleTokens = (inAppTemplate.in_app_recipients || '')
                  .match(/\[\[(\w+_role)\]\]/g) || [];
                const roleNames = roleTokens.map((t: string) =>
                  t.replace(/\[\[|\]\]/g, '').replace(/_role$/, '')
                );

                if (roleNames.length > 0) {
                  // Resolve role names to user IDs
                  const { data: roles } = await supabase
                    .from('roles')
                    .select('id, name')
                    .in('name', roleNames)
                    .eq('tenant_id', alert.tenant_id)
                    .is('deleted_at', null);

                  if (roles && roles.length > 0) {
                    const roleIds = roles.map((r: any) => r.id);

                    const { data: userRoles } = await supabase
                      .from('user_roles')
                      .select('user_id')
                      .in('role_id', roleIds)
                      .is('deleted_at', null);

                    if (userRoles && userRoles.length > 0) {
                      const userIds = [...new Set(userRoles.map((ur: any) => ur.user_id))];

                      // Verify users belong to this tenant
                      const { data: tenantUsers } = await supabase
                        .from('users')
                        .select('id')
                        .in('id', userIds)
                        .eq('tenant_id', alert.tenant_id)
                        .is('deleted_at', null);

                      if (tenantUsers && tenantUsers.length > 0) {
                        // Build notification content with variable substitution
                        const notifTitle = replaceTemplateVariables(
                          inAppTemplate.subject_template || alert.alert_type,
                          variables
                        );
                        const notifBody = replaceTemplateVariables(
                          inAppTemplate.body_template || subject,
                          variables
                        );

                        // Determine category and action URL from alert type
                        const category = alert.alert_type.split('.')[0].split('_')[0] || 'system';
                        const ctaLink = variables.shipment_link || variables.task_link ||
                          variables.release_link || variables.portal_invoice_url ||
                          variables.portal_claim_url || variables.portal_repair_url ||
                          variables.portal_inspection_url || variables.item_photos_link || null;

                        // Determine priority
                        let priority = 'normal';
                        if (alert.alert_type.includes('damaged') || alert.alert_type.includes('overdue') ||
                            alert.alert_type.includes('requires_attention') || alert.alert_type.includes('delayed')) {
                          priority = 'high';
                        }

                        // Insert in-app notifications for each user
                        const notifications = tenantUsers.map((u: any) => ({
                          tenant_id: alert.tenant_id,
                          user_id: u.id,
                          title: notifTitle,
                          body: notifBody,
                          icon: 'notifications',
                          category,
                          related_entity_type: alert.entity_type,
                          related_entity_id: alert.entity_id,
                          action_url: ctaLink,
                          is_read: false,
                          priority,
                          alert_queue_id: alert.id,
                        }));

                        const { error: notifError } = await supabase
                          .from('in_app_notifications')
                          .insert(notifications);

                        if (notifError) {
                          console.error(`[send-alerts] Failed to create in-app notifications for alert ${alert.id}:`, notifError);
                        } else {
                          console.log(`[send-alerts] Created ${notifications.length} in-app notifications for alert ${alert.id} (roles: ${roleNames.join(', ')})`);
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (inAppError) {
            // In-app notification failure should not block email delivery
            console.error(`[send-alerts] In-app notification error for alert ${alert.id}:`, inAppError);
          }
        }

        // Mark as sent
        await supabase
          .from('alert_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', alert.id);

        sent++;
        console.log(`Alert ${alert.id} sent successfully to ${allRecipientEmails.length} recipients (audience=${audience})`);
      } catch (alertError) {
        console.error(`Error processing alert ${alert.id}:`, alertError);

        await supabase
          .from('alert_queue')
          .update({
            status: 'failed',
            error_message: alertError instanceof Error ? alertError.message : 'Unknown error',
          })
          .eq('id', alert.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${pendingAlerts.length} alerts`,
        processed: pendingAlerts.length,
        sent,
        failed,
        skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-alerts function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);

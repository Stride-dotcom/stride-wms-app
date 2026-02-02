/**
 * Task Service Code Lookup
 * 
 * Fetches the billing_service_code from task_types table for dynamic task → service mapping.
 * Falls back to hardcoded defaults if no database mapping exists.
 */

import { supabase } from '@/integrations/supabase/client';
import { TASK_TYPE_TO_SERVICE_CODE } from './billingCalculation';

// Cache for task type service codes (tenant_id -> Map<taskTypeName, serviceCode>)
const taskTypeCache = new Map<string, Map<string, string | null>>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the billing service code for a task type
 * Checks database first, falls back to hardcoded defaults
 */
export async function getTaskTypeServiceCode(
  tenantId: string,
  taskTypeName: string
): Promise<string> {
  // Check cache validity
  const cacheTimestamp = cacheTimestamps.get(tenantId) || 0;
  const isCacheValid = Date.now() - cacheTimestamp < CACHE_TTL_MS;

  if (!isCacheValid) {
    // Refresh cache for this tenant
    await refreshTaskTypeCache(tenantId);
  }

  const tenantCache = taskTypeCache.get(tenantId);
  if (tenantCache) {
    const dbServiceCode = tenantCache.get(taskTypeName);
    if (dbServiceCode) {
      return dbServiceCode;
    }
  }

  // Fall back to hardcoded defaults using normalized lookup
  const { getServiceCodeForTaskType } = await import('./billingCalculation');
  return getServiceCodeForTaskType(taskTypeName);
}

/**
 * Refresh the task type cache for a tenant
 */
async function refreshTaskTypeCache(tenantId: string): Promise<void> {
  try {
    const { data, error } = await (supabase
      .from('task_types') as any)
      .select('name, billing_service_code')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      console.error('[refreshTaskTypeCache] Error:', error);
      return;
    }

    const newCache = new Map<string, string | null>();
    (data || []).forEach((tt: { name: string; billing_service_code: string | null }) => {
      if (tt.billing_service_code) {
        newCache.set(tt.name, tt.billing_service_code);
      }
    });

    taskTypeCache.set(tenantId, newCache);
    cacheTimestamps.set(tenantId, Date.now());
  } catch (error) {
    console.error('[refreshTaskTypeCache] Error:', error);
  }
}

/**
 * Invalidate cache for a tenant (call when task types are updated)
 */
export function invalidateTaskTypeCache(tenantId: string): void {
  taskTypeCache.delete(tenantId);
  cacheTimestamps.delete(tenantId);
}

/**
 * Clear entire cache (for testing or logout)
 */
export function clearTaskTypeCache(): void {
  taskTypeCache.clear();
  cacheTimestamps.clear();
}

/**
 * Schema-aware Supabase query helpers
 * Provides safe soft-delete filtering based on actual table schema
 */

// Tables that have a deleted_at column for soft deletes
const TABLES_WITH_DELETED_AT = new Set([
  'accounts',
  'items',
  'locations',
  'shipments',
  'shipment_items',
  'warehouses',
  'tasks',
  'movements',
  'billing_events',
  'profiles',
  'rate_cards',
  'rate_card_details',
  'documents',
  'item_notes',
  'item_photos',
  'repair_quotes',
]);

// Tables that use is_active instead of deleted_at
const TABLES_WITH_IS_ACTIVE = new Set([
  'item_types',
  'employees',
  'billing_charge_templates',
  'labor_rates',
]);

// Tables with status column (for reference)
const TABLES_WITH_STATUS = new Set([
  'accounts', // has status column
  'shipments',
  'shipment_items',
  'tasks',
  'items',
]);

export type TableWithDeletedAt = 
  | 'accounts'
  | 'items'
  | 'locations'
  | 'shipments'
  | 'shipment_items'
  | 'warehouses'
  | 'tasks'
  | 'movements'
  | 'billing_events'
  | 'profiles'
  | 'rate_cards'
  | 'rate_card_details'
  | 'documents'
  | 'item_notes'
  | 'item_photos'
  | 'repair_quotes';

export type TableWithIsActive =
  | 'item_types'
  | 'employees'
  | 'billing_charge_templates'
  | 'labor_rates';

/**
 * Check if a table supports soft delete via deleted_at
 */
export function hasDeletedAt(tableName: string): boolean {
  return TABLES_WITH_DELETED_AT.has(tableName);
}

/**
 * Check if a table uses is_active for filtering
 */
export function hasIsActive(tableName: string): boolean {
  return TABLES_WITH_IS_ACTIVE.has(tableName);
}

/**
 * Check if a table has a status column
 */
export function hasStatus(tableName: string): boolean {
  return TABLES_WITH_STATUS.has(tableName);
}

/**
 * Apply appropriate "active records" filter to a Supabase query builder
 * Returns the query with the correct filter applied based on table schema
 * 
 * @example
 * const query = supabase.from('accounts').select('*');
 * const filtered = applyActiveFilter(query, 'accounts');
 * // Applies: .is('deleted_at', null)
 * 
 * @example
 * const query = supabase.from('item_types').select('*');
 * const filtered = applyActiveFilter(query, 'item_types');
 * // Applies: .eq('is_active', true)
 */
export function applyActiveFilter<T extends { is: (col: string, val: null) => T; eq: (col: string, val: boolean) => T }>(
  query: T,
  tableName: string
): T {
  if (hasDeletedAt(tableName)) {
    return query.is('deleted_at', null);
  }
  if (hasIsActive(tableName)) {
    return query.eq('is_active', true);
  }
  // No filter needed for tables without soft delete
  return query;
}

/**
 * Get the filter config for a table (for documentation/debugging)
 */
export function getTableFilterConfig(tableName: string): {
  hasDeletedAt: boolean;
  hasIsActive: boolean;
  hasStatus: boolean;
  filterType: 'deleted_at' | 'is_active' | 'none';
} {
  const deletedAt = hasDeletedAt(tableName);
  const isActive = hasIsActive(tableName);
  const status = hasStatus(tableName);
  
  return {
    hasDeletedAt: deletedAt,
    hasIsActive: isActive,
    hasStatus: status,
    filterType: deletedAt ? 'deleted_at' : isActive ? 'is_active' : 'none',
  };
}

/**
 * Standard select fields for common tables
 * Use these to ensure consistent field selection across the app
 */
export const TABLE_SELECT_FIELDS = {
  accounts: 'id, account_name, account_code, status',
  warehouses: 'id, name, code, address',
  item_types: 'id, name, is_active, sort_order',
  locations: 'id, code, name, warehouse_id',
  employees: 'id, first_name, last_name, email, role, is_active',
} as const;

/**
 * Standard order config for common tables
 */
export const TABLE_ORDER_CONFIG = {
  accounts: { column: 'account_name', ascending: true },
  warehouses: { column: 'name', ascending: true },
  item_types: [
    { column: 'sort_order', ascending: true, nullsFirst: true },
    { column: 'name', ascending: true },
  ],
  locations: { column: 'code', ascending: true },
  employees: { column: 'last_name', ascending: true },
} as const;

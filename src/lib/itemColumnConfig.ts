/**
 * Shared item column configuration for consistent display across the app
 * Used in Inventory, Shipments, Tasks, and other item tables
 */

export interface ItemColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  visible?: boolean;
}

/**
 * Standard item columns for Inventory table
 * Includes thumbnail as first column
 */
export const INVENTORY_TABLE_COLUMNS: ItemColumn[] = [
  { key: 'thumbnail', label: '', width: '56px', sortable: false },
  { key: 'item_code', label: 'Item Code', sortable: true },
  { key: 'quantity', label: 'Qty', width: '60px', sortable: true },
  { key: 'vendor', label: 'Vendor', sortable: true },
  { key: 'description', label: 'Description', sortable: true },
  { key: 'location', label: 'Location', sortable: true },
  { key: 'sidemark', label: 'Sidemark', sortable: true },
  { key: 'room', label: 'Room', sortable: true },
  { key: 'item_type', label: 'Item Type', sortable: true },
];

/**
 * Standard item columns for Shipments and Tasks tables
 * Same as inventory but without thumbnail
 */
export const SHIPMENT_TASK_TABLE_COLUMNS: ItemColumn[] = [
  { key: 'item_code', label: 'Item Code', sortable: true },
  { key: 'quantity', label: 'Qty', width: '60px', sortable: true },
  { key: 'vendor', label: 'Vendor', sortable: true },
  { key: 'description', label: 'Description', sortable: true },
  { key: 'location', label: 'Location', sortable: true },
  { key: 'sidemark', label: 'Sidemark', sortable: true },
  { key: 'room', label: 'Room', sortable: true },
  { key: 'item_type', label: 'Item Type', sortable: true },
];

/**
 * Expected item fields for shipment creation
 * NOTE: Item ID Code is NOT shown during creation - it's assigned at receiving
 */
export const EXPECTED_ITEM_FIELDS = [
  { key: 'quantity', label: 'Qty', required: true },
  { key: 'vendor', label: 'Vendor', required: false },
  { key: 'description', label: 'Description', required: true },
  { key: 'item_type_id', label: 'Item Type', required: false },
  { key: 'sidemark', label: 'Sidemark', required: false },
] as const;

/**
 * Mobile card display fields (subset for compact display)
 */
export const MOBILE_ITEM_FIELDS = [
  'item_code',
  'quantity',
  'description',
  'vendor',
  'location',
] as const;

/**
 * Get column header for a given key
 */
export function getColumnLabel(key: string): string {
  const column = [...INVENTORY_TABLE_COLUMNS, ...SHIPMENT_TASK_TABLE_COLUMNS].find(c => c.key === key);
  return column?.label || key;
}

/**
 * Item select fields for Supabase queries
 * Standardized select string for item queries with joins
 */
export const ITEM_SELECT_FIELDS = `
  id,
  item_code,
  quantity,
  vendor,
  description,
  sidemark,
  room,
  status,
  client_account,
  primary_photo_url,
  current_location_id,
  item_type_id,
  warehouse_id,
  created_at,
  updated_at,
  item_type:item_types(id, name),
  location:locations!current_location_id(id, code, name),
  warehouse:warehouses(id, name)
`.trim();

/**
 * Minimal item select for list views
 */
export const ITEM_LIST_SELECT_FIELDS = `
  id,
  item_code,
  quantity,
  vendor,
  description,
  sidemark,
  room,
  status,
  client_account,
  primary_photo_url
`.trim();

import { supabase } from '@/integrations/supabase/client';
import { EntityType, ENTITY_CONFIG } from '@/config/entities';

export interface ResolvedEntity {
  number: string;
  id: string;
  type: EntityType;
  exists: boolean;
  summary?: string;
}

interface ResolverConfig {
  table: string;
  numberField: string;
  selectFields: string;
  summaryFn: (data: any) => string;
}

const resolvers: Record<EntityType, ResolverConfig> = {
  task: {
    table: 'tasks',
    numberField: 'task_number',
    selectFields: 'id, task_number, title, status',
    summaryFn: (d) => `${d.title} (${d.status})`,
  },
  shipment: {
    table: 'shipments',
    numberField: 'shipment_number',
    selectFields: 'id, shipment_number, status, direction',
    summaryFn: (d) => `${d.direction} - ${d.status}`,
  },
  repair_quote: {
    table: 'repair_quotes',
    numberField: 'quote_number',
    selectFields: 'id, quote_number, status, total_amount',
    summaryFn: (d) =>
      `$${d.total_amount?.toFixed(2) || '0.00'} (${d.status})`,
  },
  item: {
    table: 'items',
    numberField: 'item_number',
    selectFields: 'id, item_number, description, status, location_code',
    summaryFn: (d) =>
      `${d.description || 'Item'} - ${d.location_code || 'No location'} (${d.status})`,
  },
  quote: {
    table: 'quotes',
    numberField: 'quote_number',
    selectFields: 'id, quote_number, status, grand_total',
    summaryFn: (d) =>
      `$${d.grand_total?.toFixed(2) || '0.00'} (${d.status})`,
  },
  invoice: {
    table: 'invoices',
    numberField: 'invoice_number',
    selectFields: 'id, invoice_number, status, total_amount',
    summaryFn: (d) =>
      `$${d.total_amount?.toFixed(2) || '0.00'} (${d.status})`,
  },
  account: {
    table: 'accounts',
    numberField: 'account_code',
    selectFields: 'id, account_code, account_name, status',
    summaryFn: (d) => `${d.account_name} (${d.status})`,
  },
  work_order: {
    table: 'work_orders',
    numberField: 'work_order_number',
    selectFields: 'id, work_order_number, type, status',
    summaryFn: (d) => `${d.type} - ${d.status}`,
  },
};

/**
 * Resolve multiple entity numbers to their database records
 */
export async function resolveEntities(
  numbers: string[]
): Promise<ResolvedEntity[]> {
  const results: ResolvedEntity[] = [];

  // Group numbers by entity type
  const grouped = new Map<EntityType, string[]>();

  for (const number of numbers) {
    const upperNumber = number.toUpperCase();
    for (const [type, config] of Object.entries(ENTITY_CONFIG)) {
      if (upperNumber.startsWith(config.prefix + '-')) {
        if (!grouped.has(type as EntityType)) {
          grouped.set(type as EntityType, []);
        }
        grouped.get(type as EntityType)!.push(upperNumber);
        break;
      }
    }
  }

  // Resolve each entity type
  for (const [type, nums] of grouped) {
    const resolver = resolvers[type];
    if (!resolver) continue;

    try {
      const { data, error } = await supabase
        .from(resolver.table)
        .select(resolver.selectFields)
        .in(resolver.numberField, nums);

      if (error) {
        console.error(`Error resolving ${type} entities:`, error);
        // Mark all as not found on error
        for (const number of nums) {
          results.push({
            number,
            id: '',
            type,
            exists: false,
          });
        }
        continue;
      }

      const foundNumbers = new Set(
        data?.map((d: any) => d[resolver.numberField]?.toUpperCase()) || []
      );

      for (const number of nums) {
        const record = data?.find(
          (d: any) => d[resolver.numberField]?.toUpperCase() === number
        );

        results.push({
          number,
          id: record?.id || '',
          type,
          exists: foundNumbers.has(number),
          summary: record ? resolver.summaryFn(record) : undefined,
        });
      }
    } catch (err) {
      console.error(`Error resolving ${type} entities:`, err);
      // Mark all as not found on error
      for (const number of nums) {
        results.push({
          number,
          id: '',
          type,
          exists: false,
        });
      }
    }
  }

  return results;
}

/**
 * Resolve a single entity number
 */
export async function resolveEntity(
  number: string
): Promise<ResolvedEntity | null> {
  const results = await resolveEntities([number]);
  return results[0] || null;
}

/**
 * Build an entity map from resolved entities
 */
export function buildEntityMap(
  entities: ResolvedEntity[]
): Record<string, { id: string; type: EntityType; exists: boolean; summary?: string }> {
  const map: Record<string, { id: string; type: EntityType; exists: boolean; summary?: string }> = {};

  for (const entity of entities) {
    map[entity.number] = {
      id: entity.id,
      type: entity.type,
      exists: entity.exists,
      summary: entity.summary,
    };
  }

  return map;
}

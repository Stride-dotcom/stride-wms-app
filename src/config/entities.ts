// Entity configuration for chatbot recognition and deep linking

export const ENTITY_CONFIG = {
  task: {
    prefix: 'TSK',
    pattern: /\b(TSK-\d{5})\b/gi,
    route: '/tasks',
    color: 'blue',
    icon: 'CheckSquare',
    label: 'Task',
  },
  shipment: {
    prefix: 'SHP',
    pattern: /\b(SHP-\d{5})\b/gi,
    route: '/shipments',
    color: 'green',
    icon: 'Truck',
    label: 'Shipment',
  },
  repair_quote: {
    prefix: 'RPQ',
    pattern: /\b(RPQ-\d{5})\b/gi,
    route: '/repair-quotes',
    color: 'orange',
    icon: 'Wrench',
    label: 'Repair Quote',
  },
  item: {
    prefix: 'ITM',
    pattern: /\b(ITM-\d{5})\b/gi,
    route: '/inventory',
    color: 'purple',
    icon: 'Package',
    label: 'Item',
  },
  quote: {
    prefix: 'EST',
    pattern: /\b(EST-\d{5})\b/gi,
    route: '/quotes',
    color: 'teal',
    icon: 'FileText',
    label: 'Quote',
  },
  invoice: {
    prefix: 'INV',
    pattern: /\b(INV-\d{5})\b/gi,
    route: '/billing/invoices',
    color: 'emerald',
    icon: 'Receipt',
    label: 'Invoice',
  },
  account: {
    prefix: 'ACC',
    pattern: /\b(ACC-\d{5})\b/gi,
    route: '/accounts',
    color: 'indigo',
    icon: 'Building',
    label: 'Account',
  },
  work_order: {
    prefix: 'WRK',
    pattern: /\b(WRK-\d{5})\b/gi,
    route: '/work-orders',
    color: 'amber',
    icon: 'Clipboard',
    label: 'Work Order',
  },
} as const;

export type EntityType = keyof typeof ENTITY_CONFIG;

export interface EntityConfig {
  prefix: string;
  pattern: RegExp;
  route: string;
  color: string;
  icon: string;
  label: string;
}

// Get entity type from a number string (e.g., "TSK-00142" -> "task")
export function getEntityTypeFromNumber(number: string): EntityType | null {
  const upperNumber = number.toUpperCase();
  for (const [type, config] of Object.entries(ENTITY_CONFIG)) {
    if (upperNumber.startsWith(config.prefix + '-')) {
      return type as EntityType;
    }
  }
  return null;
}

// Extract all entity numbers from text
export function extractEntityNumbers(text: string): string[] {
  const numbers: string[] = [];
  for (const config of Object.values(ENTITY_CONFIG)) {
    // Reset pattern state
    config.pattern.lastIndex = 0;
    const matches = text.match(config.pattern);
    if (matches) {
      numbers.push(...matches.map((m) => m.toUpperCase()));
    }
  }
  return [...new Set(numbers)];
}

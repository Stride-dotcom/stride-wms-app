/**
 * Page Tours - Scripted UI Interactions
 *
 * Defines interactive tours for each route to test UI states and functionality.
 * Tours are "safe" - they default to read-only interactions (open/close dialogs).
 */

export type TourAction =
  | 'click'
  | 'openDropdown'
  | 'type'
  | 'waitFor'
  | 'expectVisible'
  | 'closeModal'
  | 'navigateBack'
  | 'screenshot'
  | 'pressKey';

export type RoleContext = 'admin' | 'warehouse_user' | 'client';

export interface TourStep {
  action: TourAction;
  selector?: string;
  value?: string;
  screenshotAfter?: boolean;
  note?: string;
  optional?: boolean; // If true, step failure won't fail the tour
  timeout?: number;
}

export interface PageTour {
  route: string;
  name: string;
  roleContext: RoleContext;
  requiresId?: boolean; // Route has :id param
  steps: TourStep[];
}

export const pageTours: PageTour[] = [
  // ============================================================
  // DASHBOARD
  // ============================================================
  {
    route: '/',
    name: 'Dashboard Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Initial dashboard state' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]', note: 'Page header visible' },
      { action: 'expectVisible', selector: '[data-testid="dashboard-tile-put_away"]', note: 'Put Away tile visible', optional: true },
      { action: 'click', selector: '[data-testid="dashboard-tile-put_away"]', screenshotAfter: true, note: 'Click Put Away tile', optional: true },
      { action: 'navigateBack' },
      { action: 'click', selector: '[data-testid="dashboard-tile-inspection"]', screenshotAfter: true, note: 'Click Inspection tile', optional: true },
      { action: 'navigateBack' },
      { action: 'click', selector: '[data-testid="dashboard-tile-incoming_shipments"]', screenshotAfter: true, note: 'Click Incoming Shipments tile', optional: true },
      { action: 'navigateBack' },
      { action: 'click', selector: '[data-testid="dashboard-expand-put_away"]', screenshotAfter: true, note: 'Expand Put Away details', optional: true },
      { action: 'click', selector: '[data-testid="refresh-button"]', note: 'Click refresh', optional: true },
      { action: 'screenshot', note: 'Final dashboard state' },
    ],
  },

  // ============================================================
  // SHIPMENTS
  // ============================================================
  {
    route: '/shipments',
    name: 'Shipments Hub Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Shipments hub initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-shipment-button"]', note: 'Open create shipment', optional: true },
      { action: 'screenshot', note: 'Create dialog open', screenshotAfter: true },
      { action: 'pressKey', value: 'Escape', note: 'Close dialog' },
      { action: 'click', selector: '[data-testid="shipments-tab-incoming"]', screenshotAfter: true, note: 'Click incoming tab', optional: true },
      { action: 'click', selector: '[data-testid="shipments-tab-outbound"]', screenshotAfter: true, note: 'Click outbound tab', optional: true },
      { action: 'screenshot', note: 'Final shipments state' },
    ],
  },
  {
    route: '/shipments/list',
    name: 'Shipments List Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Shipments list initial' },
      { action: 'expectVisible', selector: '[data-testid="shipments-table"]', optional: true },
      { action: 'click', selector: '[data-testid="status-filter"]', note: 'Open status filter', optional: true },
      { action: 'screenshot', note: 'Status filter open' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'type', selector: '[data-testid="search-input"]', value: 'TEST', note: 'Search shipments', optional: true },
      { action: 'screenshot', note: 'Search results' },
      { action: 'click', selector: '[data-testid="shipment-row"]:first-child', note: 'Click first shipment', optional: true },
      { action: 'screenshot', note: 'Shipment detail' },
    ],
  },
  {
    route: '/shipments/:id',
    name: 'Shipment Detail Tour',
    roleContext: 'admin',
    requiresId: true,
    steps: [
      { action: 'screenshot', note: 'Shipment detail initial' },
      { action: 'expectVisible', selector: '[data-testid="shipment-header"]', optional: true },
      { action: 'click', selector: '[data-testid="shipment-tab-overview"]', screenshotAfter: true, note: 'Overview tab', optional: true },
      { action: 'click', selector: '[data-testid="shipment-tab-items"]', screenshotAfter: true, note: 'Items tab', optional: true },
      { action: 'click', selector: '[data-testid="shipment-tab-photos"]', screenshotAfter: true, note: 'Photos tab', optional: true },
      { action: 'click', selector: '[data-testid="shipment-tab-tasks"]', screenshotAfter: true, note: 'Tasks tab', optional: true },
      { action: 'click', selector: '[data-testid="add-photo-button"]', note: 'Open add photo', optional: true },
      { action: 'pressKey', value: 'Escape', note: 'Close photo dialog' },
      { action: 'click', selector: '[data-testid="finish-receiving-button"]', note: 'Open finish receiving', optional: true },
      { action: 'screenshot', note: 'Finish receiving dialog' },
      { action: 'pressKey', value: 'Escape', note: 'Cancel finish receiving' },
      { action: 'screenshot', note: 'Final shipment detail' },
    ],
  },
  {
    route: '/shipments/new',
    name: 'New Shipment Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'New shipment form' },
      { action: 'expectVisible', selector: '[data-testid="shipment-form"]', optional: true },
      { action: 'click', selector: '[data-testid="account-select"]', note: 'Open account select', optional: true },
      { action: 'screenshot', note: 'Account dropdown' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final new shipment' },
    ],
  },

  // ============================================================
  // TASKS
  // ============================================================
  {
    route: '/tasks',
    name: 'Tasks List Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Tasks list initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-task-button"]', note: 'Open create task', optional: true },
      { action: 'screenshot', note: 'Create task dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="task-type-filter"]', note: 'Open type filter', optional: true },
      { action: 'screenshot', note: 'Type filter open' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="task-status-filter"]', note: 'Open status filter', optional: true },
      { action: 'screenshot', note: 'Status filter open' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'type', selector: '[data-testid="search-input"]', value: 'test', note: 'Search tasks', optional: true },
      { action: 'screenshot', note: 'Search results' },
      { action: 'click', selector: '[data-testid="task-row"]:first-child', note: 'Click first task', optional: true },
      { action: 'screenshot', note: 'Task selected' },
    ],
  },
  {
    route: '/tasks/:id',
    name: 'Task Detail Tour',
    roleContext: 'admin',
    requiresId: true,
    steps: [
      { action: 'screenshot', note: 'Task detail initial' },
      { action: 'expectVisible', selector: '[data-testid="task-header"]', optional: true },
      { action: 'click', selector: '[data-testid="start-task-button"]', note: 'Open start task', optional: true },
      { action: 'screenshot', note: 'Start task confirmation' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="add-note-button"]', note: 'Open add note', optional: true },
      { action: 'screenshot', note: 'Add note dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="add-photo-button"]', note: 'Open add photo', optional: true },
      { action: 'screenshot', note: 'Add photo dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="complete-task-button"]', note: 'Open complete task', optional: true },
      { action: 'screenshot', note: 'Complete task dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final task detail' },
    ],
  },

  // ============================================================
  // SCAN HUB
  // ============================================================
  {
    route: '/scan',
    name: 'Scan Hub Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Scan hub initial' },
      { action: 'expectVisible', selector: '[data-testid="scan-input"]', optional: true },
      { action: 'click', selector: '[data-testid="move-mode-toggle"]', note: 'Toggle move mode', optional: true },
      { action: 'screenshot', note: 'Move mode enabled' },
      { action: 'click', selector: '[data-testid="move-mode-toggle"]', note: 'Toggle move mode off', optional: true },
      { action: 'click', selector: '[data-testid="location-search-button"]', note: 'Open location search', optional: true },
      { action: 'screenshot', note: 'Location search open' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'type', selector: '[data-testid="scan-input"]', value: 'TEST-ITEM', note: 'Type in scan input', optional: true },
      { action: 'screenshot', note: 'Final scan hub' },
    ],
  },

  // ============================================================
  // STOCKTAKES
  // ============================================================
  {
    route: '/stocktakes',
    name: 'Stocktakes Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Stocktakes initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-stocktake-button"]', note: 'Open create stocktake', optional: true },
      { action: 'screenshot', note: 'Create stocktake dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="stocktake-row"]:first-child', note: 'Click first stocktake', optional: true },
      { action: 'screenshot', note: 'Stocktake selected' },
    ],
  },
  {
    route: '/stocktakes/:id/scan',
    name: 'Stocktake Scan Tour',
    roleContext: 'admin',
    requiresId: true,
    steps: [
      { action: 'screenshot', note: 'Stocktake scan initial' },
      { action: 'expectVisible', selector: '[data-testid="scan-input"]', optional: true },
      { action: 'click', selector: '[data-testid="start-stocktake-button"]', note: 'Start stocktake', optional: true },
      { action: 'screenshot', note: 'Stocktake started' },
      { action: 'screenshot', note: 'Final stocktake scan' },
    ],
  },

  // ============================================================
  // REPAIR QUOTES
  // ============================================================
  {
    route: '/repair-quotes',
    name: 'Repair Quotes Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Repair quotes initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="status-filter"]', note: 'Open status filter', optional: true },
      { action: 'screenshot', note: 'Status filter open' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'type', selector: '[data-testid="search-input"]', value: 'test', note: 'Search quotes', optional: true },
      { action: 'screenshot', note: 'Search results' },
      { action: 'click', selector: '[data-testid="repair-quote-row"]:first-child', note: 'Click first quote', optional: true },
      { action: 'screenshot', note: 'Quote detail dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final repair quotes' },
    ],
  },

  // ============================================================
  // SETTINGS
  // ============================================================
  {
    route: '/settings',
    name: 'Settings Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Settings initial' },
      { action: 'expectVisible', selector: '[data-testid="settings-tabs"]', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-company"]', screenshotAfter: true, note: 'Company tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-warehouses"]', screenshotAfter: true, note: 'Warehouses tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-users"]', screenshotAfter: true, note: 'Users tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-pricing"]', screenshotAfter: true, note: 'Pricing tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-prompts"]', screenshotAfter: true, note: 'Prompts tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-communications"]', screenshotAfter: true, note: 'Communications tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-invoice"]', screenshotAfter: true, note: 'Invoice tab', optional: true },
      { action: 'click', selector: '[data-testid="settings-tab-qa"]', screenshotAfter: true, note: 'QA Tests tab', optional: true },
      { action: 'screenshot', note: 'Final settings' },
    ],
  },

  // ============================================================
  // INVENTORY
  // ============================================================
  {
    route: '/inventory',
    name: 'Inventory Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Inventory initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="status-filter"]', note: 'Open status filter', optional: true },
      { action: 'screenshot', note: 'Status filter open' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'type', selector: '[data-testid="search-input"]', value: 'test', note: 'Search items', optional: true },
      { action: 'screenshot', note: 'Search results' },
      { action: 'click', selector: '[data-testid="item-row"]:first-child', note: 'Click first item', optional: true },
      { action: 'screenshot', note: 'Item detail' },
    ],
  },
  {
    route: '/inventory/:id',
    name: 'Item Detail Tour',
    roleContext: 'admin',
    requiresId: true,
    steps: [
      { action: 'screenshot', note: 'Item detail initial' },
      { action: 'expectVisible', selector: '[data-testid="item-header"]', optional: true },
      { action: 'click', selector: '[data-testid="item-tab-details"]', screenshotAfter: true, note: 'Details tab', optional: true },
      { action: 'click', selector: '[data-testid="item-tab-photos"]', screenshotAfter: true, note: 'Photos tab', optional: true },
      { action: 'click', selector: '[data-testid="item-tab-history"]', screenshotAfter: true, note: 'History tab', optional: true },
      { action: 'click', selector: '[data-testid="edit-item-button"]', note: 'Open edit', optional: true },
      { action: 'screenshot', note: 'Edit dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final item detail' },
    ],
  },

  // ============================================================
  // CLAIMS
  // ============================================================
  {
    route: '/claims',
    name: 'Claims Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Claims initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-claim-button"]', note: 'Open create claim', optional: true },
      { action: 'screenshot', note: 'Create claim dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="claim-row"]:first-child', note: 'Click first claim', optional: true },
      { action: 'screenshot', note: 'Claim detail' },
    ],
  },

  // ============================================================
  // ACCOUNTS
  // ============================================================
  {
    route: '/accounts',
    name: 'Accounts Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Accounts initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-account-button"]', note: 'Open create account', optional: true },
      { action: 'screenshot', note: 'Create account dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'type', selector: '[data-testid="search-input"]', value: 'test', note: 'Search accounts', optional: true },
      { action: 'screenshot', note: 'Search results' },
      { action: 'click', selector: '[data-testid="account-row"]:first-child', note: 'Click first account', optional: true },
      { action: 'screenshot', note: 'Account detail' },
    ],
  },

  // ============================================================
  // REPORTS / ANALYTICS
  // ============================================================
  {
    route: '/reports',
    name: 'Analytics Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Analytics initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="report-tab-billing"]', screenshotAfter: true, note: 'Billing tab', optional: true },
      { action: 'click', selector: '[data-testid="report-tab-inventory"]', screenshotAfter: true, note: 'Inventory tab', optional: true },
      { action: 'screenshot', note: 'Final analytics' },
    ],
  },

  // ============================================================
  // QUOTES
  // ============================================================
  {
    route: '/quotes',
    name: 'Quotes Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Quotes initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-quote-button"]', note: 'Navigate to new quote', optional: true },
      { action: 'screenshot', note: 'New quote page' },
      { action: 'navigateBack' },
      { action: 'click', selector: '[data-testid="quote-row"]:first-child', note: 'Click first quote', optional: true },
      { action: 'screenshot', note: 'Quote detail' },
    ],
  },

  // ============================================================
  // CLIENT PORTAL
  // ============================================================
  {
    route: '/client',
    name: 'Client Dashboard Tour',
    roleContext: 'client',
    steps: [
      { action: 'screenshot', note: 'Client dashboard initial' },
      { action: 'expectVisible', selector: '[data-testid="client-header"]', optional: true },
      { action: 'click', selector: '[data-testid="client-nav-items"]', note: 'Navigate to items', optional: true },
      { action: 'screenshot', note: 'Client items page' },
      { action: 'navigateBack' },
      { action: 'screenshot', note: 'Final client dashboard' },
    ],
  },
  {
    route: '/client/items',
    name: 'Client Items Tour',
    roleContext: 'client',
    steps: [
      { action: 'screenshot', note: 'Client items initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]', optional: true },
      { action: 'type', selector: '[data-testid="search-input"]', value: 'test', note: 'Search items', optional: true },
      { action: 'screenshot', note: 'Search results' },
      { action: 'click', selector: '[data-testid="item-row"]:first-child', note: 'Click first item', optional: true },
      { action: 'screenshot', note: 'Item detail dialog' },
      { action: 'click', selector: '[data-testid="request-repair-quote-button"]', note: 'Request repair quote button', optional: true },
      { action: 'screenshot', note: 'Repair quote section' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final client items' },
    ],
  },
  {
    route: '/client/quotes',
    name: 'Client Quotes Tour',
    roleContext: 'client',
    steps: [
      { action: 'screenshot', note: 'Client quotes initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]', optional: true },
      { action: 'click', selector: '[data-testid="quote-row"]:first-child', note: 'Click first quote', optional: true },
      { action: 'screenshot', note: 'Quote detail' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final client quotes' },
    ],
  },
  {
    route: '/client/claims',
    name: 'Client Claims Tour',
    roleContext: 'client',
    steps: [
      { action: 'screenshot', note: 'Client claims initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]', optional: true },
      { action: 'click', selector: '[data-testid="claim-row"]:first-child', note: 'Click first claim', optional: true },
      { action: 'screenshot', note: 'Claim detail' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'screenshot', note: 'Final client claims' },
    ],
  },

  // ============================================================
  // AUTH PAGES (screenshot only - no interactions)
  // ============================================================
  {
    route: '/auth',
    name: 'Auth Page Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Auth page' },
      { action: 'expectVisible', selector: '[data-testid="auth-form"]', optional: true },
      { action: 'screenshot', note: 'Final auth' },
    ],
  },
  {
    route: '/client/login',
    name: 'Client Login Tour',
    roleContext: 'client',
    steps: [
      { action: 'screenshot', note: 'Client login page' },
      { action: 'expectVisible', selector: '[data-testid="client-login-form"]', optional: true },
      { action: 'screenshot', note: 'Final client login' },
    ],
  },

  // ============================================================
  // MESSAGES
  // ============================================================
  {
    route: '/messages',
    name: 'Messages Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Messages initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="messages-tab-inbox"]', screenshotAfter: true, note: 'Inbox tab', optional: true },
      { action: 'click', selector: '[data-testid="messages-tab-notifications"]', screenshotAfter: true, note: 'Notifications tab', optional: true },
      { action: 'screenshot', note: 'Final messages' },
    ],
  },

  // ============================================================
  // BILLING
  // ============================================================
  {
    route: '/billing',
    name: 'Billing Hub Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Billing initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'screenshot', note: 'Final billing' },
    ],
  },
  {
    route: '/billing/invoices',
    name: 'Invoices Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Invoices initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="invoices-tab-list"]', screenshotAfter: true, note: 'List tab', optional: true },
      { action: 'click', selector: '[data-testid="invoices-tab-template"]', screenshotAfter: true, note: 'Template tab', optional: true },
      { action: 'screenshot', note: 'Final invoices' },
    ],
  },

  // ============================================================
  // MANIFESTS
  // ============================================================
  {
    route: '/manifests',
    name: 'Manifests Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Manifests initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'click', selector: '[data-testid="create-manifest-button"]', note: 'Open create manifest', optional: true },
      { action: 'screenshot', note: 'Create manifest dialog' },
      { action: 'pressKey', value: 'Escape' },
      { action: 'click', selector: '[data-testid="manifest-row"]:first-child', note: 'Click first manifest', optional: true },
      { action: 'screenshot', note: 'Manifest detail' },
    ],
  },

  // ============================================================
  // DIAGNOSTICS
  // ============================================================
  {
    route: '/diagnostics',
    name: 'Diagnostics Tour',
    roleContext: 'admin',
    steps: [
      { action: 'screenshot', note: 'Diagnostics initial' },
      { action: 'expectVisible', selector: '[data-testid="page-header"]' },
      { action: 'screenshot', note: 'Final diagnostics' },
    ],
  },
];

/**
 * Get tour for a specific route
 */
export function getTourForRoute(route: string): PageTour | undefined {
  // First try exact match
  const exact = pageTours.find(t => t.route === route);
  if (exact) return exact;

  // Try pattern match (for :id params)
  const hasId = /\/[a-f0-9-]{36}/i.test(route) || /\/\d+/.test(route);
  if (hasId) {
    const normalized = route.replace(/\/[a-f0-9-]{36}/gi, '/:id').replace(/\/\d+/g, '/:id');
    return pageTours.find(t => t.route === normalized);
  }

  return undefined;
}

/**
 * Get all routes that have tours
 */
export function getRoutesWithTours(): string[] {
  return pageTours.map(t => t.route);
}

/**
 * Get tours by role context
 */
export function getToursByRole(role: RoleContext): PageTour[] {
  return pageTours.filter(t => t.roleContext === role);
}

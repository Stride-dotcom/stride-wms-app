// Shipment status colors (badge style with background)
export function getShipmentStatusClasses(status: string): string {
  const normalized = status.toLowerCase().replace(/[_\s]/g, '');

  switch (normalized) {
    case 'expected':
    case 'pending':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'inprogress':
    case 'processing':
    case 'receiving':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'released':
    case 'completed':
    case 'delivered':
    case 'received':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'cancelled':
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'onhold':
    case 'hold':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

// Invoice/document status colors (badge style with background)
export function getInvoiceStatusClasses(status: string): string {
  const normalized = status.toLowerCase().replace(/[_\s]/g, '');

  switch (normalized) {
    case 'draft':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'sent':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'paid':
    case 'accepted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'void':
    case 'expired':
      return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    case 'declined':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'countered':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

// Quote status colors (same as invoice status colors)
export function getQuoteStatusClasses(status: string): string {
  return getInvoiceStatusClasses(status);
}

// Task-style status text (bold colored text, no background)
export function getTaskStatusTextClasses(status: string): string {
  const normalized = status.toLowerCase().replace(/[_\s]/g, '');

  switch (normalized) {
    case 'pending':
    case 'notstarted':
    case 'draft':
      return 'font-bold text-orange-500 dark:text-orange-400';
    case 'inprogress':
    case 'counting':
    case 'active':
      return 'font-bold text-yellow-500 dark:text-yellow-400';
    case 'completed':
    case 'verified':
    case 'closed':
      return 'font-bold text-green-500 dark:text-green-400';
    case 'unabletocomplete':
    case 'cancelled':
    case 'discrepancy':
      return 'font-bold text-red-500 dark:text-red-400';
    default:
      return '';
  }
}

// Shipment type badge colors
export function getShipmentTypeBadgeClasses(type: string): string {
  const normalized = type.toLowerCase();

  switch (normalized) {
    case 'inbound':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'outbound':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

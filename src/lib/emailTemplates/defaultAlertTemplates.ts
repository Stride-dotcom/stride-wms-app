/**
 * Default plain text templates for each alert trigger event.
 *
 * These are used when a new alert is created to populate the editor fields.
 * Users see and edit plain text + tokens — the system wraps it in branded HTML.
 *
 * Body supports: **bold**, *italic*, [links](url), {size:Npx}text{/size}, [[tokens]]
 */

export interface DefaultAlertTemplate {
  heading: string;
  subject: string;
  body: string;
  ctaLabel: string;
  ctaLink: string;
  smsBody: string;
  /** Short plain-text body for in-app notification */
  inAppBody: string;
  /** Comma-separated role tokens for in-app notification recipients */
  inAppRecipients: string;
}

export const DEFAULT_ALERT_TEMPLATES: Record<string, DefaultAlertTemplate> = {
  // ==================== SHIPMENT ====================
  'shipment.received': {
    heading: 'Shipment Received',
    subject: '[[tenant_name]]: Shipment Received — [[shipment_number]]',
    body: `We've received your shipment and it's now in our facility.

**Shipment:** [[shipment_number]]
**Vendor:** [[shipment_vendor]]
**Status:** [[shipment_status]]
**Items:** [[items_count]]

[[items_table_html]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] received at our facility. [[items_count]] items. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] received. [[items_count]] items from [[shipment_vendor]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_received': {
    heading: 'Shipment Received',
    subject: '[[tenant_name]]: Shipment Received — [[shipment_number]]',
    body: `We've received your shipment and it's now in our facility.

**Shipment:** [[shipment_number]]
**Vendor:** [[shipment_vendor]]
**Status:** [[shipment_status]]
**Items:** [[items_count]]

[[items_table_html]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] received. [[items_count]] items. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] received. [[items_count]] items from [[shipment_vendor]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_created': {
    heading: 'Shipment Created',
    subject: '[[tenant_name]]: Shipment Created — [[shipment_number]]',
    body: `A new shipment has been created and is being tracked.

**Shipment:** [[shipment_number]]
**Vendor:** [[shipment_vendor]]
**Expected Date:** [[shipment_expected_date]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: New shipment [[shipment_number]] created. Expected: [[shipment_expected_date]]. View: [[shipment_link]]',
    inAppBody: 'New shipment [[shipment_number]] created. Expected: [[shipment_expected_date]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment.status_changed': {
    heading: 'Shipment Status Updated',
    subject: '[[tenant_name]]: Shipment Status Changed — [[shipment_number]]',
    body: `The status of your shipment has been updated.

**Shipment:** [[shipment_number]]
**New Status:** [[shipment_status]]
**Vendor:** [[shipment_vendor]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] status changed to [[shipment_status]]. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] status changed to [[shipment_status]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_status_changed': {
    heading: 'Shipment Status Updated',
    subject: '[[tenant_name]]: Shipment Status Changed — [[shipment_number]]',
    body: `The status of your shipment has been updated.

**Shipment:** [[shipment_number]]
**New Status:** [[shipment_status]]
**Vendor:** [[shipment_vendor]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] status: [[shipment_status]]. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] status changed to [[shipment_status]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment.completed': {
    heading: 'Shipment Completed',
    subject: '[[tenant_name]]: Shipment Completed — [[shipment_number]]',
    body: `Your shipment has been fully processed and completed.

**Shipment:** [[shipment_number]]
**Items:** [[items_count]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] completed. [[items_count]] items. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] completed. [[items_count]] items processed.',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_completed': {
    heading: 'Shipment Completed',
    subject: '[[tenant_name]]: Shipment Completed — [[shipment_number]]',
    body: `Your shipment has been fully processed and completed.

**Shipment:** [[shipment_number]]
**Items:** [[items_count]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] completed. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] completed. [[items_count]] items processed.',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment.unidentified_intake_completed': {
    heading: 'Unidentified Intake Completed',
    subject: '[[tenant_name]]: Unidentified Intake Completed — [[shipment_number]]',
    body: `An unidentified shipment intake has been completed and ARRIVAL_NO_ID flags were applied.

**Shipment:** [[shipment_number]]
**Account:** [[account_name]]
**Status:** [[shipment_status]]
**Items Flagged:** [[items_count]]

[[items_table_html]]`,
    ctaLabel: 'Open Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Unidentified intake completed for [[shipment_number]]. [[items_count]] item(s) flagged ARRIVAL_NO_ID. [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] completed under UNIDENTIFIED SHIPMENT. [[items_count]] item(s) auto-flagged ARRIVAL_NO_ID.',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'shipment_scheduled': {
    heading: 'Shipment Scheduled',
    subject: '[[tenant_name]]: Shipment Scheduled — [[shipment_number]]',
    body: `Your shipment has been scheduled for delivery.

**Shipment:** [[shipment_number]]
**Scheduled Date:** [[scheduled_date]]
**Delivery Window:** [[delivery_window]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] scheduled for [[scheduled_date]]. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] scheduled for [[scheduled_date]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_delayed': {
    heading: 'Shipment Delayed',
    subject: '[[tenant_name]]: Shipment Delayed — [[shipment_number]]',
    body: `Your shipment has been delayed. We apologize for the inconvenience.

**Shipment:** [[shipment_number]]
**Reason:** [[delay_reason]]
**New Expected Date:** [[shipment_expected_date]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] delayed. Reason: [[delay_reason]]. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] delayed. Reason: [[delay_reason]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_out_for_delivery': {
    heading: 'Out for Delivery',
    subject: '[[tenant_name]]: Out for Delivery — [[shipment_number]]',
    body: `Your shipment is on its way!

**Shipment:** [[shipment_number]]
**Delivery Window:** [[delivery_window]]`,
    ctaLabel: 'Track Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] is out for delivery. Window: [[delivery_window]]. Track: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] is out for delivery. Window: [[delivery_window]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'shipment_delivered': {
    heading: 'Shipment Delivered',
    subject: '[[tenant_name]]: Delivered — [[shipment_number]]',
    body: `Your shipment has been delivered successfully.

**Shipment:** [[shipment_number]]
**Delivered At:** [[delivered_at]]
**Items:** [[items_count]]`,
    ctaLabel: 'View Shipment',
    ctaLink: '[[shipment_link]]',
    smsBody: '[[tenant_name]]: Shipment [[shipment_number]] delivered at [[delivered_at]]. View: [[shipment_link]]',
    inAppBody: 'Shipment [[shipment_number]] delivered. [[items_count]] items.',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },

  // ==================== ITEMS ====================
  'item.received': {
    heading: 'Item Received',
    subject: '[[tenant_name]]: Item Received — [[item_code]]',
    body: `A new item has been received at our warehouse.

**Item:** [[item_code]]
**Description:** [[item_description]]
**Location:** [[item_location]]
**Sidemark:** [[item_sidemark]]`,
    ctaLabel: 'View Item',
    ctaLink: '[[item_photos_link]]',
    smsBody: '[[tenant_name]]: Item [[item_code]] received. Location: [[item_location]]. View: [[item_photos_link]]',
    inAppBody: 'Item [[item_code]] received. Location: [[item_location]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'item.damaged': {
    heading: 'Item Damage Reported',
    subject: '[[tenant_name]]: Item Damage — [[item_code]]',
    body: `Damage has been reported for an item in our facility.

**Item:** [[item_code]]
**Description:** [[item_description]]
**Location:** [[item_location]]`,
    ctaLabel: 'View Photos',
    ctaLink: '[[item_photos_link]]',
    smsBody: '[[tenant_name]]: Damage reported for item [[item_code]]. View photos: [[item_photos_link]]',
    inAppBody: 'Damage reported for item [[item_code]]. Check photos for details.',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'item.location_changed': {
    heading: 'Item Location Updated',
    subject: '[[tenant_name]]: Item Moved — [[item_code]]',
    body: `An item has been moved to a new location.

**Item:** [[item_code]]
**New Location:** [[item_location]]`,
    ctaLabel: 'View Item',
    ctaLink: '[[item_photos_link]]',
    smsBody: '[[tenant_name]]: Item [[item_code]] moved to [[item_location]].',
    inAppBody: 'Item [[item_code]] moved to [[item_location]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'item.flag_added': {
    heading: 'Item Flag Added',
    subject: '[[tenant_name]]: Flag Added — [[item_code]]',
    body: `A flag has been added to an item.

**Item:** [[item_code]]
**Description:** [[item_description]]`,
    ctaLabel: 'View Item',
    ctaLink: '[[item_photos_link]]',
    smsBody: '[[tenant_name]]: Flag added to item [[item_code]]. View: [[item_photos_link]]',
    inAppBody: 'Flag added to item [[item_code]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },

  // ==================== TASKS ====================
  'task.created': {
    heading: 'Task Created',
    subject: '[[tenant_name]]: New Task — [[task_title]]',
    body: `A new task has been created.

**Task:** [[task_title]]
**Type:** [[task_type]]
**Due Date:** [[task_due_date]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: New task "[[task_title]]" created. Due: [[task_due_date]]. View: [[task_link]]',
    inAppBody: 'New task "[[task_title]]" created. Due: [[task_due_date]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'task.assigned': {
    heading: 'Task Assigned',
    subject: '[[tenant_name]]: Task Assigned — [[task_title]]',
    body: `A task has been assigned to you.

**Task:** [[task_title]]
**Type:** [[task_type]]
**Due Date:** [[task_due_date]]
**Assigned To:** [[assigned_to_name]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: Task "[[task_title]]" assigned to [[assigned_to_name]]. Due: [[task_due_date]]. View: [[task_link]]',
    inAppBody: 'Task "[[task_title]]" assigned to [[assigned_to_name]]. Due: [[task_due_date]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'task_assigned': {
    heading: 'Task Assigned',
    subject: '[[tenant_name]]: Task Assigned — [[task_title]]',
    body: `A task has been assigned to you.

**Task:** [[task_title]]
**Type:** [[task_type]]
**Due Date:** [[task_due_date]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: Task "[[task_title]]" assigned. Due: [[task_due_date]]. View: [[task_link]]',
    inAppBody: 'Task "[[task_title]]" assigned. Due: [[task_due_date]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'task.completed': {
    heading: 'Task Completed',
    subject: '[[tenant_name]]: Task Completed — [[task_title]]',
    body: `A task has been completed.

**Task:** [[task_title]]
**Completed By:** [[completed_by_name]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: Task "[[task_title]]" completed by [[completed_by_name]]. View: [[task_link]]',
    inAppBody: 'Task "[[task_title]]" completed by [[completed_by_name]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'task_completed': {
    heading: 'Task Completed',
    subject: '[[tenant_name]]: Task Completed — [[task_title]]',
    body: `A task has been completed.

**Task:** [[task_title]]
**Completed By:** [[completed_by_name]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: Task "[[task_title]]" completed. View: [[task_link]]',
    inAppBody: 'Task "[[task_title]]" completed by [[completed_by_name]].',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'task.overdue': {
    heading: 'Task Overdue',
    subject: '[[tenant_name]]: Task Overdue — [[task_title]] ([[task_days_overdue]] days)',
    body: `A task is past its due date and requires attention.

**Task:** [[task_title]]
**Days Overdue:** [[task_days_overdue]]
**Due Date:** [[task_due_date]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: Task "[[task_title]]" is [[task_days_overdue]] days overdue. View: [[task_link]]',
    inAppBody: 'Task "[[task_title]]" is [[task_days_overdue]] days overdue.',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },
  'task_overdue': {
    heading: 'Task Overdue',
    subject: '[[tenant_name]]: Task Overdue — [[task_title]] ([[task_days_overdue]] days)',
    body: `A task is past its due date and requires attention.

**Task:** [[task_title]]
**Days Overdue:** [[task_days_overdue]]
**Due Date:** [[task_due_date]]`,
    ctaLabel: 'View Task',
    ctaLink: '[[task_link]]',
    smsBody: '[[tenant_name]]: Task "[[task_title]]" is [[task_days_overdue]] days overdue. View: [[task_link]]',
    inAppBody: 'Task "[[task_title]]" is [[task_days_overdue]] days overdue.',
    inAppRecipients: '[[manager_role]], [[warehouse_role]]',
  },

  // ==================== INSPECTIONS ====================
  'inspection_started': {
    heading: 'Inspection Started',
    subject: '[[tenant_name]]: Inspection Started — [[inspection_number]]',
    body: `An inspection has been started.

**Inspection:** [[inspection_number]]
**Account:** [[account_name]]`,
    ctaLabel: 'View Inspection',
    ctaLink: '[[portal_inspection_url]]',
    smsBody: '[[tenant_name]]: Inspection [[inspection_number]] started. View: [[portal_inspection_url]]',
    inAppBody: 'Inspection [[inspection_number]] started for [[account_name]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'inspection_report_available': {
    heading: 'Inspection Report Ready',
    subject: '[[tenant_name]]: Inspection Report — [[inspection_number]]',
    body: `Your inspection report is now available for review.

**Inspection:** [[inspection_number]]
**Result:** [[inspection_result]]`,
    ctaLabel: 'View Report',
    ctaLink: '[[portal_inspection_url]]',
    smsBody: '[[tenant_name]]: Inspection [[inspection_number]] report ready. View: [[portal_inspection_url]]',
    inAppBody: 'Inspection [[inspection_number]] report ready. Result: [[inspection_result]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'inspection_requires_attention': {
    heading: 'Inspection Requires Attention',
    subject: '[[tenant_name]]: Inspection Needs Attention — [[inspection_number]]',
    body: `An inspection has found issues that need your attention.

**Inspection:** [[inspection_number]]
**Issues Found:** [[inspection_issues_count]]

[[inspection_findings_table_html]]`,
    ctaLabel: 'View Inspection',
    ctaLink: '[[portal_inspection_url]]',
    smsBody: '[[tenant_name]]: Inspection [[inspection_number]] needs attention. [[inspection_issues_count]] issues. View: [[portal_inspection_url]]',
    inAppBody: 'Inspection [[inspection_number]] needs attention. [[inspection_issues_count]] issues found.',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },

  // ==================== RELEASES ====================
  'release.created': {
    heading: 'Release Created',
    subject: '[[tenant_name]]: Release Created — [[release_number]]',
    body: `A new release has been created.

**Release:** [[release_number]]
**Type:** [[release_type]]
**Account:** [[account_name]]`,
    ctaLabel: 'View Release',
    ctaLink: '[[release_link]]',
    smsBody: '[[tenant_name]]: Release [[release_number]] created. Type: [[release_type]]. View: [[release_link]]',
    inAppBody: 'Release [[release_number]] created. Type: [[release_type]].',
    inAppRecipients: '[[warehouse_role]], [[client_user_role]]',
  },
  'release.approved': {
    heading: 'Release Approved',
    subject: '[[tenant_name]]: Release Approved — [[release_number]]',
    body: `A release has been approved and is ready for processing.

**Release:** [[release_number]]
**Type:** [[release_type]]`,
    ctaLabel: 'View Release',
    ctaLink: '[[release_link]]',
    smsBody: '[[tenant_name]]: Release [[release_number]] approved. View: [[release_link]]',
    inAppBody: 'Release [[release_number]] approved and ready for processing.',
    inAppRecipients: '[[warehouse_role]], [[client_user_role]]',
  },
  'release.completed': {
    heading: 'Release Completed',
    subject: '[[tenant_name]]: Release Completed — [[release_number]]',
    body: `A release has been completed.

**Release:** [[release_number]]
**Completed At:** [[release_completed_at]]`,
    ctaLabel: 'View Release',
    ctaLink: '[[release_link]]',
    smsBody: '[[tenant_name]]: Release [[release_number]] completed. View: [[release_link]]',
    inAppBody: 'Release [[release_number]] completed.',
    inAppRecipients: '[[warehouse_role]], [[client_user_role]]',
  },
  'will_call_ready': {
    heading: 'Will-Call Ready',
    subject: '[[tenant_name]]: Will-Call Ready — [[release_number]]',
    body: `Your will-call order is ready for pickup.

**Release:** [[release_number]]
**Pickup Hours:** [[pickup_hours]]
**Amount Due:** [[amount_due]]`,
    ctaLabel: 'View Release',
    ctaLink: '[[release_link]]',
    smsBody: '[[tenant_name]]: Will-call [[release_number]] ready for pickup. Hours: [[pickup_hours]]. View: [[release_link]]',
    inAppBody: 'Will-call [[release_number]] ready for pickup.',
    inAppRecipients: '[[warehouse_role]], [[client_user_role]]',
  },
  'will_call_released': {
    heading: 'Will-Call Released',
    subject: '[[tenant_name]]: Will-Call Released — [[release_number]]',
    body: `Your will-call order has been released.

**Release:** [[release_number]]
**Released At:** [[released_at]]`,
    ctaLabel: 'View Release',
    ctaLink: '[[release_link]]',
    smsBody: '[[tenant_name]]: Will-call [[release_number]] released. View: [[release_link]]',
    inAppBody: 'Will-call [[release_number]] released.',
    inAppRecipients: '[[warehouse_role]], [[client_user_role]]',
  },

  // ==================== REPAIRS ====================
  'repair_started': {
    heading: 'Repair Started',
    subject: '[[tenant_name]]: Repair Started — [[item_code]]',
    body: `Repair work has begun on your item.

**Item:** [[item_code]]
**Repair Type:** [[repair_type]]
**Account:** [[account_name]]`,
    ctaLabel: 'View Repair',
    ctaLink: '[[portal_repair_url]]',
    smsBody: '[[tenant_name]]: Repair started on [[item_code]]. Type: [[repair_type]]. View: [[portal_repair_url]]',
    inAppBody: 'Repair started on [[item_code]]. Type: [[repair_type]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'repair_completed': {
    heading: 'Repair Completed',
    subject: '[[tenant_name]]: Repair Completed — [[item_code]]',
    body: `Repair work has been completed on your item.

**Item:** [[item_code]]
**Repair Type:** [[repair_type]]
**Completed At:** [[repair_completed_at]]`,
    ctaLabel: 'View Repair',
    ctaLink: '[[portal_repair_url]]',
    smsBody: '[[tenant_name]]: Repair completed on [[item_code]]. View: [[portal_repair_url]]',
    inAppBody: 'Repair completed on [[item_code]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },
  'repair_requires_approval': {
    heading: 'Repair Approval Needed',
    subject: '[[tenant_name]]: Repair Approval Needed — [[item_code]]',
    body: `A repair requires your approval before work can continue.

**Item:** [[item_code]]
**Repair Type:** [[repair_type]]
**Estimated Cost:** [[repair_estimate_amount]]

[[repair_actions_table_html]]`,
    ctaLabel: 'Review Repair',
    ctaLink: '[[portal_repair_url]]',
    smsBody: '[[tenant_name]]: Repair approval needed for [[item_code]]. Estimate: [[repair_estimate_amount]]. Review: [[portal_repair_url]]',
    inAppBody: 'Repair approval needed for [[item_code]]. Estimate: [[repair_estimate_amount]].',
    inAppRecipients: '[[manager_role]], [[client_user_role]]',
  },

  // ==================== BILLING ====================
  'billing_event.created': {
    heading: 'Billing Event Created',
    subject: '[[tenant_name]]: Billing Event — [[service_name]]',
    body: `A new billing event has been recorded.

**Service:** [[service_name]]
**Code:** [[service_code]]
**Amount:** [[service_amount]]
**Description:** [[billing_description]]`,
    ctaLabel: '',
    ctaLink: '',
    smsBody: '[[tenant_name]]: Billing event: [[service_name]] — [[service_amount]].',
    inAppBody: 'Billing event: [[service_name]] — [[service_amount]].',
    inAppRecipients: '[[admin_role]], [[manager_role]]',
  },
  'invoice.created': {
    heading: 'Invoice Created',
    subject: '[[tenant_name]]: Invoice Created',
    body: `A new invoice has been created for your account.

**Account:** [[account_name]]`,
    ctaLabel: 'View Invoice',
    ctaLink: '[[portal_invoice_url]]',
    smsBody: '[[tenant_name]]: New invoice created. View: [[portal_invoice_url]]',
    inAppBody: 'New invoice created for [[account_name]].',
    inAppRecipients: '[[admin_role]], [[manager_role]]',
  },
  'invoice.sent': {
    heading: 'Invoice Sent',
    subject: '[[tenant_name]]: Invoice Sent',
    body: `An invoice has been sent to your email.

**Account:** [[account_name]]`,
    ctaLabel: 'View Invoice',
    ctaLink: '[[portal_invoice_url]]',
    smsBody: '[[tenant_name]]: Invoice sent. View: [[portal_invoice_url]]',
    inAppBody: 'Invoice sent to [[account_name]].',
    inAppRecipients: '[[admin_role]], [[manager_role]]',
  },
  'payment.received': {
    heading: 'Payment Received',
    subject: '[[tenant_name]]: Payment Received',
    body: `We've received your payment. Thank you!

**Account:** [[account_name]]
**Payment Status:** [[payment_status]]`,
    ctaLabel: 'View Account',
    ctaLink: '[[portal_account_url]]',
    smsBody: '[[tenant_name]]: Payment received. Thank you! View: [[portal_account_url]]',
    inAppBody: 'Payment received from [[account_name]].',
    inAppRecipients: '[[admin_role]], [[manager_role]]',
  },

  // ==================== CUSTOM / FALLBACK ====================
  'custom': {
    heading: 'Notification',
    subject: '[[tenant_name]]: Notification',
    body: `Dear [[account_contact_name]],

This is a notification from [[tenant_name]].`,
    ctaLabel: '',
    ctaLink: '',
    smsBody: '[[tenant_name]]: You have a new notification.',
    inAppBody: 'You have a new notification from [[tenant_name]].',
    inAppRecipients: '[[manager_role]]',
  },
};

/**
 * Get the default template for a trigger event, falling back to 'custom'.
 *
 * Supports per-flag trigger events (e.g. "item.flag_added.FLG_FRAGILE")
 * by falling back to the parent event key ("item.flag_added") when no
 * exact match is found.
 */
export function getDefaultTemplate(triggerEvent?: string): DefaultAlertTemplate {
  if (triggerEvent && DEFAULT_ALERT_TEMPLATES[triggerEvent]) {
    return DEFAULT_ALERT_TEMPLATES[triggerEvent];
  }

  // Fallback: try parent event key (e.g. "item.flag_added.FLG_X" → "item.flag_added")
  if (triggerEvent) {
    const parts = triggerEvent.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentKey = parts.join('.');
      if (DEFAULT_ALERT_TEMPLATES[parentKey]) {
        return DEFAULT_ALERT_TEMPLATES[parentKey];
      }
    }
  }

  return DEFAULT_ALERT_TEMPLATES['custom'];
}

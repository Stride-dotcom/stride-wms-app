// Token definitions for Template Editor
// Used by both Invoice Template Editor and Email Alert Template Editor

export interface Token {
  id: string;
  label: string;
  token: string;
  description: string;
  category: string;
}

// Invoice Template Tokens
export const INVOICE_TOKENS: Token[] = [
  // Company Information
  {
    id: 'company_name',
    label: 'Company Name',
    token: 'company_name',
    description: 'Your company/organization name',
    category: 'Company Information'
  },
  {
    id: 'company_address',
    label: 'Company Address',
    token: 'company_address',
    description: 'Your company street address',
    category: 'Company Information'
  },
  {
    id: 'company_city',
    label: 'Company City',
    token: 'company_city',
    description: 'Your company city',
    category: 'Company Information'
  },
  {
    id: 'company_state',
    label: 'Company State',
    token: 'company_state',
    description: 'Your company state',
    category: 'Company Information'
  },
  {
    id: 'company_zip',
    label: 'Company ZIP',
    token: 'company_zip',
    description: 'Your company ZIP/postal code',
    category: 'Company Information'
  },
  {
    id: 'company_phone',
    label: 'Company Phone',
    token: 'company_phone',
    description: 'Your company phone number',
    category: 'Company Information'
  },
  {
    id: 'company_email',
    label: 'Company Email',
    token: 'company_email',
    description: 'Your company email address',
    category: 'Company Information'
  },
  {
    id: 'company_logo',
    label: 'Company Logo',
    token: 'company_logo',
    description: 'Your company logo URL',
    category: 'Company Information'
  },

  // Invoice Details
  {
    id: 'invoice_number',
    label: 'Invoice Number',
    token: 'invoice_number',
    description: 'The invoice number (e.g., INV-00001)',
    category: 'Invoice Details'
  },
  {
    id: 'invoice_date',
    label: 'Invoice Date',
    token: 'invoice_date',
    description: 'Date the invoice was created',
    category: 'Invoice Details'
  },
  {
    id: 'due_date',
    label: 'Due Date',
    token: 'due_date',
    description: 'Payment due date',
    category: 'Invoice Details'
  },
  {
    id: 'period_start',
    label: 'Period Start',
    token: 'period_start',
    description: 'Billing period start date',
    category: 'Invoice Details'
  },
  {
    id: 'period_end',
    label: 'Period End',
    token: 'period_end',
    description: 'Billing period end date',
    category: 'Invoice Details'
  },
  {
    id: 'payment_terms',
    label: 'Payment Terms',
    token: 'payment_terms',
    description: 'Payment terms (e.g., Net 30)',
    category: 'Invoice Details'
  },

  // Customer Information
  {
    id: 'customer_name',
    label: 'Customer Name',
    token: 'customer_name',
    description: 'Customer/account name',
    category: 'Customer Information'
  },
  {
    id: 'customer_code',
    label: 'Customer Code',
    token: 'customer_code',
    description: 'Customer account code',
    category: 'Customer Information'
  },
  {
    id: 'billing_contact_name',
    label: 'Billing Contact',
    token: 'billing_contact_name',
    description: 'Billing contact name',
    category: 'Customer Information'
  },
  {
    id: 'billing_address',
    label: 'Billing Address',
    token: 'billing_address',
    description: 'Customer billing address',
    category: 'Customer Information'
  },
  {
    id: 'billing_city',
    label: 'Billing City',
    token: 'billing_city',
    description: 'Customer billing city',
    category: 'Customer Information'
  },
  {
    id: 'billing_state',
    label: 'Billing State',
    token: 'billing_state',
    description: 'Customer billing state',
    category: 'Customer Information'
  },
  {
    id: 'billing_zip',
    label: 'Billing ZIP',
    token: 'billing_zip',
    description: 'Customer billing ZIP code',
    category: 'Customer Information'
  },
  {
    id: 'billing_email',
    label: 'Billing Email',
    token: 'billing_email',
    description: 'Customer billing email',
    category: 'Customer Information'
  },
  {
    id: 'sidemark_name',
    label: 'Sidemark Name',
    token: 'sidemark_name',
    description: 'Sidemark/project name',
    category: 'Customer Information'
  },

  // Totals
  {
    id: 'subtotal',
    label: 'Subtotal',
    token: 'subtotal',
    description: 'Invoice subtotal before tax',
    category: 'Totals'
  },
  {
    id: 'tax_amount',
    label: 'Tax Amount',
    token: 'tax_amount',
    description: 'Tax amount',
    category: 'Totals'
  },
  {
    id: 'total_amount',
    label: 'Total Amount',
    token: 'total_amount',
    description: 'Invoice total including tax',
    category: 'Totals'
  },
  {
    id: 'balance_due',
    label: 'Balance Due',
    token: 'balance_due',
    description: 'Outstanding balance',
    category: 'Totals'
  },
  {
    id: 'credits_applied',
    label: 'Credits Applied',
    token: 'credits_applied',
    description: 'Credits applied to invoice',
    category: 'Totals'
  },

  // Special Tokens
  {
    id: 'line_items_table',
    label: 'Line Items Table',
    token: 'line_items_table',
    description: 'Renders the full line items table',
    category: 'Special'
  },
  {
    id: 'current_date',
    label: 'Current Date',
    token: 'current_date',
    description: 'Today\'s date',
    category: 'Special'
  },
  {
    id: 'payment_link',
    label: 'Payment Link',
    token: 'payment_link',
    description: 'Link to online payment portal',
    category: 'Special'
  },
  {
    id: 'invoice_notes',
    label: 'Invoice Notes',
    token: 'invoice_notes',
    description: 'Custom notes for this invoice',
    category: 'Special'
  },
];

// Email Template Tokens
export const EMAIL_TOKENS: Token[] = [
  // Brand Tokens
  {
    id: 'tenant_name',
    label: 'Organization Name',
    token: 'tenant_name',
    description: 'Your organization name',
    category: 'Brand'
  },
  {
    id: 'brand_logo_url',
    label: 'Logo URL',
    token: 'brand_logo_url',
    description: 'Your organization logo URL',
    category: 'Brand'
  },
  {
    id: 'brand_support_email',
    label: 'Support Email',
    token: 'brand_support_email',
    description: 'Support email address',
    category: 'Brand'
  },
  {
    id: 'company_address',
    label: 'Company Address',
    token: 'company_address',
    description: 'Company full address',
    category: 'Brand'
  },
  {
    id: 'company_phone',
    label: 'Company Phone',
    token: 'company_phone',
    description: 'Company phone number',
    category: 'Brand'
  },

  // Invoice Tokens
  {
    id: 'invoice_number',
    label: 'Invoice Number',
    token: 'invoice_number',
    description: 'The invoice number',
    category: 'Invoice'
  },
  {
    id: 'invoice_date',
    label: 'Invoice Date',
    token: 'invoice_date',
    description: 'Invoice creation date',
    category: 'Invoice'
  },
  {
    id: 'invoice_due_date',
    label: 'Due Date',
    token: 'invoice_due_date',
    description: 'Invoice due date',
    category: 'Invoice'
  },
  {
    id: 'total_amount',
    label: 'Total Amount',
    token: 'total_amount',
    description: 'Invoice total amount',
    category: 'Invoice'
  },
  {
    id: 'paid_amount',
    label: 'Paid Amount',
    token: 'paid_amount',
    description: 'Amount paid',
    category: 'Invoice'
  },
  {
    id: 'balance_due',
    label: 'Balance Due',
    token: 'balance_due',
    description: 'Remaining balance',
    category: 'Invoice'
  },
  {
    id: 'payment_link',
    label: 'Payment Link',
    token: 'payment_link',
    description: 'Link to payment portal',
    category: 'Invoice'
  },
  {
    id: 'invoice_link',
    label: 'Invoice Link',
    token: 'invoice_link',
    description: 'Link to view invoice',
    category: 'Invoice'
  },
  {
    id: 'period_start',
    label: 'Period Start',
    token: 'period_start',
    description: 'Billing period start',
    category: 'Invoice'
  },
  {
    id: 'period_end',
    label: 'Period End',
    token: 'period_end',
    description: 'Billing period end',
    category: 'Invoice'
  },
  {
    id: 'account_name',
    label: 'Account Name',
    token: 'account_name',
    description: 'Customer account name',
    category: 'Invoice'
  },

  // Payment Tokens
  {
    id: 'payment_date',
    label: 'Payment Date',
    token: 'payment_date',
    description: 'Date payment was received',
    category: 'Payment'
  },
  {
    id: 'payment_method',
    label: 'Payment Method',
    token: 'payment_method',
    description: 'Method of payment',
    category: 'Payment'
  },
  {
    id: 'receipt_link',
    label: 'Receipt Link',
    token: 'receipt_link',
    description: 'Link to payment receipt',
    category: 'Payment'
  },

  // Contact Tokens
  {
    id: 'billing_contact_name',
    label: 'Billing Contact',
    token: 'billing_contact_name',
    description: 'Billing contact name',
    category: 'Contact'
  },
  {
    id: 'contact_name',
    label: 'Contact Name',
    token: 'contact_name',
    description: 'Primary contact name',
    category: 'Contact'
  },

  // Shipment Tokens
  {
    id: 'shipment_reference',
    label: 'Shipment Reference',
    token: 'shipment_reference',
    description: 'Shipment reference number',
    category: 'Shipment'
  },
  {
    id: 'tracking_number',
    label: 'Tracking Number',
    token: 'tracking_number',
    description: 'Carrier tracking number',
    category: 'Shipment'
  },
  {
    id: 'carrier_name',
    label: 'Carrier Name',
    token: 'carrier_name',
    description: 'Shipping carrier name',
    category: 'Shipment'
  },
  {
    id: 'ship_date',
    label: 'Ship Date',
    token: 'ship_date',
    description: 'Date shipment was sent',
    category: 'Shipment'
  },
  {
    id: 'item_count',
    label: 'Item Count',
    token: 'item_count',
    description: 'Number of items in shipment',
    category: 'Shipment'
  },
  {
    id: 'tracking_link',
    label: 'Tracking Link',
    token: 'tracking_link',
    description: 'Link to track shipment',
    category: 'Shipment'
  },
  {
    id: 'shipment_link',
    label: 'Shipment Details Link',
    token: 'shipment_link',
    description: 'Link to shipment details',
    category: 'Shipment'
  },

  // Item Tokens
  {
    id: 'item_code',
    label: 'Item Code',
    token: 'item_code',
    description: 'Item identifier code',
    category: 'Item'
  },
  {
    id: 'item_description',
    label: 'Item Description',
    token: 'item_description',
    description: 'Item description',
    category: 'Item'
  },
  {
    id: 'location',
    label: 'Location',
    token: 'location',
    description: 'Item warehouse location',
    category: 'Item'
  },

  // Task Tokens
  {
    id: 'task_title',
    label: 'Task Title',
    token: 'task_title',
    description: 'Task name/title',
    category: 'Task'
  },
  {
    id: 'task_priority',
    label: 'Task Priority',
    token: 'task_priority',
    description: 'Task priority level',
    category: 'Task'
  },
  {
    id: 'task_due_date',
    label: 'Task Due Date',
    token: 'task_due_date',
    description: 'Task due date',
    category: 'Task'
  },
  {
    id: 'assigned_to',
    label: 'Assigned To',
    token: 'assigned_to',
    description: 'Person task is assigned to',
    category: 'Task'
  },

  // Claim Tokens
  {
    id: 'claim_reference',
    label: 'Claim Reference',
    token: 'claim_reference',
    description: 'Claim reference number',
    category: 'Claim'
  },
  {
    id: 'claim_amount',
    label: 'Claim Amount',
    token: 'claim_amount',
    description: 'Total claim amount',
    category: 'Claim'
  },
  {
    id: 'offer_amount',
    label: 'Offer Amount',
    token: 'offer_amount',
    description: 'Settlement offer amount',
    category: 'Claim'
  },
  {
    id: 'claim_status',
    label: 'Claim Status',
    token: 'claim_status',
    description: 'Current claim status',
    category: 'Claim'
  },

  // Release Tokens
  {
    id: 'release_number',
    label: 'Release Number',
    token: 'release_number',
    description: 'Release order number',
    category: 'Release'
  },
  {
    id: 'release_link',
    label: 'Release Link',
    token: 'release_link',
    description: 'Direct link to release details',
    category: 'Release'
  },

  // Employee Tokens
  {
    id: 'employee_name',
    label: 'Employee Name',
    token: 'employee_name',
    description: 'New employee name',
    category: 'Employee'
  },
  {
    id: 'employee_role',
    label: 'Employee Role',
    token: 'employee_role',
    description: 'Employee role/position',
    category: 'Employee'
  },
  {
    id: 'invited_by',
    label: 'Invited By',
    token: 'invited_by',
    description: 'Name of person who sent invite',
    category: 'Employee'
  },
  {
    id: 'invitation_link',
    label: 'Invitation Link',
    token: 'invitation_link',
    description: 'Link to accept invitation',
    category: 'Employee'
  },
  {
    id: 'expiry_date',
    label: 'Expiry Date',
    token: 'expiry_date',
    description: 'Invitation expiry date',
    category: 'Employee'
  },

  // General
  {
    id: 'current_date',
    label: 'Current Date',
    token: 'current_date',
    description: 'Today\'s date',
    category: 'General'
  },
  {
    id: 'subject',
    label: 'Email Subject',
    token: 'subject',
    description: 'Email subject line',
    category: 'General'
  },
];

// Get all unique categories from tokens
export function getTokenCategories(tokens: Token[]): string[] {
  const categories = new Set(tokens.map(t => t.category));
  return Array.from(categories);
}

// Sample data for preview rendering
export const SAMPLE_DATA: Record<string, string> = {
  // Company
  company_name: 'Stride Warehouse Services',
  company_address: '19803 87th Ave S',
  company_city: 'Kent',
  company_state: 'WA',
  company_zip: '98031',
  company_phone: '206-550-1848',
  company_email: 'warehouse@stridenw.com',
  company_logo: '/logo.png',

  // Invoice
  invoice_number: 'INV-00001',
  invoice_date: 'January 30, 2026',
  due_date: 'March 1, 2026',
  invoice_due_date: 'March 1, 2026',
  period_start: 'Jan 1, 2026',
  period_end: 'Jan 31, 2026',
  payment_terms: 'Net 30',
  subtotal: '$1,547.50',
  tax_amount: '$0.00',
  total_amount: '$1,547.50',
  balance_due: '$1,547.50',
  credits_applied: '$0.00',
  paid_amount: '$1,547.50',

  // Customer
  customer_name: 'Acme Corporation',
  customer_code: 'ACME',
  billing_contact_name: 'John Smith',
  billing_address: '123 Business Ave, Suite 400',
  billing_city: 'Seattle',
  billing_state: 'WA',
  billing_zip: '98101',
  billing_email: 'billing@acmecorp.com',
  account_name: 'Acme Corporation',

  // Other
  sidemark_name: 'Project Alpha',
  current_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  tenant_name: 'Stride Warehouse Services',
  brand_support_email: 'warehouse@stridenw.com',
  brand_logo_url: '/logo.png',
  payment_link: 'https://pay.example.com',
  invoice_link: 'https://portal.example.com/invoices/123',
  receipt_link: 'https://portal.example.com/receipts/123',
  invoice_notes: 'Thank you for your business!',

  // Payment
  payment_date: 'February 15, 2026',
  payment_method: 'Credit Card',

  // Contact
  contact_name: 'Jane Doe',

  // Shipment
  shipment_reference: 'SHP-2026-001',
  tracking_number: '1Z999AA10123456784',
  carrier_name: 'UPS',
  ship_date: 'February 1, 2026',
  item_count: '5',
  tracking_link: 'https://track.example.com/123',
  shipment_link: 'https://portal.example.com/shipments/123',

  // Item
  item_code: 'ITM-00123',
  item_description: 'Office Chair - Executive Black',
  location: 'A-01-02',

  // Task
  task_title: 'Inventory Count - Zone A',
  task_priority: 'High',
  task_due_date: 'February 10, 2026',
  assigned_to: 'Mike Johnson',

  // Claim
  claim_reference: 'CLM-2026-001',
  claim_amount: '$500.00',
  offer_amount: '$450.00',
  claim_status: 'Under Review',

  // Release
  release_number: 'REL-2026-001',
  release_link: 'https://portal.example.com/releases/123',

  // Employee
  employee_name: 'Sarah Williams',
  employee_role: 'Warehouse Associate',
  invited_by: 'Admin User',
  invitation_link: 'https://portal.example.com/invite/abc123',
  expiry_date: 'February 7, 2026',

  // Email
  subject: 'Your Invoice is Ready',

  // Line items table placeholder
  line_items_table: '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">#</th><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Date</th><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Service</th><th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Description</th><th style="padding:12px;text-align:right;border-bottom:2px solid #e2e8f0;">Qty</th><th style="padding:12px;text-align:right;border-bottom:2px solid #e2e8f0;">Rate</th><th style="padding:12px;text-align:right;border-bottom:2px solid #e2e8f0;">Total</th></tr></thead><tbody><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;">1</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Jan 15, 2026</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Storage</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Monthly storage - Zone A</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">50</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">$15.00</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">$750.00</td></tr><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;">2</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Jan 20, 2026</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Handling</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Inbound handling</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">25</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">$5.50</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">$137.50</td></tr><tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;">3</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Jan 25, 2026</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Shipping</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">Outbound shipping - UPS Ground</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">10</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">$66.00</td><td style="padding:12px;text-align:right;border-bottom:1px solid #e2e8f0;">$660.00</td></tr></tbody></table>',
};

// Render template with token replacement
export function renderTemplate(html: string, tokens: Token[], data?: Record<string, string>): string {
  let rendered = html;
  const sampleData = data || SAMPLE_DATA;

  tokens.forEach(token => {
    const regex = new RegExp(`\\{\\{${token.token}\\}\\}`, 'g');
    rendered = rendered.replace(regex, sampleData[token.token] || `[${token.label}]`);
  });

  return rendered;
}

# Stride WMS Email Templates v4

This folder contains the default **global** email/SMS templates used by the Stride WMS alert system.

## Rules
- One template per `trigger_event`
- Do **not** hardcode tenant branding. Use tokens.
- HTML templates live in this folder. SMS templates live in `sms/`.

## Token standards (must be supported by the app)
Global branding:
- {{tenant_name}}
- {{brand_logo_url}}
- {{brand_primary_color}}
- {{brand_support_email}}
- {{portal_base_url}}
- {{tenant_terms_url}}
- {{tenant_privacy_url}}
- {{tenant_company_address}}
Office recipients (internal notifications):
- {{office_alert_emails}}
- {{office_alert_email_primary}}

Entity links (CTA):
- {{shipment_link}}, {{portal_invoice_url}}, {{portal_claim_url}}, {{portal_release_url}}, {{portal_quote_url}}, etc.

Array/table tokens (pre-rendered HTML):
- {{items_table_html}} (shipments/tasks/releases)
- {{items_list_text}} (sms-friendly)

The send-alerts edge function should replace both `{{token}}` and `[[token]]` syntaxes.

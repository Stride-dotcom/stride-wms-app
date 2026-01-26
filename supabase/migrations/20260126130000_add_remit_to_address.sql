-- Add remit_to_address field to tenant_company_settings
-- This address is used for payment remittance instructions on invoices

ALTER TABLE public.tenant_company_settings
ADD COLUMN IF NOT EXISTS remit_to_address TEXT;

-- Add helpful comment
COMMENT ON COLUMN public.tenant_company_settings.remit_to_address IS 'Address where payments should be remitted to, displayed on invoices';

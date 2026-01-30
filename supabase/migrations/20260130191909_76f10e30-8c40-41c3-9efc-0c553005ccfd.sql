-- Create account_promo_codes table (junction table linking promo codes to accounts)
CREATE TABLE public.account_promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  
  -- Each promo code can only be assigned once per account
  CONSTRAINT account_promo_codes_unique UNIQUE (account_id, promo_code_id)
);

-- Create promo_code_usages table (tracks per-account-group usage for enforcing limits)
CREATE TABLE public.promo_code_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  root_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  used_by_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  billing_event_id UUID REFERENCES public.billing_events(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_by UUID REFERENCES auth.users(id),
  
  -- Each promo can only be applied once per billing event
  CONSTRAINT promo_code_usages_billing_event_unique UNIQUE (billing_event_id)
);

-- Create indexes for performance
CREATE INDEX idx_account_promo_codes_account ON public.account_promo_codes(account_id);
CREATE INDEX idx_account_promo_codes_promo ON public.account_promo_codes(promo_code_id);
CREATE INDEX idx_promo_code_usages_promo ON public.promo_code_usages(promo_code_id);
CREATE INDEX idx_promo_code_usages_root_account ON public.promo_code_usages(root_account_id);
CREATE INDEX idx_promo_code_usages_used_by_account ON public.promo_code_usages(used_by_account_id);

-- Enable RLS
ALTER TABLE public.account_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;

-- RLS policies for account_promo_codes (tenant-isolated)
CREATE POLICY "Users can view account promo codes for their tenant"
  ON public.account_promo_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      JOIN public.users u ON u.tenant_id = a.tenant_id
      WHERE a.id = account_promo_codes.account_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage account promo codes for their tenant"
  ON public.account_promo_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      JOIN public.users u ON u.tenant_id = a.tenant_id
      WHERE a.id = account_promo_codes.account_id
      AND u.id = auth.uid()
    )
  );

-- RLS policies for promo_code_usages (tenant-isolated)
CREATE POLICY "Users can view promo usages for their tenant"
  ON public.promo_code_usages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      JOIN public.users u ON u.tenant_id = a.tenant_id
      WHERE a.id = promo_code_usages.root_account_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage promo usages for their tenant"
  ON public.promo_code_usages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      JOIN public.users u ON u.tenant_id = a.tenant_id
      WHERE a.id = promo_code_usages.root_account_id
      AND u.id = auth.uid()
    )
  );
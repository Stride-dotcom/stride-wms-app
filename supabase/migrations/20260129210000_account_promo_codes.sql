-- Account Promo Codes Junction Table
-- Links promo codes to specific accounts so discounts only apply when assigned

CREATE TABLE IF NOT EXISTS account_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,

  -- Unique constraint: one promo code per account
  UNIQUE(account_id, promo_code_id)
);

-- Enable RLS
ALTER TABLE account_promo_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "account_promo_codes_tenant_access" ON account_promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = account_promo_codes.account_id
      AND a.tenant_id = auth.jwt() ->> 'tenant_id'
    )
  );

-- Indexes
CREATE INDEX idx_account_promo_codes_account ON account_promo_codes(account_id);
CREATE INDEX idx_account_promo_codes_promo ON account_promo_codes(promo_code_id);

-- Comments
COMMENT ON TABLE account_promo_codes IS 'Junction table linking promo codes to accounts. Promo codes only apply to accounts they are assigned to.';

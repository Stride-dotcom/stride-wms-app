import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useOrganizationClaimSettings } from '@/hooks/useOrganizationClaimSettings';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export function ClaimSettingsSection() {
  const { settings, loading, saving, updateSettings } = useOrganizationClaimSettings();

  const [formData, setFormData] = useState({
    approval_threshold_amount: 1000,
    approval_required_above_threshold: true,
    default_payout_method: 'credit' as 'credit' | 'check' | 'ach',
    settlement_terms_template: '',
    acceptance_token_expiry_days: 30,
    auto_create_repair_task: true,
    // Valuation Coverage settings
    coverage_enabled: true,
    coverage_default_type: 'standard' as 'standard' | 'full_replacement_no_deductible' | 'full_replacement_deductible',
    coverage_rate_full_no_deductible: 0.0188,
    coverage_rate_full_deductible: 0.0142,
    coverage_deductible_amount: 300,
    coverage_allow_shipment: true,
    coverage_allow_item: true,
  });

  const [termsOpen, setTermsOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        approval_threshold_amount: settings.approval_threshold_amount,
        approval_required_above_threshold: settings.approval_required_above_threshold,
        default_payout_method: settings.default_payout_method,
        settlement_terms_template: settings.settlement_terms_template || '',
        acceptance_token_expiry_days: settings.acceptance_token_expiry_days,
        auto_create_repair_task: settings.auto_create_repair_task,
        // Valuation Coverage settings
        coverage_enabled: settings.coverage_enabled,
        coverage_default_type: settings.coverage_default_type,
        coverage_rate_full_no_deductible: settings.coverage_rate_full_no_deductible,
        coverage_rate_full_deductible: settings.coverage_rate_full_deductible,
        coverage_deductible_amount: settings.coverage_deductible_amount,
        coverage_allow_shipment: settings.coverage_allow_shipment,
        coverage_allow_item: settings.coverage_allow_item,
      });
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (!settings) return;
    const changed =
      formData.approval_threshold_amount !== settings.approval_threshold_amount ||
      formData.approval_required_above_threshold !== settings.approval_required_above_threshold ||
      formData.default_payout_method !== settings.default_payout_method ||
      formData.settlement_terms_template !== (settings.settlement_terms_template || '') ||
      formData.acceptance_token_expiry_days !== settings.acceptance_token_expiry_days ||
      formData.auto_create_repair_task !== settings.auto_create_repair_task ||
      // Valuation Coverage changes
      formData.coverage_enabled !== settings.coverage_enabled ||
      formData.coverage_default_type !== settings.coverage_default_type ||
      formData.coverage_rate_full_no_deductible !== settings.coverage_rate_full_no_deductible ||
      formData.coverage_rate_full_deductible !== settings.coverage_rate_full_deductible ||
      formData.coverage_deductible_amount !== settings.coverage_deductible_amount ||
      formData.coverage_allow_shipment !== settings.coverage_allow_shipment ||
      formData.coverage_allow_item !== settings.coverage_allow_item;
    setHasChanges(changed);
  }, [formData, settings]);

  const handleSave = async () => {
    await updateSettings(formData);
    setHasChanges(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="shield" size="md" />
          Claim Settings
        </CardTitle>
        <CardDescription>
          Configure approval thresholds, payout methods, and settlement terms for claims.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Approval Threshold */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="approval_required">Require Admin Approval</Label>
              <p className="text-sm text-muted-foreground">
                Claims exceeding the threshold require admin approval before sending to client.
              </p>
            </div>
            <Switch
              id="approval_required"
              checked={formData.approval_required_above_threshold}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, approval_required_above_threshold: checked }))
              }
            />
          </div>

          {formData.approval_required_above_threshold && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <Label htmlFor="threshold">Approval Threshold Amount</Label>
              <div className="relative max-w-xs">
                <MaterialIcon name="attach_money" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="threshold"
                  type="number"
                  step="100"
                  min="0"
                  value={formData.approval_threshold_amount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      approval_threshold_amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Claims above this amount will require approval before being sent to client.
              </p>
            </div>
          )}
        </div>

        {/* Default Payout Method */}
        <div className="space-y-2">
          <Label htmlFor="payout_method">Default Payout Method</Label>
          <Select
            value={formData.default_payout_method}
            onValueChange={(value: 'credit' | 'check' | 'ach') =>
              setFormData((prev) => ({ ...prev, default_payout_method: value }))
            }
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">Account Credit</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="ach">ACH / Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Default payout method for approved claims. Can be overridden per claim.
          </p>
        </div>

        {/* Acceptance Token Expiry */}
        <div className="space-y-2">
          <Label htmlFor="expiry_days">Acceptance Link Expiry</Label>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              id="expiry_days"
              type="number"
              min="1"
              max="365"
              value={formData.acceptance_token_expiry_days}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  acceptance_token_expiry_days: parseInt(e.target.value) || 30,
                }))
              }
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <p className="text-xs text-muted-foreground">
            How long the client has to accept or decline the settlement offer.
          </p>
        </div>

        {/* Auto-create Repair Task */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto_repair">Auto-create Repair Tasks</Label>
            <p className="text-sm text-muted-foreground">
              Automatically create repair tasks when client accepts claims with repair items.
            </p>
          </div>
          <Switch
            id="auto_repair"
            checked={formData.auto_create_repair_task}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, auto_create_repair_task: checked }))
            }
          />
        </div>

        {/* Settlement Terms Template */}
        <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
              <span className="font-medium">Settlement Terms Template</span>
              <MaterialIcon
                name="expand_more"
                size="sm"
                className={`transition-transform ${termsOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Default legal terms shown to clients when accepting claim settlements.
            </p>
            <Textarea
              value={formData.settlement_terms_template}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, settlement_terms_template: e.target.value }))
              }
              rows={10}
              className="text-sm"
              placeholder="Enter settlement terms template..."
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Valuation Coverage Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-4">
            <MaterialIcon name="verified_user" size="md" className="text-blue-600" />
            <h3 className="font-semibold text-lg">Valuation Coverage</h3>
          </div>

          {/* Enable Coverage Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="coverage_enabled">Enable Valuation Coverage</Label>
                <p className="text-sm text-muted-foreground">
                  Allow clients to purchase additional coverage protection for their items.
                </p>
              </div>
              <Switch
                id="coverage_enabled"
                checked={formData.coverage_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, coverage_enabled: checked }))
                }
              />
            </div>

            {formData.coverage_enabled && (
              <div className="space-y-4 pl-4 border-l-2 border-blue-200 bg-blue-50/50 rounded-r-lg p-4">
                {/* Default Coverage Type */}
                <div className="space-y-2">
                  <Label htmlFor="coverage_default_type">Default Coverage Type</Label>
                  <Select
                    value={formData.coverage_default_type}
                    onValueChange={(value: 'standard' | 'full_replacement_no_deductible' | 'full_replacement_deductible') =>
                      setFormData((prev) => ({ ...prev, coverage_default_type: value }))
                    }
                  >
                    <SelectTrigger className="max-w-sm bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">
                        <div className="flex flex-col">
                          <span>Standard (60¢/lb)</span>
                          <span className="text-xs text-muted-foreground">Basic carrier liability</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="full_replacement_no_deductible">
                        <div className="flex flex-col">
                          <span>Full Replacement (No Deductible)</span>
                          <span className="text-xs text-muted-foreground">Premium coverage</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="full_replacement_deductible">
                        <div className="flex flex-col">
                          <span>Full Replacement (With Deductible)</span>
                          <span className="text-xs text-muted-foreground">Coverage with deductible</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default coverage type for new items. Can be overridden per shipment or item.
                  </p>
                </div>

                {/* Coverage Rates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rate_no_deductible">Full Replacement Rate (No Deductible)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="rate_no_deductible"
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={formData.coverage_rate_full_no_deductible}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            coverage_rate_full_no_deductible: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28 bg-white"
                      />
                      <span className="text-sm text-muted-foreground">
                        = {(formData.coverage_rate_full_no_deductible * 100).toFixed(2)}% of declared value
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate_deductible">Full Replacement Rate (With Deductible)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="rate_deductible"
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={formData.coverage_rate_full_deductible}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            coverage_rate_full_deductible: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28 bg-white"
                      />
                      <span className="text-sm text-muted-foreground">
                        = {(formData.coverage_rate_full_deductible * 100).toFixed(2)}% of declared value
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductible Amount */}
                <div className="space-y-2">
                  <Label htmlFor="deductible_amount">Deductible Amount</Label>
                  <div className="relative max-w-xs">
                    <MaterialIcon name="attach_money" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="deductible_amount"
                      type="number"
                      step="50"
                      min="0"
                      value={formData.coverage_deductible_amount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          coverage_deductible_amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="pl-8 bg-white"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deductible amount for "Full Replacement (With Deductible)" coverage type.
                  </p>
                </div>

                {/* Coverage Scope Options */}
                <div className="space-y-3 pt-2">
                  <Label className="text-sm font-medium">Coverage Scope Options</Label>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allow_shipment" className="text-sm">Allow Shipment-Level Coverage</Label>
                      <p className="text-xs text-muted-foreground">
                        Apply same coverage to all items in a shipment.
                      </p>
                    </div>
                    <Switch
                      id="allow_shipment"
                      checked={formData.coverage_allow_shipment}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, coverage_allow_shipment: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allow_item" className="text-sm">Allow Item-Level Coverage</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow coverage selection on individual items.
                      </p>
                    </div>
                    <Switch
                      id="allow_item"
                      checked={formData.coverage_allow_item}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, coverage_allow_item: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Info box */}
                <div className="bg-blue-100 border border-blue-200 rounded-lg p-3 mt-2">
                  <div className="flex gap-2">
                    <MaterialIcon name="info" size="sm" className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Coverage Premium Calculation</p>
                      <p className="text-xs mt-1">
                        Premium = Declared Value × Rate. For example, $10,000 declared value at 1.88%
                        rate = $188 coverage premium. Standard coverage (60¢/lb) has no additional charge.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

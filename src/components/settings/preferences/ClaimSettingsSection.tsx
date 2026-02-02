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
import { useOrganizationClaimSettings, CoverageTypeValue } from '@/hooks/useOrganizationClaimSettings';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Separator } from '@/components/ui/separator';

export function ClaimSettingsSection() {
  const { settings, loading, saving, updateSettings } = useOrganizationClaimSettings();

  const [formData, setFormData] = useState({
    approval_threshold_amount: 1000,
    approval_required_above_threshold: true,
    default_payout_method: 'credit' as 'credit' | 'check' | 'ach',
    settlement_terms_template: '',
    acceptance_token_expiry_days: 30,
    auto_create_repair_task: true,
    // Valuation Coverage Settings
    coverage_enabled: true,
    default_coverage_type: 'standard' as CoverageTypeValue,
    full_replacement_no_deductible_rate: 0.0188,
    full_replacement_deductible_rate: 0.0142,
    deductible_amount: 300,
    allow_item_level_coverage: true,
    allow_shipment_level_coverage: true,
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
        // Valuation Coverage Settings
        coverage_enabled: settings.coverage_enabled ?? true,
        default_coverage_type: settings.default_coverage_type ?? 'standard',
        full_replacement_no_deductible_rate: settings.full_replacement_no_deductible_rate ?? 0.0188,
        full_replacement_deductible_rate: settings.full_replacement_deductible_rate ?? 0.0142,
        deductible_amount: settings.deductible_amount ?? 300,
        allow_item_level_coverage: settings.allow_item_level_coverage ?? true,
        allow_shipment_level_coverage: settings.allow_shipment_level_coverage ?? true,
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
      // Coverage settings
      formData.coverage_enabled !== (settings.coverage_enabled ?? true) ||
      formData.default_coverage_type !== (settings.default_coverage_type ?? 'standard') ||
      formData.full_replacement_no_deductible_rate !== (settings.full_replacement_no_deductible_rate ?? 0.0188) ||
      formData.full_replacement_deductible_rate !== (settings.full_replacement_deductible_rate ?? 0.0142) ||
      formData.deductible_amount !== (settings.deductible_amount ?? 300) ||
      formData.allow_item_level_coverage !== (settings.allow_item_level_coverage ?? true) ||
      formData.allow_shipment_level_coverage !== (settings.allow_shipment_level_coverage ?? true);
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

        {/* Valuation Coverage Section */}
        <div className="pt-4">
          <Separator className="mb-6" />
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <MaterialIcon name="verified_user" size="md" className="text-primary" />
              <div>
                <h4 className="font-semibold">Valuation Coverage</h4>
                <p className="text-sm text-muted-foreground">
                  Configure coverage options and rates for items and shipments.
                </p>
              </div>
            </div>

            {/* Enable Valuation Coverage */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="coverage_enabled">Enable Valuation Coverage</Label>
                <p className="text-sm text-muted-foreground">
                  Allow clients to select coverage options for their items.
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
              <div className="space-y-6 pl-4 border-l-2 border-muted">
                {/* Default Coverage Type */}
                <div className="space-y-2">
                  <Label htmlFor="default_coverage_type">Default Coverage Type</Label>
                  <Select
                    value={formData.default_coverage_type}
                    onValueChange={(value: CoverageTypeValue) =>
                      setFormData((prev) => ({ ...prev, default_coverage_type: value }))
                    }
                  >
                    <SelectTrigger className="max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Coverage (No charge)</SelectItem>
                      <SelectItem value="full_replacement_no_deductible">Full Replacement (No deductible)</SelectItem>
                      <SelectItem value="full_replacement_deductible">Full Replacement (With deductible)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default coverage type applied to new items.
                  </p>
                </div>

                {/* Coverage Rates */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Coverage Rate Multipliers</Label>

                  {/* Full Replacement No Deductible Rate */}
                  <div className="space-y-2">
                    <Label htmlFor="no_deductible_rate" className="text-sm font-normal">
                      Full Replacement (No Deductible) Rate
                    </Label>
                    <div className="flex items-center gap-2 max-w-xs">
                      <Input
                        id="no_deductible_rate"
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={formData.full_replacement_no_deductible_rate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            full_replacement_no_deductible_rate: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28"
                      />
                      <span className="text-sm text-muted-foreground">
                        ({(formData.full_replacement_no_deductible_rate * 100).toFixed(2)}% of declared value)
                      </span>
                    </div>
                  </div>

                  {/* Full Replacement Deductible Rate */}
                  <div className="space-y-2">
                    <Label htmlFor="deductible_rate" className="text-sm font-normal">
                      Full Replacement (With Deductible) Rate
                    </Label>
                    <div className="flex items-center gap-2 max-w-xs">
                      <Input
                        id="deductible_rate"
                        type="number"
                        step="0.0001"
                        min="0"
                        max="1"
                        value={formData.full_replacement_deductible_rate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            full_replacement_deductible_rate: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28"
                      />
                      <span className="text-sm text-muted-foreground">
                        ({(formData.full_replacement_deductible_rate * 100).toFixed(2)}% of declared value)
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
                      value={formData.deductible_amount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          deductible_amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="pl-8 w-32"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Deductible applied to "Full Replacement with Deductible" claims.
                  </p>
                </div>

                {/* Coverage Scope Options */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Coverage Scope</Label>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allow_item_coverage" className="font-normal">Allow Item-Level Coverage</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable coverage selection for individual items.
                      </p>
                    </div>
                    <Switch
                      id="allow_item_coverage"
                      checked={formData.allow_item_level_coverage}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, allow_item_level_coverage: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allow_shipment_coverage" className="font-normal">Allow Shipment-Level Coverage</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable coverage selection for entire shipments.
                      </p>
                    </div>
                    <Switch
                      id="allow_shipment_coverage"
                      checked={formData.allow_shipment_level_coverage}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, allow_shipment_level_coverage: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
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

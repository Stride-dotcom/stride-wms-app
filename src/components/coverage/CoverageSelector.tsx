import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserRole } from '@/hooks/useRoles';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

// Canonical coverage types (matching database constraint)
export type CoverageType = 'standard' | 'full_replacement_no_deductible' | 'full_replacement_deductible' | 'pending';

interface CoverageSelectorProps {
  itemId: string;
  accountId?: string | null;
  sidemarkId?: string | null;
  classId?: string | null;
  currentCoverage?: CoverageType | null;
  currentDeclaredValue?: number | null;
  currentWeight?: number | null;
  isStaff?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  onUpdate?: (coverageType: CoverageType, declaredValue: number | null) => void;
}

// Default rates - will be overridden by tenant/account settings
const DEFAULT_RATES = {
  standard: 0,
  full_replacement_no_deductible: 0.0188, // 1.88% of declared value
  full_replacement_deductible: 0.0142, // 1.42% of declared value
  pending: 0,
};

const DEFAULT_DEDUCTIBLE = 300;

const COVERAGE_LABELS: Record<CoverageType, string> = {
  standard: 'Standard (60c/lb)',
  full_replacement_no_deductible: 'Full Replacement (No Deductible)',
  full_replacement_deductible: 'Full Replacement (With Deductible)',
  pending: 'Pending - Awaiting Selection',
};

// Coverage badge component for display in item lists
export function CoverageBadge({ coverageType }: { coverageType: CoverageType | null | undefined }) {
  if (!coverageType || coverageType === 'pending') {
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
        <MaterialIcon name="schedule" className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  }

  if (coverageType === 'standard') {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        <MaterialIcon name="shield" className="h-3 w-3 mr-1" />
        Standard
      </Badge>
    );
  }

  if (coverageType === 'full_replacement_no_deductible') {
    return (
      <Badge className="bg-blue-600 hover:bg-blue-700">
        <MaterialIcon name="verified_user" className="h-3 w-3 mr-1" />
        Full (No Ded.)
      </Badge>
    );
  }

  if (coverageType === 'full_replacement_deductible') {
    return (
      <Badge className="bg-green-600 hover:bg-green-700">
        <MaterialIcon name="verified_user" className="h-3 w-3 mr-1" />
        Full ($300 Ded.)
      </Badge>
    );
  }

  return null;
}

export function CoverageSelector({
  itemId,
  accountId,
  sidemarkId,
  classId,
  currentCoverage,
  currentDeclaredValue,
  currentWeight,
  isStaff = true,
  readOnly = false,
  compact = false,
  onUpdate,
}: CoverageSelectorProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { isAdmin } = useCurrentUserRole();

  const [coverageType, setCoverageType] = useState<CoverageType>(currentCoverage || 'standard');
  const [declaredValue, setDeclaredValue] = useState(currentDeclaredValue?.toString() || '');
  const [weightLbs, setWeightLbs] = useState(currentWeight?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    type: CoverageType;
    cost: number;
    delta: number;
  } | null>(null);

  // Coverage rates from tenant/account settings
  const [rates, setRates] = useState({
    full_replacement_no_deductible: DEFAULT_RATES.full_replacement_no_deductible,
    full_replacement_deductible: DEFAULT_RATES.full_replacement_deductible,
    deductible_amount: DEFAULT_DEDUCTIBLE,
  });

  // Fetch coverage rates from tenant/account settings
  useEffect(() => {
    async function fetchRates() {
      if (!profile?.tenant_id) return;

      try {
        // First check for account-level override
        if (accountId) {
          const { data: accountSettings } = await (supabase as any)
            .from('account_coverage_settings')
            .select('*')
            .eq('tenant_id', profile.tenant_id)
            .eq('account_id', accountId)
            .maybeSingle();

          if (accountSettings?.override_enabled) {
            setRates({
              full_replacement_no_deductible: accountSettings.coverage_rate_full_no_deductible ?? DEFAULT_RATES.full_replacement_no_deductible,
              full_replacement_deductible: accountSettings.coverage_rate_full_deductible ?? DEFAULT_RATES.full_replacement_deductible,
              deductible_amount: accountSettings.coverage_deductible_amount ?? DEFAULT_DEDUCTIBLE,
            });
            return;
          }
        }

        // Fall back to tenant-level settings
        const { data: orgSettings } = await (supabase as any)
          .from('organization_claim_settings')
          .select('coverage_rate_full_no_deductible, coverage_rate_full_deductible, coverage_deductible_amount')
          .eq('tenant_id', profile.tenant_id)
          .maybeSingle();

        if (orgSettings) {
          setRates({
            full_replacement_no_deductible: orgSettings.coverage_rate_full_no_deductible ?? DEFAULT_RATES.full_replacement_no_deductible,
            full_replacement_deductible: orgSettings.coverage_rate_full_deductible ?? DEFAULT_RATES.full_replacement_deductible,
            deductible_amount: orgSettings.coverage_deductible_amount ?? DEFAULT_DEDUCTIBLE,
          });
        }
      } catch (error) {
        console.error('Error fetching coverage rates:', error);
      }
    }

    fetchRates();
  }, [profile?.tenant_id, accountId]);

  // Calculate coverage cost using configurable rates
  const calculateCost = (type: CoverageType, value: number): number => {
    if (type === 'standard' || type === 'pending') return 0;
    if (type === 'full_replacement_no_deductible') {
      return value * rates.full_replacement_no_deductible;
    }
    if (type === 'full_replacement_deductible') {
      return value * rates.full_replacement_deductible;
    }
    return 0;
  };

  // Get deductible for coverage type
  const getDeductible = (type: CoverageType): number => {
    if (type === 'full_replacement_deductible') {
      return rates.deductible_amount;
    }
    return 0;
  };

  // Get rate for coverage type
  const getRate = (type: CoverageType): number => {
    if (type === 'full_replacement_no_deductible') {
      return rates.full_replacement_no_deductible;
    }
    if (type === 'full_replacement_deductible') {
      return rates.full_replacement_deductible;
    }
    return 0;
  };

  // Calculate maximum coverage for standard
  const calculateStandardCap = (weight: number): number => {
    return weight * 0.60; // $0.60 per lb (industry standard)
  };

  const currentCost = calculateCost(currentCoverage || 'standard', currentDeclaredValue || 0);
  const newCost = calculateCost(coverageType, parseFloat(declaredValue) || 0);
  const costDelta = newCost - currentCost;

  const handleSave = async () => {
    const dv = parseFloat(declaredValue);

    // Validation
    if ((coverageType === 'full_replacement_deductible' || coverageType === 'full_replacement_no_deductible') && (!dv || dv <= 0)) {
      toast({
        variant: 'destructive',
        title: 'Declared Value Required',
        description: 'Full replacement coverage requires a declared value.',
      });
      return;
    }

    // If already billed and values changed, show confirmation
    if (currentCoverage && currentCoverage !== 'standard' && currentCoverage !== 'pending') {
      if (!isAdmin) {
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'Only administrators can modify billed coverage.',
        });
        return;
      }

      if (costDelta !== 0) {
        setPendingChange({
          type: coverageType,
          cost: newCost,
          delta: costDelta,
        });
        setShowConfirmDialog(true);
        return;
      }
    }

    await saveCoverage();
  };

  const saveCoverage = async () => {
    setSaving(true);
    try {
      const dv = parseFloat(declaredValue) || null;
      const weight = parseFloat(weightLbs) || null;
      const rate = getRate(coverageType);
      const deductible = getDeductible(coverageType);

      // Update item
      const { error: itemError } = await supabase
        .from('items')
        .update({
          coverage_type: coverageType,
          declared_value: dv,
          weight_lbs: weight,
          coverage_rate: rate,
          coverage_deductible: deductible,
          coverage_selected_at: new Date().toISOString(),
          coverage_selected_by: profile?.id,
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Create billing event if applicable
      if (coverageType !== 'standard' && coverageType !== 'pending' && dv && profile?.tenant_id) {
        const cost = calculateCost(coverageType, dv);

        // If there's a delta (modification), handle accordingly
        if (pendingChange && pendingChange.delta !== 0) {
          if (pendingChange.delta > 0) {
            // Additional charge
            await supabase.from('billing_events').insert([{
              tenant_id: profile.tenant_id,
              account_id: accountId,
              sidemark_id: sidemarkId,
              class_id: classId,
              item_id: itemId,
              event_type: 'coverage',
              charge_type: 'handling_coverage',
              description: `Coverage adjustment: ${COVERAGE_LABELS[coverageType]}`,
              quantity: 1,
              unit_rate: pendingChange.delta,
              total_amount: pendingChange.delta,
              status: 'unbilled',
              occurred_at: new Date().toISOString(),
              metadata: {
                coverage_type: coverageType,
                rate: rate,
                declared_value: dv,
                is_adjustment: true,
              },
              created_by: profile.id,
            }]);
          } else {
            // Credit
            await supabase.from('account_credits').insert([{
              tenant_id: profile.tenant_id,
              account_id: accountId,
              amount: Math.abs(pendingChange.delta),
              reason: `Coverage adjustment credit for item`,
              created_by: profile.id,
            }]);
          }
        } else if (!currentCoverage || currentCoverage === 'standard' || currentCoverage === 'pending') {
          // Initial coverage charge
          await supabase.from('billing_events').insert([{
            tenant_id: profile.tenant_id,
            account_id: accountId,
            sidemark_id: sidemarkId,
            class_id: classId,
            item_id: itemId,
            event_type: 'coverage',
            charge_type: 'handling_coverage',
            description: `Coverage: ${COVERAGE_LABELS[coverageType]} on declared value $${dv.toFixed(2)}`,
            quantity: 1,
            unit_rate: cost,
            total_amount: cost,
            status: 'unbilled',
            occurred_at: new Date().toISOString(),
            metadata: {
              coverage_type: coverageType,
              rate: rate,
              declared_value: dv,
            },
            created_by: profile.id,
          }]);
        }
      }

      toast({ title: 'Coverage Updated' });
      onUpdate?.(coverageType, parseFloat(declaredValue) || null);
    } catch (error) {
      console.error('Error saving coverage:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save coverage',
      });
    } finally {
      setSaving(false);
      setShowConfirmDialog(false);
      setPendingChange(null);
    }
  };

  const hasChanges =
    coverageType !== (currentCoverage || 'standard') ||
    declaredValue !== (currentDeclaredValue?.toString() || '') ||
    weightLbs !== (currentWeight?.toString() || '');

  // Compact mode for quick entry table
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Select
          value={coverageType}
          onValueChange={(v) => setCoverageType(v as CoverageType)}
          disabled={readOnly}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard" className="text-xs">Standard (60c/lb)</SelectItem>
            <SelectItem value="full_replacement_no_deductible" className="text-xs">Full (No Ded.)</SelectItem>
            <SelectItem value="full_replacement_deductible" className="text-xs">Full (${rates.deductible_amount} Ded.)</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          value={declaredValue}
          onChange={(e) => setDeclaredValue(e.target.value)}
          placeholder="$0.00"
          className="w-24 h-8 text-xs"
          disabled={readOnly}
        />
        {hasChanges && (
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="h-8 px-2">
            {saving ? <MaterialIcon name="progress_activity" className="animate-spin" style={{ fontSize: '12px' }} /> : 'Save'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="verified_user" size="md" className="text-blue-600" />
          Valuation Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Coverage Badge */}
        {currentCoverage && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <CoverageBadge coverageType={currentCoverage} />
          </div>
        )}

        {/* Coverage Type */}
        <div className="space-y-2">
          <Label>Coverage Type</Label>
          <Select
            value={coverageType}
            onValueChange={(v) => setCoverageType(v as CoverageType)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">
                <div className="flex flex-col">
                  <span>Standard (60c/lb)</span>
                  <span className="text-xs text-muted-foreground">Basic carrier liability - no charge</span>
                </div>
              </SelectItem>
              <SelectItem value="full_replacement_no_deductible">
                <div className="flex flex-col">
                  <span>Full Replacement (No Deductible)</span>
                  <span className="text-xs text-muted-foreground">{(rates.full_replacement_no_deductible * 100).toFixed(2)}% of declared value</span>
                </div>
              </SelectItem>
              <SelectItem value="full_replacement_deductible">
                <div className="flex flex-col">
                  <span>Full Replacement (${rates.deductible_amount} Deductible)</span>
                  <span className="text-xs text-muted-foreground">{(rates.full_replacement_deductible * 100).toFixed(2)}% of declared value</span>
                </div>
              </SelectItem>
              <SelectItem value="pending">
                <div className="flex flex-col">
                  <span>Pending</span>
                  <span className="text-xs text-muted-foreground">Awaiting client selection</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Weight */}
        <div className="space-y-2">
          <Label>Weight (lbs)</Label>
          <Input
            type="number"
            step="0.1"
            value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)}
            placeholder="0.0"
            disabled={readOnly || (!isStaff && currentWeight !== null)}
          />
          {weightLbs && coverageType === 'standard' && (
            <p className="text-xs text-muted-foreground">
              Standard coverage cap: ${calculateStandardCap(parseFloat(weightLbs) || 0).toFixed(2)}
            </p>
          )}
        </div>

        {/* Declared Value */}
        <div className="space-y-2">
          <Label>
            Declared Value ($)
            {(coverageType === 'full_replacement_deductible' || coverageType === 'full_replacement_no_deductible') && (
              <span className="text-destructive ml-1">*</span>
            )}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={declaredValue}
            onChange={(e) => setDeclaredValue(e.target.value)}
            placeholder="0.00"
            required={coverageType === 'full_replacement_deductible' || coverageType === 'full_replacement_no_deductible'}
            disabled={readOnly || (!isAdmin && currentDeclaredValue !== null && currentCoverage !== 'pending' && currentCoverage !== 'standard')}
          />
          {(coverageType === 'full_replacement_deductible' || coverageType === 'full_replacement_no_deductible') && !declaredValue && (
            <p className="text-xs text-destructive">
              Declared value is required for full replacement coverage.
            </p>
          )}
          {!isAdmin && currentDeclaredValue !== null && currentCoverage !== 'pending' && currentCoverage !== 'standard' && (
            <p className="text-xs text-yellow-500">
              Only administrators can modify declared value after coverage is applied.
            </p>
          )}
        </div>

        {/* Coverage Cost Preview */}
        {(coverageType === 'full_replacement_deductible' || coverageType === 'full_replacement_no_deductible') && declaredValue && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Coverage Rate:</span>
              <span className="font-mono">{(getRate(coverageType) * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Deductible:</span>
              <span className="font-mono">${getDeductible(coverageType).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-medium pt-1 border-t">
              <span>Coverage Premium:</span>
              <span className="text-blue-600 font-mono">
                ${calculateCost(coverageType, parseFloat(declaredValue) || 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Pending Coverage Notice */}
        {coverageType === 'pending' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start gap-2">
              <MaterialIcon name="schedule" size="sm" className="text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Coverage is pending. The client will be prompted to enter a declared value and select coverage.
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        {!readOnly && hasChanges && (
          <Button
            onClick={handleSave}
            disabled={saving || ((coverageType === 'full_replacement_deductible' || coverageType === 'full_replacement_no_deductible') && (!declaredValue || parseFloat(declaredValue) <= 0))}
            className="w-full"
          >
            {saving && <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-2" />}
            Save Coverage
          </Button>
        )}
      </CardContent>

      {/* Confirmation Dialog for Coverage Changes */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Coverage Change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && pendingChange.delta > 0 ? (
                <>
                  This will create an additional charge of{' '}
                  <strong>${pendingChange.delta.toFixed(2)}</strong>.
                </>
              ) : pendingChange && pendingChange.delta < 0 ? (
                <>
                  This will create a credit of{' '}
                  <strong>${Math.abs(pendingChange.delta).toFixed(2)}</strong> to the account.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveCoverage}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

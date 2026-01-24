import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Shield, Info } from 'lucide-react';

export type CoverageType = 'standard' | 'full_deductible' | 'full_no_deductible' | 'pending';

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

const COVERAGE_RATES = {
  standard: 0,
  full_deductible: 0.015, // 1.5% of declared value
  full_no_deductible: 0.0188, // 1.88% of declared value
  pending: 0,
};

const COVERAGE_DEDUCTIBLES = {
  standard: 0,
  full_deductible: 300,
  full_no_deductible: 0,
  pending: 0,
};

const COVERAGE_LABELS: Record<CoverageType, string> = {
  standard: 'Standard Coverage (No charge)',
  full_deductible: 'Full Replacement ($300 deductible)',
  full_no_deductible: 'Full Replacement (No deductible)',
  pending: 'Pending - Awaiting Declared Value',
};

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

  // Calculate coverage cost
  const calculateCost = (type: CoverageType, value: number): number => {
    if (type === 'standard' || type === 'pending') return 0;
    return value * COVERAGE_RATES[type];
  };

  // Calculate maximum coverage for standard
  const calculateStandardCap = (weight: number): number => {
    return weight * 0.72; // $0.72 per lb
  };

  const currentCost = calculateCost(currentCoverage || 'standard', currentDeclaredValue || 0);
  const newCost = calculateCost(coverageType, parseFloat(declaredValue) || 0);
  const costDelta = newCost - currentCost;

  const handleSave = async () => {
    const dv = parseFloat(declaredValue);

    // Validation
    if ((coverageType === 'full_deductible' || coverageType === 'full_no_deductible') && (!dv || dv <= 0)) {
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
      const rate = COVERAGE_RATES[coverageType];
      const deductible = COVERAGE_DEDUCTIBLES[coverageType];

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
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COVERAGE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">{label.split('(')[0].trim()}</SelectItem>
            ))}
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
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Handling Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
              {Object.entries(COVERAGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
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
          <Label>Declared Value ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={declaredValue}
            onChange={(e) => setDeclaredValue(e.target.value)}
            placeholder="0.00"
            disabled={readOnly || (!isAdmin && currentDeclaredValue !== null && currentCoverage !== 'pending' && currentCoverage !== 'standard')}
          />
          {!isAdmin && currentDeclaredValue !== null && currentCoverage !== 'pending' && currentCoverage !== 'standard' && (
            <p className="text-xs text-yellow-500">
              Only administrators can modify declared value after coverage is applied.
            </p>
          )}
        </div>

        {/* Coverage Cost Preview */}
        {(coverageType === 'full_deductible' || coverageType === 'full_no_deductible') && declaredValue && (
          <div className="p-3 bg-muted rounded-md space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Coverage Rate:</span>
              <span>{(COVERAGE_RATES[coverageType] * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Deductible:</span>
              <span>${COVERAGE_DEDUCTIBLES[coverageType].toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span>Coverage Cost:</span>
              <span className="text-primary">
                ${calculateCost(coverageType, parseFloat(declaredValue) || 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Pending Coverage Notice */}
        {coverageType === 'pending' && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-yellow-500 mt-0.5" />
              <p className="text-sm text-yellow-500">
                Coverage is pending. The client will be prompted to enter a declared value and select coverage.
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        {!readOnly && hasChanges && (
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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

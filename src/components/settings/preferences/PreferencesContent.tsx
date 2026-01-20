import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Tag, XCircle, Settings, Calendar, Coffee } from 'lucide-react';
import { useTenantPreferences, TenantPreferencesUpdate } from '@/hooks/useTenantPreferences';
import { StorageInspectionSection } from './StorageInspectionSection';
import { BillingRatesSection } from './BillingRatesSection';
import { LegalLinksSection } from './LegalLinksSection';
import { DefaultNotesSection } from './DefaultNotesSection';
import { ComingSoonSection } from './ComingSoonSection';
import { EmailDomainSection } from './EmailDomainSection';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export function PreferencesContent() {
  const { preferences, loading, saving, updatePreferences } = useTenantPreferences();
  
  // Local form state
  const [formData, setFormData] = useState({
    free_storage_days: 0,
    will_call_minimum: 30,
    should_create_inspections: false,
    daily_storage_rate_per_cuft: 0.04,
    sales_tax_rate: 0,
    default_shipment_notes: '',
    terms_of_service_url: '',
    privacy_policy_url: '',
  });

  // Sync from preferences when loaded
  useEffect(() => {
    if (preferences) {
      setFormData({
        free_storage_days: preferences.free_storage_days,
        will_call_minimum: preferences.will_call_minimum,
        should_create_inspections: preferences.should_create_inspections,
        daily_storage_rate_per_cuft: preferences.daily_storage_rate_per_cuft,
        sales_tax_rate: preferences.sales_tax_rate || 0,
        default_shipment_notes: preferences.default_shipment_notes || '',
        terms_of_service_url: preferences.terms_of_service_url || '',
        privacy_policy_url: preferences.privacy_policy_url || '',
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    const updates: TenantPreferencesUpdate = {
      free_storage_days: formData.free_storage_days,
      will_call_minimum: formData.will_call_minimum,
      should_create_inspections: formData.should_create_inspections,
      daily_storage_rate_per_cuft: formData.daily_storage_rate_per_cuft,
      sales_tax_rate: formData.sales_tax_rate,
      default_shipment_notes: formData.default_shipment_notes || null,
      terms_of_service_url: formData.terms_of_service_url || null,
      privacy_policy_url: formData.privacy_policy_url || null,
    };
    await updatePreferences(updates);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[150px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Sections */}
      <StorageInspectionSection
        freeStorageDays={formData.free_storage_days}
        willCallMinimum={formData.will_call_minimum}
        shouldCreateInspections={formData.should_create_inspections}
        onFreeStorageDaysChange={(value) => setFormData(prev => ({ ...prev, free_storage_days: value }))}
        onWillCallMinimumChange={(value) => setFormData(prev => ({ ...prev, will_call_minimum: value }))}
        onShouldCreateInspectionsChange={(value) => setFormData(prev => ({ ...prev, should_create_inspections: value }))}
      />

      <BillingRatesSection
        dailyStorageRatePerCuft={formData.daily_storage_rate_per_cuft}
        onDailyStorageRateChange={(value) => setFormData(prev => ({ ...prev, daily_storage_rate_per_cuft: value }))}
        salesTaxRate={formData.sales_tax_rate}
        onSalesTaxRateChange={(value) => setFormData(prev => ({ ...prev, sales_tax_rate: value }))}
        shipmentMinimum={preferences?.shipment_minimum}
        hourlyRate={preferences?.hourly_rate}
        baseRateIncludesPieces={preferences?.base_rate_includes_pieces}
        additionalPieceRate={preferences?.additional_piece_rate}
      />

      {/* Coming Soon Sections */}
      <ComingSoonSection title="Custom Field Labels" icon={Tag}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Order Field Label</Label>
            <Input value={preferences?.order_field_label || 'Order #'} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Custom Field 1 Label</Label>
            <Input value={preferences?.custom_field_1_label || 'Sidemark'} disabled className="bg-muted" />
          </div>
        </div>
      </ComingSoonSection>

      <ComingSoonSection title="Cancellation & Removal Fees" icon={XCircle}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Late Cancellation Fee</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input value={preferences?.late_cancellation_fee || 100} disabled className="pl-7 bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Removal First 2 Pieces</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input value={preferences?.removal_first_2_pieces || 185} disabled className="pl-7 bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Extra Piece Rate</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input value={preferences?.removal_extra_piece_default || 0} disabled className="pl-7 bg-muted" />
            </div>
          </div>
        </div>
      </ComingSoonSection>

      <ComingSoonSection title="Operational Rules" icon={Settings}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">Require Signature to Finish</Label>
            <Switch checked={preferences?.require_signature_to_finish ?? true} disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">Allow Typed Name as Signature</Label>
            <Switch checked={preferences?.allow_typed_name_as_signature ?? true} disabled />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground">Allow Billing to Consumer</Label>
            <Switch checked={preferences?.allow_billing_to_consumer ?? true} disabled />
          </div>
        </div>
      </ComingSoonSection>

      <ComingSoonSection title="Scheduling & Reservations" icon={Calendar}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Morning Starts At</Label>
            <Input type="time" value={preferences?.morning_starts_at || '09:00'} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Window Length (hours)</Label>
            <Input type="number" value={preferences?.window_length_hours || 2} disabled className="bg-muted" />
          </div>
        </div>
      </ComingSoonSection>

      <ComingSoonSection title="Break Settings" icon={Coffee}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Break Duration (minutes)</Label>
            <Input type="number" value={preferences?.break_minutes || 30} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Break Every (hours)</Label>
            <Input type="number" value={preferences?.break_every_hours || 4} disabled className="bg-muted" />
          </div>
        </div>
      </ComingSoonSection>

      {/* Active Sections (continued) */}
      <DefaultNotesSection
        defaultShipmentNotes={formData.default_shipment_notes}
        onDefaultShipmentNotesChange={(value) => setFormData(prev => ({ ...prev, default_shipment_notes: value }))}
      />

      <LegalLinksSection
        termsOfServiceUrl={formData.terms_of_service_url}
        privacyPolicyUrl={formData.privacy_policy_url}
        onTermsOfServiceUrlChange={(value) => setFormData(prev => ({ ...prev, terms_of_service_url: value }))}
        onPrivacyPolicyUrlChange={(value) => setFormData(prev => ({ ...prev, privacy_policy_url: value }))}
      />

      {/* Email Domain Configuration */}
      <EmailDomainSection />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

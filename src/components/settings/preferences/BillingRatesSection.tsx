import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';

interface BillingRatesSectionProps {
  dailyStorageRatePerCuft: number;
  onDailyStorageRateChange: (value: number) => void;
  salesTaxRate: number;
  onSalesTaxRateChange: (value: number) => void;
  willCallMinimum: number;
  onWillCallMinimumChange: (value: number) => void;
  receivingChargeMinimum: number;
  onReceivingChargeMinimumChange: (value: number) => void;
  // Future fields (read-only display)
  shipmentMinimum?: number | null;
  hourlyRate?: number | null;
  baseRateIncludesPieces?: number | null;
  additionalPieceRate?: number | null;
}

export function BillingRatesSection({
  dailyStorageRatePerCuft,
  onDailyStorageRateChange,
  salesTaxRate,
  onSalesTaxRateChange,
  willCallMinimum,
  onWillCallMinimumChange,
  receivingChargeMinimum,
  onReceivingChargeMinimumChange,
  shipmentMinimum,
  hourlyRate,
  baseRateIncludesPieces,
  additionalPieceRate,
}: BillingRatesSectionProps) {
  // Handle text input for sales tax rate
  const handleSalesTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(value) || 0;
    onSalesTaxRateChange(numValue / 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Billing & Rate Settings
        </CardTitle>
        <CardDescription>
          Configure billing rates for storage and services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Fields */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="daily_storage_rate">Daily Storage Rate per cu ft</Label>
              <Badge variant="default" className="text-xs">Active</Badge>
            </div>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="daily_storage_rate"
                type="text"
                inputMode="decimal"
                value={dailyStorageRatePerCuft}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  onDailyStorageRateChange(parseFloat(value) || 0);
                }}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Storage charge = item cubic feet × this rate × days in storage
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="sales_tax_rate">Sales Tax Rate</Label>
              <Badge variant="default" className="text-xs">Active</Badge>
            </div>
            <div className="relative max-w-xs">
              <Input
                id="sales_tax_rate"
                type="text"
                inputMode="decimal"
                value={(salesTaxRate * 100).toFixed(2)}
                onChange={handleSalesTaxChange}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Applied to taxable charges on invoices
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="will_call_minimum">Will Call Minimum</Label>
              <Badge variant="default" className="text-xs">Active</Badge>
            </div>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="will_call_minimum"
                type="text"
                inputMode="decimal"
                value={willCallMinimum}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  onWillCallMinimumChange(parseFloat(value) || 0);
                }}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum charge for will call orders
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="receiving_charge_minimum">Receiving Charge Minimum</Label>
              <Badge variant="default" className="text-xs">Active</Badge>
            </div>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="receiving_charge_minimum"
                type="text"
                inputMode="decimal"
                value={receivingChargeMinimum}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  onReceivingChargeMinimumChange(parseFloat(value) || 0);
                }}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum charge for receiving items
            </p>
          </div>
        </div>

        {/* Future Fields - Coming Soon */}
        <div className="rounded-lg border border-dashed p-4 opacity-60">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            <span className="text-sm text-muted-foreground">Additional billing settings</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 pointer-events-none">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Shipment Minimum</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={shipmentMinimum || 0}
                  disabled
                  className="pl-7 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Hourly Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={hourlyRate || 0}
                  disabled
                  className="pl-7 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Base Rate Includes Pieces</Label>
              <Input
                type="number"
                value={baseRateIncludesPieces || 0}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Additional Piece Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={additionalPieceRate || 0}
                  disabled
                  className="pl-7 bg-muted"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

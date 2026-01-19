import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';

interface BillingRatesSectionProps {
  dailyStorageRatePerCuft: number;
  onDailyStorageRateChange: (value: number) => void;
  // Future fields (read-only display)
  shipmentMinimum?: number | null;
  hourlyRate?: number | null;
  baseRateIncludesPieces?: number | null;
  additionalPieceRate?: number | null;
}

export function BillingRatesSection({
  dailyStorageRatePerCuft,
  onDailyStorageRateChange,
  shipmentMinimum,
  hourlyRate,
  baseRateIncludesPieces,
  additionalPieceRate,
}: BillingRatesSectionProps) {
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
        {/* Active Field */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="daily_storage_rate">Daily Storage Rate per cu ft</Label>
            <Badge variant="default" className="text-xs">Active</Badge>
          </div>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="daily_storage_rate"
              type="number"
              min="0"
              step="0.0001"
              value={dailyStorageRatePerCuft}
              onChange={(e) => onDailyStorageRateChange(parseFloat(e.target.value) || 0)}
              className="pl-7"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Storage charge = item cubic feet × this rate × days in storage
          </p>
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

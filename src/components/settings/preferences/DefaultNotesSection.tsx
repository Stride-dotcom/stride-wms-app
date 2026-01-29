import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface DefaultNotesSectionProps {
  defaultShipmentNotes: string;
  onDefaultShipmentNotesChange: (value: string) => void;
}

export function DefaultNotesSection({
  defaultShipmentNotes,
  onDefaultShipmentNotesChange,
}: DefaultNotesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="description" size="md" />
          Default Shipment Notes
        </CardTitle>
        <CardDescription>
          Default notes to pre-populate on new shipments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="default_notes">Default Notes</Label>
          <Textarea
            id="default_notes"
            placeholder="Enter default notes that will appear on new shipments..."
            rows={4}
            value={defaultShipmentNotes}
            onChange={(e) => onDefaultShipmentNotesChange(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

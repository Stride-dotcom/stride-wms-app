import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Claim, useClaims } from '@/hooks/useClaims';
import { Loader2, Save, MessageSquare, Lock } from 'lucide-react';

interface ClaimNotesProps {
  claim: Claim;
  isStaff?: boolean;
  readOnly?: boolean;
  onUpdate?: () => void;
}

export function ClaimNotes({ claim, isStaff = true, readOnly = false, onUpdate }: ClaimNotesProps) {
  const { updateClaim, addAuditEntry } = useClaims();
  // Use resolution_notes for notes since the table uses that column
  const [resolutionNotes, setResolutionNotes] = useState(claim.resolution_notes || '');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleNotesChange = (value: string) => {
    setResolutionNotes(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (resolutionNotes !== claim.resolution_notes) {
        await updateClaim(claim.id, { resolution_notes: resolutionNotes });
        await addAuditEntry(claim.id, 'notes_updated', { resolution_notes: resolutionNotes });
        setHasChanges(false);
        onUpdate?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resolution Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Notes & Resolution Details
            {isStaff && (
              <Badge variant="outline" className="ml-2 text-xs border-yellow-500 text-yellow-500">
                Staff only
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            <div className="p-3 bg-muted rounded-md min-h-[100px] whitespace-pre-wrap">
              {resolutionNotes || 'No notes added'}
            </div>
          ) : (
            <Textarea
              value={resolutionNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about the claim investigation, resolution details, etc..."
              rows={6}
            />
          )}
        </CardContent>
      </Card>

      {/* Description (Read-only) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Original Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-muted rounded-md min-h-[60px] whitespace-pre-wrap">
            {claim.description || 'No description provided'}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {!readOnly && hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Notes
          </Button>
        </div>
      )}
    </div>
  );
}

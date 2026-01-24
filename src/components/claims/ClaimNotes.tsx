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
  const [publicNotes, setPublicNotes] = useState(claim.public_notes || '');
  const [internalNotes, setInternalNotes] = useState(claim.internal_notes || '');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handlePublicChange = (value: string) => {
    setPublicNotes(value);
    setHasChanges(true);
  };

  const handleInternalChange = (value: string) => {
    setInternalNotes(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Partial<Claim> = {};
      
      if (publicNotes !== claim.public_notes) {
        updateData.public_notes = publicNotes;
      }
      if (isStaff && internalNotes !== claim.internal_notes) {
        updateData.internal_notes = internalNotes;
      }

      if (Object.keys(updateData).length > 0) {
        await updateClaim(claim.id, updateData);
        await addAuditEntry(claim.id, 'notes_updated', updateData);
        setHasChanges(false);
        onUpdate?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Public Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Public Notes
            <Badge variant="outline" className="ml-2 text-xs">
              Visible to client
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            <div className="p-3 bg-muted rounded-md min-h-[100px] whitespace-pre-wrap">
              {publicNotes || 'No public notes'}
            </div>
          ) : (
            <Textarea
              value={publicNotes}
              onChange={(e) => handlePublicChange(e.target.value)}
              placeholder="Notes visible to the client..."
              rows={4}
            />
          )}
        </CardContent>
      </Card>

      {/* Internal Notes (Staff Only) */}
      {isStaff && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" />
              Internal Notes
              <Badge variant="outline" className="ml-2 text-xs border-yellow-500 text-yellow-500">
                Staff only
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              <div className="p-3 bg-muted rounded-md min-h-[100px] whitespace-pre-wrap">
                {internalNotes || 'No internal notes'}
              </div>
            ) : (
              <Textarea
                value={internalNotes}
                onChange={(e) => handleInternalChange(e.target.value)}
                placeholder="Internal notes (not visible to client)..."
                rows={4}
              />
            )}
          </CardContent>
        </Card>
      )}

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

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { useInboundCandidates, type CandidateParams, type InboundCandidate } from '@/hooks/useInboundCandidates';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DockIntakeMatchingPanelProps {
  dockIntakeId: string;
  params: CandidateParams;
  onLinked?: () => void;
}

function confidenceBadgeVariant(score: number): 'default' | 'secondary' | 'outline' {
  if (score >= 80) return 'default';
  if (score >= 50) return 'secondary';
  return 'outline';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}

export default function DockIntakeMatchingPanel({
  dockIntakeId,
  params,
  onLinked,
}: DockIntakeMatchingPanelProps) {
  const { candidates, loading } = useInboundCandidates(params);
  const { toast } = useToast();
  const [linking, setLinking] = useState<string | null>(null);

  const handleLink = useCallback(
    async (candidate: InboundCandidate) => {
      try {
        setLinking(candidate.shipment_id);
        const { data, error } = await supabase.rpc('rpc_link_dock_intake_to_shipment', {
          p_dock_intake_id: dockIntakeId,
          p_linked_shipment_id: candidate.shipment_id,
          p_link_type: candidate.inbound_kind,
          p_confidence_score: candidate.confidence_score,
        });
        if (error) throw error;

        toast({
          title: 'Linked',
          description: `Dock intake linked to ${candidate.shipment_number}.`,
        });
        onLinked?.();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Link Failed',
          description: error instanceof Error ? error.message : 'Failed to link.',
        });
      } finally {
        setLinking(null);
      }
    },
    [dockIntakeId, toast, onLinked]
  );

  const hasParams = params.accountId || params.vendorName || params.refValue;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MaterialIcon name="search" size="sm" />
          Matching Candidates
          <HelpTip tooltip="Suggested manifest/expected shipments that may match this dock intake. Results are ranked by confidence. Click Link to associate. Never auto-linked." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasParams ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <MaterialIcon name="info" size="lg" className="mb-2 opacity-40" />
            <p>Enter an account, vendor, or reference number above to search for matching shipments.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-primary" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <MaterialIcon name="search_off" size="lg" className="mb-2 opacity-40" />
            <p>No matching candidates found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.shipment_id}
                className="flex items-start justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-sm">
                      {c.shipment_number}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.inbound_kind}
                    </Badge>
                    <Badge variant={confidenceBadgeVariant(c.confidence_score)}>
                      {c.confidence_score}% — {c.confidence_label}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.account_name || 'No account'}
                    {c.vendor_name ? ` · Vendor: ${c.vendor_name}` : ''}
                    {c.expected_pieces ? ` · ${c.expected_pieces} pcs` : ''}
                    {c.eta_start ? ` · ETA: ${formatDate(c.eta_start)}` : ''}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLink(c)}
                  disabled={linking === c.shipment_id}
                >
                  {linking === c.shipment_id ? (
                    <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                  ) : (
                    <>
                      <MaterialIcon name="link" size="sm" className="mr-1" />
                      Link
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

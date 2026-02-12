import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { useInboundCandidates, type CandidateParams, type InboundCandidate } from '@/hooks/useInboundCandidates';
import { useInboundLinks, type InboundLink } from '@/hooks/useInboundLinks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DockIntakeMatchingPanelProps {
  dockIntakeId: string;
  params: CandidateParams;
  onLinked?: () => void;
  /** When true, shows item-level refinement hints */
  showItemRefinement?: boolean;
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

type RefType = 'BOL' | 'PRO' | 'TRACKING' | 'PO' | 'REF';

export default function DockIntakeMatchingPanel({
  dockIntakeId,
  params,
  onLinked,
  showItemRefinement,
}: DockIntakeMatchingPanelProps) {
  const { toast } = useToast();
  const [linking, setLinking] = useState<string | null>(null);

  // Reference number input state
  const [refType, setRefType] = useState<RefType>('BOL');
  const [refInput, setRefInput] = useState('');

  // Merge the typed ref value into candidate params
  const mergedParams: CandidateParams = {
    ...params,
    refValue: refInput.trim() || params.refValue || null,
  };

  const { candidates, loading } = useInboundCandidates(mergedParams);
  const { links, loading: linksLoading, unlinkShipment, refetch: refetchLinks } = useInboundLinks(dockIntakeId);

  // Filter out already-linked shipments from candidates
  const linkedIds = new Set(links.map((l) => l.linked_shipment_id));
  const filteredCandidates = candidates.filter((c) => !linkedIds.has(c.shipment_id));

  const handleLink = useCallback(
    async (candidate: InboundCandidate) => {
      try {
        setLinking(candidate.shipment_id);
        const { error } = await supabase.rpc('rpc_link_dock_intake_to_shipment', {
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
        refetchLinks();
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
    [dockIntakeId, toast, onLinked, refetchLinks]
  );

  const handleUnlink = useCallback(
    async (link: InboundLink) => {
      await unlinkShipment(link.id);
      onLinked?.();
    },
    [unlinkShipment, onLinked]
  );

  const hasParams = params.accountId || params.vendorName || params.refValue || refInput.trim();

  return (
    <div className="space-y-4">
      {/* Linked Shipments */}
      {links.length > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-800">
              <MaterialIcon name="link" size="sm" />
              Linked ({links.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-start justify-between p-2 rounded-md border border-green-200 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium text-sm">{link.shipment_number}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {link.link_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {link.account_name || 'No account'}
                    {link.vendor_name ? ` · ${link.vendor_name}` : ''}
                    {link.expected_pieces ? ` · ${link.expected_pieces} pcs` : ''}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleUnlink(link)}
                >
                  <MaterialIcon name="link_off" size="sm" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reference Number Search */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MaterialIcon name="qr_code_scanner" size="sm" />
            Reference Lookup
            <HelpTip tooltip="Enter a BOL, PRO, tracking, or PO number to find matching manifests/expected shipments. Exact reference matches produce the highest confidence scores." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={refType} onValueChange={(v) => setRefType(v as RefType)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOL">BOL</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
                <SelectItem value="TRACKING">Tracking</SelectItem>
                <SelectItem value="PO">PO</SelectItem>
                <SelectItem value="REF">Ref</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder={`Enter ${refType} number...`}
              className="h-8 text-sm flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Matching Candidates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="search" size="sm" />
            Matching Candidates
            <HelpTip tooltip="Suggested manifest/expected shipments ranked by confidence. Click Link to associate. Results refine as you fill in more fields." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasParams ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <MaterialIcon name="info" size="lg" className="mb-2 opacity-40" />
              <p>Enter an account, vendor, or reference number to search for matching shipments.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-6">
              <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-primary" />
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <MaterialIcon name="search_off" size="lg" className="mb-2 opacity-40" />
              <p>
                {candidates.length > 0 && links.length > 0
                  ? 'All matching candidates are already linked.'
                  : 'No matching candidates found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCandidates.map((c) => (
                <div
                  key={c.shipment_id}
                  className="flex items-start justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-sm">
                        {c.shipment_number}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.inbound_kind}
                      </Badge>
                      <Badge variant={confidenceBadgeVariant(c.confidence_score)}>
                        {c.confidence_score}% — {c.confidence_label}
                      </Badge>
                      {c.item_match_count > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-0.5">
                          <MaterialIcon name="inventory_2" size="sm" />
                          {c.item_match_count} item{c.item_match_count !== 1 ? 's' : ''}
                        </Badge>
                      )}
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

          {/* Item-level refinement hint */}
          {showItemRefinement && filteredCandidates.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <MaterialIcon name="auto_awesome" size="sm" className="text-amber-500" />
              Item details (description, vendor) from receiving further refine these results.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

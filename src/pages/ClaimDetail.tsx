import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, Clock, User, Package, Truck, Building, DollarSign, ScanLine } from 'lucide-react';
import { ScanDocumentButton } from '@/components/scanner/ScanDocumentButton';
import { DocumentList } from '@/components/scanner/DocumentList';
import { useClaims, CLAIM_TYPE_LABELS, CLAIM_STATUS_LABELS, type Claim, type ClaimAudit, type ClaimItem } from '@/hooks/useClaims';
import { ClaimAttachments } from '@/components/claims/ClaimAttachments';
import { ClaimNotes } from '@/components/claims/ClaimNotes';
import { ClaimStatusActions } from '@/components/claims/ClaimStatusActions';
import { ClaimItemsList } from '@/components/claims/ClaimItemsList';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  under_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  pending_approval: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  pending_acceptance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  credited: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground',
};

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { claims, loading, fetchAuditLog, fetchClaimItems, refetch } = useClaims();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [auditLog, setAuditLog] = useState<ClaimAudit[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (claims.length > 0 && id) {
      const found = claims.find(c => c.id === id);
      setClaim(found || null);
    }
  }, [claims, id]);

  useEffect(() => {
    if (id) {
      setLoadingAudit(true);
      fetchAuditLog(id).then(log => {
        setAuditLog(log);
        setLoadingAudit(false);
      });
      // Also fetch claim items
      fetchClaimItems(id).then(setClaimItems);
    }
  }, [id, fetchAuditLog, fetchClaimItems]);

  // Refetch claim items when claim is refetched
  const handleRefetch = async () => {
    await refetch();
    if (id) {
      const items = await fetchClaimItems(id);
      setClaimItems(items);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!claim) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-foreground">Claim not found</h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/claims')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Claims
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/claims')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{claim.claim_number}</h1>
                <Badge className={statusColors[claim.status]}>
                  {CLAIM_STATUS_LABELS[claim.status as keyof typeof CLAIM_STATUS_LABELS] || claim.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {CLAIM_TYPE_LABELS[claim.claim_type as keyof typeof CLAIM_TYPE_LABELS] || claim.claim_type}
              </p>
            </div>
          </div>
          <ClaimStatusActions claim={claim} claimItems={claimItems} onUpdate={handleRefetch} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Claim Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <p className="text-foreground">{claim.description || 'No description provided'}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Account</h4>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{claim.account?.account_name || 'N/A'}</span>
                    </div>
                  </div>
                  {claim.sidemark && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Sidemark</h4>
                      <span>{claim.sidemark.sidemark_name}</span>
                    </div>
                  )}
                </div>

                {claim.item && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Linked Item</h4>
                    <Link to={`/inventory/${claim.item.id}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Package className="h-4 w-4" />
                      {claim.item.item_code} - {claim.item.description}
                    </Link>
                  </div>
                )}

                {claim.shipment && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Linked Shipment</h4>
                    <Link to={`/shipments/${claim.shipment.id}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Truck className="h-4 w-4" />
                      {claim.shipment.shipment_number}
                    </Link>
                  </div>
                )}

                {claim.non_inventory_ref && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Non-Inventory Reference</h4>
                    <p>{claim.non_inventory_ref}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Claim Items (Multi-Item Support) */}
            <ClaimItemsList
              claimId={claim.id}
              claimStatus={claim.status}
              accountId={claim.account_id || undefined}
              sidemarkId={claim.sidemark_id || undefined}
            />

            {/* Incident & Contact Info - Only show if there's incident data */}
            {(claim.incident_contact_name || claim.incident_location || claim.incident_contact_phone || claim.incident_contact_email) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Incident Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {claim.incident_location && <p><strong>Location:</strong> {claim.incident_location}</p>}
                  {claim.incident_contact_name && <p><strong>Contact:</strong> {claim.incident_contact_name}</p>}
                  {claim.incident_contact_phone && <p><strong>Phone:</strong> {claim.incident_contact_phone}</p>}
                  {claim.incident_contact_email && <p><strong>Email:</strong> {claim.incident_contact_email}</p>}
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="attachments">
              <TabsList>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="attachments" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ScanDocumentButton
                      context={{ type: 'general', label: `Claim: ${claim.claim_number}` }}
                      onSuccess={() => {
                        // Optionally refetch
                      }}
                      label="Scan Document"
                      variant="outline"
                    />
                  </div>
                  <ClaimAttachments claimId={claim.id} />
                  <DocumentList
                    contextType="general"
                    contextId={claim.id}
                  />
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <ClaimNotes claim={claim} onUpdate={handleRefetch} />
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Activity History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingAudit ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : auditLog.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {auditLog.map(entry => (
                          <div key={entry.id} className="flex items-start gap-3 text-sm">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <p className="text-foreground">
                                <span className="font-medium capitalize">
                                  {entry.action.replace(/_/g, ' ')}
                                </span>
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Valuation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Valuation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claim.coverage_snapshot && (
                  <div>
                    <h4 className="text-sm text-muted-foreground">Coverage Snapshot</h4>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                      {JSON.stringify(claim.coverage_snapshot, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Claimed:</span>
                  </div>
                  <div className="text-right font-medium">
                    {claim.claim_value_requested != null ? `$${claim.claim_value_requested.toFixed(2)}` : 'N/A'}
                  </div>

                  <div>
                    <span className="text-muted-foreground">Calculated:</span>
                  </div>
                  <div className="text-right font-medium">
                    {claim.claim_value_calculated != null ? `$${claim.claim_value_calculated.toFixed(2)}` : 'N/A'}
                  </div>

                  <div>
                    <span className="text-muted-foreground">Deductible:</span>
                  </div>
                  <div className="text-right font-medium">
                    {claim.deductible_applied != null ? `$${claim.deductible_applied.toFixed(2)}` : 'N/A'}
                  </div>

                  <Separator className="col-span-2 my-2" />

                  <div>
                    <span className="text-muted-foreground font-medium">Approved Payout:</span>
                  </div>
                  <div className="text-right font-bold text-primary">
                    {claim.approved_payout_amount != null ? `$${claim.approved_payout_amount.toFixed(2)}` : 'Pending'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meta Info */}
            <Card>
              <CardHeader>
                <CardTitle>Meta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filed By</span>
                  <span>
                    {claim.filed_by_user 
                      ? `${claim.filed_by_user.first_name || ''} ${claim.filed_by_user.last_name || ''}`.trim() || 'Unknown'
                      : 'System'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filed At</span>
                  <span>{claim.created_at ? format(new Date(claim.created_at), 'MMM d, yyyy') : 'N/A'}</span>
                </div>
                {claim.resolved_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolved At</span>
                    <span>{format(new Date(claim.resolved_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

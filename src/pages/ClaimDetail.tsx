import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { PhotoScannerButton } from '@/components/common/PhotoScannerButton';
import { PhotoUploadButton } from '@/components/common/PhotoUploadButton';
import { PhotoGrid } from '@/components/common/PhotoGrid';
import { useAuth } from '@/contexts/AuthContext';
import { ScanDocumentButton } from '@/components/scanner/ScanDocumentButton';
import { DocumentList } from '@/components/scanner/DocumentList';
import { useClaims, CLAIM_TYPE_LABELS, CLAIM_STATUS_LABELS, type Claim, type ClaimAudit, type ClaimItem } from '@/hooks/useClaims';
import { ClaimAttachments } from '@/components/claims/ClaimAttachments';
import { ClaimNotes } from '@/components/claims/ClaimNotes';
import { ClaimStatusActions } from '@/components/claims/ClaimStatusActions';
import { ClaimItemsList } from '@/components/claims/ClaimItemsList';
import { ClaimEditDialog } from '@/components/claims/ClaimEditDialog';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

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

// Extended audit log type with user info
interface AuditLogWithUser extends ClaimAudit {
  user?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { claims, loading, fetchAuditLog, fetchClaimItems, refetch } = useClaims();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogWithUser[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [claimPhotos, setClaimPhotos] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (claims.length > 0 && id) {
      const found = claims.find(c => c.id === id);
      setClaim(found || null);
    }
  }, [claims, id]);

  // Fetch audit log with user details
  const fetchAuditLogWithUsers = async (claimId: string) => {
    setLoadingAudit(true);
    try {
      // Fetch audit entries
      const { data: auditData, error: auditError } = await supabase
        .from('claim_audit')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (auditError) throw auditError;

      if (!auditData || auditData.length === 0) {
        setAuditLog([]);
        setLoadingAudit(false);
        return;
      }

      // Get unique actor IDs
      const actorIds = [...new Set(auditData.map(a => a.actor_id).filter(Boolean))] as string[];

      // Fetch user details
      let userMap = new Map<string, { id: string; first_name: string | null; last_name: string | null }>();
      if (actorIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', actorIds);

        if (users) {
          userMap = new Map(users.map(u => [u.id, u]));
        }
      }

      // Merge user data with audit entries
      const entriesWithUsers = auditData.map(entry => ({
        ...entry,
        user: entry.actor_id ? userMap.get(entry.actor_id) || null : null,
      }));

      setAuditLog(entriesWithUsers);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      setAuditLog([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAuditLogWithUsers(id);
      fetchClaimItems(id).then(setClaimItems);
    }
  }, [id, fetchClaimItems]);

  // Refetch claim items when claim is refetched
  const handleRefetch = async () => {
    await refetch();
    if (id) {
      const items = await fetchClaimItems(id);
      setClaimItems(items);
      // Also refetch audit log to show changes
      fetchAuditLogWithUsers(id);
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
            <MaterialIcon name="arrow_back" size="sm" className="mr-2" /> Back to Claims
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
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <MaterialIcon name="arrow_back" size="md" />
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
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="description" size="md" />
                  Claim Details
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                  <MaterialIcon name="edit" size="sm" className="mr-1" />
                  Edit
                </Button>
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
                      <MaterialIcon name="business" size="sm" className="text-muted-foreground" />
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
                      <MaterialIcon name="inventory_2" size="sm" />
                      {claim.item.item_code} - {claim.item.description}
                    </Link>
                  </div>
                )}

                {claim.shipment && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Linked Shipment</h4>
                    <Link to={`/shipments/${claim.shipment.id}`} className="flex items-center gap-2 text-primary hover:underline">
                      <MaterialIcon name="local_shipping" size="sm" />
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
              onItemsChange={handleRefetch}
            />

            {/* Incident & Contact Info - Only show if there's incident data */}
            {(claim.incident_contact_name || claim.incident_location || claim.incident_contact_phone || claim.incident_contact_email) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MaterialIcon name="description" size="md" />
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
            <Tabs defaultValue="photos">
              <TabsList>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>

              <TabsContent value="photos" className="mt-4">
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MaterialIcon name="photo_camera" size="sm" />
                      Photos ({claimPhotos.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <PhotoScannerButton
                        entityType="claim"
                        entityId={claim.id}
                        tenantId={profile?.tenant_id}
                        existingPhotos={claimPhotos}
                        maxPhotos={20}
                        onPhotosSaved={(urls) => setClaimPhotos(urls)}
                        size="sm"
                        label="Take Photos"
                        showCount={false}
                      />
                      <PhotoUploadButton
                        entityType="claim"
                        entityId={claim.id}
                        tenantId={profile?.tenant_id}
                        existingPhotos={claimPhotos}
                        maxPhotos={20}
                        onPhotosSaved={(urls) => setClaimPhotos(urls)}
                        size="sm"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {claimPhotos.length > 0 ? (
                      <PhotoGrid
                        photos={claimPhotos}
                        onPhotosChange={(urls) => setClaimPhotos(urls)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No photos yet. Tap "Take Photos" to capture.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

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
                      <MaterialIcon name="schedule" size="md" />
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
                        {auditLog.map(entry => {
                          const userName = entry.user
                            ? `${entry.user.first_name || ''} ${entry.user.last_name || ''}`.trim() || 'Unknown User'
                            : 'System';
                          const details = entry.details as Record<string, unknown> | null;
                          const changedFields = details?.changed_fields as string[] | undefined;

                          return (
                            <div key={entry.id} className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-3 last:pb-0">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <MaterialIcon name="person" size="sm" className="text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground">
                                  <span className="font-medium">{userName}</span>
                                  <span className="text-muted-foreground mx-1">·</span>
                                  <span className="capitalize">
                                    {entry.action.replace(/_/g, ' ')}
                                  </span>
                                </p>
                                {changedFields && changedFields.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Changed: {changedFields.map(f => f.replace(/_/g, ' ')).join(', ')}
                                  </p>
                                )}
                                <p className="text-muted-foreground text-xs mt-1">
                                  {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
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
                  <MaterialIcon name="attach_money" size="md" />
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

        {/* Edit Dialog */}
        <ClaimEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          claim={claim}
          onSave={handleRefetch}
        />
      </div>
    </DashboardLayout>
  );
}

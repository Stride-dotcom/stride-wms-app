import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
} from '@/components/ui/mobile-data-card';
import { useClaims, ClaimStatus, ClaimType } from '@/hooks/useClaims';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  FileText,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<ClaimStatus, string> = {
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  investigating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending_approval: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  denied: 'bg-red-500/20 text-red-400 border-red-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const statusLabels: Record<ClaimStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  denied: 'Denied',
  paid: 'Paid',
  closed: 'Closed',
};

const typeLabels: Record<ClaimType, string> = {
  damage: 'Damage',
  loss: 'Loss',
  shortage: 'Shortage',
  delay: 'Delay',
  other: 'Other',
};

export default function Claims() {
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ClaimType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [newClaimData, setNewClaimData] = useState({
    description: '',
    claim_type: 'damage' as ClaimType,
    claimed_amount: '',
  });
  const [resolveData, setResolveData] = useState({
    status: 'approved' as 'approved' | 'denied' | 'paid' | 'closed',
    approved_amount: '',
    resolution_notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isMobile = useIsMobile();
  const { claims, loading, refetch, createClaim, resolveClaim } = useClaims({
    status: statusFilter === 'all' ? undefined : statusFilter,
    claimType: typeFilter === 'all' ? undefined : typeFilter,
  });

  const filteredClaims = claims.filter(claim => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      claim.claim_number.toLowerCase().includes(query) ||
      claim.description.toLowerCase().includes(query) ||
      claim.account?.account_name?.toLowerCase().includes(query) ||
      claim.item?.item_code?.toLowerCase().includes(query)
    );
  });

  const handleCreateClaim = async () => {
    if (!newClaimData.description) return;
    
    setIsSubmitting(true);
    try {
      await createClaim({
        description: newClaimData.description,
        claim_type: newClaimData.claim_type,
        claimed_amount: newClaimData.claimed_amount ? parseFloat(newClaimData.claimed_amount) : null,
        account_id: '', // Would need account selector in real implementation
      });
      setCreateDialogOpen(false);
      setNewClaimData({ description: '', claim_type: 'damage', claimed_amount: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveClaim = async () => {
    if (!selectedClaim) return;
    
    setIsSubmitting(true);
    try {
      await resolveClaim(selectedClaim, {
        status: resolveData.status,
        approved_amount: resolveData.approved_amount ? parseFloat(resolveData.approved_amount) : undefined,
        resolution_notes: resolveData.resolution_notes,
      });
      setResolveDialogOpen(false);
      setSelectedClaim(null);
      setResolveData({ status: 'approved', approved_amount: '', resolution_notes: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResolveDialog = (claimId: string) => {
    setSelectedClaim(claimId);
    setResolveDialogOpen(true);
  };

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as ClaimStatus] || statusColors.open}>
      {statusLabels[status as ClaimStatus] || status}
    </Badge>
  );

  const stats = {
    open: claims.filter(c => c.status === 'open').length,
    investigating: claims.filter(c => c.status === 'investigating').length,
    pending: claims.filter(c => c.status === 'pending_approval').length,
    total: claims.length,
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-foreground">Manage</span>{" "}
            <span className="text-primary">Claims</span>
          </h1>
          <p className="text-muted-foreground">Track and manage damage, loss, and shortage claims</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Claim
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-blue-400">{stats.open}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Investigating</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.investigating}</p>
              </div>
              <Search className="h-8 w-8 text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-purple-400">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search claims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClaimStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ClaimType | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Claims List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No claims found
            </div>
          ) : isMobile ? (
            <div className="divide-y divide-border">
              {filteredClaims.map((claim) => (
                <MobileDataCard
                  key={claim.id}
                  onClick={() => openResolveDialog(claim.id)}
                >
                  <MobileDataCardHeader>
                    <MobileDataCardTitle>{claim.claim_number}</MobileDataCardTitle>
                    {getStatusBadge(claim.status)}
                  </MobileDataCardHeader>
                  <MobileDataCardDescription>{claim.description}</MobileDataCardDescription>
                  <MobileDataCardContent>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div><span className="font-medium">Type:</span> {typeLabels[claim.claim_type as ClaimType] || claim.claim_type}</div>
                      <div><span className="font-medium">Account:</span> {claim.account?.account_name || '-'}</div>
                      <div><span className="font-medium">Item:</span> {claim.item?.item_code || '-'}</div>
                      <div><span className="font-medium">Claimed:</span> {claim.claimed_amount ? `$${claim.claimed_amount.toFixed(2)}` : '-'}</div>
                      <div><span className="font-medium">Filed:</span> {format(new Date(claim.created_at), 'MMM d, yyyy')}</div>
                    </div>
                  </MobileDataCardContent>
                </MobileDataCard>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-mono">{claim.claim_number}</TableCell>
                    <TableCell>{typeLabels[claim.claim_type as ClaimType] || claim.claim_type}</TableCell>
                    <TableCell>{claim.account?.account_name || '-'}</TableCell>
                    <TableCell className="font-mono">{claim.item?.item_code || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{claim.description}</TableCell>
                    <TableCell>{claim.claimed_amount ? `$${claim.claimed_amount.toFixed(2)}` : '-'}</TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell>{format(new Date(claim.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {!['paid', 'closed', 'denied'].includes(claim.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openResolveDialog(claim.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Claim Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File New Claim</DialogTitle>
            <DialogDescription>
              Create a new claim for damage, loss, or shortage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Claim Type</Label>
              <Select 
                value={newClaimData.claim_type} 
                onValueChange={(v) => setNewClaimData(d => ({ ...d, claim_type: v as ClaimType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newClaimData.description}
                onChange={(e) => setNewClaimData(d => ({ ...d, description: e.target.value }))}
                placeholder="Describe the issue..."
              />
            </div>
            <div className="space-y-2">
              <Label>Claimed Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={newClaimData.claimed_amount}
                onChange={(e) => setNewClaimData(d => ({ ...d, claimed_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateClaim} disabled={isSubmitting || !newClaimData.description}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              File Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Claim Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Claim</DialogTitle>
            <DialogDescription>
              Update the status and resolution for this claim.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution</Label>
              <Select 
                value={resolveData.status} 
                onValueChange={(v) => setResolveData(d => ({ ...d, status: v as typeof resolveData.status }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Approve
                    </div>
                  </SelectItem>
                  <SelectItem value="denied">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Deny
                    </div>
                  </SelectItem>
                  <SelectItem value="paid">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Mark as Paid
                    </div>
                  </SelectItem>
                  <SelectItem value="closed">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      Close
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resolveData.status === 'approved' && (
              <div className="space-y-2">
                <Label>Approved Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={resolveData.approved_amount}
                  onChange={(e) => setResolveData(d => ({ ...d, approved_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolveData.resolution_notes}
                onChange={(e) => setResolveData(d => ({ ...d, resolution_notes: e.target.value }))}
                placeholder="Enter resolution notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResolveClaim} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

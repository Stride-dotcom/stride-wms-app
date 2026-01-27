import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
} from '@/components/ui/mobile-data-card';
import { useClaims, ClaimStatus, ClaimType, CLAIM_TYPE_LABELS, CLAIM_STATUS_LABELS } from '@/hooks/useClaims';
import { ClaimCreateDialog } from '@/components/claims/ClaimCreateDialog';
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
  initiated: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  under_review: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending_approval: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  pending_acceptance: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  denied: 'bg-red-500/20 text-red-400 border-red-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  credited: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paid: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function Claims() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ClaimType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const isMobile = useIsMobile();
  const { claims, loading, refetch } = useClaims({
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

  const handleRowClick = (claimId: string) => {
    navigate(`/claims/${claimId}`);
  };

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as ClaimStatus] || statusColors.initiated}>
      {CLAIM_STATUS_LABELS[status as ClaimStatus] || status}
    </Badge>
  );

  const stats = {
    initiated: claims.filter(c => c.status === 'initiated').length,
    underReview: claims.filter(c => c.status === 'under_review').length,
    approved: claims.filter(c => c.status === 'approved').length,
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
          <p className="text-muted-foreground">Track and manage damage, loss, and incident claims</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Claim
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Initiated</p>
                <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">{stats.initiated}</p>
              </div>
              <span className="text-3xl opacity-50">🔓</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Under Review</p>
                <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{stats.underReview}</p>
              </div>
              <span className="text-3xl opacity-50">🕒</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-500 dark:text-green-400">{stats.approved}</p>
              </div>
              <span className="text-3xl opacity-50">✅</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Claims</p>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
              </div>
              <span className="text-3xl opacity-50">📄</span>
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
                {Object.entries(CLAIM_STATUS_LABELS).map(([value, label]) => (
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
                {Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => (
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
                  onClick={() => handleRowClick(claim.id)}
                >
                  <MobileDataCardHeader>
                    <MobileDataCardTitle>{claim.claim_number}</MobileDataCardTitle>
                    {getStatusBadge(claim.status)}
                  </MobileDataCardHeader>
                  <MobileDataCardDescription>{claim.description}</MobileDataCardDescription>
                  <MobileDataCardContent>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div><span className="font-medium">Type:</span> {CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] || claim.claim_type}</div>
                      <div><span className="font-medium">Account:</span> {claim.account?.account_name || '-'}</div>
                      <div><span className="font-medium">Item:</span> {claim.item?.item_code || '-'}</div>
                      <div><span className="font-medium">Amount:</span> {claim.approved_payout_amount ? `$${claim.approved_payout_amount.toFixed(2)}` : '-'}</div>
                      <div><span className="font-medium">Filed:</span> {claim.created_at ? format(new Date(claim.created_at), 'MMM d, yyyy') : '-'}</div>
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow 
                    key={claim.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(claim.id)}
                  >
                    <TableCell className="font-mono">{claim.claim_number}</TableCell>
                    <TableCell>{CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] || claim.claim_type}</TableCell>
                    <TableCell>{claim.account?.account_name || '-'}</TableCell>
                    <TableCell className="font-mono">{claim.item?.item_code || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{claim.description}</TableCell>
                    <TableCell>{claim.approved_payout_amount ? `$${claim.approved_payout_amount.toFixed(2)}` : '-'}</TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell>{claim.created_at ? format(new Date(claim.created_at), 'MMM d, yyyy') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Claim Dialog */}
      <ClaimCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </DashboardLayout>
  );
}

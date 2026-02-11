import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { HelpTip } from '@/components/ui/help-tip';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useContainerUnits } from '@/hooks/useContainerUnits';
import { useContainerActions } from '@/hooks/useContainerActions';
import { useLocations } from '@/hooks/useLocations';
import type { Database } from '@/integrations/supabase/types';

type ContainerRow = Database['public']['Tables']['containers']['Row'];

export default function ContainerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [container, setContainer] = useState<ContainerRow | null>(null);
  const [locationCode, setLocationCode] = useState<string>('');
  const [pageLoading, setPageLoading] = useState(true);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const { units, loading: unitsLoading, refetch: refetchUnits } = useContainerUnits(id);
  const { moveContainer, removeUnitFromContainer, loading: actionLoading } = useContainerActions();
  const { locations } = useLocations();

  useEffect(() => {
    if (id) {
      fetchContainer(id);
    }
  }, [id]);

  const fetchContainer = async (containerId: string) => {
    try {
      setPageLoading(true);
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('id', containerId)
        .single();

      if (error) throw error;
      setContainer(data);

      // Fetch location code
      if (data.location_id) {
        const { data: loc } = await supabase
          .from('locations')
          .select('code')
          .eq('id', data.location_id)
          .single();
        setLocationCode(loc?.code || '');
      }
    } catch (error) {
      console.error('Error fetching container:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load container details.',
      });
      navigate(-1);
    } finally {
      setPageLoading(false);
    }
  };

  const handleMove = async () => {
    if (!container || !selectedLocationId) return;

    const result = await moveContainer(container.id, selectedLocationId);
    if (result) {
      setMoveDialogOpen(false);
      setSelectedLocationId('');
      // Refresh container and units
      fetchContainer(container.id);
      refetchUnits();
    }
  };

  const handleRemoveUnit = async (unitId: string) => {
    const result = await removeUnitFromContainer(unitId);
    if (result) {
      refetchUnits();
    }
  };

  const handleCloseContainer = async () => {
    if (!container) return;

    try {
      const { error } = await supabase
        .from('containers')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', container.id);

      if (error) throw error;

      toast({
        title: 'Container Closed',
        description: `Container ${container.container_code} has been closed.`,
      });
      fetchContainer(container.id);
    } catch (error) {
      console.error('Error closing container:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to close container.',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <Badge variant="outline" className={colors[status] || ''}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (pageLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!container) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Container not found.</p>
          <Button variant="link" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalVolume = units.reduce((sum, u) => sum + (u.unit_cu_ft || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              {container.location_id && (
                <>
                  <Link to={`/locations/${container.location_id}`} className="hover:underline">
                    Location: {locationCode}
                  </Link>
                  <MaterialIcon name="chevron_right" size="sm" />
                </>
              )}
              <span>Container</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                <code className="bg-muted px-2 py-0.5 rounded">{container.container_code}</code>
              </h1>
              {getStatusBadge(container.status)}
            </div>
            {container.container_type && (
              <p className="text-muted-foreground mt-1">Type: {container.container_type}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Info + Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Location</CardTitle>
            </CardHeader>
            <CardContent>
              {container.location_id ? (
                <Link
                  to={`/locations/${container.location_id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {locationCode || container.location_id}
                </Link>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                <HelpTip tooltip="Total number of inventory units currently stored in this container.">
                  Contents
                </HelpTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{units.length} unit{units.length !== 1 ? 's' : ''}</p>
              {totalVolume > 0 && (
                <p className="text-xs text-muted-foreground">{totalVolume.toFixed(1)} cu ft total</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                <HelpTip tooltip="The physical footprint volume of the container itself, used in bounded footprint capacity calculations.">
                  Footprint
                </HelpTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {container.footprint_cu_ft != null ? `${container.footprint_cu_ft} cu ft` : 'Not set'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setMoveDialogOpen(true)}
            disabled={container.status === 'archived'}
          >
            <MaterialIcon name="move_item" size="sm" className="mr-2" />
            Move Container
          </Button>
          {container.status === 'active' && (
            <Button variant="outline" onClick={handleCloseContainer}>
              <MaterialIcon name="lock" size="sm" className="mr-2" />
              Close Container
            </Button>
          )}
        </div>

        {/* Contents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <HelpTip tooltip="Inventory units stored inside this container. Removing a unit keeps it at the same location but detaches it from the container.">
                Container Contents
              </HelpTip>
            </CardTitle>
            <CardDescription>
              {units.length} unit{units.length !== 1 ? 's' : ''} in this container
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unitsLoading ? (
              <div className="flex items-center justify-center h-24">
                <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
              </div>
            ) : units.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                This container is empty.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IC Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                          {unit.ic_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={unit.status} size="sm" />
                      </TableCell>
                      <TableCell>{unit.class || '—'}</TableCell>
                      <TableCell>
                        {unit.unit_cu_ft != null ? `${unit.unit_cu_ft} cu ft` : '—'}
                      </TableCell>
                      <TableCell>
                        {unit.dims_l != null && unit.dims_w != null && unit.dims_h != null
                          ? `${unit.dims_l} x ${unit.dims_w} x ${unit.dims_h}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={actionLoading}
                          onClick={() => handleRemoveUnit(unit.id)}
                          title="Remove from container"
                        >
                          <MaterialIcon name="logout" size="sm" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Move Container Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Container</DialogTitle>
            <DialogDescription>
              Select a new location for container <strong>{container.container_code}</strong>.
              All {units.length} unit{units.length !== 1 ? 's' : ''} inside will be moved automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target location" />
              </SelectTrigger>
              <SelectContent>
                {locations
                  .filter((l) => l.id !== container.location_id && l.status === 'active')
                  .map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} {loc.name ? `(${loc.name})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMove}
              disabled={!selectedLocationId || actionLoading}
            >
              {actionLoading && (
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
              )}
              Move Container
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

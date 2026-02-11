import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { HelpTip } from '@/components/ui/help-tip';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useContainersAtLocation } from '@/hooks/useContainersAtLocation';
import { useUnitsAtLocation, type UnitFilters } from '@/hooks/useUnitsAtLocation';
import { useLocationCapacity } from '@/hooks/useLocationCapacity';
import { useOrgPreferences } from '@/hooks/useOrgPreferences';
import type { Database } from '@/integrations/supabase/types';

type LocationRow = Database['public']['Tables']['locations']['Row'];

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [warehouseName, setWarehouseName] = useState<string>('');
  const [parentPath, setParentPath] = useState<string>('');
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { containers, loading: containersLoading, refetch: refetchContainers } = useContainersAtLocation(id);

  const unitFilters: UnitFilters = useMemo(() => ({
    search: search || undefined,
    status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
  }), [search, statusFilter]);

  const { units, loading: unitsLoading, refetch: refetchUnits } = useUnitsAtLocation(id, unitFilters);
  const { capacity, loading: capacityLoading, fetchCapacity } = useLocationCapacity(id);
  const { preferences } = useOrgPreferences();

  useEffect(() => {
    if (id) {
      fetchLocation(id);
      fetchCapacity(id);
    }
  }, [id]);

  const fetchLocation = async (locationId: string) => {
    try {
      setPageLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .single();

      if (error) throw error;
      setLocation(data);

      // Fetch warehouse name
      if (data.warehouse_id) {
        const { data: wh } = await supabase
          .from('warehouses')
          .select('name')
          .eq('id', data.warehouse_id)
          .single();
        setWarehouseName(wh?.name || '');
      }

      // Build parent path
      if (data.parent_location_id) {
        const parts: string[] = [];
        let currentParentId: string | null = data.parent_location_id;
        while (currentParentId) {
          const { data: parent } = await supabase
            .from('locations')
            .select('code, parent_location_id')
            .eq('id', currentParentId)
            .single();
          if (parent) {
            parts.unshift(parent.code);
            currentParentId = parent.parent_location_id;
          } else {
            break;
          }
        }
        setParentPath(parts.join(' / '));
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load location details.',
      });
      navigate('/settings');
    } finally {
      setPageLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      zone: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      aisle: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      bay: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      bin: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      shelf: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      release: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
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

  if (!location) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Location not found.</p>
          <Button variant="link" onClick={() => navigate('/settings')}>
            Back to Settings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link to="/settings" className="hover:underline">Settings</Link>
              <MaterialIcon name="chevron_right" size="sm" />
              <span>Locations</span>
              {parentPath && (
                <>
                  <MaterialIcon name="chevron_right" size="sm" />
                  <span>{parentPath}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                <code className="bg-muted px-2 py-0.5 rounded">{location.code}</code>
              </h1>
              {getTypeBadge(location.type)}
              <StatusIndicator status={location.status} size="sm" />
              {location.location_type && (
                <Badge variant="secondary">{location.location_type}</Badge>
              )}
            </div>
            {location.name && (
              <p className="text-muted-foreground mt-1">{location.name}</p>
            )}
            {warehouseName && (
              <p className="text-sm text-muted-foreground">Warehouse: {warehouseName}</p>
            )}
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
            Back
          </Button>
        </div>

        {/* Capacity Panel */}
        {preferences.space_tracking_mode !== 'none' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <HelpTip tooltip="Shows the volume utilization of this location based on inventory units and containers stored here.">
                  Capacity Utilization
                </HelpTip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {capacityLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                  Loading capacity data...
                </div>
              ) : capacity ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Used</p>
                    <p className="text-lg font-semibold">
                      {capacity.used_cu_ft != null ? `${capacity.used_cu_ft.toFixed(1)} cu ft` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capacity</p>
                    <p className="text-lg font-semibold">
                      {capacity.capacity_cu_ft != null ? `${capacity.capacity_cu_ft.toFixed(1)} cu ft` : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Utilization</p>
                    <p className="text-lg font-semibold">
                      {capacity.utilization_pct != null ? `${capacity.utilization_pct.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No capacity data available.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="containers">
          <TabsList>
            <TabsTrigger value="containers">
              Containers ({containers.length})
            </TabsTrigger>
            <TabsTrigger value="inventory">
              Inventory ({units.length})
            </TabsTrigger>
          </TabsList>

          {/* Containers Tab */}
          <TabsContent value="containers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <HelpTip tooltip="Containers currently located at this storage location. Move containers between locations to relocate all their contents at once.">
                    Containers at Location
                  </HelpTip>
                </CardTitle>
                <CardDescription>
                  {containers.length} container{containers.length !== 1 ? 's' : ''} at this location
                </CardDescription>
              </CardHeader>
              <CardContent>
                {containersLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
                  </div>
                ) : containers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No containers at this location.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Footprint</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {containers.map((container) => (
                        <TableRow key={container.id}>
                          <TableCell className="font-medium">
                            <Link
                              to={`/containers/${container.id}`}
                              className="text-primary hover:underline"
                            >
                              <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                                {container.container_code}
                              </code>
                            </Link>
                          </TableCell>
                          <TableCell>{container.container_type || '—'}</TableCell>
                          <TableCell>
                            <StatusIndicator status={container.status} size="sm" />
                          </TableCell>
                          <TableCell>
                            {container.footprint_cu_ft != null
                              ? `${container.footprint_cu_ft} cu ft`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/containers/${container.id}`)}
                            >
                              <MaterialIcon name="open_in_new" size="sm" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      <HelpTip tooltip="All inventory units physically present at this location, whether in containers or loose. Based on unit.location_id, not display-only.">
                        Inventory Units
                      </HelpTip>
                    </CardTitle>
                    <CardDescription>
                      {units.length} unit{units.length !== 1 ? 's' : ''} at this location
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Search IC code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="AVAILABLE">Available</SelectItem>
                      <SelectItem value="QUARANTINE">Quarantine</SelectItem>
                      <SelectItem value="HOLD">Hold</SelectItem>
                      <SelectItem value="DAMAGED">Damaged</SelectItem>
                      <SelectItem value="INSPECTION">Inspection</SelectItem>
                      <SelectItem value="RELEASED">Released</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {unitsLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
                  </div>
                ) : units.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No inventory units at this location.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IC Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Container</TableHead>
                        <TableHead>Volume</TableHead>
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
                            {unit.container_code ? (
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {unit.container_code}
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {unit.unit_cu_ft != null ? `${unit.unit_cu_ft} cu ft` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

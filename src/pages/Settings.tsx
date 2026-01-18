import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building, Users, Warehouse, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLocations, Location } from '@/hooks/useLocations';
import { LocationsSettingsTab } from '@/components/settings/LocationsSettingsTab';
import { LocationDialog } from '@/components/locations/LocationDialog';
import { PrintLabelsDialog } from '@/components/locations/PrintLabelsDialog';
import { CSVImportDialog } from '@/components/settings/CSVImportDialog';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface UserInfo {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
}

export default function Settings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  // Locations state
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedLocationsForPrint, setSelectedLocationsForPrint] = useState<Location[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);

  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { locations, loading: locationsLoading, refetch: refetchLocations } = useLocations(
    selectedWarehouse === 'all' ? undefined : selectedWarehouse
  );

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSettingsData();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (profile) {
      setProfileData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  const fetchSettingsData = async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, slug, status')
        .eq('id', profile.tenant_id)
        .single();

      if (tenantData) setTenant(tenantData);

      // Fetch users
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, status')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('email');

      setUsers(userData || []);
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update your profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Location handlers
  const handleCreateLocation = () => {
    setEditingLocation(null);
    setLocationDialogOpen(true);
  };

  const handleEditLocation = (locationId: string) => {
    setEditingLocation(locationId);
    setLocationDialogOpen(true);
  };

  const handleLocationDialogClose = () => {
    setLocationDialogOpen(false);
    setEditingLocation(null);
  };

  const handleLocationSuccess = () => {
    handleLocationDialogClose();
    refetchLocations();
  };

  const handlePrintSelected = (selected: Location[]) => {
    setSelectedLocationsForPrint(selected);
    setPrintDialogOpen(true);
  };

  const handleImportCSV = (file: File) => {
    setCsvFile(file);
    setCsvImportDialogOpen(true);
  };

  const handleImportSuccess = () => {
    refetchLocations();
    setCsvImportDialogOpen(false);
    setCsvFile(null);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and organization settings
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) =>
                        setProfileData({ ...profileData, firstName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) =>
                        setProfileData({ ...profileData, lastName: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profileData.email} disabled />
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed from this page
                  </p>
                </div>
                <Separator />
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Organization Details
                </CardTitle>
                <CardDescription>
                  View your organization information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tenant ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">Organization Name</Label>
                        <p className="text-lg font-medium">{tenant.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Slug</Label>
                        <p className="text-lg font-medium">{tenant.slug}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <div className="mt-1">
                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                          {tenant.status}
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No organization data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warehouses">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Warehouses
                </CardTitle>
                <CardDescription>
                  {warehouses.length} warehouses configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                {warehousesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : warehouses.length === 0 ? (
                  <p className="text-muted-foreground">No warehouses configured</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {warehouses.map((wh) => (
                          <TableRow key={wh.id}>
                            <TableCell className="font-medium">{wh.code}</TableCell>
                            <TableCell>{wh.name}</TableCell>
                            <TableCell>
                              {wh.city || wh.state
                                ? `${wh.city || ''}${wh.city && wh.state ? ', ' : ''}${wh.state || ''}`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={wh.status === 'active' ? 'default' : 'secondary'}>
                                {wh.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations">
            <LocationsSettingsTab
              locations={locations}
              warehouses={warehouses}
              loading={locationsLoading || warehousesLoading}
              selectedWarehouse={selectedWarehouse}
              onWarehouseChange={setSelectedWarehouse}
              onEdit={handleEditLocation}
              onCreate={handleCreateLocation}
              onRefresh={refetchLocations}
              onPrintSelected={handlePrintSelected}
              onImportCSV={handleImportCSV}
            />
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users
                </CardTitle>
                <CardDescription>
                  {users.length} users in your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-muted-foreground">No users found</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.first_name || user.last_name
                                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                : '-'}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                {user.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Location Dialog */}
      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        locationId={editingLocation}
        warehouses={warehouses}
        locations={locations}
        defaultWarehouseId={selectedWarehouse === 'all' ? undefined : selectedWarehouse}
        onSuccess={handleLocationSuccess}
      />

      {/* Print Labels Dialog */}
      <PrintLabelsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        locations={selectedLocationsForPrint}
        warehouses={warehouses}
      />

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={csvImportDialogOpen}
        onOpenChange={setCsvImportDialogOpen}
        file={csvFile}
        warehouses={warehouses}
        onSuccess={handleImportSuccess}
      />
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building, Users, Warehouse, Save, Plus, Package, DollarSign, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLocations, Location } from '@/hooks/useLocations';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { LocationsSettingsTab } from '@/components/settings/LocationsSettingsTab';
import { LocationDialog } from '@/components/locations/LocationDialog';
import { PrintLabelsDialog } from '@/components/locations/PrintLabelsDialog';
import { CSVImportDialog } from '@/components/settings/CSVImportDialog';
import { WarehouseList } from '@/components/warehouses/WarehouseList';
import { WarehouseDialog } from '@/components/warehouses/WarehouseDialog';
import { UserList } from '@/components/settings/UserList';
import { UserDialog } from '@/components/settings/UserDialog';
import { InviteUserDialog } from '@/components/settings/InviteUserDialog';
import { ItemTypesSettingsTab } from '@/components/settings/ItemTypesSettingsTab';
import { BillingChargeTemplatesTab } from '@/components/settings/BillingChargeTemplatesTab';
import { EmployeesSettingsTab } from '@/components/settings/EmployeesSettingsTab';
import { OrganizationSettingsTab } from '@/components/settings/OrganizationSettingsTab';
import { RateSheetsSettingsTab } from '@/components/settings/RateSheetsSettingsTab';
import { CommunicationsSettingsTab } from '@/components/settings/CommunicationsSettingsTab';
import { LaborSettingsTab } from '@/components/settings/LaborSettingsTab';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const TAB_OPTIONS = [
  { value: 'profile', label: 'Profile' },
  { value: 'organization', label: 'Organization' },
  { value: 'employees', label: 'Employees' },
  { value: 'communications', label: 'Alerts' },
  { value: 'billing', label: 'Billing' },
  { value: 'labor', label: 'Labor', adminOnly: true },
  { value: 'rate-sheets', label: 'Rate Sheets' },
  { value: 'item-types', label: 'Item Types' },
  { value: 'warehouses', label: 'Warehouses' },
  { value: 'locations', label: 'Locations' },
  { value: 'users', label: 'Users' },
];

export default function Settings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
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

  // Warehouse state
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<string | null>(null);

  // User state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const { warehouses, loading: warehousesLoading, refetch: refetchWarehouses } = useWarehouses();
  const { locations, loading: locationsLoading, refetch: refetchLocations } = useLocations(
    selectedWarehouse === 'all' ? undefined : selectedWarehouse
  );
  const { 
    users, 
    roles, 
    loading: usersLoading, 
    refetch: refetchUsers, 
    deleteUser, 
    assignRole, 
    removeRole 
  } = useUsers();
  const { hasRole } = usePermissions();
  const isAdmin = hasRole('admin') || hasRole('tenant_admin');

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

  // Warehouse handlers
  const handleCreateWarehouse = () => {
    setEditingWarehouse(null);
    setWarehouseDialogOpen(true);
  };

  const handleEditWarehouse = (warehouseId: string) => {
    setEditingWarehouse(warehouseId);
    setWarehouseDialogOpen(true);
  };

  const handleWarehouseDialogClose = () => {
    setWarehouseDialogOpen(false);
    setEditingWarehouse(null);
  };

  const handleWarehouseSuccess = () => {
    handleWarehouseDialogClose();
    refetchWarehouses();
  };

  // Filter tabs based on admin status
  const visibleTabs = TAB_OPTIONS.filter(tab => !tab.adminOnly || isAdmin);

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
      <div className="space-y-6 px-2 sm:px-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and organization settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Mobile: Dropdown navigation */}
          <div className="sm:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {visibleTabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Tab navigation */}
          <TabsList className="hidden sm:flex flex-wrap h-auto gap-1">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="communications">Alerts</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            {isAdmin && <TabsTrigger value="labor">Labor</TabsTrigger>}
            <TabsTrigger value="rate-sheets">Rate Sheets</TabsTrigger>
            <TabsTrigger value="item-types">Item Types</TabsTrigger>
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
            <OrganizationSettingsTab />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeesSettingsTab />
          </TabsContent>

          <TabsContent value="communications">
            <CommunicationsSettingsTab />
          </TabsContent>

          <TabsContent value="billing">
            <BillingChargeTemplatesTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="labor">
              <LaborSettingsTab />
            </TabsContent>
          )}

          <TabsContent value="rate-sheets">
            <RateSheetsSettingsTab />
          </TabsContent>

          <TabsContent value="item-types">
            <ItemTypesSettingsTab />
          </TabsContent>

          <TabsContent value="warehouses">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    Warehouses
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your warehouse locations and configurations
                  </p>
                </div>
                <Button onClick={handleCreateWarehouse} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Warehouse
                </Button>
              </div>
              <WarehouseList
                warehouses={warehouses}
                loading={warehousesLoading}
                onEdit={handleEditWarehouse}
                onRefresh={refetchWarehouses}
              />
            </div>
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
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Manage users and their roles in your organization
                  </p>
                </div>
              </div>
              <UserList
                users={users}
                roles={roles}
                loading={usersLoading}
                currentUserId={profile?.id}
                onEdit={(userId) => {
                  setEditingUser(userId);
                  setUserDialogOpen(true);
                }}
                onDelete={deleteUser}
                onRefresh={refetchUsers}
                onInvite={() => setInviteDialogOpen(true)}
              />
            </div>
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

      {/* Warehouse Dialog */}
      <WarehouseDialog
        open={warehouseDialogOpen}
        onOpenChange={setWarehouseDialogOpen}
        warehouseId={editingWarehouse}
        onSuccess={handleWarehouseSuccess}
      />

      {/* User Dialog */}
      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        userId={editingUser}
        users={users}
        roles={roles}
        currentUserId={profile?.id}
        onSuccess={() => {
          setUserDialogOpen(false);
          setEditingUser(null);
          refetchUsers();
        }}
        onAssignRole={assignRole}
        onRemoveRole={removeRole}
      />

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        roles={roles}
        onSuccess={() => {
          setInviteDialogOpen(false);
          refetchUsers();
        }}
      />
    </DashboardLayout>
  );
}

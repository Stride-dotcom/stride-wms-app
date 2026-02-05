import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
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
// Removed: ItemTypesSettingsTab, RateSheetsSettingsTab, BillableServicesSettingsTab - using unified service_events pricing
// Removed: EmployeesSettingsTab - employee functionality consolidated into Users tab
import { OrganizationSettingsTab } from '@/components/settings/OrganizationSettingsTab';
import { SidemarksSettingsTab } from '@/components/settings/SidemarksSettingsTab';
import { ServiceRatesConsole } from '@/components/settings/ServiceRatesConsole';

import { LaborSettingsTab } from '@/components/settings/LaborSettingsTab';
import { AlertsSettingsTab } from '@/components/settings/AlertsSettingsTab';
import { IntegrationsSettingsTab } from '@/components/settings/IntegrationsSettingsTab';
import { PromptsSettingsTab } from '@/components/settings/PromptsSettingsTab';
import { AuditLogTab } from '@/components/settings/AuditLogTab';
import { QATestConsoleTab } from '@/components/settings/QATestConsoleTab';
import packageJson from '../../package.json';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const TAB_OPTIONS = [
  { value: 'profile', label: 'Profile' },
  { value: 'organization', label: 'Organization' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'prompts', label: 'Prompts', adminOnly: true },
  { value: 'labor', label: 'Labor', adminOnly: true },
  { value: 'service-rates', label: 'Service Rates', adminOnly: true },
  { value: 'audit', label: 'Audit Log', adminOnly: true },
  { value: 'integrations', label: 'Integrations', adminOnly: true },
  { value: 'sidemarks', label: 'Sidemarks' },
  { value: 'warehouses', label: 'Warehouses' },
  { value: 'locations', label: 'Locations' },
  { value: 'users', label: 'Users' },
  { value: 'qa', label: 'QA Tests', adminOnly: true },
];

export default function Settings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
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
    removeRole,
    updatePromptLevel,
    resendInvite,
    revokeAccess,
  } = useUsers();
  const { hasRole } = usePermissions();
  const isAdmin = hasRole('admin') || hasRole('tenant_admin');

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSettingsData();
    }
  }, [profile?.tenant_id]);

  // Handle URL parameters for QBO callback
  useEffect(() => {
    const tab = searchParams.get('tab');
    const qboStatus = searchParams.get('qbo');
    const message = searchParams.get('message');

    if (tab) {
      setActiveTab(tab);
    }

    if (qboStatus === 'connected') {
      toast({
        title: 'QuickBooks Connected',
        description: 'Your QuickBooks account has been successfully connected.',
      });
      // Clean up URL params
      searchParams.delete('qbo');
      setSearchParams(searchParams, { replace: true });
    } else if (qboStatus === 'error') {
      toast({
        title: 'QuickBooks Connection Failed',
        description: message || 'Failed to connect to QuickBooks. Please try again.',
        variant: 'destructive',
      });
      // Clean up URL params
      searchParams.delete('qbo');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

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
          <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 px-2 sm:px-0">
        <div className="flex items-start justify-between">
          <PageHeader
            primaryText="System"
            accentText="Config"
            description="Manage your account and organization settings"
          />
          {/* TEMPORARY: Build stamp for mobile confirmation */}
          <div className="text-[10px] text-muted-foreground/60 text-right leading-tight shrink-0 mt-1 font-mono">
            <div>v{packageJson.version}</div>
            <div>{typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__.replace('T', ' ').slice(0, 19) : 'dev'}</div>
            {typeof __COMMIT_HASH__ !== 'undefined' && __COMMIT_HASH__ && <div>{__COMMIT_HASH__}</div>}
          </div>
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
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            {isAdmin && <TabsTrigger value="prompts">Prompts</TabsTrigger>}
            {isAdmin && <TabsTrigger value="labor">Labor</TabsTrigger>}
            {isAdmin && <TabsTrigger value="service-rates">Service Rates</TabsTrigger>}
            {isAdmin && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
            {isAdmin && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
            <TabsTrigger value="sidemarks">Sidemarks</TabsTrigger>
            <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            {isAdmin && <TabsTrigger value="qa">QA Tests</TabsTrigger>}
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
                      <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="save" size="sm" className="mr-2" />
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

          <TabsContent value="alerts">
            <AlertsSettingsTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="prompts">
              <PromptsSettingsTab />
            </TabsContent>
          )}

          {/* Billing tab removed - charge templates moved to Rate Sheets */}

          {isAdmin && (
            <TabsContent value="labor">
              <LaborSettingsTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="service-rates">
              <ServiceRatesConsole />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="audit">
              <AuditLogTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="integrations">
              <IntegrationsSettingsTab />
            </TabsContent>
          )}

          <TabsContent value="sidemarks">
            <SidemarksSettingsTab />
          </TabsContent>

          {/* Removed: Services, Rate Sheets, Classes tabs - now using unified service_events pricing system */}

          <TabsContent value="warehouses">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <MaterialIcon name="warehouse" size="md" />
                    Warehouses
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your warehouse locations and configurations
                  </p>
                </div>
                <Button onClick={handleCreateWarehouse} className="w-full sm:w-auto">
                  <MaterialIcon name="add" size="sm" className="mr-2" />
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
              onWarehouseRefresh={refetchWarehouses}
            />
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <MaterialIcon name="group" size="md" />
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

          {isAdmin && (
            <TabsContent value="qa">
              <QATestConsoleTab />
            </TabsContent>
          )}
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
        onUpdatePromptLevel={updatePromptLevel}
        onResendInvite={resendInvite}
        onRevokeAccess={revokeAccess}
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

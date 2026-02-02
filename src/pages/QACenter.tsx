import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useAdminDev } from '@/hooks/useAdminDev';
import { useToast } from '@/hooks/use-toast';
import { QATestConsoleTab } from '@/components/settings/QATestConsoleTab';

// Lazy import of BotQA content (to avoid circular dependencies)
import BotQAPage from '@/pages/admin/BotQA';
// Lazy import of Diagnostics content
import DiagnosticsPage from '@/pages/Diagnostics';

/**
 * QA Center - Consolidated internal QA tools
 *
 * Requires:
 * - VITE_ENABLE_QA_CENTER=true
 * - Tenant in VITE_QA_ALLOWLIST_TENANTS (comma-separated UUIDs) or empty for all
 * - User has admin_dev system role
 */
export default function QACenter() {
  const { canAccessQACenter, isAdminDev, loading } = useAdminDev();
  const [activeTab, setActiveTab] = useState('workflow');

  // Show loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Redirect if not authorized
  if (!canAccessQACenter) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="qa-center-page">
        {/* Page Header */}
        <div className="flex items-center justify-between" data-testid="page-header">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MaterialIcon name="science" size="lg" />
              QA Center
            </h1>
            <p className="text-muted-foreground">
              Internal testing and diagnostics tools
            </p>
          </div>
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <MaterialIcon name="shield_person" size="sm" className="mr-1" />
            admin_dev
          </Badge>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="qa-center-tabs">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="workflow" className="flex items-center gap-2" data-testid="qa-tab-workflow">
              <MaterialIcon name="checklist" size="sm" />
              Workflow QA
            </TabsTrigger>
            <TabsTrigger value="bot" className="flex items-center gap-2" data-testid="qa-tab-bot">
              <MaterialIcon name="smart_toy" size="sm" />
              Bot QA
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="flex items-center gap-2" data-testid="qa-tab-diagnostics">
              <MaterialIcon name="bug_report" size="sm" />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="access" className="flex items-center gap-2" data-testid="qa-tab-access">
              <MaterialIcon name="admin_panel_settings" size="sm" />
              Access
            </TabsTrigger>
          </TabsList>

          {/* Workflow QA Tab */}
          <TabsContent value="workflow" className="mt-6">
            <QATestConsoleTab />
          </TabsContent>

          {/* Bot QA Tab */}
          <TabsContent value="bot" className="mt-6">
            <BotQAContent />
          </TabsContent>

          {/* Diagnostics Tab */}
          <TabsContent value="diagnostics" className="mt-6">
            <DiagnosticsContent />
          </TabsContent>

          {/* Admin Dev Access Tab */}
          <TabsContent value="access" className="mt-6">
            <AdminDevAccessTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/**
 * Bot QA Content - Extracted from BotQA page
 */
function BotQAContent() {
  // We need to render BotQAPage content without the DashboardLayout wrapper
  // Since BotQAPage is a full page component, we'll extract its inner content
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="smart_toy" size="md" />
            Bot Testing Tools
          </CardTitle>
          <CardDescription>
            Test AI bot entity resolution, tool execution, and conversation flows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Navigate to the full Bot QA page for comprehensive testing tools.
          </p>
          <Button asChild>
            <a href="/admin/bot-qa">
              <MaterialIcon name="open_in_new" size="sm" className="mr-2" />
              Open Bot QA
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Diagnostics Content - Extracted from Diagnostics page
 */
function DiagnosticsContent() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="bug_report" size="md" />
            Error Monitoring Dashboard
          </CardTitle>
          <CardDescription>
            View and manage application errors, warnings, and issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Navigate to the full Diagnostics page for comprehensive error monitoring.
          </p>
          <Button asChild>
            <a href="/diagnostics">
              <MaterialIcon name="open_in_new" size="sm" className="mr-2" />
              Open Diagnostics
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Admin Dev Access Management Tab
 */
function AdminDevAccessTab() {
  const { toast } = useToast();
  const { grantAdminDev, revokeAdminDev, fetchAdminDevUsers, isAdminDev } = useAdminDev();
  const [adminDevUsers, setAdminDevUsers] = useState<{ id: string; email: string; first_name: string | null; last_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    loadAdminDevUsers();
  }, []);

  const loadAdminDevUsers = async () => {
    setLoading(true);
    const users = await fetchAdminDevUsers();
    setAdminDevUsers(users);
    setLoading(false);
  };

  const handleGrant = async () => {
    if (!grantEmail.trim()) return;

    setGranting(true);
    const result = await grantAdminDev(grantEmail.trim());
    setGranting(false);

    if (result.success) {
      toast({ title: 'Success', description: `Granted admin_dev access to ${grantEmail}` });
      setGrantDialogOpen(false);
      setGrantEmail('');
      loadAdminDevUsers();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleRevoke = async (userId: string, email: string) => {
    setRevoking(userId);
    const result = await revokeAdminDev(userId);
    setRevoking(null);

    if (result.success) {
      toast({ title: 'Success', description: `Revoked admin_dev access from ${email}` });
      loadAdminDevUsers();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MaterialIcon name="admin_panel_settings" size="md" />
                Admin Dev Access Management
              </CardTitle>
              <CardDescription>
                Manage users with the admin_dev system role
              </CardDescription>
            </div>
            <Button onClick={() => setGrantDialogOpen(true)}>
              <MaterialIcon name="person_add" size="sm" className="mr-2" />
              Grant Access
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
            </div>
          ) : adminDevUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MaterialIcon name="group" size="lg" className="mx-auto mb-2 opacity-50" />
              <p>No admin_dev users found</p>
              <p className="text-sm">Grant access to internal team members</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminDevUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <MaterialIcon name="person" size="sm" className="text-purple-600" />
                        </div>
                        <span className="font-medium">
                          {user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user.email.split('@')[0]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(user.id, user.email)}
                        disabled={revoking === user.id}
                      >
                        {revoking === user.id ? (
                          <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                        ) : (
                          <>
                            <MaterialIcon name="person_remove" size="sm" className="mr-1" />
                            Revoke
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MaterialIcon name="info" size="sm" />
            About System Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The <code className="bg-muted px-1 rounded">admin_dev</code> role is a <strong>system role</strong> that exists outside of tenant scope.
          </p>
          <p>
            System roles cannot be created, modified, or assigned by tenant administrators - only by existing admin_dev users or through the service role.
          </p>
          <p>
            Access to QA Center requires:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code className="bg-muted px-1 rounded">VITE_ENABLE_QA_CENTER=true</code></li>
            <li>Tenant in allowlist (or empty allowlist for all tenants)</li>
            <li>User has <code className="bg-muted px-1 rounded">admin_dev</code> system role</li>
          </ul>
        </CardContent>
      </Card>

      {/* Grant Access Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Admin Dev Access</DialogTitle>
            <DialogDescription>
              Enter the email of the user to grant admin_dev access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grant-email">Email Address</Label>
              <Input
                id="grant-email"
                type="email"
                placeholder="developer@example.com"
                value={grantEmail}
                onChange={e => setGrantEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGrant()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={!grantEmail.trim() || granting}>
              {granting ? (
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-2" />
              ) : (
                <MaterialIcon name="person_add" size="sm" className="mr-2" />
              )}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

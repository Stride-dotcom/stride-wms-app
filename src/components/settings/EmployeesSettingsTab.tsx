import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, UserPlus, DollarSign, Users } from 'lucide-react';

interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  labor_rate: number | null;
  roles: { id: string; name: string }[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export function EmployeesSettingsTab() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    labor_rate: 0,
    role_id: 'none',
  });

  const [inviteData, setInviteData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role_id: 'none',
    labor_rate: 0,
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchEmployees();
      fetchRoles();
    }
  }, [profile?.tenant_id]);

  const fetchEmployees = async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id, email, first_name, last_name, labor_rate,
          user_roles!inner(
            role:roles(id, name)
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null);

      if (error) throw error;

      // Transform the data
      const employeesData = (users || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        labor_rate: user.labor_rate,
        roles: user.user_roles
          ?.map((ur: any) => ur.role)
          .filter(Boolean) || [],
      }));

      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .in('name', ['admin', 'manager', 'warehouse']);

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      labor_rate: employee.labor_rate || 0,
      role_id: employee.roles[0]?.id || 'none',
    });
    setDialogOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!selectedEmployee) return;

    setSaving(true);
    try {
      // Update labor rate
      const { error: userError } = await supabase
        .from('users')
        .update({ labor_rate: formData.labor_rate })
        .eq('id', selectedEmployee.id);

      if (userError) throw userError;

      // Update role if changed
      if (formData.role_id !== 'none') {
        const currentRoleId = selectedEmployee.roles[0]?.id;
        
        if (currentRoleId !== formData.role_id) {
          // Remove old role
          if (currentRoleId) {
            await supabase
              .from('user_roles')
              .delete()
              .eq('user_id', selectedEmployee.id)
              .eq('role_id', currentRoleId);
          }

          // Add new role
          await supabase
            .from('user_roles')
            .insert({
              user_id: selectedEmployee.id,
              role_id: formData.role_id,
            });
        }
      }

      toast({
        title: 'Employee Updated',
        description: 'Employee details have been saved.',
      });

      setDialogOpen(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save employee details.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!profile?.tenant_id || !inviteData.email) return;

    setSaving(true);
    try {
      // Create invite in auth (this would normally trigger an email)
      const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
        inviteData.email
      );

      if (authError) {
        // If we can't use admin API, just create the user record
        toast({
          variant: 'destructive',
          title: 'Note',
          description: 'User invitation requires admin privileges. Please add user manually.',
        });
        return;
      }

      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${inviteData.email}.`,
      });

      setInviteDialogOpen(false);
      setInviteData({
        email: '',
        first_name: '',
        last_name: '',
        role_id: 'none',
        labor_rate: 0,
      });
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send invitation.',
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'warehouse':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees
            </CardTitle>
            <CardDescription>
              Manage employee roles and labor rates
            </CardDescription>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Employee
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : employees.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No employees found. Invite employees to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Labor Rate</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    {employee.first_name || employee.last_name
                      ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
                      : '-'}
                  </TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {employee.roles.map((role) => (
                        <Badge
                          key={role.id}
                          className={getRoleBadgeColor(role.name)}
                        >
                          {role.name}
                        </Badge>
                      ))}
                      {employee.roles.length === 0 && (
                        <span className="text-muted-foreground">No role</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {employee.labor_rate != null ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {employee.labor_rate.toFixed(2)}/hr
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditEmployee(employee)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update role and labor rate for{' '}
              {selectedEmployee?.first_name || selectedEmployee?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, role_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Role</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor_rate">Labor Rate ($/hour)</Label>
              <Input
                id="labor_rate"
                type="number"
                min="0"
                step="0.01"
                value={formData.labor_rate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    labor_rate: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEmployee} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Employee Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Employee</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new employee
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite_email">Email *</Label>
              <Input
                id="invite_email"
                type="email"
                value={inviteData.email}
                onChange={(e) =>
                  setInviteData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="employee@company.com"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite_first_name">First Name</Label>
                <Input
                  id="invite_first_name"
                  value={inviteData.first_name}
                  onChange={(e) =>
                    setInviteData((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite_last_name">Last Name</Label>
                <Input
                  id="invite_last_name"
                  value={inviteData.last_name}
                  onChange={(e) =>
                    setInviteData((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteData.role_id}
                onValueChange={(value) =>
                  setInviteData((prev) => ({ ...prev, role_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Role</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite_labor_rate">Labor Rate ($/hour)</Label>
              <Input
                id="invite_labor_rate"
                type="number"
                min="0"
                step="0.01"
                value={inviteData.labor_rate}
                onChange={(e) =>
                  setInviteData((prev) => ({
                    ...prev,
                    labor_rate: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={saving || !inviteData.email}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

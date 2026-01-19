import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import {
  Loader2,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Users,
  CheckCircle,
  Clock,
  Upload,
} from 'lucide-react';
import { EmployeeDialog } from '@/components/employees/EmployeeDialog';
import { EmployeeImportDialog } from '@/components/employees/EmployeeImportDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
  MobileDataCardActions,
} from '@/components/ui/mobile-data-card';

interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string;
  enrolled: boolean;
  invited_at: string | null;
  last_login_at: string | null;
  roles: { id: string; name: string }[];
}

export default function Employees() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasRole } = usePermissions();
  const isAdmin = hasRole('admin');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [inviting, setInviting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportDialogOpen(true);
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchEmployees();
    }
  }, [profile?.tenant_id]);

  const fetchEmployees = async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id, email, first_name, last_name, phone, status, enrolled, invited_at, last_login_at
        `)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('email');

      if (error) throw error;

      // Fetch roles separately to avoid join issues
      const userIds = (users || []).map((u: any) => u.id);
      let userRolesMap: Record<string, { id: string; name: string }[]> = {};
      
      if (userIds.length > 0) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            roles(id, name)
          `)
          .in('user_id', userIds);

        if (userRoles) {
          userRoles.forEach((ur: any) => {
            if (ur.roles) {
              if (!userRolesMap[ur.user_id]) {
                userRolesMap[ur.user_id] = [];
              }
              userRolesMap[ur.user_id].push(ur.roles);
            }
          });
        }
      }

      const employeesData = (users || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        status: user.status,
        enrolled: user.enrolled || false,
        invited_at: user.invited_at,
        last_login_at: user.last_login_at,
        roles: userRolesMap[user.id] || [],
      }));

      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load employees',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkInvite = async () => {
    if (selectedIds.size === 0) return;

    setInviting(true);
    try {
      const selectedEmployees = employees.filter(e => selectedIds.has(e.id) && !e.enrolled);
      let successCount = 0;
      
      for (const employee of selectedEmployees) {
        // Generate invite token
        const inviteToken = crypto.randomUUID();
        
        // Update user with invite token and status
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            invite_token: inviteToken,
            invited_at: new Date().toISOString(),
            status: 'invited'
          })
          .eq('id', employee.id);

        if (updateError) {
          console.error('Error updating user:', updateError);
          continue;
        }

        // Call edge function to send invite email
        const { error: emailError } = await supabase.functions.invoke('send-employee-invite', {
          body: {
            user_id: employee.id,
            tenant_id: profile?.tenant_id,
          },
        });

        if (emailError) {
          console.error('Error sending invite email:', emailError);
        } else {
          successCount++;
        }
      }

      toast({
        title: 'Invitations Sent',
        description: `Sent ${successCount} invitation(s) successfully.`,
      });

      setSelectedIds(new Set());
      fetchEmployees();
    } catch (error) {
      console.error('Error sending invites:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send invitations',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setDialogOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDialogOpen(true);
  };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'warehouse':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'repair_tech':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'client_user':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const filteredEmployees = employees.filter(employee =>
    employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (employee.first_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (employee.last_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const allSelected = filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredEmployees.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">
              Manage your team members and their access
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedIds.size > 0 && (
              <Button 
                variant="outline" 
                onClick={handleBulkInvite}
                disabled={inviting}
              >
                {inviting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Invite Selected ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button onClick={handleAddEmployee}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  {employees.length} employees
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No employees found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'Add your first employee to get started'}
                </p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredEmployees.map((employee) => (
                  <MobileDataCard
                    key={employee.id}
                    onClick={() => handleEditEmployee(employee)}
                    selected={selectedIds.has(employee.id)}
                  >
                    <MobileDataCardHeader>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(employee.id)}
                          onCheckedChange={(checked) => handleSelect(employee.id, !!checked)}
                          aria-label={`Select ${employee.email}`}
                          className="h-5 w-5"
                        />
                        <div>
                          <MobileDataCardTitle>
                            {employee.first_name || employee.last_name
                              ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
                              : 'Unnamed'}
                          </MobileDataCardTitle>
                          <MobileDataCardDescription>{employee.email}</MobileDataCardDescription>
                        </div>
                      </div>
                      {employee.enrolled ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Enrolled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </MobileDataCardHeader>
                    <MobileDataCardContent>
                      <div className="flex flex-wrap gap-1">
                        {employee.roles.map((role) => (
                          <Badge
                            key={role.id}
                            className={getRoleBadgeColor(role.name)}
                          >
                            {role.name.replace('_', ' ')}
                          </Badge>
                        ))}
                        {employee.roles.length === 0 && (
                          <span className="text-muted-foreground text-xs">No role</span>
                        )}
                      </div>
                    </MobileDataCardContent>
                    <MobileDataCardActions>
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => handleEditEmployee(employee)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </MobileDataCardActions>
                  </MobileDataCard>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Invited At</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow 
                      key={employee.id}
                      className="cursor-pointer"
                      onClick={() => handleEditEmployee(employee)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(employee.id)}
                          onCheckedChange={(checked) => handleSelect(employee.id, !!checked)}
                          aria-label={`Select ${employee.email}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {employee.first_name || employee.last_name
                          ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
                          : '-'}
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.phone || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {employee.roles.map((role) => (
                            <Badge
                              key={role.id}
                              className={getRoleBadgeColor(role.name)}
                            >
                              {role.name.replace('_', ' ')}
                            </Badge>
                          ))}
                          {employee.roles.length === 0 && (
                            <span className="text-muted-foreground text-sm">No role</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.enrolled ? (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.invited_at
                          ? format(new Date(employee.invited_at), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {employee.last_login_at
                          ? format(new Date(employee.last_login_at), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                              Edit
                            </DropdownMenuItem>
                            {!employee.enrolled && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedIds(new Set([employee.id]));
                                handleBulkInvite();
                              }}>
                                Send Invite
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={selectedEmployee}
        onSuccess={fetchEmployees}
        isAdmin={isAdmin}
      />

      <EmployeeImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        file={importFile}
        onSuccess={() => {
          setImportDialogOpen(false);
          setImportFile(null);
          fetchEmployees();
        }}
      />
    </DashboardLayout>
  );
}

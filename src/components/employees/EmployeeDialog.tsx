import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanDocumentButton, DocumentList } from '@/components/scanner';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useWarehouses } from '@/hooks/useWarehouses';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

const employeeSchema = z.object({
  email: z.string().email('Valid email required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  role_ids: z.array(z.string()),
  // Pay fields - admin only (stored in employee_pay table)
  pay_type: z.string().optional(),
  pay_rate: z.coerce.number().optional(),
  salary_hourly_equivalent: z.coerce.number().optional(),
  overtime_eligible: z.boolean().optional(),
  primary_warehouse_id: z.string().optional(),
  cost_center: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  roles: { id: string; name: string }[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSuccess: () => void;
  isAdmin: boolean;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  warehouse: 'Warehouse',
  client_user: 'Client User',
  repair_tech: 'Repair Tech',
};

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
  isAdmin,
}: EmployeeDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { warehouses } = useWarehouses();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [payData, setPayData] = useState<{
    id?: string;
    pay_type: string | null;
    pay_rate: number | null;
    salary_hourly_equivalent: number | null;
    overtime_eligible: boolean;
    primary_warehouse_id: string | null;
    cost_center: string | null;
  } | null>(null);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role_ids: [],
      pay_type: '',
      pay_rate: undefined,
      salary_hourly_equivalent: undefined,
      overtime_eligible: false,
      primary_warehouse_id: '',
      cost_center: '',
    },
  });

  useEffect(() => {
    if (open && profile?.tenant_id) {
      fetchRoles();
      if (employee) {
        loadEmployeeData(employee.id);
      } else {
        form.reset({
          email: '',
          first_name: '',
          last_name: '',
          phone: '',
          role_ids: [],
          pay_type: '',
          pay_rate: undefined,
          salary_hourly_equivalent: undefined,
          overtime_eligible: false,
          primary_warehouse_id: '',
          cost_center: '',
        });
        setPayData(null);
      }
    }
  }, [open, employee, profile?.tenant_id]);

  const fetchRoles = async () => {
    if (!profile?.tenant_id) return;

    const { data, error } = await supabase
      .from('roles')
      .select('id, name, description')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .in('name', ['admin', 'manager', 'warehouse', 'client_user', 'repair_tech'])
      .order('name');

    if (!error) {
      setRoles(data || []);
    }
  };

  const loadEmployeeData = async (id: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    // Load pay data from employee_pay table if admin
    let employeePayData = null;
    if (isAdmin) {
      const { data: payRecord } = await supabase
        .from('employee_pay')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      employeePayData = payRecord;
    }

    if (!error && data) {
      form.reset({
        email: data.email,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        role_ids: employee?.roles.map(r => r.id) || [],
        pay_type: employeePayData?.pay_type || '',
        pay_rate: employeePayData?.pay_rate || undefined,
        salary_hourly_equivalent: employeePayData?.salary_hourly_equivalent || undefined,
        overtime_eligible: employeePayData?.overtime_eligible || false,
        primary_warehouse_id: employeePayData?.primary_warehouse_id || '',
        cost_center: employeePayData?.cost_center || '',
      });

      if (isAdmin && employeePayData) {
        setPayData({
          id: employeePayData.id,
          pay_type: employeePayData.pay_type,
          pay_rate: employeePayData.pay_rate,
          salary_hourly_equivalent: employeePayData.salary_hourly_equivalent,
          overtime_eligible: employeePayData.overtime_eligible || false,
          primary_warehouse_id: employeePayData.primary_warehouse_id,
          cost_center: employeePayData.cost_center,
        });
      }
    }
  };

  const onSubmit = async (data: EmployeeFormData) => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      const userData: any = {
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        phone: data.phone || null,
      };

      if (employee) {
        // Update existing employee
        const { error } = await supabase
          .from('users')
          .update(userData)
          .eq('id', employee.id);

        if (error) throw error;

        // Update roles
        const currentRoleIds = employee.roles.map(r => r.id);
        const newRoleIds = data.role_ids;

        // Remove old roles
        const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));
        for (const roleId of rolesToRemove) {
          await supabase
            .from('user_roles')
            .update({ deleted_at: new Date().toISOString() })
            .eq('user_id', employee.id)
            .eq('role_id', roleId);
        }

        // Add new roles
        const rolesToAdd = newRoleIds.filter(id => !currentRoleIds.includes(id));
        for (const roleId of rolesToAdd) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: employee.id,
              role_id: roleId,
              assigned_by: profile.id,
            });
        }

        // Save pay data to employee_pay table if admin
        if (isAdmin) {
          await saveEmployeePayData(employee.id, data);
        }

        toast({
          title: 'Employee Updated',
          description: 'Employee details have been saved.',
        });
      } else {
        // Create new employee
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: data.email,
            tenant_id: profile.tenant_id,
            password_hash: 'pending', // Will be set on invite acceptance
            status: 'pending',
            ...userData,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Assign roles
        for (const roleId of data.role_ids) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: newUser.id,
              role_id: roleId,
              assigned_by: profile.id,
            });
        }

        // Save pay data to employee_pay table if admin
        if (isAdmin) {
          await saveEmployeePayData(newUser.id, data);
        }

        toast({
          title: 'Employee Created',
          description: 'New employee has been added.',
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save employee',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveEmployeePayData = async (userId: string, data: EmployeeFormData) => {
    if (!profile?.tenant_id) return;

    const payDataPayload: any = {
      pay_type: data.pay_type || 'hourly',
      pay_rate: data.pay_rate || 0,
      salary_hourly_equivalent: data.salary_hourly_equivalent || null,
      overtime_eligible: data.overtime_eligible || false,
      primary_warehouse_id: data.primary_warehouse_id || null,
      cost_center: data.cost_center || null,
    };

    // Check if pay record exists
    const { data: existingPay } = await supabase
      .from('employee_pay')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPay) {
      // Update existing
      const { error } = await supabase
        .from('employee_pay')
        .update({
          ...payDataPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPay.id);

      if (error) throw error;

      // Audit log
      await supabase.from('admin_audit_log').insert({
        tenant_id: profile.tenant_id,
        actor_id: profile.id,
        entity_type: 'employee_pay',
        entity_id: existingPay.id,
        action: 'update',
        changes_json: payDataPayload,
      });
    } else {
      // Create new
      const { data: newPay, error } = await supabase
        .from('employee_pay')
        .insert({
          tenant_id: profile.tenant_id,
          user_id: userId,
          ...payDataPayload,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from('admin_audit_log').insert({
        tenant_id: profile.tenant_id,
        actor_id: profile.id,
        entity_type: 'employee_pay',
        entity_id: newPay.id,
        action: 'create',
        changes_json: payDataPayload,
      });
    }
  };

  const toggleRole = (roleId: string) => {
    const current = form.getValues('role_ids');
    if (current.includes(roleId)) {
      form.setValue('role_ids', current.filter(id => id !== roleId));
    } else {
      form.setValue('role_ids', [...current, roleId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee ? 'Edit Employee' : 'Add New Employee'}
          </DialogTitle>
          <DialogDescription>
            {employee
              ? `Update details for ${employee.email}`
              : 'Add a new team member to your organization'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="details">
              <TabsList className={`grid w-full ${isAdmin && employee ? 'grid-cols-4' : isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="details" className="gap-2">
                  <MaterialIcon name="person" size="sm" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="roles" className="gap-2">
                  <MaterialIcon name="shield" size="sm" />
                  Roles
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="pay" className="gap-2">
                    <MaterialIcon name="attach_money" size="sm" />
                    Pay
                  </TabsTrigger>
                )}
                {employee && isAdmin && (
                  <TabsTrigger value="documents" className="gap-2">
                    Documents
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="details" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="employee@company.com"
                          disabled={!!employee}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1 (555) 123-4567" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="roles" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <FormLabel>Assign Roles</FormLabel>
                  <FormDescription>
                    Select one or more roles for this employee
                  </FormDescription>
                </div>

                <div className="grid gap-3">
                  {roles.map((role) => {
                    const isChecked = form.watch('role_ids').includes(role.id);
                    return (
                      <div
                        key={role.id}
                        className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleRole(role.id)}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {ROLE_DISPLAY_NAMES[role.name] || role.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {role.description || 'No description'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              {isAdmin && (
                <TabsContent value="pay" className="space-y-4 pt-4">
                  <div className="rounded-lg bg-muted/50 p-4 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Pay information is only visible to administrators and is used for labor cost reporting.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="pay_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pay Type</FormLabel>
                        <Select
                          value={field.value || ''}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select pay type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="salary">Salary</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pay_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Pay Rate {form.watch('pay_type') === 'hourly' ? '($/hour)' : '($/year)'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('pay_type') === 'salary' && (
                    <FormField
                      control={form.control}
                      name="salary_hourly_equivalent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salary Hourly Equivalent ($/hour)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Auto-calculated or enter manually"
                            />
                          </FormControl>
                          <FormDescription>
                            Used for labor cost calculations. Default: annual salary ÷ 2080 hours
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="primary_warehouse_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Warehouse</FormLabel>
                        <Select
                          value={field.value || '_none_'}
                          onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select primary warehouse" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_none_">None</SelectItem>
                            {warehouses.map((wh) => (
                              <SelectItem key={wh.id} value={wh.id}>
                                {wh.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default warehouse for labor cost grouping
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="overtime_eligible"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Overtime Eligible</FormLabel>
                          <FormDescription>
                            Employee can receive overtime pay
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cost_center"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Center</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., WH-001" />
                        </FormControl>
                        <FormDescription>
                          Optional cost center code for reporting
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              )}

              {/* Documents Tab - for existing employees, admin only */}
              {employee && isAdmin && (
                <TabsContent value="documents" className="space-y-4 pt-4">
                  <div className="rounded-lg bg-muted/50 p-4 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Upload sensitive documents like ID cards or certifications. These are only visible to administrators.
                    </p>
                  </div>
                  <div className="flex justify-end mb-4">
                    <ScanDocumentButton
                      context={{ type: 'employee', employeeId: employee.id, employeeName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() }}
                      isSensitive={true}
                      onSuccess={() => {}}
                    />
                  </div>
                  <DocumentList
                    contextType="employee"
                    contextId={employee.id}
                  />
                </TabsContent>
              )}
            </Tabs>

            <Separator />

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : employee ? (
                  'Save Changes'
                ) : (
                  'Add Employee'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

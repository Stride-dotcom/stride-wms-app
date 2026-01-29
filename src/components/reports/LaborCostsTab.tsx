import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLaborSettings } from '@/hooks/useLaborSettings';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface TaskWithTime {
  id: string;
  task_type: string;
  assigned_to: string | null;
  warehouse_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  status: string;
  completed_at: string | null;
}

interface EmployeePayData {
  user_id: string;
  pay_type: string;
  pay_rate: number;
  salary_hourly_equivalent: number | null;
  overtime_eligible: boolean;
  primary_warehouse_id: string | null;
}

interface UserInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface RoleInfo {
  user_id: string;
  role_name: string;
}

interface WarehouseRoleSummary {
  warehouse_id: string;
  warehouse_name: string;
  role: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  labor_cost: number;
  tasks_completed: number;
}

interface EmployeeSummary {
  user_id: string;
  name: string;
  roles: string[];
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_cost: number;
}

interface TaskTypeSummary {
  task_type: string;
  hours: number;
  cost: number;
  count: number;
}

export function LaborCostsTab() {
  const { profile } = useAuth();
  const { warehouses } = useWarehouses();
  const { settings: laborSettings, loading: laborSettingsLoading } = useLaborSettings();
  
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskWithTime[]>([]);
  const [employeePay, setEmployeePay] = useState<EmployeePayData[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [userRoles, setUserRoles] = useState<RoleInfo[]>([]);
  
  // Filters
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedTaskType, setSelectedTaskType] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData();
    }
  }, [profile?.tenant_id, dateFrom, dateTo]);

  const fetchData = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);

    try {
      // Fetch tasks with time data
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, task_type, assigned_to, warehouse_id, started_at, ended_at, duration_minutes, status, completed_at')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .gte('completed_at', dateFrom)
        .lte('completed_at', dateTo + 'T23:59:59');

      // Fetch employee pay data
      const { data: payData } = await supabase
        .from('employee_pay')
        .select('user_id, pay_type, pay_rate, salary_hourly_equivalent, overtime_eligible, primary_warehouse_id')
        .eq('tenant_id', profile.tenant_id);

      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null);

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, roles:role_id(name)')
        .is('deleted_at', null);

      setTasks((tasksData || []) as TaskWithTime[]);
      setEmployeePay((payData || []) as EmployeePayData[]);
      setUsers((usersData || []) as UserInfo[]);
      
      // Transform roles data
      const transformedRoles = (rolesData || []).map((r: any) => ({
        user_id: r.user_id,
        role_name: r.roles?.name || 'unknown',
      }));
      setUserRoles(transformedRoles);
    } catch (error) {
      console.error('Error fetching labor data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(userRoles.map(r => r.role_name));
    return Array.from(roles).sort();
  }, [userRoles]);

  // Get unique task types for filter
  const uniqueTaskTypes = useMemo(() => {
    const types = new Set(tasks.map(t => t.task_type));
    return Array.from(types).sort();
  }, [tasks]);

  // Helper to get user name
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return 'Unknown';
    return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  };

  // Helper to get user roles
  const getUserRoles = (userId: string) => {
    return userRoles.filter(r => r.user_id === userId).map(r => r.role_name);
  };

  // Helper to get employee pay
  const getEmployeePay = (userId: string) => {
    return employeePay.find(p => p.user_id === userId);
  };

  // Helper to get warehouse name
  const getWarehouseName = (warehouseId: string | null) => {
    if (!warehouseId) return 'Unassigned';
    const wh = warehouses.find(w => w.id === warehouseId);
    return wh?.name || 'Unknown';
  };

  // Calculate hourly rate for an employee
  const getHourlyRate = (userId: string) => {
    const pay = getEmployeePay(userId);
    if (!pay) return 0;
    
    if (pay.pay_type === 'hourly') {
      return pay.pay_rate;
    } else {
      // Salary - use salary_hourly_equivalent or calculate from annual / 2080
      return pay.salary_hourly_equivalent || (pay.pay_rate / 2080);
    }
  };

  // Calculate overtime for each employee based on weekly hours
  const calculateOvertimeByEmployee = useMemo(() => {
    const result: Record<string, { regular: number; overtime: number }> = {};
    const standardWeeklyMinutes = (laborSettings?.standard_workweek_hours || 40) * 60;
    const overtimeMultiplier = laborSettings?.overtime_multiplier || 1.5;

    // Group tasks by employee and week
    const employeeWeeklyMinutes: Record<string, Record<string, number>> = {};

    tasks.forEach(task => {
      if (!task.assigned_to || !task.duration_minutes) return;
      
      const userId = task.assigned_to;
      const pay = getEmployeePay(userId);
      if (!pay?.overtime_eligible) return;

      const taskDate = task.completed_at ? parseISO(task.completed_at) : new Date();
      const weekStart = format(startOfWeek(taskDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');

      if (!employeeWeeklyMinutes[userId]) {
        employeeWeeklyMinutes[userId] = {};
      }
      if (!employeeWeeklyMinutes[userId][weekStart]) {
        employeeWeeklyMinutes[userId][weekStart] = 0;
      }
      employeeWeeklyMinutes[userId][weekStart] += task.duration_minutes;
    });

    // Calculate overtime for each employee
    Object.entries(employeeWeeklyMinutes).forEach(([userId, weeks]) => {
      let totalRegular = 0;
      let totalOvertime = 0;

      Object.values(weeks).forEach(weekMinutes => {
        if (weekMinutes > standardWeeklyMinutes) {
          totalRegular += standardWeeklyMinutes;
          totalOvertime += weekMinutes - standardWeeklyMinutes;
        } else {
          totalRegular += weekMinutes;
        }
      });

      result[userId] = { regular: totalRegular, overtime: totalOvertime };
    });

    return result;
  }, [tasks, employeePay, laborSettings]);

  // Filter tasks based on selections
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (selectedWarehouse !== 'all' && task.warehouse_id !== selectedWarehouse) return false;
      if (selectedEmployee !== 'all' && task.assigned_to !== selectedEmployee) return false;
      if (selectedTaskType !== 'all' && task.task_type !== selectedTaskType) return false;
      if (selectedRole !== 'all') {
        const userRolesList = task.assigned_to ? getUserRoles(task.assigned_to) : [];
        if (!userRolesList.includes(selectedRole)) return false;
      }
      return true;
    });
  }, [tasks, selectedWarehouse, selectedEmployee, selectedTaskType, selectedRole, userRoles]);

  // Calculate warehouse + role summary
  const warehouseRoleSummary = useMemo((): WarehouseRoleSummary[] => {
    const summaryMap: Record<string, WarehouseRoleSummary> = {};
    const overtimeMultiplier = laborSettings?.overtime_multiplier || 1.5;

    filteredTasks.forEach(task => {
      if (!task.assigned_to || !task.duration_minutes) return;

      const warehouseId = task.warehouse_id || 'unassigned';
      const roles = getUserRoles(task.assigned_to);
      const role = roles[0] || 'unknown';
      const key = `${warehouseId}-${role}`;

      if (!summaryMap[key]) {
        summaryMap[key] = {
          warehouse_id: warehouseId,
          warehouse_name: getWarehouseName(task.warehouse_id),
          role,
          total_hours: 0,
          regular_hours: 0,
          overtime_hours: 0,
          labor_cost: 0,
          tasks_completed: 0,
        };
      }

      const hours = task.duration_minutes / 60;
      const hourlyRate = getHourlyRate(task.assigned_to);
      const overtimeData = calculateOvertimeByEmployee[task.assigned_to];
      
      // Simplified: proportion based on total employee overtime
      let regularHours = hours;
      let overtimeHours = 0;
      
      if (overtimeData && overtimeData.overtime > 0) {
        const totalEmployeeMinutes = overtimeData.regular + overtimeData.overtime;
        const overtimeRatio = overtimeData.overtime / totalEmployeeMinutes;
        overtimeHours = hours * overtimeRatio;
        regularHours = hours - overtimeHours;
      }

      const cost = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * overtimeMultiplier);

      summaryMap[key].total_hours += hours;
      summaryMap[key].regular_hours += regularHours;
      summaryMap[key].overtime_hours += overtimeHours;
      summaryMap[key].labor_cost += cost;
      summaryMap[key].tasks_completed += 1;
    });

    return Object.values(summaryMap).sort((a, b) => {
      if (a.warehouse_name !== b.warehouse_name) return a.warehouse_name.localeCompare(b.warehouse_name);
      return a.role.localeCompare(b.role);
    });
  }, [filteredTasks, laborSettings, calculateOvertimeByEmployee]);

  // Calculate employee summary
  const employeeSummary = useMemo((): EmployeeSummary[] => {
    const summaryMap: Record<string, EmployeeSummary> = {};
    const overtimeMultiplier = laborSettings?.overtime_multiplier || 1.5;

    filteredTasks.forEach(task => {
      if (!task.assigned_to || !task.duration_minutes) return;

      const userId = task.assigned_to;
      if (!summaryMap[userId]) {
        summaryMap[userId] = {
          user_id: userId,
          name: getUserName(userId),
          roles: getUserRoles(userId),
          total_hours: 0,
          regular_hours: 0,
          overtime_hours: 0,
          total_cost: 0,
        };
      }

      const hours = task.duration_minutes / 60;
      const hourlyRate = getHourlyRate(userId);
      const overtimeData = calculateOvertimeByEmployee[userId];

      let regularHours = hours;
      let overtimeHours = 0;
      
      if (overtimeData && overtimeData.overtime > 0) {
        const totalEmployeeMinutes = overtimeData.regular + overtimeData.overtime;
        const overtimeRatio = overtimeData.overtime / totalEmployeeMinutes;
        overtimeHours = hours * overtimeRatio;
        regularHours = hours - overtimeHours;
      }

      const cost = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * overtimeMultiplier);

      summaryMap[userId].total_hours += hours;
      summaryMap[userId].regular_hours += regularHours;
      summaryMap[userId].overtime_hours += overtimeHours;
      summaryMap[userId].total_cost += cost;
    });

    return Object.values(summaryMap).sort((a, b) => b.total_cost - a.total_cost);
  }, [filteredTasks, laborSettings, calculateOvertimeByEmployee]);

  // Calculate task type summary
  const taskTypeSummary = useMemo((): TaskTypeSummary[] => {
    const summaryMap: Record<string, TaskTypeSummary> = {};
    const overtimeMultiplier = laborSettings?.overtime_multiplier || 1.5;

    filteredTasks.forEach(task => {
      if (!task.duration_minutes) return;

      const taskType = task.task_type;
      if (!summaryMap[taskType]) {
        summaryMap[taskType] = {
          task_type: taskType,
          hours: 0,
          cost: 0,
          count: 0,
        };
      }

      const hours = task.duration_minutes / 60;
      let cost = 0;

      if (task.assigned_to) {
        const hourlyRate = getHourlyRate(task.assigned_to);
        const overtimeData = calculateOvertimeByEmployee[task.assigned_to];

        let regularHours = hours;
        let overtimeHours = 0;
        
        if (overtimeData && overtimeData.overtime > 0) {
          const totalEmployeeMinutes = overtimeData.regular + overtimeData.overtime;
          const overtimeRatio = overtimeData.overtime / totalEmployeeMinutes;
          overtimeHours = hours * overtimeRatio;
          regularHours = hours - overtimeHours;
        }

        cost = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * overtimeMultiplier);
      }

      summaryMap[taskType].hours += hours;
      summaryMap[taskType].cost += cost;
      summaryMap[taskType].count += 1;
    });

    return Object.values(summaryMap).sort((a, b) => b.cost - a.cost);
  }, [filteredTasks, laborSettings, calculateOvertimeByEmployee]);

  // Totals
  const totals = useMemo(() => {
    return {
      hours: warehouseRoleSummary.reduce((sum, row) => sum + row.total_hours, 0),
      cost: warehouseRoleSummary.reduce((sum, row) => sum + row.labor_cost, 0),
      tasks: warehouseRoleSummary.reduce((sum, row) => sum + row.tasks_completed, 0),
      employees: new Set(filteredTasks.filter(t => t.assigned_to).map(t => t.assigned_to)).size,
    };
  }, [warehouseRoleSummary, filteredTasks]);

  // CSV export functions
  const exportWarehouseRoleCSV = () => {
    const headers = ['Warehouse', 'Role', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Labor Cost', 'Tasks Completed'];
    const rows = warehouseRoleSummary.map(row => [
      row.warehouse_name,
      row.role,
      row.total_hours.toFixed(2),
      row.regular_hours.toFixed(2),
      row.overtime_hours.toFixed(2),
      row.labor_cost.toFixed(2),
      row.tasks_completed.toString(),
    ]);
    downloadCSV(headers, rows, 'labor-costs-by-warehouse-role.csv');
  };

  const exportEmployeeCSV = () => {
    const headers = ['Employee', 'Roles', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Total Cost'];
    const rows = employeeSummary.map(row => [
      row.name,
      row.roles.join(', '),
      row.total_hours.toFixed(2),
      row.regular_hours.toFixed(2),
      row.overtime_hours.toFixed(2),
      row.total_cost.toFixed(2),
    ]);
    downloadCSV(headers, rows, 'labor-costs-by-employee.csv');
  };

  const exportTaskTypeCSV = () => {
    const headers = ['Task Type', 'Hours', 'Cost', 'Task Count'];
    const rows = taskTypeSummary.map(row => [
      row.task_type,
      row.hours.toFixed(2),
      row.cost.toFixed(2),
      row.count.toString(),
    ]);
    downloadCSV(headers, rows, 'labor-costs-by-task-type.csv');
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  if (loading || laborSettingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <MaterialIcon name="schedule" size="sm" className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.hours.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Labor Cost</CardTitle>
            <MaterialIcon name="attach_money" size="sm" className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.cost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <MaterialIcon name="business" size="sm" className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.tasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <MaterialIcon name="group" size="sm" className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.employees}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTaskTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{getUserName(user.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Tables */}
      <Tabs defaultValue="warehouse-role">
        <TabsList>
          <TabsTrigger value="warehouse-role">By Warehouse & Role</TabsTrigger>
          <TabsTrigger value="employee">By Employee</TabsTrigger>
          <TabsTrigger value="task-type">By Task Type</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouse-role" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Labor Costs by Warehouse & Role</CardTitle>
                <CardDescription>Summary grouped by warehouse and employee role</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportWarehouseRoleCSV}>
                <MaterialIcon name="download" size="sm" className="mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Regular Hours</TableHead>
                    <TableHead className="text-right">Overtime Hours</TableHead>
                    <TableHead className="text-right">Labor Cost</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouseRoleSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No data available for the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    warehouseRoleSummary.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.warehouse_name}</TableCell>
                        <TableCell className="capitalize">{row.role}</TableCell>
                        <TableCell className="text-right">{row.total_hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{row.regular_hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{row.overtime_hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">${row.labor_cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.tasks_completed}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employee" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Labor Costs by Employee</CardTitle>
                <CardDescription>Individual employee labor breakdown</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportEmployeeCSV}>
                <MaterialIcon name="download" size="sm" className="mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Regular Hours</TableHead>
                    <TableHead className="text-right">Overtime Hours</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No data available for the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeeSummary.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="capitalize">{row.roles.join(', ')}</TableCell>
                        <TableCell className="text-right">{row.total_hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{row.regular_hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{row.overtime_hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">${row.total_cost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="task-type" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Labor Costs by Task Type</CardTitle>
                <CardDescription>Hours and costs per task category</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportTaskTypeCSV}>
                <MaterialIcon name="download" size="sm" className="mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Type</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Task Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskTypeSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No data available for the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    taskTypeSummary.map((row) => (
                      <TableRow key={row.task_type}>
                        <TableCell className="font-medium capitalize">{row.task_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right">{row.hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">${row.cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

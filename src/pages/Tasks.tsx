import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTasks, useTaskTypes, Task } from '@/hooks/useTasks';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { UnableToCompleteDialog } from '@/components/tasks/UnableToCompleteDialog';
import { WillCallCompletionDialog } from '@/components/tasks/WillCallCompletionDialog';
import { TaskCompletionBlockedDialog } from '@/components/tasks/TaskCompletionBlockedDialog';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { validateTaskCompletion, TaskCompletionValidationResult } from '@/lib/billing/taskCompletionValidation';

// Status text classes for bold colored text without background
const getStatusTextClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'font-bold text-orange-500 dark:text-orange-400';
    case 'in_progress':
      return 'font-bold text-yellow-500 dark:text-yellow-400';
    case 'completed':
      return 'font-bold text-green-500 dark:text-green-400';
    case 'unable_to_complete':
      return 'font-bold text-red-500 dark:text-red-400';
    case 'cancelled':
      return 'font-bold text-gray-500 dark:text-gray-400';
    default:
      return '';
  }
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  unable_to_complete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const statusEmojis: Record<string, string> = {
  pending: '🕒',
  in_progress: '🔄',
  completed: '✅',
  unable_to_complete: '❌',
  cancelled: '🚫',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  unable_to_complete: 'Unable to Complete',
  cancelled: 'Cancelled',
};

const priorityColors: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function Tasks() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasRole, isAdmin } = usePermissions();
  const { warehouses } = useWarehouses();
  const { taskTypes } = useTaskTypes();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if user is a technician (repair tech with limited access)
  const isTechnician = hasRole('technician') && !hasRole('tenant_admin') && !hasRole('warehouse_user') && !isAdmin;

  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || 'all',
    taskType: searchParams.get('type') || 'all',
    warehouseId: 'all',
  }));

  // Sync filters from URL params when they change (e.g. Dashboard tile click)
  // Also auto-open dialog when new=true param is present
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlType = searchParams.get('type');
    const isNew = searchParams.get('new') === 'true';

    if (urlStatus || urlType) {
      setFilters(f => ({
        ...f,
        status: urlStatus || f.status,
        taskType: urlType || f.taskType,
      }));
    }

    // Auto-open task creation dialog when new=true
    if (isNew && urlType) {
      setEditingTask(null);
      setPreSelectedTaskType(urlType);
      setDialogOpen(true);
      // Clear the 'new' param from URL to prevent re-opening on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('new');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [preSelectedTaskType, setPreSelectedTaskType] = useState<string | undefined>(undefined);
  const [unableToCompleteTask, setUnableToCompleteTask] = useState<Task | null>(null);
  const [willCallTask, setWillCallTask] = useState<Task | null>(null);
  const [willCallItems, setWillCallItems] = useState<Array<{ id: string; item_code: string; description: string | null }>>([]);
  const [completionBlockedOpen, setCompletionBlockedOpen] = useState(false);
  const [completionValidationResult, setCompletionValidationResult] = useState<TaskCompletionValidationResult | null>(null);

  // Fetch ALL tasks for stable tile counts (no filters, but respect technician filter)
  const { tasks: allTasks } = useTasks({
    // Technicians only see their assigned tasks
    assignedTo: isTechnician ? profile?.id : undefined,
  });

  // Fetch filtered tasks for the table
  const {
    tasks,
    loading,
    isRefetching,
    refetch,
    startTask,
    completeTask,
    markUnableToComplete,
    claimTask,
    updateTaskStatus,
    deleteTask,
    getTaskItems,
  } = useTasks({
    status: filters.status === 'all' ? undefined : filters.status,
    taskType: filters.taskType === 'all' ? undefined : filters.taskType,
    warehouseId: filters.warehouseId === 'all' ? undefined : filters.warehouseId,
    // Technicians only see their assigned tasks
    assignedTo: isTechnician ? profile?.id : undefined,
  });

  // Filter tasks locally for search (avoid refetch on search)
  const filteredTasks = tasks
    .filter(task =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.task_type.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Special handling for due_date: nulls go to end when sorting asc (nearest first)
      if (sortField === 'due_date') {
        const aDate = a.due_date;
        const bDate = b.due_date;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1; // nulls at end
        if (!bDate) return -1;
        const cmp = aDate.localeCompare(bDate);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      let aVal: any = '';
      let bVal: any = '';
      switch (sortField) {
        case 'title': aVal = a.title; bVal = b.title; break;
        case 'task_type': aVal = a.task_type; bVal = b.task_type; break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'priority': aVal = a.priority || ''; bVal = b.priority || ''; break;
        case 'assigned_to':
          aVal = a.assigned_user ? `${a.assigned_user.first_name} ${a.assigned_user.last_name}` : '';
          bVal = b.assigned_user ? `${b.assigned_user.first_name} ${b.assigned_user.last_name}` : '';
          break;
        default: aVal = a.created_at; bVal = b.created_at; break;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIndicator = ({ field }: { field: string }) => (
    sortField === field ? <span className="ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span> : null
  );

  // Use ALL tasks for stable tile counts (not affected by filters)
  const stats = {
    inQueue: allTasks.filter(t => t.status === 'pending').length,
    inProgress: allTasks.filter(t => t.status === 'in_progress').length,
    completed: allTasks.filter(t => t.status === 'completed').length,
    overdue: allTasks.filter(t =>
      t.status !== 'completed' &&
      t.status !== 'unable_to_complete' &&
      t.due_date &&
      new Date(t.due_date) < new Date()
    ).length,
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleCreate = (taskType?: string) => {
    setEditingTask(null);
    setPreSelectedTaskType(taskType);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setPreSelectedTaskType(undefined);
    refetch();
  };

  const handleUnableToComplete = async (note: string) => {
    if (!unableToCompleteTask) return false;
    const success = await markUnableToComplete(unableToCompleteTask.id, note);
    if (success) {
      setUnableToCompleteTask(null);
    }
    return success;
  };

  // Handle Will Call completion
  const handleCompleteClick = async (task: Task) => {
    // Phase 5B: Validate task completion requirements
    if (profile?.tenant_id) {
      const validationResult = await validateTaskCompletion(
        profile.tenant_id,
        task.id,
        task.task_type
      );

      if (!validationResult.canComplete) {
        // Show blocking dialog with validation issues
        setCompletionValidationResult(validationResult);
        setCompletionBlockedOpen(true);
        return;
      }
    }

    if (task.task_type === 'Will Call') {
      // Fetch items for this task
      const items = await getTaskItems(task.id);
      setWillCallItems(items);
      setWillCallTask(task);
    } else {
      // Normal completion
      completeTask(task.id);
    }
  };

  const handleWillCallComplete = async (pickupName: string) => {
    if (!willCallTask) return false;
    const success = await completeTask(willCallTask.id, pickupName);
    if (success) {
      setWillCallTask(null);
      setWillCallItems([]);
    }
    return success;
  };

  // Only show full loading on initial load when there's no data yet
  const showInitialLoading = loading && tasks.length === 0;

  // Render action buttons based on task status
  const renderActionButtons = (task: Task) => {
    const buttons = [];

    if (task.status === 'pending') {
      buttons.push(
        <Button
          key="start"
          size="sm"
          variant="outline"
          onClick={() => startTask(task.id)}
          className="h-7 px-2 text-xs"
        >
          <span className="mr-1">▶️</span>
          Start
        </Button>
      );
    }

    if (task.status === 'in_progress') {
      buttons.push(
        <Button
          key="complete"
          size="sm"
          variant="default"
          onClick={() => handleCompleteClick(task)}
          className="h-7 px-2 text-xs"
        >
          <span className="mr-1">✅</span>
          Complete
        </Button>,
        <Button
          key="unable"
          size="sm"
          variant="destructive"
          onClick={() => setUnableToCompleteTask(task)}
          className="h-7 px-2 text-xs"
        >
          <span className="mr-1">❌</span>
          Unable
        </Button>
      );
    }

    return buttons.length > 0 ? (
      <div className="flex gap-1">{buttons}</div>
    ) : null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            primaryText={isTechnician ? "My" : "Operations"}
            accentText={isTechnician ? "Tasks" : "Queue"}
            description={isTechnician ? "View and complete your assigned tasks" : "Manage inspections, assemblies, repairs, and other tasks"}
          />
          {!isTechnician && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/billing')}>
                <span className="mr-2">💲</span>
                Add Charge
              </Button>
              <Button onClick={() => handleCreate()} className="w-full sm:w-auto">
                <span className="mr-2">➕</span>
                Create Task
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilters(f => ({ ...f, status: 'pending' }))}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="emoji-tile emoji-tile-lg bg-card border border-border shadow-sm rounded-lg">
                  🕒
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inQueue}</p>
                  <p className="text-sm text-muted-foreground">In Queue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilters(f => ({ ...f, status: 'in_progress' }))}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="emoji-tile emoji-tile-lg bg-card border border-border shadow-sm rounded-lg">
                  🔄
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilters(f => ({ ...f, status: 'completed' }))}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="emoji-tile emoji-tile-lg bg-card border border-border shadow-sm rounded-lg">
                  ✅
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="emoji-tile emoji-tile-lg bg-card border border-border shadow-sm rounded-lg">
                  🚨
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filters.status} onValueChange={(value) => setFilters(f => ({ ...f, status: value }))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="unable_to_complete">Unable to Complete</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.taskType} onValueChange={(value) => setFilters(f => ({ ...f, taskType: value }))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {taskTypes.map(type => (
                <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.warehouseId} onValueChange={(value) => setFilters(f => ({ ...f, warehouseId: value }))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(wh => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={refetch} disabled={isRefetching}>
            <span className={isRefetching ? 'animate-spin inline-block' : ''}>🔄</span>
          </Button>
        </div>

        {/* Tasks Table */}
        <Card className="relative">
          {/* Subtle loading overlay for refetching */}
          {isRefetching && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
              <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
            </div>
          )}
          
          {showInitialLoading ? (
            <CardContent className="flex items-center justify-center h-48">
              <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('title')}>
                    Task<SortIndicator field="title" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('task_type')}>
                    Type<SortIndicator field="task_type" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                    Status<SortIndicator field="status" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('priority')}>
                    Priority<SortIndicator field="priority" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('due_date')}>
                    Due Date<SortIndicator field="due_date" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('assigned_to')}>
                    Assigned To<SortIndicator field="assigned_to" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-5xl opacity-30">📝</div>
                        <p className="text-muted-foreground font-medium">
                          {searchQuery || filters.status !== 'all' || filters.taskType !== 'all' || filters.warehouseId !== 'all'
                            ? 'No tasks match your filters'
                            : 'No tasks yet'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {searchQuery || filters.status !== 'all' || filters.taskType !== 'all' || filters.warehouseId !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'Click "Create Task" to get started'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <TableCell className="font-medium">
                        {task.title}
                        {task.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {task.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.task_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={getStatusTextClass(task.status)}>
                          {statusLabels[task.status]?.toUpperCase() || task.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.priority === 'urgent' ? (
                          <span className="font-bold text-red-500 dark:text-red-400">
                            URGENT
                          </span>
                        ) : (
                          <span className="font-bold text-blue-500 dark:text-blue-400">
                            NORMAL
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <span className={
                            new Date(task.due_date) < new Date() &&
                            task.status !== 'completed' &&
                            task.status !== 'unable_to_complete'
                              ? 'text-red-600 font-medium'
                              : ''
                          }>
                            {format(new Date(task.due_date), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.assigned_user ? (
                          <span>
                            {task.assigned_user.first_name} {task.assigned_user.last_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </CardContent>
          )}
        </Card>
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        preSelectedTaskType={preSelectedTaskType}
        onSuccess={handleDialogSuccess}
      />

      <UnableToCompleteDialog
        open={!!unableToCompleteTask}
        onOpenChange={(open) => !open && setUnableToCompleteTask(null)}
        taskTitle={unableToCompleteTask?.title || ''}
        onConfirm={handleUnableToComplete}
      />

      <WillCallCompletionDialog
        open={!!willCallTask}
        onOpenChange={(open) => {
          if (!open) {
            setWillCallTask(null);
            setWillCallItems([]);
          }
        }}
        taskTitle={willCallTask?.title || ''}
        items={willCallItems}
        onComplete={handleWillCallComplete}
      />

      <TaskCompletionBlockedDialog
        open={completionBlockedOpen}
        onOpenChange={setCompletionBlockedOpen}
        validationResult={completionValidationResult}
      />
    </DashboardLayout>
  );
}

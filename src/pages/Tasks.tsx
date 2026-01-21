import { useState } from 'react';
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
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { UnableToCompleteDialog } from '@/components/tasks/UnableToCompleteDialog';
import { WillCallCompletionDialog } from '@/components/tasks/WillCallCompletionDialog';
import { format } from 'date-fns';
import {
  Loader2,
  Plus,
  Search,
  MoreHorizontal,
  Check,
  User,
  Trash2,
  Pencil,
  RefreshCw,
  ClipboardList,
  AlertCircle,
  Clock,
  CheckCircle2,
  Play,
  XCircle,
  ListTodo,
  AlertTriangle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  in_queue: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  unable_to_complete: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  in_queue: 'In Queue',
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  unable_to_complete: 'Unable to Complete',
  cancelled: 'Cancelled',
};

const priorityColors: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-800',
  urgent: 'bg-red-100 text-red-800',
};

export default function Tasks() {
  const { profile } = useAuth();
  const { warehouses } = useWarehouses();
  const { taskTypes } = useTaskTypes();

  const [filters, setFilters] = useState({
    status: 'all',
    taskType: 'all',
    warehouseId: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [preSelectedTaskType, setPreSelectedTaskType] = useState<string | undefined>(undefined);
  const [unableToCompleteTask, setUnableToCompleteTask] = useState<Task | null>(null);
  const [willCallTask, setWillCallTask] = useState<Task | null>(null);
  const [willCallItems, setWillCallItems] = useState<Array<{ id: string; item_code: string; description: string | null }>>([]);

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
  });

  // Filter tasks locally for search (avoid refetch on search)
  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.task_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Memoize stats to avoid recalculation flicker
  const stats = {
    inQueue: tasks.filter(t => t.status === 'in_queue' || t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => 
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

    if (task.status === 'in_queue' || task.status === 'pending') {
      buttons.push(
        <Button
          key="start"
          size="sm"
          variant="outline"
          onClick={() => startTask(task.id)}
          className="h-7 px-2 text-xs"
        >
          <Play className="h-3 w-3 mr-1" />
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
          <Check className="h-3 w-3 mr-1" />
          Complete
        </Button>,
        <Button
          key="unable"
          size="sm"
          variant="destructive"
          onClick={() => setUnableToCompleteTask(task)}
          className="h-7 px-2 text-xs"
        >
          <XCircle className="h-3 w-3 mr-1" />
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
        <div className="flex items-center justify-between">
          <PageHeader
            primaryText="Operations"
            accentText="Queue"
            description="Manage inspections, assemblies, repairs, and other tasks"
          />
          <Button onClick={() => handleCreate()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilters(f => ({ ...f, status: 'in_queue' }))}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <ListTodo className="h-6 w-6 text-yellow-600" />
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
                <div className="p-3 bg-amber-100 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-amber-600" />
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
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
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
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-600" />
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <SelectItem value="in_queue">In Queue</SelectItem>
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
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Tasks Table */}
        <Card className="relative">
          {/* Subtle loading overlay for refetching */}
          {isRefetching && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {showInitialLoading ? (
            <CardContent className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <ClipboardList className="h-10 w-10 text-muted-foreground" />
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
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleEdit(task)}
                          className="hover:underline text-left"
                        >
                          {task.title}
                        </button>
                        {task.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {task.description}
                          </p>
                        )}
                        {task.status === 'unable_to_complete' && task.unable_to_complete_note && (
                          <p className="text-xs text-destructive truncate max-w-[200px]">
                            Note: {task.unable_to_complete_note}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.task_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(value) => {
                            if (value === 'unable_to_complete') {
                              setUnableToCompleteTask(task);
                            } else {
                              updateTaskStatus(task.id, value);
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-[140px]">
                            <Badge className={statusColors[task.status] || ''}>
                              {statusLabels[task.status] || task.status.replace('_', ' ')}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in_queue">In Queue</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="unable_to_complete">Unable to Complete</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {task.priority === 'urgent' ? (
                          <Badge className="bg-red-100 text-red-800 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Urgent
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-800">
                            Normal
                          </Badge>
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
                      <TableCell>
                        {renderActionButtons(task)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(task)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {!task.assigned_to && (
                              <DropdownMenuItem onClick={() => claimTask(task.id)}>
                                <User className="mr-2 h-4 w-4" />
                                Claim Task
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(task.status === 'in_queue' || task.status === 'pending') && (
                              <DropdownMenuItem onClick={() => startTask(task.id)}>
                                <Play className="mr-2 h-4 w-4" />
                                Start Task
                              </DropdownMenuItem>
                            )}
                              {task.status === 'in_progress' && (
                              <>
                                <DropdownMenuItem onClick={() => handleCompleteClick(task)}>
                                  <Check className="mr-2 h-4 w-4" />
                                  Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setUnableToCompleteTask(task)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Unable to Complete
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteTask(task.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    </DashboardLayout>
  );
}

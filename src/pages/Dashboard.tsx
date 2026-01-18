import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { format, isPast, isToday } from 'date-fns';
import { 
  Loader2, 
  Search as SearchIcon, 
  Truck, 
  ClipboardCheck, 
  Wrench, 
  Package,
  RefreshCw,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  in_queue: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-blue-100 text-blue-800',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { 
    stats, 
    inspectionTasks, 
    assemblyTasks, 
    incomingShipments,
    putAwayItems,
    loading, 
    refetch 
  } = useDashboardStats();

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const isOverdue = isPast(date) && !isToday(date);
    return (
      <span className={isOverdue ? 'text-destructive font-medium' : ''}>
        {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
        {format(date, 'MMM d, yyyy')}
      </span>
    );
  };

  const handleCardClick = (type: 'inspection' | 'assembly' | 'shipments' | 'putaway') => {
    switch (type) {
      case 'inspection':
        navigate('/tasks?type=Inspection');
        break;
      case 'assembly':
        navigate('/tasks?type=Assembly');
        break;
      case 'shipments':
        navigate('/shipments?direction=inbound');
        break;
      case 'putaway':
        navigate('/inventory?location=receiving');
        break;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}! Here's an overview of your warehouse.
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCardClick('inspection')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Need to Inspect</CardTitle>
                  <ClipboardCheck className="h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.needToInspect}</div>
                  <p className="text-xs text-muted-foreground">Pending inspections by due date</p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCardClick('assembly')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Need to Assemble</CardTitle>
                  <Wrench className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.needToAssemble}</div>
                  <p className="text-xs text-muted-foreground">Pending assemblies by due date</p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCardClick('shipments')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Incoming Shipments</CardTitle>
                  <Truck className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.incomingShipments}</div>
                  <p className="text-xs text-muted-foreground">Expected by ETA date</p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCardClick('putaway')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Put Away</CardTitle>
                  <Package className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.putAwayCount}</div>
                  <p className="text-xs text-muted-foreground">Items at Receiving Dock</p>
                </CardContent>
              </Card>
            </div>

            {/* Task Lists Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Inspection Tasks */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Inspections Due</CardTitle>
                    <CardDescription>Upcoming inspection tasks</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleCardClick('inspection')}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {inspectionTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No pending inspections</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inspectionTasks.slice(0, 5).map((task) => (
                          <TableRow 
                            key={task.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/tasks?id=${task.id}`)}
                          >
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell>{task.account?.account_name || '-'}</TableCell>
                            <TableCell>{formatDueDate(task.due_date)}</TableCell>
                            <TableCell>
                              <Badge className={priorityColors[task.priority] || ''}>
                                {task.priority}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Assembly Tasks */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Assemblies Due</CardTitle>
                    <CardDescription>Upcoming assembly tasks</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleCardClick('assembly')}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {assemblyTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No pending assemblies</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assemblyTasks.slice(0, 5).map((task) => (
                          <TableRow 
                            key={task.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/tasks?id=${task.id}`)}
                          >
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell>{task.account?.account_name || '-'}</TableCell>
                            <TableCell>{formatDueDate(task.due_date)}</TableCell>
                            <TableCell>
                              <Badge className={priorityColors[task.priority] || ''}>
                                {task.priority}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Incoming Shipments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Incoming Shipments</CardTitle>
                  <CardDescription>Expected shipments by ETA</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleCardClick('shipments')}>
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {incomingShipments.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No incoming shipments</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shipment #</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>ETA</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomingShipments.slice(0, 5).map((shipment) => (
                        <TableRow 
                          key={shipment.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/shipments?id=${shipment.id}`)}
                        >
                          <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
                          <TableCell>{shipment.account?.account_name || '-'}</TableCell>
                          <TableCell>{shipment.carrier || '-'}</TableCell>
                          <TableCell>
                            {shipment.eta ? format(new Date(shipment.eta), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[shipment.status] || 'bg-gray-100 text-gray-800'}>
                              {shipment.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Put Away List - Larger Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Put Away List</CardTitle>
                  <CardDescription>Items at Receiving Dock that need to be put away</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleCardClick('putaway')}>
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {putAwayItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No items at Receiving Dock</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {putAwayItems.map((item) => (
                        <TableRow 
                          key={item.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/inventory?id=${item.id}`)}
                        >
                          <TableCell className="font-medium">{item.item_code}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {item.description || '-'}
                          </TableCell>
                          <TableCell>{item.client_account || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.location?.code || item.location?.name || 'Receiving'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.received_at 
                              ? format(new Date(item.received_at), 'MMM d, yyyy')
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

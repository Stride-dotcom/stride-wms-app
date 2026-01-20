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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { format, isPast, isToday } from 'date-fns';
import { 
  Loader2, 
  Truck, 
  ClipboardCheck, 
  Wrench, 
  Package,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  GripVertical,
  Settings2,
  Eye,
  EyeOff,
  Trash2,
  Play,
  Check,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  in_queue: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-amber-100 text-amber-800',
};

interface SortableCardProps {
  id: string;
  children: React.ReactNode;
}

function SortableCard({ id, children }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { 
    stats, 
    inspectionTasks, 
    assemblyTasks, 
    willCallTasks,
    disposalTasks,
    incomingShipments,
    putAwayItems,
    loading, 
    refetch 
  } = useDashboardStats();

  const {
    preferences,
    updateCardOrder,
    toggleCardVisibility,
    DEFAULT_CARD_ORDER,
  } = useDashboardPreferences();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleCardClick = (type: 'inspection' | 'assembly' | 'shipments' | 'putaway' | 'willcall' | 'disposal') => {
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
      case 'willcall':
        navigate('/tasks?type=Will%20Call');
        break;
      case 'disposal':
        navigate('/tasks?type=Disposal');
        break;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = preferences.cardOrder.indexOf(active.id as string);
      const newIndex = preferences.cardOrder.indexOf(over.id as string);
      const newOrder = arrayMove(preferences.cardOrder, oldIndex, newIndex);
      updateCardOrder(newOrder);
    }
  };

  const cardConfigs: Record<string, { title: string; icon: React.ReactNode; value: number; description: string; type: 'inspection' | 'assembly' | 'shipments' | 'putaway' | 'willcall' | 'disposal' }> = {
    inspection: {
      title: 'Need to Inspect',
      icon: <ClipboardCheck className="h-5 w-5 text-yellow-500" />,
      value: stats.needToInspect,
      description: 'Pending inspections by due date',
      type: 'inspection',
    },
    assembly: {
      title: 'Need to Assemble',
      icon: <Wrench className="h-5 w-5 text-amber-500" />,
      value: stats.needToAssemble,
      description: 'Pending assemblies by due date',
      type: 'assembly',
    },
    shipments: {
      title: 'Incoming Shipments',
      icon: <Truck className="h-5 w-5 text-green-500" />,
      value: stats.incomingShipments,
      description: 'Expected by ETA date',
      type: 'shipments',
    },
    putaway: {
      title: 'Put Away',
      icon: <Package className="h-5 w-5 text-purple-500" />,
      value: stats.putAwayCount,
      description: 'Items at Receiving Dock',
      type: 'putaway',
    },
    willcall: {
      title: 'Will Call',
      icon: <Truck className="h-5 w-5 text-orange-500" />,
      value: stats.willCallCount,
      description: 'Pending pickups',
      type: 'willcall',
    },
    disposal: {
      title: 'Disposal',
      icon: <Trash2 className="h-5 w-5 text-red-500" />,
      value: stats.disposalCount,
      description: 'Items to dispose',
      type: 'disposal',
    },
  };

  const visibleCards = preferences.cardOrder.filter(
    id => !preferences.hiddenCards.includes(id)
  );

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
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {DEFAULT_CARD_ORDER.map(cardId => (
                  <DropdownMenuItem
                    key={cardId}
                    onClick={() => toggleCardVisibility(cardId)}
                    className="gap-2"
                  >
                    {preferences.hiddenCards.includes(cardId) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {cardConfigs[cardId]?.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stat Cards - Draggable */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={visibleCards} strategy={rectSortingStrategy}>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {visibleCards.map(cardId => {
                    const config = cardConfigs[cardId];
                    if (!config) return null;

                    return (
                      <SortableCard key={cardId} id={cardId}>
                        <Card 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleCardClick(config.type)}
                        >
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-10">
                            <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
                            {config.icon}
                          </CardHeader>
                          <CardContent className="pl-10">
                            <div className="text-2xl font-bold">{config.value}</div>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          </CardContent>
                        </Card>
                      </SortableCard>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

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
                          onClick={() => navigate(`/shipments/${shipment.id}`)}
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

            {/* Will Call & Disposal Tasks */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Will Call Tasks */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5 text-orange-500" />
                      Will Call Pickups
                    </CardTitle>
                    <CardDescription>Pending customer pickups</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleCardClick('willcall')}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {willCallTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No pending will call pickups</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {willCallTasks.slice(0, 5).map((task) => (
                          <TableRow 
                            key={task.id} 
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell 
                              className="font-medium"
                              onClick={() => navigate(`/tasks?id=${task.id}`)}
                            >
                              {task.title}
                            </TableCell>
                            <TableCell onClick={() => navigate(`/tasks?id=${task.id}`)}>
                              {task.account?.account_name || '-'}
                            </TableCell>
                            <TableCell onClick={() => navigate(`/tasks?id=${task.id}`)}>
                              {formatDueDate(task.due_date)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {task.status === 'in_queue' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/tasks?id=${task.id}&action=start`);
                                    }}
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                                {task.status === 'in_progress' && (
                                  <Button 
                                    size="sm" 
                                    variant="default" 
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/tasks?id=${task.id}&action=complete`);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Disposal Tasks */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-red-500" />
                      Disposal Queue
                    </CardTitle>
                    <CardDescription>Items awaiting disposal</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleCardClick('disposal')}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {disposalTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No items pending disposal</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disposalTasks.slice(0, 5).map((task) => (
                          <TableRow 
                            key={task.id} 
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell 
                              className="font-medium"
                              onClick={() => navigate(`/tasks?id=${task.id}`)}
                            >
                              {task.title}
                            </TableCell>
                            <TableCell onClick={() => navigate(`/tasks?id=${task.id}`)}>
                              {task.account?.account_name || '-'}
                            </TableCell>
                            <TableCell onClick={() => navigate(`/tasks?id=${task.id}`)}>
                              {formatDueDate(task.due_date)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {task.status === 'in_queue' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/tasks?id=${task.id}&action=start`);
                                    }}
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                                {task.status === 'in_progress' && (
                                  <Button 
                                    size="sm" 
                                    variant="default" 
                                    className="h-7 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/tasks?id=${task.id}&action=complete`);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Put Away List */}
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
                          onClick={() => navigate(`/inventory/${item.id}`)}
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

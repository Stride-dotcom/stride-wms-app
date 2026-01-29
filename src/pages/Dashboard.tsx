import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, PutAwayItem, TaskItem, ShipmentItem } from '@/hooks/useDashboardStats';

/**
 * Format minutes to a readable time string
 * e.g., 135 -> "2h 15m", 45 -> "45 min"
 */
function formatTimeEstimate(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

type ExpandedCard = 'put_away' | 'inspection' | 'assembly' | 'incoming_shipments' | 'repairs' | null;

/**
 * Phase 2 Dashboard (Command Center)
 * Requirements:
 * - 5 large tiles: Put Away, Needs Inspection, Needs Assembly, Incoming Shipments, Repairs
 * - Each tile shows total count + urgent badge if urgent > 0
 * - Each tile has expandable dropdown showing items
 * - Clicking each tile navigates to the correct page with the correct default filter/tab
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const {
    stats,
    putAwayItems,
    inspectionTasks,
    assemblyTasks,
    repairTasks,
    incomingShipments,
    loading,
    refetch
  } = useDashboardStats();
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);

  const toggleCard = (key: ExpandedCard) => {
    setExpandedCard(expandedCard === key ? null : key);
  };

  const tiles = useMemo(
    () => [
      {
        key: 'put_away' as ExpandedCard,
        title: 'PUT AWAY',
        emoji: '📦',
        count: stats.putAwayCount,
        urgent: stats.putAwayUrgentCount,
        description: 'Items on receiving dock',
        bgColor: 'bg-card border border-border shadow-sm',
        countColor: 'text-purple-600 dark:text-purple-400',
        onClick: () => navigate('/inventory?location=receiving'),
      },
      {
        key: 'inspection' as ExpandedCard,
        title: 'NEEDS INSPECTION',
        emoji: '🔍',
        count: stats.needToInspect,
        urgent: stats.urgentNeedToInspect,
        description: 'Pending inspection tasks',
        bgColor: 'bg-card border border-border shadow-sm',
        countColor: 'text-amber-600 dark:text-amber-400',
        onClick: () => navigate('/tasks?type=Inspection&status=pending'),
        timeEstimate: stats.inspectionTimeEstimate,
      },
      {
        key: 'assembly' as ExpandedCard,
        title: 'NEEDS ASSEMBLY',
        emoji: '🔧',
        count: stats.needToAssemble,
        urgent: stats.urgentNeedToAssemble,
        description: 'Pending assembly tasks',
        bgColor: 'bg-card border border-border shadow-sm',
        countColor: 'text-blue-600 dark:text-blue-400',
        onClick: () => navigate('/tasks?type=Assembly&status=pending'),
        timeEstimate: stats.assemblyTimeEstimate,
      },
      {
        key: 'incoming_shipments' as ExpandedCard,
        title: 'INCOMING SHIPMENTS',
        emoji: '🚚',
        count: stats.incomingShipments,
        urgent: stats.incomingShipmentsUrgentCount,
        description: 'Expected / not received',
        bgColor: 'bg-card border border-border shadow-sm',
        countColor: 'text-emerald-600 dark:text-emerald-400',
        onClick: () => navigate('/shipments/incoming'),
      },
      {
        key: 'repairs' as ExpandedCard,
        title: 'REPAIRS',
        emoji: '🔨',
        count: stats.repairCount,
        urgent: stats.urgentNeedToRepair,
        description: 'Pending repair tasks',
        bgColor: 'bg-card border border-border shadow-sm',
        countColor: 'text-red-600 dark:text-red-400',
        onClick: () => navigate('/tasks?type=Repair&status=pending'),
        timeEstimate: stats.repairTimeEstimate,
      },
    ],
    [navigate, stats]
  );

  // Get items for expanded card
  const getExpandedItems = (key: ExpandedCard) => {
    switch (key) {
      case 'put_away':
        return putAwayItems;
      case 'inspection':
        return inspectionTasks;
      case 'assembly':
        return assemblyTasks;
      case 'repairs':
        return repairTasks;
      case 'incoming_shipments':
        return incomingShipments;
      default:
        return [];
    }
  };

  // Render item row based on type
  const renderItemRow = (item: PutAwayItem | TaskItem | ShipmentItem, key: ExpandedCard) => {
    if (key === 'put_away') {
      const putAwayItem = item as PutAwayItem;
      return (
        <div
          key={putAwayItem.id}
          className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/inventory/${putAwayItem.id}`);
          }}
          role="button"
        >
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-medium truncate">{putAwayItem.item_code}</div>
            {putAwayItem.description && (
              <div className="text-xs text-muted-foreground truncate">{putAwayItem.description}</div>
            )}
          </div>
          <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
        </div>
      );
    }

    if (key === 'incoming_shipments') {
      const shipment = item as ShipmentItem;
      return (
        <div
          key={shipment.id}
          className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/shipments/${shipment.id}`);
          }}
          role="button"
        >
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-medium truncate">{shipment.shipment_number}</div>
            <div className="text-xs text-muted-foreground truncate">
              {shipment.account?.account_name || 'Unknown'} • {shipment.carrier || 'No carrier'}
            </div>
          </div>
          <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
        </div>
      );
    }

    // Task items (inspection, assembly, repairs)
    const task = item as TaskItem;
    return (
      <div
        key={task.id}
        className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/tasks?id=${task.id}`);
        }}
        role="button"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{task.title}</div>
          <div className="text-xs text-muted-foreground truncate">
            {task.account?.account_name || 'No account'}
            {task.priority === 'urgent' && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">Urgent</Badge>
            )}
          </div>
        </div>
        <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between gap-3">
          <PageHeader
            primaryText="Command"
            accentText="Center"
            description={`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ''}.`}
          />
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <MaterialIcon name={loading ? "sync" : "refresh"} size="sm" className={cn("mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => {
              const isExpanded = expandedCard === t.key;
              const items = getExpandedItems(t.key);
              const timeStr = t.timeEstimate ? formatTimeEstimate(t.timeEstimate) : '';

              return (
                <Card key={t.key} className="hover:shadow-lg transition-shadow relative">
                  {/* Expand/Collapse Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCard(t.key);
                    }}
                  >
                    <MaterialIcon name="expand_more" size="sm" className={cn(
                      "transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )} />
                  </Button>

                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-10">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                        {t.title}
                      </CardTitle>
                      {typeof t.urgent === 'number' && t.urgent > 0 && (
                        <Badge className="bg-red-500 text-white text-[10px]">
                          ⚠️ {t.urgent}
                        </Badge>
                      )}
                    </div>
                    <div className={`emoji-tile emoji-tile-lg rounded-lg ${t.bgColor}`}>
                      {t.emoji}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div
                      className={`flex items-baseline gap-2 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={t.onClick}
                      role="button"
                    >
                      <span className={`text-3xl font-bold ${t.countColor}`}>{t.count ?? 0}</span>
                      {timeStr && t.count > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ⏱️ ~{timeStr}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>

                    {/* Expandable Items List */}
                    {isExpanded && items.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <ScrollArea className="max-h-64">
                          <div className="space-y-1">
                            {items.slice(0, 10).map((item) => renderItemRow(item, t.key))}
                          </div>
                        </ScrollArea>
                        {items.length > 10 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              t.onClick();
                            }}
                          >
                            View all {t.count} items
                          </Button>
                        )}
                      </div>
                    )}

                    {isExpanded && items.length === 0 && (
                      <div className="mt-4 border-t pt-3 text-center text-sm text-muted-foreground">
                        No items to display
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

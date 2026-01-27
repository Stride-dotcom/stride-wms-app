import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, PutAwayItem } from '@/hooks/useDashboardStats';

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

/**
 * Phase 2 Dashboard (Command Center)
 * Requirements:
 * - 5 large tiles: Put Away, Needs Inspection, Needs Assembly, Incoming Shipments, Repairs
 * - Each tile shows total count + urgent badge if urgent > 0
 * - Clicking each tile navigates to the correct page with the correct default filter/tab
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { stats, putAwayItems, loading, refetch } = useDashboardStats();
  const [putAwayExpanded, setPutAwayExpanded] = useState(false);

  const tiles = useMemo(
    () => [
      {
        key: 'put_away',
        title: 'PUT AWAY',
        emoji: '📦',
        count: stats.putAwayCount,
        urgent: stats.putAwayUrgentCount,
        description: 'Items on receiving dock',
        bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
        countColor: 'text-purple-600 dark:text-purple-400',
        onClick: () => navigate('/inventory?location=receiving'),
      },
      {
        key: 'inspection',
        title: 'NEEDS INSPECTION',
        emoji: '🔍',
        count: stats.needToInspect,
        urgent: stats.urgentNeedToInspect,
        description: 'Pending inspection tasks',
        bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
        countColor: 'text-amber-600 dark:text-amber-400',
        onClick: () => navigate('/tasks?type=Inspection&status=pending'),
        timeEstimate: stats.inspectionTimeEstimate,
      },
      {
        key: 'assembly',
        title: 'NEEDS ASSEMBLY',
        emoji: '🔧',
        count: stats.needToAssemble,
        urgent: stats.urgentNeedToAssemble,
        description: 'Pending assembly tasks',
        bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
        countColor: 'text-blue-600 dark:text-blue-400',
        onClick: () => navigate('/tasks?type=Assembly&status=pending'),
        timeEstimate: stats.assemblyTimeEstimate,
      },
      {
        key: 'incoming_shipments',
        title: 'INCOMING SHIPMENTS',
        emoji: '🚚',
        count: stats.incomingShipments,
        urgent: stats.incomingShipmentsUrgentCount,
        description: 'Expected / not received',
        bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        countColor: 'text-emerald-600 dark:text-emerald-400',
        onClick: () => navigate('/shipments/incoming'),
      },
      {
        key: 'repairs',
        title: 'REPAIRS',
        emoji: '🔨',
        count: stats.repairCount,
        urgent: stats.urgentNeedToRepair,
        description: 'Pending repair tasks',
        bgColor: 'bg-red-500/10 dark:bg-red-500/20',
        countColor: 'text-red-600 dark:text-red-400',
        onClick: () => navigate('/tasks?type=Repair&status=pending'),
        timeEstimate: stats.repairTimeEstimate,
      },
    ],
    [navigate, stats]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <PageHeader
            primaryText="Command"
            accentText="Center"
            description={`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ''}.`}
          />
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-2">🔄</span>}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => {
              // Special handling for put_away tile to show expandable items list
              if (t.key === 'put_away') {
                return (
                  <Card key={t.key} className="hover:shadow-lg transition-shadow">
                    <CardHeader
                      className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
                      onClick={() => setPutAwayExpanded(!putAwayExpanded)}
                      role="button"
                    >
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">{t.title}</CardTitle>
                        {typeof t.urgent === 'number' && t.urgent > 0 && (
                          <Badge className="bg-red-500 text-white">
                            ⚠️ {t.urgent}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`emoji-tile emoji-tile-lg rounded-lg ${t.bgColor}`}>
                          {t.emoji}
                        </div>
                        {putAwayExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`text-3xl font-bold cursor-pointer hover:opacity-80 transition-opacity ${t.countColor}`}
                        onClick={t.onClick}
                        role="button"
                      >
                        {t.count ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>

                      {putAwayExpanded && putAwayItems.length > 0 && (
                        <div className="mt-4 border-t pt-3 space-y-2 max-h-64 overflow-y-auto">
                          {putAwayItems.slice(0, 10).map((item: PutAwayItem) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/inventory/${item.id}`);
                              }}
                              role="button"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm font-medium truncate">{item.item_code}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                )}
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                            </div>
                          ))}
                          {putAwayItems.length > 10 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
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
                    </CardContent>
                  </Card>
                );
              }

              // Standard tile rendering for other tiles
              const timeStr = t.timeEstimate ? formatTimeEstimate(t.timeEstimate) : '';
              return (
                <Card
                  key={t.key}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={t.onClick}
                  role="button"
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">{t.title}</CardTitle>
                      {typeof t.urgent === 'number' && t.urgent > 0 && (
                        <Badge className="bg-red-500 text-white">
                          ⚠️ {t.urgent}
                        </Badge>
                      )}
                    </div>
                    <div className={`emoji-tile emoji-tile-lg rounded-lg ${t.bgColor}`}>
                      {t.emoji}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${t.countColor}`}>{t.count ?? 0}</span>
                      {timeStr && t.count > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ⏱️ ~{timeStr}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
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

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Package, ClipboardCheck, Wrench, Truck, Hammer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';

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
  const { stats, loading, refetch } = useDashboardStats();

  const tiles = useMemo(
    () => [
      {
        key: 'put_away',
        title: 'Put Away',
        icon: <Package className="h-5 w-5" />,
        count: stats.putAwayCount,
        urgent: stats.putAwayUrgentCount,
        description: 'Items on receiving dock',
        bgColor: 'bg-purple-500/10',
        iconColor: 'text-purple-500',
        onClick: () => navigate('/inventory?location=receiving'),
      },
      {
        key: 'inspection',
        title: 'Needs Inspection',
        icon: <ClipboardCheck className="h-5 w-5" />,
        count: stats.needToInspect,
        urgent: stats.urgentNeedToInspect,
        description: 'Pending inspection tasks',
        bgColor: 'bg-yellow-500/10',
        iconColor: 'text-yellow-500',
        onClick: () => navigate('/tasks?type=Inspection&status=pending'),
      },
      {
        key: 'assembly',
        title: 'Needs Assembly',
        icon: <Wrench className="h-5 w-5" />,
        count: stats.needToAssemble,
        urgent: stats.urgentNeedToAssemble,
        description: 'Pending assembly tasks',
        bgColor: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        onClick: () => navigate('/tasks?type=Assembly&status=pending'),
      },
      {
        key: 'incoming_shipments',
        title: 'Incoming Shipments',
        icon: <Truck className="h-5 w-5" />,
        count: stats.incomingShipments,
        urgent: stats.incomingShipmentsUrgentCount,
        description: 'Expected / not received',
        bgColor: 'bg-green-500/10',
        iconColor: 'text-green-500',
        onClick: () => navigate('/shipments/incoming'),
      },
      {
        key: 'repairs',
        title: 'Repairs',
        icon: <Hammer className="h-5 w-5" />,
        count: stats.repairCount,
        urgent: stats.urgentNeedToRepair,
        description: 'Pending repair tasks',
        bgColor: 'bg-red-500/10',
        iconColor: 'text-red-500',
        onClick: () => navigate('/tasks?type=Repair&status=pending'),
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => (
              <Card
                key={t.key}
                className="cursor-pointer hover:shadow-md transition"
                onClick={t.onClick}
                role="button"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">{t.title}</CardTitle>
                    {typeof t.urgent === 'number' && t.urgent > 0 && (
                      <Badge className="bg-red-600/10 text-red-700 hover:bg-red-600/10">
                        Urgent: {t.urgent}
                      </Badge>
                    )}
                  </div>
                  <div className={`rounded-xl ${t.bgColor} p-2`}>
                    <span className={t.iconColor}>{t.icon}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{t.count ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

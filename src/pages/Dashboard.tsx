import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Package, Truck, ClipboardList, AlertTriangle, Loader2 } from 'lucide-react';

interface DashboardStats {
  totalItems: number;
  pendingReceiving: number;
  activeOrders: number;
  lowStockAlerts: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    pendingReceiving: 0,
    activeOrders: 0,
    lowStockAlerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch total items
        const { count: itemCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null);

        // Fetch pending receiving batches
        const { count: receivingCount } = await supabase
          .from('receiving_batches')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch active will call orders
        const { count: ordersCount } = await supabase
          .from('will_call_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'in_progress'])
          .is('deleted_at', null);

        // Fetch pending tasks as alerts
        const { count: alertsCount } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .is('deleted_at', null);

        setStats({
          totalItems: itemCount || 0,
          pendingReceiving: receivingCount || 0,
          activeOrders: ordersCount || 0,
          lowStockAlerts: alertsCount || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Items',
      value: stats.totalItems,
      description: 'Items in inventory',
      icon: Package,
      color: 'text-blue-500',
    },
    {
      title: 'Pending Receiving',
      value: stats.pendingReceiving,
      description: 'Batches awaiting processing',
      icon: ClipboardList,
      color: 'text-yellow-500',
    },
    {
      title: 'Active Orders',
      value: stats.activeOrders,
      description: 'Will call orders in progress',
      icon: Truck,
      color: 'text-green-500',
    },
    {
      title: 'Pending Tasks',
      value: stats.lowStockAlerts,
      description: 'Tasks requiring attention',
      icon: AlertTriangle,
      color: 'text-red-500',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}! Here's an overview of your warehouse.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest movements and updates in your warehouse</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity feed coming soon...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Quick actions coming soon...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, lazy, Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, Package, ClipboardList, Truck, TrendingUp, FileText, DollarSign, Receipt } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { LaborCostsTab } from '@/components/reports/LaborCostsTab';
import { BillingReportTab } from '@/components/reports/BillingReportTab';
import { InvoicesPageTab } from '@/components/reports/InvoicesPageTab';

interface ReportStats {
  totalItems: number;
  itemsByStatus: { status: string; count: number }[];
  receivingByMonth: { month: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function Reports() {
  const { isAdmin } = usePermissions();
  const [stats, setStats] = useState<ReportStats>({
    totalItems: 0,
    itemsByStatus: [],
    receivingByMonth: [],
    ordersByStatus: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      // Fetch total items
      const { count: itemCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Fetch items by status
      const { data: itemsData } = await supabase
        .from('items')
        .select('status')
        .is('deleted_at', null);

      const itemsByStatus = itemsData?.reduce((acc: Record<string, number>, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}) || {};

      // Fetch orders by status
      const { data: ordersData } = await supabase
        .from('will_call_orders')
        .select('status')
        .is('deleted_at', null);

      const ordersByStatus = ordersData?.reduce((acc: Record<string, number>, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}) || {};

      // Fetch receiving batches for chart
      const { data: receivingData } = await supabase
        .from('receiving_batches')
        .select('created_at')
        .order('created_at', { ascending: true });

      const receivingByMonth = receivingData?.reduce((acc: Record<string, number>, batch) => {
        if (batch.created_at) {
          const month = new Date(batch.created_at).toLocaleDateString('en-US', {
            month: 'short',
            year: '2-digit',
          });
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {}) || {};

      setStats({
        totalItems: itemCount || 0,
        itemsByStatus: Object.entries(itemsByStatus).map(([status, count]) => ({
          status,
          count: count as number,
        })),
        receivingByMonth: Object.entries(receivingByMonth)
          .slice(-6)
          .map(([month, count]) => ({
            month,
            count: count as number,
          })),
        ordersByStatus: Object.entries(ordersByStatus).map(([status, count]) => ({
          status: status.replace('_', ' '),
          count: count as number,
        })),
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          primaryText="Insight"
          accentText="Analytics"
          description="Analytics, insights, and invoicing for your warehouse operations"
        />

        <Tabs defaultValue="analytics">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="labor-costs" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Labor Costs
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="billing" className="gap-2">
                <FileText className="h-4 w-4" />
                Billing Report
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="invoices" className="gap-2">
                <Receipt className="h-4 w-4" />
                Invoices
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalItems.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Item Statuses</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.itemsByStatus.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receiving Batches</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.receivingByMonth.reduce((sum, m) => sum + m.count, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.ordersByStatus.reduce((sum, o) => sum + o.count, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory by Status</CardTitle>
                  <CardDescription>Distribution of items across different statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.itemsByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.itemsByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ status, percent }) =>
                            `${status} (${(percent * 100).toFixed(0)}%)`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="status"
                        >
                          {stats.itemsByStatus.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No inventory data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Receiving Activity</CardTitle>
                  <CardDescription>Receiving batches over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.receivingByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.receivingByMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No receiving data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Orders by Status</CardTitle>
                  <CardDescription>Current distribution of will call orders</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.ordersByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.ordersByStatus} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="status" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No order data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="labor-costs" className="mt-6">
              <LaborCostsTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="billing" className="mt-6">
              <BillingReportTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="invoices" className="mt-6">
              <InvoicesPageTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

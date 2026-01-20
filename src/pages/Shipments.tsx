import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  Truck, 
  Clock, 
  CheckCircle, 
  Plus, 
  ArrowRight,
  Loader2 
} from 'lucide-react';

interface ShipmentCounts {
  incoming: number;
  outbound: number;
  recentReceived: number;
  recentReleased: number;
}

interface RecentShipment {
  id: string;
  shipment_number: string;
  status: string;
  account_name?: string;
  created_at: string;
  completed_at?: string;
}

export default function Shipments() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<ShipmentCounts>({
    incoming: 0,
    outbound: 0,
    recentReceived: 0,
    recentReleased: 0,
  });
  const [recentReceived, setRecentReceived] = useState<RecentShipment[]>([]);
  const [recentReleased, setRecentReleased] = useState<RecentShipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShipmentData();
  }, []);

  const fetchShipmentData = async () => {
    try {
      // Note: Using type assertion until Supabase types are regenerated
      const shipmentsTable = supabase.from('shipments') as any;
      
      // Fetch counts in parallel
      const [incomingRes, outboundRes, recentReceivedRes, recentReleasedRes] = await Promise.all([
        // Incoming: expected or in_progress inbound shipments
        shipmentsTable
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'inbound')
          .in('status', ['expected', 'in_progress'])
          .is('deleted_at', null),
        // Outbound: Will Call or Disposal releases not yet completed
        shipmentsTable
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'outbound')
          .in('status', ['expected', 'in_progress'])
          .is('deleted_at', null),
        // Recent received: last 5 fully received shipments
        shipmentsTable
          .select('id, shipment_number, status, created_at, completed_at, accounts(account_name)')
          .eq('shipment_type', 'inbound')
          .eq('status', 'received')
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(5),
        // Recent released: last 5 completed releases
        shipmentsTable
          .select('id, shipment_number, status, created_at, completed_at, accounts(account_name)')
          .eq('shipment_type', 'outbound')
          .eq('status', 'completed')
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(5),
      ]);

      setCounts({
        incoming: incomingRes.count || 0,
        outbound: outboundRes.count || 0,
        recentReceived: recentReceivedRes.data?.length || 0,
        recentReleased: recentReleasedRes.data?.length || 0,
      });

      setRecentReceived(
        (recentReceivedRes.data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          created_at: s.created_at,
          completed_at: s.completed_at,
        }))
      );

      setRecentReleased(
        (recentReleasedRes.data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          created_at: s.created_at,
          completed_at: s.completed_at,
        }))
      );
    } catch (error) {
      console.error('Error fetching shipment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const hubCards = [
    {
      title: 'Incoming Shipments',
      description: 'Expected & in-progress inbound shipments',
      count: counts.incoming,
      icon: Package,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      href: '/shipments/incoming',
    },
    {
      title: 'Outbound Shipments',
      description: 'Will Call & Disposal releases in progress',
      count: counts.outbound,
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      href: '/shipments/outbound',
    },
    {
      title: 'Recent Received',
      description: 'Last 5 shipments fully received',
      count: counts.recentReceived,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/shipments/received',
      recentItems: recentReceived,
    },
    {
      title: 'Recent Released',
      description: 'Last 5 completed releases',
      count: counts.recentReleased,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      href: '/shipments/released',
      recentItems: recentReleased,
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            primaryText="Logistics"
            accentText="Console"
            description="Manage incoming and outbound shipments"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/shipments/return/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Return
            </Button>
            <Button onClick={() => navigate('/shipments/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Shipment
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {hubCards.map((card) => (
            <Card 
              key={card.title}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(card.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-lg font-semibold px-3">
                  {card.count}
                </Badge>
              </CardHeader>
              <CardContent>
                {card.recentItems && card.recentItems.length > 0 ? (
                  <div className="space-y-2">
                    {card.recentItems.slice(0, 3).map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.shipment_number}</span>
                          {item.account_name && (
                            <span className="text-muted-foreground">• {item.account_name}</span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {item.completed_at ? formatDate(item.completed_at) : formatDate(item.created_at)}
                        </span>
                      </div>
                    ))}
                    {card.recentItems.length > 3 && (
                      <div className="text-sm text-muted-foreground pt-1">
                        +{card.recentItems.length - 3} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm text-muted-foreground py-2">
                    <span>View all {card.title.toLowerCase()}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

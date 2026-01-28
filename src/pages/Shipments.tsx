/**
 * Shipments Hub Page
 * 
 * Clean implementation showing counts for incoming/outbound shipments.
 * Navigation to filtered lists for each category.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

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
  const { profile } = useAuth();
  const { toast } = useToast();
  
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
    if (profile?.tenant_id) {
      fetchShipmentData();
    }
  }, [profile?.tenant_id]);

  const fetchShipmentData = async () => {
    try {
      // Fetch counts in parallel
      const [incomingRes, outboundRes, recentReceivedRes, recentReleasedRes] = await Promise.all([
        // Incoming: expected or in_progress inbound shipments (valid statuses only)
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'inbound')
          .in('status', ['expected', 'in_progress'])
          .is('deleted_at', null),
        // Outbound: expected or in_progress outbound shipments
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'outbound')
          .in('status', ['expected', 'in_progress'])
          .is('deleted_at', null),
        // Recent received: last 5 fully received shipments
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, received_at, accounts(account_name)')
          .in('status', ['received'])
          .is('deleted_at', null)
          .order('received_at', { ascending: false })
          .limit(5),
        // Recent released: last 5 released/completed shipments
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, completed_at, accounts(account_name)')
          .in('status', ['released', 'completed'])
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(5),
      ]);

      // Check for errors
      if (incomingRes.error) {
        console.error('[Shipments] Incoming count failed:', incomingRes.error);
      }
      if (outboundRes.error) {
        console.error('[Shipments] Outbound count failed:', outboundRes.error);
      }
      if (recentReceivedRes.error) {
        console.error('[Shipments] Recent received failed:', recentReceivedRes.error);
      }
      if (recentReleasedRes.error) {
        console.error('[Shipments] Recent released failed:', recentReleasedRes.error);
      }

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
          completed_at: s.received_at,
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
    } catch (error: any) {
      console.error('[Shipments] Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load shipment data',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const hubCards = [
    {
      title: 'Incoming Shipments',
      description: 'Expected & receiving inbound shipments',
      count: counts.incoming,
      emoji: '📦',
      bgColor: 'bg-card border border-border shadow-sm',
      href: '/shipments/incoming',
    },
    {
      title: 'Outbound Shipments',
      description: 'Will Call & Disposal releases in progress',
      count: counts.outbound,
      emoji: '🚚',
      bgColor: 'bg-card border border-border shadow-sm',
      href: '/shipments/outbound',
    },
    {
      title: 'Recent Received',
      description: 'Last 5 shipments fully received',
      count: counts.recentReceived,
      emoji: '✅',
      bgColor: 'bg-card border border-border shadow-sm',
      href: '/shipments/received',
      recentItems: recentReceived,
    },
    {
      title: 'Recent Released',
      description: 'Last 5 completed releases',
      count: counts.recentReleased,
      emoji: '🕒',
      bgColor: 'bg-card border border-border shadow-sm',
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
            <Button variant="outline" onClick={() => navigate('/billing')}>
              <span className="mr-2">💲</span>
              Add Charge
            </Button>
            <Button variant="secondary" onClick={() => navigate('/shipments/return/new')}>
              <span className="mr-2">➕</span>
              Create Return
            </Button>
            <Button onClick={() => navigate('/shipments/new')}>
              <span className="mr-2">➕</span>
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
                  <div className={`emoji-tile emoji-tile-lg rounded-lg ${card.bgColor}`}>
                    {card.emoji}
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
                    <span>➡️</span>
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

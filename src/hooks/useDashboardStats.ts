import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardStats {
  needToInspect: number;
  needToAssemble: number;
  incomingShipments: number;
  putAwayCount: number;
  willCallCount: number;
  disposalCount: number;
  repairCount: number;
  // Urgent counts
  urgentNeedToInspect: number;
  urgentNeedToAssemble: number;
  urgentNeedToRepair: number;
  putAwayUrgentCount: number;
  incomingShipmentsUrgentCount: number;
}

export interface TaskItem {
  id: string;
  title: string;
  task_type: string;
  due_date: string | null;
  priority: string;
  status: string;
  account?: {
    account_name: string;
  };
}

export interface ShipmentItem {
  id: string;
  shipment_number: string;
  eta: string | null;
  status: string;
  carrier: string | null;
  account?: {
    account_name: string;
  };
}

export interface PutAwayItem {
  id: string;
  item_code: string;
  description: string | null;
  client_account: string | null;
  received_at: string | null;
  location?: {
    code: string;
    name: string | null;
  };
}

export function useDashboardStats() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    needToInspect: 0,
    needToAssemble: 0,
    incomingShipments: 0,
    putAwayCount: 0,
    willCallCount: 0,
    disposalCount: 0,
    repairCount: 0,
    urgentNeedToInspect: 0,
    urgentNeedToAssemble: 0,
    urgentNeedToRepair: 0,
    putAwayUrgentCount: 0,
    incomingShipmentsUrgentCount: 0,
  });
  const [inspectionTasks, setInspectionTasks] = useState<TaskItem[]>([]);
  const [assemblyTasks, setAssemblyTasks] = useState<TaskItem[]>([]);
  const [willCallTasks, setWillCallTasks] = useState<TaskItem[]>([]);
  const [disposalTasks, setDisposalTasks] = useState<TaskItem[]>([]);
  const [incomingShipments, setIncomingShipments] = useState<ShipmentItem[]>([]);
  const [putAwayItems, setPutAwayItems] = useState<PutAwayItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);

      // Fetch inspection tasks (not completed, ordered by due date)
      const { data: inspections, count: inspectCount } = await (supabase
        .from('tasks') as any)
        .select(`
          id, title, task_type, due_date, priority, status,
          account:accounts(account_name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('task_type', 'Inspection')
        .not('status', 'in', '("completed","cancelled")')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      // Fetch assembly tasks (not completed, ordered by due date)
      const { data: assemblies, count: assemblyCount } = await (supabase
        .from('tasks') as any)
        .select(`
          id, title, task_type, due_date, priority, status,
          account:accounts(account_name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('task_type', 'Assembly')
        .not('status', 'in', '("completed","cancelled")')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      // Fetch Will Call tasks (not completed, ordered by due date)
      const { data: willCalls, count: willCallCount } = await (supabase
        .from('tasks') as any)
        .select(`
          id, title, task_type, due_date, priority, status,
          account:accounts(account_name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('task_type', 'Will Call')
        .not('status', 'in', '("completed","cancelled")')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      // Fetch Disposal tasks (not completed, ordered by due date)
      const { data: disposals, count: disposalCount } = await (supabase
        .from('tasks') as any)
        .select(`
          id, title, task_type, due_date, priority, status,
          account:accounts(account_name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('task_type', 'Disposal')
        .not('status', 'in', '("completed","cancelled")')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      // Fetch Repair tasks (not completed, ordered by due date)
      const { data: repairs, count: repairCount } = await (supabase
        .from('tasks') as any)
        .select(`
          id, title, task_type, due_date, priority, status,
          account:accounts(account_name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('task_type', 'Repair')
        .not('status', 'in', '("completed","cancelled")')
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      // Fetch incoming shipments (ordered by expected arrival)
      const { data: shipments, count: shipmentCount } = await (supabase
        .from('shipments') as any)
        .select(`
          id, shipment_number, expected_arrival_date, status, carrier,
          account:accounts(account_name)
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .eq('shipment_type', 'inbound')
        .in('status', ['expected', 'in_progress'])
        .is('deleted_at', null)
        .order('expected_arrival_date', { ascending: true, nullsFirst: false })
        .limit(10);

      // Fetch items at Receiving Dock location (need to put away)
      const { data: receivingDockLocation } = await (supabase
        .from('locations') as any)
        .select('id')
        .ilike('code', '%receiving%dock%')
        .single();

      let putAwayData: PutAwayItem[] = [];
      let putAwayCount = 0;

      if (receivingDockLocation) {
        const { data: putAwayItemsResult, count } = await (supabase
          .from('items') as any)
          .select(`
            id, item_code, description, client_account, received_at,
            location:locations(code, name)
          `, { count: 'exact' })
          .eq('current_location_id', receivingDockLocation.id)
          .is('deleted_at', null)
          .eq('status', 'active')
          .order('received_at', { ascending: true })
          .limit(20);

        putAwayData = putAwayItemsResult || [];
        putAwayCount = count || 0;
      } else {
        // Fallback: get items with location names containing "receiving"
        const { data: putAwayItemsResult, count } = await (supabase
          .from('items') as any)
          .select(`
            id, item_code, description, client_account, received_at,
            location:locations(code, name)
          `, { count: 'exact' })
          .is('deleted_at', null)
          .eq('status', 'active')
          .order('received_at', { ascending: true })
          .limit(100);

        // Filter for receiving locations client-side
        const filtered = (putAwayItemsResult || []).filter((item: PutAwayItem) => 
          item.location?.code?.toLowerCase().includes('receiving') ||
          item.location?.name?.toLowerCase().includes('receiving')
        );
        putAwayData = filtered;
        putAwayCount = filtered.length;
      }

      // Calculate urgent counts from fetched data
      const urgentInspections = (inspections || []).filter((t: any) => t.priority === 'urgent').length;
      const urgentAssemblies = (assemblies || []).filter((t: any) => t.priority === 'urgent').length;
      const urgentRepairs = (repairs || []).filter((t: any) => t.priority === 'urgent').length;

      // For put away urgent: count items that have been at receiving dock for more than 24 hours
      const now = new Date();
      const urgentPutAway = putAwayData.filter((item: PutAwayItem) => {
        if (!item.received_at) return false;
        const received = new Date(item.received_at);
        const hoursAtDock = (now.getTime() - received.getTime()) / (1000 * 60 * 60);
        return hoursAtDock > 24;
      }).length;

      // For shipments urgent: count shipments where expected arrival is today or past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const urgentShipments = (shipments || []).filter((s: any) => {
        if (!s.expected_arrival_date) return false;
        const eta = new Date(s.expected_arrival_date);
        eta.setHours(0, 0, 0, 0);
        return eta <= today;
      }).length;

      setStats({
        needToInspect: inspectCount || 0,
        needToAssemble: assemblyCount || 0,
        incomingShipments: shipmentCount || 0,
        putAwayCount: putAwayCount,
        willCallCount: willCallCount || 0,
        disposalCount: disposalCount || 0,
        repairCount: repairCount || 0,
        urgentNeedToInspect: urgentInspections,
        urgentNeedToAssemble: urgentAssemblies,
        urgentNeedToRepair: urgentRepairs,
        putAwayUrgentCount: urgentPutAway,
        incomingShipmentsUrgentCount: urgentShipments,
      });

      setInspectionTasks(inspections || []);
      setAssemblyTasks(assemblies || []);
      setWillCallTasks(willCalls || []);
      setDisposalTasks(disposals || []);
      setIncomingShipments(shipments || []);
      setPutAwayItems(putAwayData);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    inspectionTasks,
    assemblyTasks,
    willCallTasks,
    disposalTasks,
    incomingShipments,
    putAwayItems,
    loading,
    refetch: fetchStats,
  };
}

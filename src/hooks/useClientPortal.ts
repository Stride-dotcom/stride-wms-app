import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientPortalContext {
  portalUser: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    account_id: string;
    tenant_id: string;
    is_primary: boolean;
  } | null;
  account: {
    id: string;
    name: string;
    account_code: string;
  } | null;
  tenant: {
    id: string;
    name: string;
  } | null;
  isLoading: boolean;
  isClientPortalUser: boolean;
}

// Get the current client portal user context
export function useClientPortalContext(): ClientPortalContext {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['client-portal-context', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: portalUser, error } = await (supabase
        .from('client_portal_users') as any)
        .select(`
          id,
          email,
          first_name,
          last_name,
          account_id,
          tenant_id,
          is_primary,
          accounts:account_id (
            id,
            account_name,
            account_code
          ),
          tenants:tenant_id (
            id,
            name
          )
        `)
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !portalUser) return null;

      return {
        portalUser: {
          id: portalUser.id,
          email: portalUser.email,
          first_name: portalUser.first_name,
          last_name: portalUser.last_name,
          account_id: portalUser.account_id,
          tenant_id: portalUser.tenant_id,
          is_primary: portalUser.is_primary,
        },
        account: portalUser.accounts ? {
          id: portalUser.accounts.id,
          name: portalUser.accounts.account_name,
          account_code: portalUser.accounts.account_code,
        } : null,
        tenant: portalUser.tenants ? {
          id: portalUser.tenants.id,
          name: portalUser.tenants.name,
        } : null,
      };
    },
    enabled: !!user?.id,
  });

  return {
    portalUser: data?.portalUser || null,
    account: data?.account || null,
    tenant: data?.tenant || null,
    isLoading,
    isClientPortalUser: !!data?.portalUser,
  };
}

// Get items for the client's account
export function useClientItems() {
  const { portalUser, isLoading: contextLoading } = useClientPortalContext();

  return useQuery({
    queryKey: ['client-items', portalUser?.account_id],
    queryFn: async () => {
      if (!portalUser?.account_id) return [];

      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          item_code,
          description,
          status,
          condition,
          location_id,
          current_location,
          category,
          created_at,
          photos,
          sidemarks:sidemark_id (
            id,
            sidemark_code,
            sidemark_name
          )
        `)
        .eq('account_id', portalUser.account_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!portalUser?.account_id && !contextLoading,
  });
}

// Get quotes for the client's account
export function useClientQuotes() {
  const { portalUser, isLoading: contextLoading } = useClientPortalContext();

  return useQuery({
    queryKey: ['client-quotes', portalUser?.account_id],
    queryFn: async () => {
      if (!portalUser?.account_id) return [];

      const { data, error } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          id,
          quote_number,
          status,
          customer_total,
          client_response,
          client_responded_at,
          expires_at,
          created_at,
          repair_quote_items (
            id,
            item_code,
            item_description
          )
        `)
        .eq('account_id', portalUser.account_id)
        .in('status', ['sent_to_client', 'accepted', 'declined', 'expired'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!portalUser?.account_id && !contextLoading,
  });
}

// Get recent shipments for the client's account
export function useClientShipments() {
  const { portalUser, isLoading: contextLoading } = useClientPortalContext();

  return useQuery({
    queryKey: ['client-shipments', portalUser?.account_id],
    queryFn: async () => {
      if (!portalUser?.account_id) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          id,
          shipment_number,
          shipment_type,
          status,
          scheduled_date,
          created_at,
          origin_name,
          destination_name,
          total_items
        `)
        .eq('account_id', portalUser.account_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!portalUser?.account_id && !contextLoading,
  });
}

// Get dashboard stats
export function useClientDashboardStats() {
  const { portalUser, isLoading: contextLoading } = useClientPortalContext();

  return useQuery({
    queryKey: ['client-dashboard-stats', portalUser?.account_id],
    queryFn: async () => {
      if (!portalUser?.account_id) {
        return {
          totalItems: 0,
          inStorage: 0,
          pendingQuotes: 0,
          recentShipments: 0,
        };
      }

      // Get item counts
      const { count: totalItems } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', portalUser.account_id)
        .is('deleted_at', null);

      const { count: inStorage } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', portalUser.account_id)
        .eq('status', 'available')
        .is('deleted_at', null);

      // Get pending quotes count
      const { count: pendingQuotes } = await (supabase
        .from('repair_quotes') as any)
        .select('*', { count: 'exact', head: true })
        .eq('account_id', portalUser.account_id)
        .eq('status', 'sent_to_client');

      // Get recent shipments (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentShipments } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', portalUser.account_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      return {
        totalItems: totalItems || 0,
        inStorage: inStorage || 0,
        pendingQuotes: pendingQuotes || 0,
        recentShipments: recentShipments || 0,
      };
    },
    enabled: !!portalUser?.account_id && !contextLoading,
  });
}

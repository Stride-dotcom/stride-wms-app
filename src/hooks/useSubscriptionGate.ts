import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionGateState {
  status: string;
  is_active: boolean;
  is_in_grace: boolean;
  is_restricted: boolean;
  grace_until?: string;
}

const DEFAULT_GATE: SubscriptionGateState = {
  status: "none",
  is_active: true,
  is_in_grace: false,
  is_restricted: false,
};

export function useSubscriptionGate() {
  const { session } = useAuth();

  return useQuery<SubscriptionGateState>({
    queryKey: ["subscription-gate"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_my_subscription_gate");
      if (error) {
        console.error("useSubscriptionGate error:", error.message);
        // Fail-open: if RPC fails, treat as active
        return DEFAULT_GATE;
      }
      return data as SubscriptionGateState;
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

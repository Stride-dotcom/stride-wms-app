import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Warehouse } from '@/hooks/useWarehouses';

const STORAGE_KEY = 'stride.selectedWarehouseId';

interface WarehouseContextType {
  selectedWarehouseId: string | null;
  setSelectedWarehouseId: (id: string | null) => void;
  warehouses: Warehouse[];
  loading: boolean;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const setSelectedWarehouseId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Fetch warehouses when authenticated
  useEffect(() => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchWarehouses = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('warehouses')
          .select('*')
          .is('deleted_at', null)
          .order('name');

        if (error) throw error;
        if (cancelled) return;

        const whs = data || [];
        setWarehouses(whs);

        // Validate persisted selection or auto-select
        const persisted = localStorage.getItem(STORAGE_KEY);
        const persistedValid = persisted && whs.some((w) => w.id === persisted);

        if (persistedValid) {
          setSelectedIdState(persisted);
        } else if (whs.length === 1) {
          setSelectedWarehouseId(whs[0].id);
        } else if (persisted && !persistedValid) {
          // Clear invalid persisted value
          localStorage.removeItem(STORAGE_KEY);
          setSelectedIdState(null);
        }
      } catch (err) {
        console.error('[WarehouseContext] Error fetching warehouses:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWarehouses();
    return () => {
      cancelled = true;
    };
  }, [profile?.tenant_id, setSelectedWarehouseId]);

  return (
    <WarehouseContext.Provider
      value={{
        selectedWarehouseId: selectedId,
        setSelectedWarehouseId,
        warehouses,
        loading,
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
}

export function useSelectedWarehouse() {
  const context = useContext(WarehouseContext);
  if (context === undefined) {
    throw new Error('useSelectedWarehouse must be used within a WarehouseProvider');
  }
  return context;
}

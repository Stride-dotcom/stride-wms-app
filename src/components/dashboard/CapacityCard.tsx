import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CapacityData {
  measuredCount: number;
  totalCount: number;
  totalUsed: number;
  totalCapacity: number;
  utilization: number;
}

export function CapacityCard() {
  const { profile } = useAuth();
  const [data, setData] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCapacity = async () => {
      if (!profile?.tenant_id) return;

      try {
        setLoading(true);

        // Fetch all active locations (capacity_cuft may be null for unmeasured)
        const { data: locations, error: locError } = await (
          supabase.from('locations') as any
        )
          .select('id, capacity_cuft')
          .is('deleted_at', null);

        if (locError) throw locError;
        if (cancelled) return;

        const allLocs: Array<{ id: string; capacity_cuft: number | null }> =
          locations || [];
        const measuredLocs = allLocs.filter((l) => l.capacity_cuft != null);
        const measuredIds = measuredLocs.map((l) => l.id);

        let totalUsed = 0;
        const totalCapacity = measuredLocs.reduce(
          (sum, l) => sum + Number(l.capacity_cuft || 0),
          0,
        );

        if (measuredIds.length > 0) {
          const { data: cacheData, error: cacheError } = await (
            supabase.from('location_capacity_cache') as any
          )
            .select('used_cuft')
            .in('location_id', measuredIds);

          if (!cacheError && cacheData) {
            totalUsed = (cacheData as Array<{ used_cuft: number }>).reduce(
              (sum, c) => sum + Number(c.used_cuft || 0),
              0,
            );
          }
        }

        if (cancelled) return;

        setData({
          measuredCount: measuredLocs.length,
          totalCount: allLocs.length,
          totalUsed,
          totalCapacity,
          utilization: totalCapacity > 0 ? totalUsed / totalCapacity : 0,
        });
      } catch (err) {
        console.error('[CapacityCard] Error:', err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCapacity();
    const interval = setInterval(fetchCapacity, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.tenant_id]);

  // ---- Loading ----
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-10">
          <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">
            WAREHOUSE CAPACITY
          </CardTitle>
          <div className="emoji-tile emoji-tile-lg rounded-lg bg-card border border-border shadow-sm">
            📐
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-16 flex items-center justify-center">
            <MaterialIcon
              name="progress_activity"
              size="md"
              className="animate-spin text-muted-foreground"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Empty / not configured ----
  if (!data || data.totalCapacity === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-10">
          <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">
            WAREHOUSE CAPACITY
          </CardTitle>
          <div className="emoji-tile emoji-tile-lg rounded-lg bg-card border border-border shadow-sm">
            📐
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Capacity not configured
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data
              ? `${data.measuredCount} of ${data.totalCount} bays measured`
              : 'No location data'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Data available ----
  const utilPct = (data.utilization * 100).toFixed(0);
  const utilColor =
    data.utilization >= 0.9
      ? 'text-red-600 dark:text-red-400'
      : data.utilization >= 0.7
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

  const barColor =
    data.utilization >= 0.9
      ? 'bg-red-500'
      : data.utilization >= 0.7
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-10">
        <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          WAREHOUSE CAPACITY
        </CardTitle>
        <div className="emoji-tile emoji-tile-lg rounded-lg bg-card border border-border shadow-sm">
          📐
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${utilColor}`}>{utilPct}%</span>
          <span className="text-sm text-muted-foreground">utilized</span>
        </div>

        {/* Utilization bar */}
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{
              width: `${Math.min(data.utilization * 100, 100)}%`,
            }}
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>
            {data.totalUsed.toFixed(0)} / {data.totalCapacity.toFixed(0)} cuft
          </span>
          <span>
            {data.measuredCount} of {data.totalCount} bays measured
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

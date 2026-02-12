import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ContainerVolumeMode = 'units_only' | 'bounded_footprint';
export type SpaceTrackingMode = 'none' | 'cubic_feet' | 'dimensions';

export interface OrgPreferences {
  container_volume_mode: ContainerVolumeMode;
  space_tracking_mode: SpaceTrackingMode;
}

const DEFAULTS: OrgPreferences = {
  container_volume_mode: 'bounded_footprint',
  space_tracking_mode: 'none',
};

export function useOrgPreferences() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<OrgPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('setting_key, setting_value')
        .eq('tenant_id', profile.tenant_id)
        .in('setting_key', ['container_volume_mode', 'space_tracking_mode']);

      if (error) throw error;

      const prefs = { ...DEFAULTS };
      data?.forEach((row) => {
        if (row.setting_key === 'container_volume_mode' && row.setting_value) {
          prefs.container_volume_mode = (row.setting_value as unknown as string) as ContainerVolumeMode;
        }
        if (row.setting_key === 'space_tracking_mode' && row.setting_value) {
          prefs.space_tracking_mode = (row.setting_value as unknown as string) as SpaceTrackingMode;
        }
      });

      setPreferences(prefs);
    } catch (error) {
      console.error('Error fetching org preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = useCallback(async (key: keyof OrgPreferences, value: string) => {
    if (!profile?.tenant_id) return false;

    try {
      // Upsert the key-value pair
      const { error } = await (supabase as any)
        .from('tenant_settings')
        .upsert(
          [{
            tenant_id: profile.tenant_id,
            setting_key: key,
            setting_value: value,
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          }],
          { onConflict: 'tenant_id,setting_key' }
        );

      if (error) throw error;

      setPreferences((prev) => ({ ...prev, [key]: value }));
      toast({
        title: 'Preference Updated',
        description: `${key.replace(/_/g, ' ')} has been saved.`,
      });
      return true;
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to save preference.',
      });
      return false;
    }
  }, [profile?.tenant_id, profile?.id, toast]);

  return {
    preferences,
    loading,
    updatePreference,
    refetch: fetchPreferences,
  };
}

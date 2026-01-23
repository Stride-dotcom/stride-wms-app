import { useState, useEffect } from 'react';
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SidemarkSelectProps {
  accountId?: string | null;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

/**
 * Reusable sidemark selector that fetches sidemarks for a given account.
 * Falls back to tenant-wide sidemarks if no accountId is provided.
 */
export function SidemarkSelect({
  accountId,
  value,
  onChange,
  placeholder = 'Select sidemark...',
  disabled = false,
  clearable = true,
  className,
}: SidemarkSelectProps) {
  const { profile } = useAuth();
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSidemarks = async () => {
      if (!profile?.tenant_id) return;
      
      setLoading(true);
      try {
        let query = supabase
          .from('sidemarks')
          .select('id, sidemark_name, sidemark_code')
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null)
          .order('sidemark_name');

        if (accountId) {
          query = query.eq('account_id', accountId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching sidemarks:', error);
          return;
        }

        setOptions(
          (data || []).map((s) => ({
            value: s.id,
            label: s.sidemark_code ? `${s.sidemark_name} (${s.sidemark_code})` : s.sidemark_name,
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSidemarks();
  }, [profile?.tenant_id, accountId]);

  return (
    <SearchableSelect
      options={options}
      value={value || ''}
      onChange={onChange}
      placeholder={loading ? 'Loading...' : placeholder}
      searchPlaceholder="Search sidemarks..."
      emptyText="No sidemarks found"
      disabled={disabled || loading}
      clearable={clearable}
      className={className}
    />
  );
}

export default SidemarkSelect;

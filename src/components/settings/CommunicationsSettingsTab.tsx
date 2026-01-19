import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { useCommunications } from '@/hooks/useCommunications';
import { AlertsTab } from './communications/AlertsTab';
import { BrandSettingsCard } from './communications/BrandSettingsCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Account {
  id: string;
  account_name: string;
  account_code: string;
}

export function CommunicationsSettingsTab() {
  const { profile } = useAuth();
  const {
    alerts,
    brandSettings,
    loading,
    createAlert,
    updateAlert,
    deleteAlert,
    updateBrandSettings,
  } = useCommunications();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('global');

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!profile?.tenant_id) return;
      
      const { data } = await supabase
        .from('accounts')
        .select('id, account_name, account_code')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('account_name');
      
      setAccounts(data || []);
    };
    
    fetchAccounts();
  }, [profile?.tenant_id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full sm:w-[400px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1 sm:px-0">
      {/* Account Scope Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <CardTitle className="text-base">Template Scope</CardTitle>
                <CardDescription>
                  Edit global templates or per-account overrides
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Label htmlFor="account-scope" className="text-sm text-muted-foreground">
                Viewing:
              </Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-full sm:w-[280px]" id="account-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Global</Badge>
                      <span>Default Templates</span>
                    </div>
                  </SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <span>{account.account_name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">({account.account_code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        {selectedAccountId !== 'global' && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Templates edited here will override the global defaults for{' '}
              <strong>{accounts.find(a => a.id === selectedAccountId)?.account_name}</strong>.
              If no override exists, the global template will be used.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Brand Settings */}
      <BrandSettingsCard
        brandSettings={brandSettings}
        onUpdate={updateBrandSettings}
      />

      {/* Alerts List - clicking edit navigates to dedicated page */}
      <AlertsTab
        alerts={alerts}
        onCreateAlert={createAlert}
        onUpdateAlert={updateAlert}
        onDeleteAlert={deleteAlert}
      />
    </div>
  );
}

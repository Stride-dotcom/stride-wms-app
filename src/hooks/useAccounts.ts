 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 
 export interface Account {
   id: string;
   account_code: string;
   account_name: string;
   account_type: string | null;
   status: string;
   primary_contact_name: string | null;
   primary_contact_email: string | null;
   billing_city: string | null;
   billing_state: string | null;
   credit_hold: boolean | null;
   parent_account_id: string | null;
   is_master_account: boolean | null;
 }
 
 export function useAccounts() {
   const { toast } = useToast();
   const { profile } = useAuth();
   const [accounts, setAccounts] = useState<Account[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchAccounts = useCallback(async () => {
     if (!profile?.tenant_id) return;
 
     try {
       setLoading(true);
       const { data, error } = await supabase
         .from('accounts')
         .select('id, account_code, account_name, account_type, status, primary_contact_name, primary_contact_email, billing_city, billing_state, credit_hold, parent_account_id, is_master_account')
         .is('deleted_at', null)
         .order('account_name', { ascending: true });
 
       if (error) throw error;
       setAccounts(data || []);
     } catch (error) {
       console.error('Error fetching accounts:', error);
       toast({
         variant: 'destructive',
         title: 'Error',
         description: 'Failed to load accounts',
       });
     } finally {
       setLoading(false);
     }
   }, [profile?.tenant_id, toast]);
 
   useEffect(() => {
     fetchAccounts();
   }, [fetchAccounts]);
 
   return {
     accounts,
     loading,
     refetch: fetchAccounts,
   };
 }
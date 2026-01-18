import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserAccount {
  id: string;
  user_id: string;
  account_id: string;
  access_level: string;
  account_name?: string;
}

export interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_name: string | null;
  role_id: string | null;
  is_active: boolean;
  last_login: string | null;
  assigned_accounts: UserAccount[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: any;
  is_system: boolean;
}

export function useRoles() {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchRoles();
    }
  }, [profile?.tenant_id]);

  const fetchRoles = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRole = async (name: string, description?: string, permissions?: any) => {
    if (!profile?.tenant_id) return null;

    try {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          tenant_id: profile.tenant_id,
          name,
          description: description || null,
          permissions: permissions || {},
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchRoles();
      return data;
    } catch (error) {
      console.error('Error creating role:', error);
      return null;
    }
  };

  return { roles, loading, refetch: fetchRoles, createRole };
}

export function useUserAccounts(userId?: string) {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserAccounts();
    }
  }, [userId]);

  const fetchUserAccounts = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select(`
          id,
          user_id,
          account_id,
          access_level,
          accounts:account_id (account_name)
        `)
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (error) throw error;

      const accountsWithNames = (data || []).map(ua => ({
        ...ua,
        account_name: (ua.accounts as any)?.account_name,
      }));

      setAccounts(accountsWithNames);
    } catch (error) {
      console.error('Error fetching user accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignAccount = async (accountId: string, accessLevel: string = 'read_only') => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('user_accounts')
        .insert({
          user_id: userId,
          account_id: accountId,
          access_level: accessLevel,
        });

      if (error) throw error;
      await fetchUserAccounts();
      return true;
    } catch (error) {
      console.error('Error assigning account:', error);
      return false;
    }
  };

  const removeAccount = async (userAccountId: string) => {
    try {
      const { error } = await supabase
        .from('user_accounts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userAccountId);

      if (error) throw error;
      await fetchUserAccounts();
      return true;
    } catch (error) {
      console.error('Error removing account:', error);
      return false;
    }
  };

  return { accounts, loading, refetch: fetchUserAccounts, assignAccount, removeAccount };
}

export function useCurrentUserRole() {
  const { profile } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.id) {
      fetchUserRole();
    }
  }, [profile?.id]);

  const fetchUserRole = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles:role_id (name, permissions)
        `)
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const roleName = (data.roles as any)?.name;
        const rolePerms = (data.roles as any)?.permissions;
        setRole(roleName);
        setPermissions(Array.isArray(rolePerms) ? rolePerms : []);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = role === 'admin' || role === 'tenant_admin';
  const isManager = role === 'manager' || isAdmin;
  const isWarehouse = role === 'warehouse' || isManager;
  const isClientUser = role === 'client_user';

  const hasPermission = (permission: string) => {
    if (isAdmin) return true;
    return permissions.includes(permission) || permissions.includes('*');
  };

  const canAccessBilling = isAdmin || isManager;
  const canAccessSettings = isAdmin;
  const canManageUsers = isAdmin;
  const canManageAccounts = isAdmin || isManager;

  return {
    role,
    loading,
    isAdmin,
    isManager,
    isWarehouse,
    isClientUser,
    hasPermission,
    canAccessBilling,
    canAccessSettings,
    canManageUsers,
    canManageAccounts,
  };
}

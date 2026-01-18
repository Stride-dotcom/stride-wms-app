import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type UserRow = Database['public']['Tables']['users']['Row'];
type RoleRow = Database['public']['Tables']['roles']['Row'];

export interface UserWithRoles extends UserRow {
  roles: { id: string; name: string }[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchUsers = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('email');

      if (usersError) throw usersError;

      // Fetch user_roles with role details
      const { data: userRolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles (
            id,
            name
          )
        `)
        .is('deleted_at', null);

      if (rolesError) throw rolesError;

      // Map roles to users
      const usersWithRoles: UserWithRoles[] = (usersData || []).map(user => {
        const userRoles = userRolesData
          ?.filter(ur => ur.user_id === user.id)
          .map(ur => {
            const role = ur.roles as unknown as { id: string; name: string };
            return role;
          })
          .filter(Boolean) || [];

        return {
          ...user,
          roles: userRoles,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load users',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  const fetchRoles = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const updateUser = async (userId: string, data: { first_name?: string; last_name?: string; status?: string }) => {
    const { error } = await supabase
      .from('users')
      .update(data)
      .eq('id', userId);

    if (error) throw error;
  };

  const deleteUser = async (userId: string) => {
    // Soft delete
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
  };

  const assignRole = async (userId: string, roleId: string) => {
    if (!profile?.id) return;

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: profile.id,
      });

    if (error) throw error;
  };

  const removeRole = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) throw error;
  };

  return {
    users,
    roles,
    loading,
    refetch: fetchUsers,
    updateUser,
    deleteUser,
    assignRole,
    removeRole,
  };
}

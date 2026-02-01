import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import { PromptLevel } from '@/types/guidedPrompts';

type UserRow = Database['public']['Tables']['users']['Row'];
type RoleRow = Database['public']['Tables']['roles']['Row'];

export interface UserWithRoles extends UserRow {
  roles: { id: string; name: string }[];
  prompt_level?: PromptLevel;
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

      // Fetch user prompt settings
      const { data: promptSettingsData } = await supabase
        .from('user_prompt_settings')
        .select('user_id, prompt_level')
        .eq('tenant_id', profile.tenant_id);

      // Map roles and prompt settings to users
      const usersWithRoles: UserWithRoles[] = (usersData || []).map(user => {
        const userRoles = userRolesData
          ?.filter(ur => ur.user_id === user.id)
          .map(ur => {
            const role = ur.roles as unknown as { id: string; name: string };
            return role;
          })
          .filter(Boolean) || [];

        const promptSetting = promptSettingsData?.find(ps => ps.user_id === user.id);

        return {
          ...user,
          roles: userRoles,
          prompt_level: (promptSetting?.prompt_level as PromptLevel) || 'training',
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

  const updateUser = async (userId: string, data: { first_name?: string; last_name?: string; status?: string; labor_rate?: number | null }) => {
    const { error } = await supabase
      .from('users')
      .update(data)
      .eq('id', userId);

    if (error) throw error;
  };

  const updatePromptLevel = async (userId: string, promptLevel: PromptLevel) => {
    if (!profile?.tenant_id) return;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_prompt_settings')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_prompt_settings')
        .update({ prompt_level: promptLevel, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_prompt_settings')
        .insert({
          user_id: userId,
          tenant_id: profile.tenant_id,
          prompt_level: promptLevel,
        });

      if (error) throw error;
    }
  };

  const resendInvite = async (userId: string) => {
    if (!profile?.tenant_id) return;

    const { error } = await supabase.functions.invoke('send-employee-invite', {
      body: {
        user_id: userId,
        tenant_id: profile.tenant_id,
      },
    });

    if (error) throw error;
  };

  const revokeAccess = async (userId: string) => {
    const { error } = await supabase
      .from('users')
      .update({ status: 'suspended' })
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
    updatePromptLevel,
    resendInvite,
    revokeAccess,
    deleteUser,
    assignRole,
    removeRole,
  };
}

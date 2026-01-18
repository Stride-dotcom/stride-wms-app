import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface UsePermissionsReturn {
  roles: Role[];
  permissions: string[];
  loading: boolean;
  hasRole: (roleName: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchRolesAndPermissions = async () => {
      try {
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select(`
            role_id,
            roles (
              id,
              name,
              permissions
            )
          `)
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (error) {
          console.error('Error fetching roles:', error);
          setLoading(false);
          return;
        }

        const fetchedRoles: Role[] = [];
        const allPermissions: Set<string> = new Set();

        userRoles?.forEach((ur) => {
          const role = ur.roles as unknown as { id: string; name: string; permissions: string[] };
          if (role) {
            fetchedRoles.push({
              id: role.id,
              name: role.name,
              permissions: Array.isArray(role.permissions) ? role.permissions : [],
            });
            
            if (Array.isArray(role.permissions)) {
              role.permissions.forEach((p: string) => allPermissions.add(p));
            }
          }
        });

        setRoles(fetchedRoles);
        setPermissions(Array.from(allPermissions));
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRolesAndPermissions();
  }, [user]);

  const hasRole = (roleName: string): boolean => {
    return roles.some((role) => role.name.toLowerCase() === roleName.toLowerCase());
  };

  const hasPermission = (permission: string): boolean => {
    // Check for wildcard permission
    if (permissions.includes('*')) {
      return true;
    }
    return permissions.includes(permission);
  };

  const isAdmin = hasRole('admin') || hasRole('tenant_admin');

  return {
    roles,
    permissions,
    loading,
    hasRole,
    hasPermission,
    isAdmin,
  };
}

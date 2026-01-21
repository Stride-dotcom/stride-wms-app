import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// TYPES
// ============================================

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
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isAdmin: boolean;
}

// ============================================
// PERMISSION CONSTANTS
// ============================================

export const PERMISSIONS = {
  // Inventory
  ITEMS_READ: 'items.read',
  ITEMS_CREATE: 'items.create',
  ITEMS_UPDATE: 'items.update',
  ITEMS_DELETE: 'items.delete',
  ITEMS_MOVE: 'items.move',
  
  // Shipments
  SHIPMENTS_READ: 'shipments.read',
  SHIPMENTS_CREATE: 'shipments.create',
  SHIPMENTS_RECEIVE: 'shipments.receive',
  SHIPMENTS_COMPLETE: 'shipments.complete',
  
  // Tasks
  TASKS_READ: 'tasks.read',
  TASKS_CREATE: 'tasks.create',
  TASKS_UPDATE: 'tasks.update',
  TASKS_ASSIGN: 'tasks.assign',
  TASKS_COMPLETE: 'tasks.complete',
  
  // Accounts
  ACCOUNTS_READ: 'accounts.read',
  ACCOUNTS_CREATE: 'accounts.create',
  ACCOUNTS_UPDATE: 'accounts.update',
  
  // Billing
  BILLING_READ: 'billing.read',
  BILLING_CREATE: 'billing.create',
  BILLING_INVOICE: 'billing.invoice',
  
  // Reports
  REPORTS_READ: 'reports.read',
  REPORTS_CREATE: 'reports.create',
  
  // Notes & Attachments
  NOTES_READ: 'notes.read',
  NOTES_CREATE: 'notes.create',
  ATTACHMENTS_CREATE: 'attachments.create',
  
  // Movements
  MOVEMENTS_READ: 'movements.read',
  
  // Admin
  WILDCARD: '*',
} as const;

// ============================================
// HOOK
// ============================================

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
          console.error('[Permissions] Error fetching roles:', {
            error,
            message: error.message,
            code: error.code,
          });
          setLoading(false);
          return;
        }

        const fetchedRoles: Role[] = [];
        const allPermissions: Set<string> = new Set();

        userRoles?.forEach((ur) => {
          const role = ur.roles as unknown as { id: string; name: string; permissions: string[] };
          if (role) {
            const rolePermissions = Array.isArray(role.permissions) ? role.permissions : [];
            fetchedRoles.push({
              id: role.id,
              name: role.name,
              permissions: rolePermissions,
            });
            
            rolePermissions.forEach((p: string) => allPermissions.add(p));
          }
        });

        setRoles(fetchedRoles);
        setPermissions(Array.from(allPermissions));
      } catch (error) {
        console.error('[Permissions] Exception fetching permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRolesAndPermissions();
  }, [user]);

  // Check if user has a specific role by name
  const hasRole = useCallback((roleName: string): boolean => {
    return roles.some((role) => role.name.toLowerCase() === roleName.toLowerCase());
  }, [roles]);

  // Check if user has a specific permission (capability-based)
  const hasPermission = useCallback((permission: string): boolean => {
    // Wildcard permission grants all access
    if (permissions.includes(PERMISSIONS.WILDCARD)) {
      return true;
    }
    return permissions.includes(permission);
  }, [permissions]);

  // Check if user has any of the specified permissions
  const hasAnyPermission = useCallback((perms: string[]): boolean => {
    if (permissions.includes(PERMISSIONS.WILDCARD)) {
      return true;
    }
    return perms.some(p => permissions.includes(p));
  }, [permissions]);

  // Check if user has all of the specified permissions
  const hasAllPermissions = useCallback((perms: string[]): boolean => {
    if (permissions.includes(PERMISSIONS.WILDCARD)) {
      return true;
    }
    return perms.every(p => permissions.includes(p));
  }, [permissions]);

  // Admin check using permissions, not role names
  const isAdmin = permissions.includes(PERMISSIONS.WILDCARD);

  return {
    roles,
    permissions,
    loading,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
  };
}

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
  isAdminDev: boolean;
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
        // Prefer SECURITY DEFINER RPC to avoid RLS blocking the roles join (roles: null).
        // Falls back to the legacy join query if RPC is not present.
        const { data: rpcRoles, error: rpcError } = await (supabase as any).rpc('get_my_roles');

        if (!rpcError && Array.isArray(rpcRoles)) {
          const fetchedRoles: Role[] = [];
          const allPermissions: Set<string> = new Set();

          rpcRoles.forEach((r: any) => {
            const rolePermissions = Array.isArray(r?.permissions) ? r.permissions : [];
            if (r?.id && r?.name) {
              fetchedRoles.push({
                id: String(r.id),
                name: String(r.name),
                permissions: rolePermissions,
              });
              rolePermissions.forEach((p: string) => allPermissions.add(p));
            }
          });

          setRoles(fetchedRoles);
          setPermissions(Array.from(allPermissions));
          return;
        }

        // If RPC doesn't exist yet, silently fall back.
        if (rpcError && rpcError.code !== '42883') {
          // Suppress AbortError - happens during navigation/re-renders
          if (rpcError.message?.includes('AbortError') || rpcError.code === '20') {
            setLoading(false);
            return;
          }
          console.error('[Permissions] Error fetching roles via get_my_roles RPC:', {
            error: rpcError,
            message: rpcError.message,
            code: rpcError.code,
          });
          setLoading(false);
          return;
        }

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
          // Suppress AbortError - happens during navigation/re-renders
          if (error.message?.includes('AbortError') || error.code === '20') {
            setLoading(false);
            return;
          }
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
          const role = ur.roles as unknown as { id: string; name: string; permissions: any };
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
      } catch (error: any) {
        // Suppress AbortError - happens during navigation/re-renders
        if (error?.name === 'AbortError' || error?.message?.includes('AbortError')) {
          return;
        }
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

  // Check if user has admin_dev role (system role with highest privileges)
  const isAdminDev = roles.some((role) => role.name === 'admin_dev');

  // Admin check: wildcard permission OR admin_dev role OR admin/tenant_admin roles
  const isAdmin = permissions.includes(PERMISSIONS.WILDCARD) ||
                  isAdminDev ||
                  roles.some((role) => ['admin', 'tenant_admin'].includes(role.name));

  // Override hasPermission to grant all permissions to admin_dev
  const hasPermissionWithAdminDev = useCallback((permission: string): boolean => {
    if (isAdminDev) return true;
    if (permissions.includes(PERMISSIONS.WILDCARD)) return true;
    return permissions.includes(permission);
  }, [permissions, isAdminDev]);

  // Override hasAnyPermission for admin_dev
  const hasAnyPermissionWithAdminDev = useCallback((perms: string[]): boolean => {
    if (isAdminDev) return true;
    if (permissions.includes(PERMISSIONS.WILDCARD)) return true;
    return perms.some(p => permissions.includes(p));
  }, [permissions, isAdminDev]);

  // Override hasAllPermissions for admin_dev
  const hasAllPermissionsWithAdminDev = useCallback((perms: string[]): boolean => {
    if (isAdminDev) return true;
    if (permissions.includes(PERMISSIONS.WILDCARD)) return true;
    return perms.every(p => permissions.includes(p));
  }, [permissions, isAdminDev]);

  // Override hasRole to include admin_dev as having all roles for access purposes
  const hasRoleWithAdminDev = useCallback((roleName: string): boolean => {
    // admin_dev has all role access
    if (isAdminDev) return true;
    return roles.some((role) => role.name.toLowerCase() === roleName.toLowerCase());
  }, [roles, isAdminDev]);

  return {
    roles,
    permissions,
    loading,
    hasRole: hasRoleWithAdminDev,
    hasPermission: hasPermissionWithAdminDev,
    hasAnyPermission: hasAnyPermissionWithAdminDev,
    hasAllPermissions: hasAllPermissionsWithAdminDev,
    isAdmin,
    isAdminDev,
  };
}

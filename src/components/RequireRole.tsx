import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface RequireRoleProps {
  role: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const { hasRole, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <MaterialIcon name="progress_activity" size="sm" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roles = Array.isArray(role) ? role : [role];
  const hasAnyRole = roles.some((r) => hasRole(r));

  if (!hasAnyRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <MaterialIcon name="progress_activity" size="sm" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAnyPermission = permissions.some((p) => hasPermission(p));

  if (!hasAnyPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RequireRoleProps {
  role: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ role, children, fallback }: RequireRoleProps) {
  const { hasRole, roles: userRoles, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requiredRoles = Array.isArray(role) ? role : [role];
  const hasAnyRole = requiredRoles.some((r) => hasRole(r));

  if (!hasAnyRole) {
    if (fallback !== undefined) return <>{fallback}</>;

    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You don’t have permission to view this page.
            </p>
            <div className="text-sm">
              <div className="font-medium">Required role(s):</div>
              <div className="text-muted-foreground">{requiredRoles.join(', ')}</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Your role(s):</div>
              <div className="text-muted-foreground">
                {userRoles.length ? userRoles.map((r) => r.name).join(', ') : 'None'}
              </div>
            </div>
            <Button asChild variant="outline">
              <Link to="/">Return to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
